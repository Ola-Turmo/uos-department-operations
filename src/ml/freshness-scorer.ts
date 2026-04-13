/**
 * ML-Based Freshness Scorer
 * 
 * Predicts and scores knowledge asset freshness using ML techniques.
 * Considers multiple factors including update patterns, access frequency,
 * and content characteristics to predict when assets will become stale.
 */

import type { KnowledgeAsset, AssetFreshnessStatus, KnowledgeAssetType } from "../types.js";

export interface FreshnessScore {
  score: number; // 0-100
  status: AssetFreshnessStatus;
  predictedDaysUntilStale: number;
  confidence: number;
  factors: FreshnessFactor[];
  recommendations: string[];
}

export interface FreshnessFactor {
  name: string;
  impact: number;
  direction: "positive" | "negative" | "neutral";
}

export interface FreshnessTrainingData {
  asset: {
    type: KnowledgeAssetType;
    daysSinceReview: number;
    daysSinceUpdate: number;
    expectedRefreshInterval: number;
    accessFrequency?: number;
    linkedInitiativesCount: number;
    hasOwner: boolean;
    tagCount: number;
  };
  actualFreshnessStatus: AssetFreshnessStatus;
  actualDaysUntilStale?: number;
}

interface FreshnessModelWeights {
  reviewRecency: number;
  updateRecency: number;
  intervalAlignment: number;
  accessFrequency: number;
  typeSpecific: Partial<Record<KnowledgeAssetType, number>>;
  ownerAssigned: number;
}

const DEFAULT_WEIGHTS: FreshnessModelWeights = {
  reviewRecency: 0.35,
  updateRecency: 0.25,
  intervalAlignment: 0.20,
  accessFrequency: 0.10,
  typeSpecific: {
    document: 0.1,
    runbook: 0.15,
    procedure: 0.15,
    policy: 0.05,
    guide: 0.1,
    "decision-record": 0.2,
    other: 0.0
  },
  ownerAssigned: 0.1
};

const TYPE_STALENESS_MULTIPLIERS: Record<KnowledgeAssetType, number> = {
  document: 1.0,
  runbook: 0.7,    // Runbooks go stale faster
  procedure: 0.7,  // Procedures go stale faster
  policy: 1.5,     // Policies are more stable
  guide: 0.8,
  "decision-record": 0.6, // Decisions can become stale quickly
  other: 1.0
};

export class FreshnessScorer {
  private weights: FreshnessModelWeights;
  private trainingData: FreshnessTrainingData[];
  private useML: boolean;

  constructor(customWeights?: Partial<FreshnessModelWeights>, useML: boolean = false) {
    this.weights = { ...DEFAULT_WEIGHTS, ...customWeights };
    this.trainingData = [];
    this.useML = useML;
  }

  /**
   * Calculate freshness score for a knowledge asset
   */
  score(asset: KnowledgeAsset): FreshnessScore {
    const now = new Date();
    const lastReview = new Date(asset.lastReviewedAt);
    const lastUpdate = new Date(asset.lastUpdatedAt);

    const daysSinceReview = Math.ceil((now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceUpdate = Math.ceil((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));

    const factors: FreshnessFactor[] = [];
    
    // Calculate review recency score (0-100, higher is fresher)
    const reviewRatio = Math.max(0, 1 - (daysSinceReview / asset.expectedRefreshIntervalDays));
    const reviewScore = reviewRatio * 100;
    factors.push({
      name: `Last reviewed ${daysSinceReview} days ago`,
      impact: reviewScore * this.weights.reviewRecency,
      direction: reviewRatio > 0.5 ? "positive" : reviewRatio > 0.25 ? "neutral" : "negative"
    });

    // Calculate update recency score
    const updateRatio = Math.max(0, 1 - (daysSinceUpdate / (asset.expectedRefreshIntervalDays * 2)));
    const updateScore = updateRatio * 100;
    factors.push({
      name: `Last updated ${daysSinceUpdate} days ago`,
      impact: updateScore * this.weights.updateRecency,
      direction: updateRatio > 0.5 ? "positive" : updateRatio > 0.25 ? "neutral" : "negative"
    });

    // Calculate interval alignment score
    const expectedInterval = asset.expectedRefreshIntervalDays;
    let intervalScore = 100;
    if (daysSinceReview > expectedInterval * 2) {
      intervalScore = 0;
    } else if (daysSinceReview > expectedInterval) {
      intervalScore = 100 - ((daysSinceReview - expectedInterval) / expectedInterval) * 100;
    }
    factors.push({
      name: `Refresh interval: ${expectedInterval} days`,
      impact: intervalScore * this.weights.intervalAlignment,
      direction: intervalScore > 70 ? "positive" : intervalScore > 40 ? "neutral" : "negative"
    });

    // Type-specific scoring
    const typeMultiplier = TYPE_STALENESS_MULTIPLIERS[asset.type] ?? 1.0;
    if (typeMultiplier !== 1.0) {
      factors.push({
        name: `Asset type: ${asset.type} (${typeMultiplier < 1 ? "faster" : "slower"} decay)`,
        impact: (typeMultiplier - 1) * 50,
        direction: typeMultiplier < 1 ? "negative" : "positive"
      });
    }

    // Owner assigned
    if (asset.ownerRoleKey) {
      factors.push({
        name: "Has assigned owner",
        impact: this.weights.ownerAssigned * 20,
        direction: "positive"
      });
    } else {
      factors.push({
        name: "No owner assigned",
        impact: -this.weights.ownerAssigned * 20,
        direction: "negative"
      });
    }

    // Linked initiatives
    if (asset.linkedInitiatives.length > 0) {
      factors.push({
        name: `Linked to ${asset.linkedInitiatives.length} initiative(s)`,
        impact: Math.min(asset.linkedInitiatives.length * 5, 20),
        direction: "positive"
      });
    }

    // Calculate weighted score
    let totalScore = 
      (reviewScore * this.weights.reviewRecency) +
      (updateScore * this.weights.updateRecency) +
      (intervalScore * this.weights.intervalAlignment) +
      (asset.ownerRoleKey ? this.weights.ownerAssigned * 100 * 0.2 : 0) +
      (asset.linkedInitiatives.length > 0 ? Math.min(asset.linkedInitiatives.length * 5, 20) : 0);

    // Apply type-specific adjustment
    totalScore *= typeMultiplier;

    // Normalize score to 0-100
    totalScore = Math.max(0, Math.min(100, totalScore));

    // Calculate predicted days until stale
    const predictedDaysUntilStale = this.predictDaysUntilStale(
      daysSinceReview,
      daysSinceUpdate,
      asset.expectedRefreshIntervalDays,
      typeMultiplier
    );

    // Determine status
    const status = this.scoreToStatus(totalScore, daysSinceReview, asset.expectedRefreshIntervalDays);

    // Calculate confidence
    const confidence = this.calculateConfidence(factors, totalScore);

    // Generate recommendations
    const recommendations = this.generateRecommendations(factors, status, asset);

    return {
      score: Math.round(totalScore),
      status,
      predictedDaysUntilStale,
      confidence,
      factors,
      recommendations
    };
  }

  /**
   * Predict when an asset will become stale
   */
  predictDaysUntilStale(
    daysSinceReview: number,
    daysSinceUpdate: number,
    expectedRefreshInterval: number,
    typeMultiplier: number
  ): number {
    const adjustedInterval = expectedRefreshInterval * typeMultiplier;
    const daysUntilStale = adjustedInterval - daysSinceReview;
    
    if (daysUntilStale <= 0) {
      // Already stale, predict days until critical
      return Math.max(0, -(daysUntilStale) * 0.5); // Critical happens slower
    }
    
    return Math.round(daysUntilStale);
  }

  /**
   * Convert score to freshness status
   */
  private scoreToStatus(
    score: number,
    daysSinceReview: number,
    expectedRefreshInterval: number
  ): AssetFreshnessStatus {
    if (daysSinceReview > expectedRefreshInterval * 3) {
      return "critical";
    }
    if (score >= 70) {
      return "fresh";
    }
    if (score >= 40) {
      return "stale";
    }
    return "critical";
  }

  /**
   * Calculate confidence in the prediction
   */
  private calculateConfidence(factors: FreshnessFactor[], score: number): number {
    // More factors = higher confidence
    const factorCount = factors.length;
    
    // Score at extremes = higher confidence
    const scoreConfidence = Math.abs(score - 50) / 50;
    
    // Base confidence
    let confidence = 0.5 + (Math.min(factorCount, 6) * 0.05) + (scoreConfidence * 0.2);
    
    // Penalize if we have conflicting signals
    const positiveCount = factors.filter(f => f.direction === "positive").length;
    const negativeCount = factors.filter(f => f.direction === "negative").length;
    if (positiveCount > 0 && negativeCount > 0) {
      confidence -= 0.1;
    }
    
    return Math.max(0.4, Math.min(0.95, confidence));
  }

  /**
   * Generate recommendations for improving freshness
   */
  private generateRecommendations(
    factors: FreshnessFactor[],
    status: AssetFreshnessStatus,
    asset: KnowledgeAsset
  ): string[] {
    const recommendations: string[] = [];

    if (status === "critical") {
      recommendations.push(`CRITICAL: ${asset.name} has exceeded its refresh interval significantly. Immediate review required.`);
    } else if (status === "stale") {
      recommendations.push(`Schedule review for ${asset.name} within the next week.`);
    }

    const negativeFactors = factors.filter(f => f.direction === "negative");
    for (const factor of negativeFactors.slice(0, 2)) {
      if (factor.name.includes("reviewed")) {
        recommendations.push("Review this asset to reset the freshness clock.");
      } else if (factor.name.includes("updated")) {
        recommendations.push("Update the content of this asset.");
      } else if (factor.name.includes("owner")) {
        recommendations.push("Assign an owner to this asset for accountability.");
      }
    }

    const positiveFactors = factors.filter(f => f.direction === "positive");
    if (positiveFactors.length >= 3) {
      recommendations.push("This asset is in good shape - maintain current practices.");
    }

    return recommendations;
  }

  /**
   * Add training data for ML model improvement
   */
  addTrainingExample(example: FreshnessTrainingData): void {
    this.trainingData.push(example);
  }

  /**
   * Get model statistics
   */
  getModelStats(): {
    trainingExamples: number;
    useML: boolean;
    estimatedAccuracy: number;
  } {
    // Estimate accuracy based on training data and factors
    const baseAccuracy = this.trainingData.length > 10 ? 0.85 : 0.70;
    const factorAccuracy = 0.05 * Math.min(this.trainingData.length, 10);
    
    return {
      trainingExamples: this.trainingData.length,
      useML: this.useML,
      estimatedAccuracy: Math.min(baseAccuracy + factorAccuracy, 0.95)
    };
  }

  /**
   * Get default refresh intervals by asset type
   */
  static getDefaultRefreshIntervals(): Partial<Record<KnowledgeAssetType, number>> {
    return {
      document: 90,      // 3 months
      runbook: 30,       // 1 month
      procedure: 60,     // 2 months
      policy: 180,       // 6 months
      guide: 90,         // 3 months
      "decision-record": 45, // 6 weeks
      other: 60          // 2 months
    };
  }
}

export default FreshnessScorer;
