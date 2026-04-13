/**
 * LLM-Powered Bottleneck Analyzer
 * 
 * Analyzes operational data to identify, characterize, and recommend solutions
 * for bottlenecks in planning, execution, and knowledge management workflows.
 * Uses LLM to provide deeper insight beyond rule-based detection.
 */

import type {
  OwnedAction,
  KnowledgeAsset,
  RefreshTask,
  BottleneckReport,
  BottleneckSeverity,
  PlanningCycle,
} from "../types.js";

export interface LLMClient {
  complete(prompt: string): Promise<string>;
}

export interface BottleneckAnalysis {
  type: BottleneckAnalysisType;
  description: string;
  affectedItems: string[];
  severity: BottleneckSeverity;
  rootCauses: string[];
  recommendations: string[];
  estimatedImpact: string;
  confidence: number;
}

export type BottleneckAnalysisType = 
  | "action-overload"
  | "ownership-gap"
  | "dependency-block"
  | "knowledge-staleness"
  | "cycle-frequency"
  | "resource-contention"
  | "unknown";

export interface ActionFlowMetrics {
  actionId: string;
  title: string;
  statusChanges: number;
  totalDaysOpen: number;
  timeInEachStatus: Record<string, number>;
  blockerCount: number;
}

export interface BottleneckDetectionInput {
  actions: OwnedAction[];
  assets: KnowledgeAsset[];
  refreshTasks: RefreshTask[];
  cycles: PlanningCycle[];
}

export class LLMBottleneckAnalyzer {
  private llmClient: LLMClient | null;

  constructor(llmClient?: LLMClient) {
    this.llmClient = llmClient ?? null;
  }

  /**
   * Analyze actions to detect flow bottlenecks
   */
  async analyzeActionBottlenecks(actions: OwnedAction[]): Promise<BottleneckAnalysis[]> {
    const analyses: BottleneckAnalysis[] = [];
    
    // Detect action overload
    const actionOverload = this.detectActionOverload(actions);
    if (actionOverload) {
      analyses.push(actionOverload);
    }

    // Detect ownership gaps
    const ownershipGap = this.detectOwnershipGap(actions);
    if (ownershipGap) {
      analyses.push(ownershipGap);
    }

    // Detect dependency blocks
    const dependencyBlock = this.detectDependencyBlocks(actions);
    if (dependencyBlock) {
      analyses.push(dependencyBlock);
    }

    // Use LLM for deeper analysis if available
    if (this.llmClient && analyses.length > 0) {
      return this.enhanceAnalysisWithLLM(analyses, actions);
    }

    return analyses;
  }

  /**
   * Detect action overload on specific roles or the system
   */
  private detectActionOverload(actions: OwnedAction[]): BottleneckAnalysis | null {
    const openActions = actions.filter(a => !["completed", "cancelled", "deferred"].includes(a.status));
    
    if (openActions.length < 10) return null;

    const ownerCounts: Record<string, number> = {};
    for (const action of openActions) {
      const owner = action.ownerRoleKey || "unassigned";
      ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
    }

    const maxOwner = Object.entries(ownerCounts).reduce(
      (max, [owner, count]) => (count > max[1] ? [owner, count] : max),
      ["", 0]
    );

    if (maxOwner[1] >= 5) {
      return {
        type: "action-overload",
        description: `${maxOwner[1]} open actions assigned to ${maxOwner[0]}, indicating potential overload`,
        affectedItems: openActions.filter(a => (a.ownerRoleKey || "unassigned") === maxOwner[0]).map(a => a.id),
        severity: maxOwner[1] >= 10 ? "critical" : maxOwner[1] >= 7 ? "significant" : "moderate",
        rootCauses: [
          `High concentration of work (${maxOwner[1]} actions) assigned to single role`,
          "May indicate insufficient delegation or resource constraints"
        ],
        recommendations: [
          "Redistribute actions to other team members",
          "Evaluate if some actions can be deferred or cancelled",
          "Consider adding additional resources for overloaded role"
        ],
        estimatedImpact: `${maxOwner[1]} actions may be delayed due to overload`,
        confidence: 0.85,
      };
    }

    return null;
  }

  /**
   * Detect ownership gaps (unassigned or under-assigned critical actions)
   */
  private detectOwnershipGap(actions: OwnedAction[]): BottleneckAnalysis | null {
    const openActions = actions.filter(a => !["completed", "cancelled", "deferred"].includes(a.status));
    const unassigned = openActions.filter(a => !a.ownerRoleKey);
    const criticalUnassigned = unassigned.filter(a => a.priority === "critical" || a.priority === "high");

    if (criticalUnassigned.length > 0) {
      return {
        type: "ownership-gap",
        description: `${criticalUnassigned.length} high/critical priority actions without assigned owners`,
        affectedItems: criticalUnassigned.map(a => a.id),
        severity: criticalUnassigned.length >= 3 ? "critical" : "significant",
        rootCauses: [
          "Critical actions created without owner assignment",
          "Potential ambiguity in responsibility",
          "May indicate rapid planning without proper ownership assignment"
        ],
        recommendations: [
          "Assign owners to all critical actions immediately",
          "Implement ownership assignment as mandatory step in action creation",
          "Review planning process to ensure owner assignment"
        ],
        estimatedImpact: `${criticalUnassigned.length} critical actions may not be worked on`,
        confidence: 0.9,
      };
    }

    return null;
  }

  /**
   * Detect dependency blocks (actions blocked by other actions)
   */
  private detectDependencyBlocks(actions: OwnedAction[]): BottleneckAnalysis | null {
    const blockedActions = actions.filter(a => a.status === "blocked");
    
    if (blockedActions.length === 0) return null;

    const highPriorityBlocked = blockedActions.filter(a => 
      a.priority === "critical" || a.priority === "high"
    );

    return {
      type: "dependency-block",
      description: `${blockedActions.length} actions blocked${highPriorityBlocked.length > 0 ? `, including ${highPriorityBlocked.length} high/critical priority` : ""}`,
      affectedItems: blockedActions.map(a => a.id),
      severity: highPriorityBlocked.length > 0 ? "critical" : "moderate",
      rootCauses: blockedActions.map(a => a.blockedReason || "Unknown blocker").filter(Boolean) as string[],
      recommendations: [
        "Investigate and resolve blockers for critical actions first",
        "Document dependency chains to understand impact",
        "Escalate persistent blockers that cannot be resolved at team level"
      ],
      estimatedImpact: `${blockedActions.length} actions delayed pending blocker resolution`,
      confidence: 0.8,
    };
  }

  /**
   * Analyze knowledge asset staleness patterns
   */
  async analyzeKnowledgeBottlenecks(assets: KnowledgeAsset[]): Promise<BottleneckAnalysis[]> {
    const staleAssets = assets.filter(a => 
      a.currentFreshnessStatus === "stale" || a.currentFreshnessStatus === "critical"
    );
    
    const analyses: BottleneckAnalysis[] = [];

    if (staleAssets.length === 0) return analyses;

    // Group stale assets by type
    const staleByType: Record<string, KnowledgeAsset[]> = {};
    for (const asset of staleAssets) {
      if (!staleByType[asset.type]) staleByType[asset.type] = [];
      staleByType[asset.type].push(asset);
    }

    // Find most problematic asset types
    for (const [type, typeAssets] of Object.entries(staleByType)) {
      if (typeAssets.length >= 3) {
        const critical = typeAssets.filter(a => a.currentFreshnessStatus === "critical").length;
        analyses.push({
          type: "knowledge-staleness",
          description: `${typeAssets.length} ${type} assets are stale${critical > 0 ? `, ${critical} critical` : ""}`,
          affectedItems: typeAssets.map(a => a.id),
          severity: critical > 0 ? "significant" : "moderate",
          rootCauses: [
            `Multiple ${type} assets have exceeded refresh intervals`,
            "May indicate process gaps in knowledge management"
          ],
          recommendations: [
            `Prioritize refresh for ${type} assets with critical status`,
            "Review and update refresh intervals if they are unrealistic",
            "Implement automated refresh reminders"
          ],
          estimatedImpact: `Decision quality may be impacted for ${type} related processes`,
          confidence: 0.75,
        });
      }
    }

    if (this.llmClient && staleAssets.length > 0) {
      return this.enhanceKnowledgeAnalysisWithLLM(analyses, staleAssets);
    }

    return analyses;
  }

  /**
   * Calculate action flow metrics for bottleneck analysis
   */
  calculateActionFlowMetrics(actions: OwnedAction[]): ActionFlowMetrics[] {
    const metrics: ActionFlowMetrics[] = [];

    for (const action of actions) {
      const statusChanges: Record<string, number> = {};
      let currentDays = 0;
      
      if (action.createdAt) {
        const created = new Date(action.createdAt);
        const updated = action.updatedAt ? new Date(action.updatedAt) : new Date();
        currentDays = Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }

      metrics.push({
        actionId: action.id,
        title: action.title,
        statusChanges: action.checkInNotes.length,
        totalDaysOpen: currentDays,
        timeInEachStatus: statusChanges,
        blockerCount: action.status === "blocked" ? 1 : 0,
      });
    }

    return metrics;
  }

  /**
   * Analyze planning cycle efficiency
   */
  async analyzeCycleEfficiency(cycles: PlanningCycle[], actions: OwnedAction[]): Promise<BottleneckAnalysis[]> {
    const analyses: BottleneckAnalysis[] = [];

    const completedCycles = cycles.filter(c => c.status === "completed");
    if (completedCycles.length < 2) return analyses;

    // Calculate average cycle completion rate
    let totalActions = 0;
    let completedActions = 0;
    
    for (const cycle of completedCycles) {
      const cycleActions = actions.filter(a => cycle.generatedActionIds.includes(a.id));
      totalActions += cycleActions.length;
      completedActions += cycleActions.filter(a => a.status === "completed").length;
    }

    const completionRate = totalActions > 0 ? completedActions / totalActions : 1;

    if (completionRate < 0.7) {
      analyses.push({
        type: "cycle-frequency",
        description: `Planning cycle action completion rate is ${(completionRate * 100).toFixed(0)}%, below 70% threshold`,
        affectedItems: completedCycles.map(c => c.id),
        severity: completionRate < 0.5 ? "critical" : "significant",
        rootCauses: [
          "Actions generated in planning may not be achievable",
          "Planning may be too ambitious or resources insufficient",
          "Follow-through mechanisms may be weak"
        ],
        recommendations: [
          "Review planning assumptions with actual capacity",
          "Implement action tracking during cycle execution",
          "Reduce action scope while increasing specificity"
        ],
        estimatedImpact: `${((1 - completionRate) * 100).toFixed(0)}% of planned work may not be completed`,
        confidence: 0.7,
      });
    }

    if (this.llmClient) {
      return this.enhanceCycleAnalysisWithLLM(analyses, cycles, actions);
    }

    return analyses;
  }

  /**
   * Generate comprehensive bottleneck report
   */
  async generateBottleneckReport(input: BottleneckDetectionInput): Promise<BottleneckReport | null> {
    const analyses: BottleneckAnalysis[] = [];

    const actionAnalyses = await this.analyzeActionBottlenecks(input.actions);
    analyses.push(...actionAnalyses);

    const knowledgeAnalyses = await this.analyzeKnowledgeBottlenecks(input.assets);
    analyses.push(...knowledgeAnalyses);

    const cycleAnalyses = await this.analyzeCycleEfficiency(input.cycles, input.actions);
    analyses.push(...cycleAnalyses);

    if (analyses.length === 0) return null;

    // Determine overall severity
    const severities: BottleneckSeverity[] = analyses.map(a => a.severity);
    let overallSeverity: BottleneckSeverity = "minor";
    if (severities.includes("critical")) overallSeverity = "critical";
    else if (severities.includes("significant")) overallSeverity = "significant";
    else if (severities.includes("moderate")) overallSeverity = "moderate";

    const allAffectedActions = analyses.flatMap(a => 
      a.affectedItems.filter(id => input.actions.some(ac => ac.id === id))
    );
    const allAffectedAssets = analyses.flatMap(a => 
      a.affectedItems.filter(id => input.assets.some(as => as.id === id))
    );

    const allRecommendations = [...new Set(analyses.flatMap(a => a.recommendations))];

    return {
      id: `bottleneck-${Date.now()}`,
      name: `Operations Bottleneck Analysis: ${new Date().toLocaleDateString()}`,
      description: `Identified ${analyses.length} bottleneck${analyses.length > 1 ? "s" : ""}: ${analyses.map(a => a.type).join(", ")}`,
      severity: overallSeverity,
      affectedProcesses: [...new Set(analyses.map(a => a.type))],
      affectedAssetIds: [...new Set(allAffectedAssets)],
      affectedActionIds: [...new Set(allAffectedActions)],
      metrics: [
        {
          name: "Actions with Bottlenecks",
          value: allAffectedActions.length,
          threshold: 5,
          direction: "above"
        },
        {
          name: "Knowledge Assets Affected",
          value: allAffectedAssets.length,
          threshold: 3,
          direction: "above"
        }
      ],
      recommendations: allRecommendations,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Enhance analysis with LLM
   */
  private async enhanceAnalysisWithLLM(
    analyses: BottleneckAnalysis[],
    actions: OwnedAction[]
  ): Promise<BottleneckAnalysis[]> {
    if (!this.llmClient) return analyses;

    const actionsJson = JSON.stringify(actions.slice(0, 20).map(a => ({
      id: a.id,
      title: a.title,
      status: a.status,
      priority: a.priority,
      ownerRoleKey: a.ownerRoleKey
    })));

    const analysesJson = JSON.stringify(analyses);

    const prompt = `Analyze these bottleneck detections and provide enhanced insights.

BOTTLENECKS DETECTED:
${analysesJson}

RELATED ACTIONS (sample):
${actionsJson}

For each bottleneck, provide additional insights as JSON:
{
  "enhancedAnalysis": [
    {
      "originalType": "action-overload",
      "additionalRootCauses": ["additional cause 1"],
      "refinedRecommendations": ["refined recommendation"],
      "confidence": 0.9
    }
  ]
}`;

    try {
      const response = await this.llmClient.complete(prompt);
      const parsed = JSON.parse(response);
      
      if (parsed.enhancedAnalysis) {
        for (const enhanced of parsed.enhancedAnalysis) {
          const original = analyses.find(a => a.type === enhanced.originalType);
          if (original) {
            original.rootCauses = [...original.rootCauses, ...(enhanced.additionalRootCauses || [])];
            original.recommendations = enhanced.refinedRecommendations || original.recommendations;
            original.confidence = enhanced.confidence ?? original.confidence;
          }
        }
      }
    } catch (error) {
      console.warn("LLM enhancement failed:", error);
    }

    return analyses;
  }

  /**
   * Enhance knowledge bottleneck analysis with LLM
   */
  private async enhanceKnowledgeAnalysisWithLLM(
    analyses: BottleneckAnalysis[],
    staleAssets: KnowledgeAsset[]
  ): Promise<BottleneckAnalysis[]> {
    if (!this.llmClient) return analyses;

    const assetsJson = JSON.stringify(staleAssets.slice(0, 10).map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      freshnessStatus: a.currentFreshnessStatus,
      lastReviewedAt: a.lastReviewedAt
    })));

    const prompt = `Analyze knowledge asset staleness patterns and provide recommendations.

STALE ASSETS:
${assetsJson}

Provide refined analysis as JSON:
{
  "patterns": ["pattern 1", "pattern 2"],
  "strategicRecommendations": ["recommendation 1"]
}`;

    try {
      const response = await this.llmClient.complete(prompt);
      const parsed = JSON.parse(response);
      
      if (parsed.patterns && parsed.strategicRecommendations) {
        for (const analysis of analyses) {
          analysis.rootCauses.push(...parsed.patterns);
          analysis.recommendations.push(...parsed.strategicRecommendations);
        }
      }
    } catch (error) {
      console.warn("LLM knowledge analysis enhancement failed:", error);
    }

    return analyses;
  }

  /**
   * Enhance cycle efficiency analysis with LLM
   */
  private async enhanceCycleAnalysisWithLLM(
    analyses: BottleneckAnalysis[],
    cycles: PlanningCycle[],
    actions: OwnedAction[]
  ): Promise<BottleneckAnalysis[]> {
    if (!this.llmClient) return analyses;

    const cyclesJson = JSON.stringify(cycles.slice(0, 5).map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      generatedActionIds: c.generatedActionIds.length
    })));

    const prompt = `Analyze planning cycle patterns and provide improvement recommendations.

CYCLES:
${cyclesJson}

Provide strategic recommendations as JSON:
{
  "strategicRecommendations": ["recommendation 1", "recommendation 2"]
}`;

    try {
      const response = await this.llmClient.complete(prompt);
      const parsed = JSON.parse(response);
      
      if (parsed.strategicRecommendations) {
        for (const analysis of analyses) {
          analysis.recommendations.push(...parsed.strategicRecommendations);
        }
      }
    } catch (error) {
      console.warn("LLM cycle analysis enhancement failed:", error);
    }

    return analyses;
  }

  /**
   * Set the LLM client
   */
  setLLMClient(client: LLMClient): void {
    this.llmClient = client;
  }
}

export default LLMBottleneckAnalyzer;
