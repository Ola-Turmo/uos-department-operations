/**
 * ML-Based Priority Predictor
 * 
 * Uses historical patterns and feature analysis to predict the appropriate
 * priority for actions based on their characteristics and context.
 * Implements a simple rule-based ML model that can be enhanced with
 * more sophisticated ML techniques.
 */

import type { OwnedAction, ActionPriority } from "../types.js";

export interface PriorityPrediction {
  predictedPriority: ActionPriority;
  confidence: number;
  factors: PriorityFactor[];
  reasoning: string;
}

export interface PriorityFactor {
  name: string;
  contribution: number;
  direction: "increases" | "decreases";
}

export interface PriorityTrainingExample {
  action: {
    title: string;
    description: string;
    sourceInputType?: string;
    hasDueDate: boolean;
    dueDateDaysFromNow?: number;
    hasOwner: boolean;
    linkedInitiativesCount: number;
    linkedProjectsCount: number;
    tagsCount: number;
  };
  actualPriority: ActionPriority;
}

const PRIORITY_SCORE_WEIGHTS = {
  // Title factors
  urgentKeywords: { weight: 2.0, keywords: ["urgent", "asap", "critical", "emergency", "immediately"] },
  highPriorityKeywords: { weight: 1.5, keywords: ["important", "high priority", "key", "essential"] },
  
  // Source type factors
  sourceType: {
    meeting: 0.5,
    document: 0.3,
    email: 0.4,
    ticket: 0.6,
    task: 0.7,
    other: 0.0
  },
  
  // Time factors
  dueDateProximity: {
    critical: { maxDays: 1, weight: 3.0 },
    high: { maxDays: 3, weight: 2.0 },
    medium: { maxDays: 7, weight: 1.0 },
    low: { maxDays: 14, weight: 0.5 }
  },
  
  // Link factors
  linkedInitiatives: { weight: 0.3, threshold: 2 },
  linkedProjects: { weight: 0.2, threshold: 2 },
  
  // Ownership factors
  hasOwner: { weight: -0.5 },
  noOwner: { weight: 0.8 },
  
  // Tag complexity
  tags: { weight: 0.1, perTag: 0.1 }
};

export class PriorityPredictor {
  private trainingExamples: PriorityTrainingExample[] = [];
  private useML: boolean;

  constructor(useML: boolean = false) {
    this.useML = useML;
  }

  /**
   * Predict priority for a new action based on its characteristics
   */
  predict(params: {
    title: string;
    description: string;
    sourceInputType?: string;
    dueDate?: string;
    ownerRoleKey?: string;
    linkedInitiatives?: string[];
    linkedProjects?: string[];
    tags?: string[];
  }): PriorityPrediction {
    const factors: PriorityFactor[] = [];
    let baseScore = 50; // Neutral starting point

    const titleLower = params.title.toLowerCase();
    const descLower = params.description.toLowerCase();
    const combinedText = `${titleLower} ${descLower}`;

    // Check for urgent keywords
    for (const keyword of PRIORITY_SCORE_WEIGHTS.urgentKeywords.keywords) {
      if (combinedText.includes(keyword)) {
        baseScore += PRIORITY_SCORE_WEIGHTS.urgentKeywords.weight;
        factors.push({
          name: `Contains urgent keyword: "${keyword}"`,
          contribution: PRIORITY_SCORE_WEIGHTS.urgentKeywords.weight,
          direction: "increases"
        });
      }
    }

    // Check for high priority keywords
    for (const keyword of PRIORITY_SCORE_WEIGHTS.highPriorityKeywords.keywords) {
      if (combinedText.includes(keyword)) {
        baseScore += PRIORITY_SCORE_WEIGHTS.highPriorityKeywords.weight;
        factors.push({
          name: `Contains high-priority keyword: "${keyword}"`,
          contribution: PRIORITY_SCORE_WEIGHTS.highPriorityKeywords.weight,
          direction: "increases"
        });
      }
    }

    // Source type influence
    if (params.sourceInputType) {
      const sourceWeight = (PRIORITY_SCORE_WEIGHTS.sourceType as Record<string, number>)[params.sourceInputType] ?? 0;
      baseScore += sourceWeight;
      factors.push({
        name: `Source type: ${params.sourceInputType}`,
        contribution: sourceWeight,
        direction: sourceWeight > 0 ? "increases" : "decreases" as const
      });
    }

    // Due date proximity
    if (params.dueDate) {
      const dueDate = new Date(params.dueDate);
      const now = new Date();
      const daysFromNow = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysFromNow <= 0) {
        // Overdue
        baseScore += 3.0;
        factors.push({
          name: `Due date is overdue by ${Math.abs(daysFromNow)} days`,
          contribution: 3.0,
          direction: "increases"
        });
      } else if (daysFromNow <= 1) {
        baseScore += 3.0;
        factors.push({ name: "Due within 1 day", contribution: 3.0, direction: "increases" });
      } else if (daysFromNow <= 3) {
        baseScore += 2.0;
        factors.push({ name: "Due within 3 days", contribution: 2.0, direction: "increases" });
      } else if (daysFromNow <= 7) {
        baseScore += 1.0;
        factors.push({ name: "Due within 7 days", contribution: 1.0, direction: "increases" });
      } else if (daysFromNow <= 14) {
        baseScore += 0.5;
        factors.push({ name: "Due within 14 days", contribution: 0.5, direction: "increases" });
      }
    }

    // Linked initiatives
    const initiativesCount = params.linkedInitiatives?.length ?? 0;
    if (initiativesCount >= 2) {
      baseScore += PRIORITY_SCORE_WEIGHTS.linkedInitiatives.weight;
      factors.push({
        name: `Linked to ${initiativesCount} initiatives`,
        contribution: PRIORITY_SCORE_WEIGHTS.linkedInitiatives.weight,
        direction: "increases"
      });
    }

    // Linked projects
    const projectsCount = params.linkedProjects?.length ?? 0;
    if (projectsCount >= 2) {
      baseScore += PRIORITY_SCORE_WEIGHTS.linkedProjects.weight;
      factors.push({
        name: `Linked to ${projectsCount} projects`,
        contribution: PRIORITY_SCORE_WEIGHTS.linkedProjects.weight,
        direction: "increases"
      });
    }

    // Ownership
    if (params.ownerRoleKey) {
      baseScore += PRIORITY_SCORE_WEIGHTS.hasOwner.weight;
      factors.push({
        name: "Has assigned owner",
        contribution: Math.abs(PRIORITY_SCORE_WEIGHTS.hasOwner.weight),
        direction: "decreases"
      });
    } else {
      baseScore += PRIORITY_SCORE_WEIGHTS.noOwner.weight;
      factors.push({
        name: "No owner assigned",
        contribution: PRIORITY_SCORE_WEIGHTS.noOwner.weight,
        direction: "increases"
      });
    }

    // Tags
    const tagsCount = params.tags?.length ?? 0;
    if (tagsCount > 0) {
      const tagContribution = Math.min(tagsCount * PRIORITY_SCORE_WEIGHTS.tags.perTag, 1.0);
      baseScore += tagContribution;
      factors.push({
        name: `${tagsCount} tag${tagsCount > 1 ? "s" : ""}`,
        contribution: tagContribution,
        direction: "increases"
      });
    }

    // Convert score to priority
    const predictedPriority = this.scoreToPriority(baseScore);
    const confidence = this.calculateConfidence(factors, baseScore);

    return {
      predictedPriority,
      confidence,
      factors,
      reasoning: this.generateReasoning(factors, predictedPriority, baseScore)
    };
  }

  /**
   * Predict priority for an existing action
   */
  predictFromAction(action: OwnedAction): PriorityPrediction {
    return this.predict({
      title: action.title,
      description: action.description,
      sourceInputType: action.sourceInputType,
      dueDate: action.dueDate,
      ownerRoleKey: action.ownerRoleKey,
      linkedInitiatives: action.linkedInitiatives,
      linkedProjects: action.linkedProjects,
      tags: action.tags,
    });
  }

  /**
   * Retrain the model with historical examples
   */
  addTrainingExample(example: PriorityTrainingExample): void {
    this.trainingExamples.push(example);
    
    // If we have enough examples, we could retrain
    if (this.trainingExamples.length >= 10 && !this.useML) {
      console.log(`PriorityPredictor: ${this.trainingExamples.length} training examples accumulated. Consider enabling ML mode.`);
    }
  }

  /**
   * Add multiple training examples
   */
  addTrainingExamples(examples: PriorityTrainingExample[]): void {
    for (const example of examples) {
      this.addTrainingExample(example);
    }
  }

  /**
   * Get model performance metrics
   */
  getModelMetrics(): {
    trainingExamples: number;
    useML: boolean;
    averageConfidence: number;
  } {
    return {
      trainingExamples: this.trainingExamples.length,
      useML: this.useML,
      averageConfidence: 0.75 // Placeholder
    };
  }

  /**
   * Convert numeric score to priority
   */
  private scoreToPriority(score: number): ActionPriority {
    if (score >= 80) return "critical";
    if (score >= 60) return "high";
    if (score >= 40) return "medium";
    return "low";
  }

  /**
   * Calculate prediction confidence based on factors
   */
  private calculateConfidence(factors: PriorityFactor[], baseScore: number): number {
    if (factors.length === 0) return 0.3;
    
    // More factors = higher confidence
    const factorCount = Math.min(factors.length / 3, 1.0);
    
    // Strong signals (high contribution) increase confidence
    const strongSignals = factors.filter(f => f.contribution >= 1.5).length;
    const strongSignalBonus = Math.min(strongSignals * 0.1, 0.3);
    
    // Confidence is higher when score is at extremes
    const scoreConfidence = Math.abs(baseScore - 50) / 50;
    
    const confidence = 0.4 + (factorCount * 0.2) + strongSignalBonus + (scoreConfidence * 0.2);
    return Math.max(0.3, Math.min(0.95, confidence));
  }

  /**
   * Generate reasoning text for the prediction
   */
  private generateReasoning(factors: PriorityFactor[], priority: ActionPriority, score: number): string {
    const increasingFactors = factors.filter(f => f.direction === "increases");
    const decreasingFactors = factors.filter(f => f.direction === "decreases");

    const topFactors = [...increasingFactors, ...decreasingFactors]
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3);

    if (topFactors.length === 0) {
      return `Predicted ${priority} priority based on neutral scoring (${score.toFixed(1)}).`;
    }

    const factorDescriptions = topFactors.map(f => 
      `${f.direction === "increases" ? "+" : "-"}${f.contribution.toFixed(1)}: ${f.name}`
    );

    return `Predicted ${priority} priority (score: ${score.toFixed(1)}). Key factors: ${factorDescriptions.join("; ")}.`;
  }
}

export default PriorityPredictor;
