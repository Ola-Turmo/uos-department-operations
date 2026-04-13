/**
 * ML Knowledge Freshness Scorer
 * Predicts knowledge base staleness before it happens.
 * Uses engagement signals + time to predict when content will go stale.
 */
import { callMiniMaxLLM } from "./nlp-client.js";

export interface KnowledgeAsset {
  id: string;
  title: string;
  lastUpdated: string;
  lastReviewed: string;
  category: string;
  viewCount30d: number;
  helpfulVotes: number;
  unhelpfulVotes: number;
  linkedDocIds: string[];
  tags: string[];
}

export interface FreshnessPrediction {
  assetId: string;
  freshnessScore: number; // 0-1, higher = fresher
  stalenessRisk: "critical" | "high" | "medium" | "low";
  predictedStaleDate: string;
  confidence: number;
  factors: string[];
  refreshRecommendation: string;
  priorityRefresh: number; // 0-100
}

export class MLKnowledgeFreshness {
  /**
   * Score knowledge assets by freshness and predict when they'll go stale.
   */
  async score(asset: KnowledgeAsset): Promise<FreshnessPrediction> {
    const prompt = `Assess the freshness risk of this knowledge base article:

Title: ${asset.title}
Category: ${asset.category}
Last updated: ${asset.lastUpdated}
Last reviewed: ${asset.lastReviewed}
Views (30d): ${asset.viewCount30d}
Helpful votes: ${asset.helpfulVotes}
Unhelpful votes: ${asset.unhelpfulVotes}
Tags: ${asset.tags.join(", ")}

Return JSON:
{
  "freshnessScore": 0.0-1.0 (1=fresh, 0=stale),
  "stalenessRisk": "critical|high|medium|low",
  "predictedStaleDate": "YYYY-MM-DD (when content likely outdated)",
  "confidence": 0.0-1.0,
  "factors": ["reason1", "reason2"],
  "refreshRecommendation": "brief recommendation",
  "priorityRefresh": 0-100 (higher=more urgent)
}`;

    const response = await callMiniMaxLLM({
      prompt,
      system: "You are a knowledge management expert. Assess document freshness risk.",
      maxTokens: 350,
      temperature: 0.3,
    });

    if (!response) return this.ruleBasedScore(asset);

    try {
      const parsed = JSON.parse(response);
      return {
        assetId: asset.id,
        freshnessScore: Math.max(0, Math.min(1, parsed.freshnessScore ?? 0.5)),
        stalenessRisk: (["critical", "high", "medium", "low"].includes(parsed.stalenessRisk)) ? parsed.stalenessRisk : "medium",
        predictedStaleDate: parsed.predictedStaleDate ?? this.addDays(new Date(), 30).toISOString().slice(0, 10),
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
        factors: Array.isArray(parsed.factors) ? parsed.factors : [],
        refreshRecommendation: parsed.refreshRecommendation ?? "Review and update",
        priorityRefresh: Math.max(0, Math.min(100, parsed.priorityRefresh ?? 50)),
      };
    } catch { return this.ruleBasedScore(asset); }
  }

  /**
   * Score multiple assets and return prioritized refresh queue.
   */
  async scoreBatch(assets: KnowledgeAsset[]): Promise<FreshnessPrediction[]> {
    const results = await Promise.all(assets.map(a => this.score(a)));
    return results.sort((a, b) => b.priorityRefresh - a.priorityRefresh);
  }

  private ruleBasedScore(asset: KnowledgeAsset): FreshnessPrediction {
    const daysSinceUpdate = Math.floor((Date.now() - new Date(asset.lastUpdated).getTime()) / 86400000);
    const daysSinceReview = Math.floor((Date.now() - new Date(asset.lastReviewed).getTime()) / 86400000);
    const helpfulRate = asset.helpfulVotes + asset.unhelpfulVotes > 0
      ? asset.helpfulVotes / (asset.helpfulVotes + asset.unhelpfulVotes)
      : 0.5;
    let freshness = 1.0;
    freshness -= Math.min(0.4, daysSinceUpdate / 180); // max 40% decay from age
    freshness -= Math.min(0.3, daysSinceReview / 90); // max 30% from no review
    freshness -= helpfulRate < 0.6 ? 0.2 : 0; // 20% penalty for low helpful rate
    freshness -= asset.viewCount30d < 5 ? 0.1 : 0;
    freshness = Math.max(0, freshness);
    const risk: FreshnessPrediction["stalenessRisk"] = freshness > 0.7 ? "low" : freshness > 0.4 ? "medium" : freshness > 0.2 ? "high" : "critical";
    return {
      assetId: asset.id,
      freshnessScore: freshness,
      stalenessRisk: risk,
      predictedStaleDate: this.addDays(new Date(asset.lastUpdated), Math.round(daysSinceUpdate * 1.5)).toISOString().slice(0, 10),
      confidence: 0.5,
      factors: ["rule-based fallback", `days since update: ${daysSinceUpdate}`],
      refreshRecommendation: freshness < 0.5 ? "Update recommended" : "Content adequate",
      priorityRefresh: Math.round((1 - freshness) * 100),
    };
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86400000);
  }
}
