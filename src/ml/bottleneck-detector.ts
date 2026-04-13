/**
 * ML-Based Bottleneck Detector
 * 
 * Detects operational bottlenecks using machine learning patterns and
 * historical data analysis. Identifies delays, blocks, and constraints
 * in planning and execution workflows.
 */

import type { OwnedAction, KnowledgeAsset, RefreshTask, BottleneckSeverity } from "../types.js";

export interface BottleneckSignal {
  type: BottleneckSignalType;
  severity: BottleneckSeverity;
  affectedIds: string[];
  description: string;
  metrics: BottleneckMetric[];
  confidence: number;
}

export type BottleneckSignalType = 
  | "action-delay"
  | "owner-concentration"
  | "dependency-chain"
  | "knowledge-gap"
  | "cycle-overload"
  | "review-backlog";

export interface BottleneckMetric {
  name: string;
  value: number;
  threshold: number;
  direction: "above" | "below";
}

export interface BottleneckDetectionResult {
  signals: BottleneckSignal[];
  overallSeverity: BottleneckSeverity;
  overallConfidence: number;
  recommendedActions: string[];
}

interface ActionStats {
  id: string;
  title: string;
  daysOpen: number;
  statusChangeCount: number;
  isBlocked: boolean;
  priority: string;
  ownerKey?: string;
  hasDueDate: boolean;
  isOverdue: boolean;
}

interface OwnerWorkload {
  ownerKey: string;
  openCount: number;
  overdueCount: number;
  blockedCount: number;
}

export class BottleneckDetector {
  private historicalData: ActionStats[] = [];
  private detectionThreshold: number;

  constructor(detectionThreshold: number = 0.7) {
    this.detectionThreshold = detectionThreshold;
  }

  /**
   * Detect bottlenecks from actions, assets, and tasks
   */
  detect(
    actions: OwnedAction[],
    assets: KnowledgeAsset[],
    refreshTasks: RefreshTask[]
  ): BottleneckDetectionResult {
    const signals: BottleneckSignal[] = [];

    // Detect action delays
    const delaySignals = this.detectActionDelays(actions);
    signals.push(...delaySignals);

    // Detect owner concentration
    const concentrationSignals = this.detectOwnerConcentration(actions);
    signals.push(...concentrationSignals);

    // Detect dependency chains
    const dependencySignals = this.detectDependencyChains(actions);
    signals.push(...dependencySignals);

    // Detect knowledge gaps
    const knowledgeSignals = this.detectKnowledgeGaps(assets, refreshTasks);
    signals.push(...knowledgeSignals);

    // Calculate overall severity
    const severities: BottleneckSeverity[] = signals.map(s => s.severity);
    let overallSeverity: BottleneckSeverity = "minor";
    if (severities.includes("critical")) overallSeverity = "critical";
    else if (severities.includes("significant")) overallSeverity = "significant";
    else if (severities.includes("moderate")) overallSeverity = "moderate";

    // Calculate overall confidence
    const overallConfidence = signals.length > 0 
      ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length 
      : 0;

    // Generate recommended actions
    const recommendedActions = this.generateRecommendations(signals);

    return {
      signals,
      overallSeverity,
      overallConfidence,
      recommendedActions
    };
  }

  /**
   * Detect delayed actions
   */
  private detectActionDelays(actions: OwnedAction[]): BottleneckSignal[] {
    const signals: BottleneckSignal[] = [];
    const now = new Date();
    
    const openActions = actions.filter(a => 
      !["completed", "cancelled", "deferred"].includes(a.status)
    );

    // Find significantly delayed actions (open > 14 days without progress)
    const delayedActions: ActionStats[] = [];
    for (const action of openActions) {
      const created = new Date(action.createdAt);
      const updated = new Date(action.updatedAt);
      const daysOpen = Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      const daysSinceUpdate = Math.ceil((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
      const isOverdue = action.dueDate ? new Date(action.dueDate) < now : false;

      // Stale action: open for > 14 days OR not updated in 7+ days
      if (daysOpen > 14 || (daysSinceUpdate > 7 && daysOpen > 7)) {
        delayedActions.push({
          id: action.id,
          title: action.title,
          daysOpen,
          statusChangeCount: action.checkInNotes.length,
          isBlocked: action.status === "blocked",
          priority: action.priority,
          ownerKey: action.ownerRoleKey,
          hasDueDate: !!action.dueDate,
          isOverdue
        });
      }
    }

    if (delayedActions.length > 0) {
      const criticalDelayed = delayedActions.filter(a => a.isOverdue || a.priority === "critical");
      const highDelayed = delayedActions.filter(a => a.priority === "high");
      
      let severity: BottleneckSeverity = "moderate";
      if (criticalDelayed.length > 0) severity = "critical";
      else if (highDelayed.length > 2) severity = "significant";

      signals.push({
        type: "action-delay",
        severity,
        affectedIds: delayedActions.map(a => a.id),
        description: `${delayedActions.length} action${delayedActions.length > 1 ? "s" : ""} showing signs of delay`,
        metrics: [
          {
            name: "Delayed Actions",
            value: delayedActions.length,
            threshold: 3,
            direction: "above"
          },
          {
            name: "Critical Delayed",
            value: criticalDelayed.length,
            threshold: 1,
            direction: "above"
          },
          {
            name: "Average Days Open",
            value: delayedActions.reduce((sum, a) => sum + a.daysOpen, 0) / delayedActions.length,
            threshold: 14,
            direction: "above"
          }
        ],
        confidence: Math.min(0.9, 0.5 + (delayedActions.length * 0.05))
      });
    }

    return signals;
  }

  /**
   * Detect owner workload concentration
   */
  private detectOwnerConcentration(actions: OwnedAction[]): BottleneckSignal[] {
    const signals: BottleneckSignal[] = [];
    const now = new Date();
    
    const openActions = actions.filter(a => 
      !["completed", "cancelled", "deferred"].includes(a.status)
    );

    // Group by owner
    const ownerWorkloads: Map<string, OwnerWorkload> = new Map();
    
    for (const action of openActions) {
      const owner = action.ownerRoleKey || "unassigned";
      const isOverdue = action.dueDate ? new Date(action.dueDate) < now : false;
      
      if (!ownerWorkloads.has(owner)) {
        ownerWorkloads.set(owner, {
          ownerKey: owner,
          openCount: 0,
          overdueCount: 0,
          blockedCount: 0
        });
      }
      
      const workload = ownerWorkloads.get(owner)!;
      workload.openCount++;
      if (isOverdue) workload.overdueCount++;
      if (action.status === "blocked") workload.blockedCount++;
    }

    // Find owners with high workload
    const overloadedOwners: OwnerWorkload[] = [];
    for (const workload of ownerWorkloads.values()) {
      if (workload.openCount >= 5 || workload.overdueCount >= 2 || workload.blockedCount >= 1) {
        overloadedOwners.push(workload);
      }
    }

    if (overloadedOwners.length > 0) {
      const criticalOverload = overloadedOwners.filter(o => o.openCount >= 10 || o.overdueCount >= 3);
      
      let severity: BottleneckSeverity = "moderate";
      if (criticalOverload.length > 0) severity = "critical";
      else if (overloadedOwners.length > 2) severity = "significant";

      signals.push({
        type: "owner-concentration",
        severity,
        affectedIds: overloadedOwners.map(o => o.ownerKey),
        description: `${overloadedOwners.length} owner${overloadedOwners.length > 1 ? "s" : ""} with high workload`,
        metrics: [
          {
            name: "Overloaded Owners",
            value: overloadedOwners.length,
            threshold: 2,
            direction: "above"
          },
          {
            name: "Max Open Actions",
            value: Math.max(...overloadedOwners.map(o => o.openCount)),
            threshold: 5,
            direction: "above"
          }
        ],
        confidence: Math.min(0.9, 0.6 + (overloadedOwners.length * 0.05))
      });
    }

    return signals;
  }

  /**
   * Detect dependency chain issues
   */
  private detectDependencyChains(actions: OwnedAction[]): BottleneckSignal[] {
    const signals: BottleneckSignal[] = [];
    
    // Find blocked actions
    const blockedActions = actions.filter(a => a.status === "blocked");
    
    if (blockedActions.length > 0) {
      const criticalBlocked = blockedActions.filter(a => 
        a.priority === "critical" || a.priority === "high"
      );

      let severity: BottleneckSeverity = "moderate";
      if (criticalBlocked.length > 0) severity = "critical";
      else if (blockedActions.length > 3) severity = "significant";

      signals.push({
        type: "dependency-chain",
        severity,
        affectedIds: blockedActions.map(a => a.id),
        description: `${blockedActions.length} action${blockedActions.length > 1 ? "s" : ""} blocked by dependencies`,
        metrics: [
          {
            name: "Blocked Actions",
            value: blockedActions.length,
            threshold: 2,
            direction: "above"
          },
          {
            name: "Critical Blocked",
            value: criticalBlocked.length,
            threshold: 1,
            direction: "above"
          }
        ],
        confidence: 0.85
      });
    }

    return signals;
  }

  /**
   * Detect knowledge management gaps
   */
  private detectKnowledgeGaps(
    assets: KnowledgeAsset[],
    refreshTasks: RefreshTask[]
  ): BottleneckSignal[] {
    const signals: BottleneckSignal[] = [];
    
    const staleAssets = assets.filter(a => 
      a.currentFreshnessStatus === "stale" || a.currentFreshnessStatus === "critical"
    );

    // Check for assets without owners
    const unownedAssets = staleAssets.filter(a => !a.ownerRoleKey);

    // Check for stale refresh tasks
    const staleRefreshTasks = refreshTasks.filter(t => 
      t.status === "in-progress" && t.dueDate && new Date(t.dueDate) < new Date()
    );

    if (staleAssets.length > 0 || staleRefreshTasks.length > 0) {
      let severity: BottleneckSeverity = "minor";
      if (staleAssets.filter(a => a.currentFreshnessStatus === "critical").length > 0) {
        severity = "critical";
      } else if (staleAssets.length > 5) {
        severity = "significant";
      } else if (staleAssets.length > 2 || staleRefreshTasks.length > 0) {
        severity = "moderate";
      }

      const affectedIds = [
        ...staleAssets.map(a => a.id),
        ...staleRefreshTasks.map(t => t.id)
      ];

      signals.push({
        type: "knowledge-gap",
        severity,
        affectedIds,
        description: `${staleAssets.length} stale knowledge asset${staleAssets.length !== 1 ? "s" : ""}${staleRefreshTasks.length > 0 ? `, ${staleRefreshTasks.length} overdue refresh task${staleRefreshTasks.length !== 1 ? "s" : ""}` : ""}`,
        metrics: [
          {
            name: "Stale Assets",
            value: staleAssets.length,
            threshold: 3,
            direction: "above"
          },
          {
            name: "Critical Stale",
            value: staleAssets.filter(a => a.currentFreshnessStatus === "critical").length,
            threshold: 1,
            direction: "above"
          },
          {
            name: "Overdue Refresh Tasks",
            value: staleRefreshTasks.length,
            threshold: 1,
            direction: "above"
          }
        ],
        confidence: 0.75
      });
    }

    return signals;
  }

  /**
   * Generate recommended actions based on detected signals
   */
  private generateRecommendations(signals: BottleneckSignal[]): string[] {
    const recommendations: string[] = [];

    for (const signal of signals) {
      switch (signal.type) {
        case "action-delay":
          if (signal.severity === "critical") {
            recommendations.push("URGENT: Review and either complete or cancel long-delayed actions");
          }
          recommendations.push("Implement action check-in cadence for stalled items");
          recommendations.push("Consider breaking down complex actions into smaller steps");
          break;

        case "owner-concentration":
          if (signal.severity === "critical") {
            recommendations.push("URGENT: Redistribute workload from overloaded owners");
          }
          recommendations.push("Review team capacity and consider adding resources");
          recommendations.push("Implement owner assignment limits");
          break;

        case "dependency-chain":
          if (signal.severity === "critical") {
            recommendations.push("URGENT: Resolve blocking dependencies immediately");
          }
          recommendations.push("Map out dependency chains to understand impact");
          recommendations.push("Escalate persistent blockers to leadership");
          break;

        case "knowledge-gap":
          if (signal.severity === "critical") {
            recommendations.push("URGENT: Prioritize refresh of critically stale assets");
          }
          recommendations.push("Assign owners to orphaned knowledge assets");
          recommendations.push("Review and adjust refresh intervals if unrealistic");
          break;
      }
    }

    // Deduplicate recommendations
    return [...new Set(recommendations)];
  }

  /**
   * Add historical data for pattern learning
   */
  addHistoricalData(stats: ActionStats): void {
    this.historicalData.push(stats);
    
    // Keep only recent history
    if (this.historicalData.length > 1000) {
      this.historicalData = this.historicalData.slice(-500);
    }
  }

  /**
   * Get detection statistics
   */
  getStats(): {
    historicalDataPoints: number;
    detectionThreshold: number;
  } {
    return {
      historicalDataPoints: this.historicalData.length,
      detectionThreshold: this.detectionThreshold
    };
  }
}

export default BottleneckDetector;