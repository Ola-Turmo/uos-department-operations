import { ActionDependencyGraph } from './dependency-graph.js';

/**
 * Bottleneck action with delay impact analysis
 */
export interface BottleneckAction {
  actionId: string;
  duration: number;         // days
  slack: number;            // days of slack before affecting critical path
  delayImpact: number;      // how much this action delays the overall project
  position: 'start' | 'middle' | 'end';
  alternatives: string[];   // parallel alternatives if any
}

/**
 * Summary metrics for the critical path
 */
export interface CriticalPathMetrics {
  totalDuration: number;    // total critical path length in days
  bottleneckCount: number;
  parallelPathCount: number;
  criticalActionIds: string[];
  earliestCompletionDate: string;
}

/**
 * CriticalPathCalculator
 * 
 * Analyzes an ActionDependencyGraph to identify the critical path,
 * bottleneck actions, and slack times for non-critical actions.
 */
export class CriticalPathCalculator {
  private graph: ActionDependencyGraph;
  private criticalPathCache: string[] | null = null;

  constructor(graph: ActionDependencyGraph) {
    this.graph = graph;
  }

  /**
   * Calculate the critical path (longest weighted path through the graph)
   */
  calculateCriticalPath(): string[] {
    this.criticalPathCache = this.graph.getCriticalPath();
    return this.criticalPathCache;
  }

  /**
   * Get all bottleneck actions on the critical path with their delay impact
   */
  getBottleneckActions(): BottleneckAction[] {
    const criticalPath = this.calculateCriticalPath();
    
    if (criticalPath.length === 0) {
      return [];
    }

    const bottlenecks: BottleneckAction[] = [];
    
    for (let i = 0; i < criticalPath.length; i++) {
      const actionId = criticalPath[i];
      const duration = this.graph.getActionDuration(actionId);
      const slack = this.getSlackTime(actionId);
      const delayImpact = duration; // Duration is the delay impact
      
      // Determine position
      let position: 'start' | 'middle' | 'end';
      if (criticalPath.length === 1) {
        position = 'start';
      } else if (i === 0) {
        position = 'start';
      } else if (i === criticalPath.length - 1) {
        position = 'end';
      } else {
        position = 'middle';
      }

      // Find parallel alternatives (actions at same "level" with same dependencies)
      const alternatives = this.findParallelAlternatives(actionId);

      bottlenecks.push({
        actionId,
        duration,
        slack,
        delayImpact,
        position,
        alternatives,
      });
    }

    return bottlenecks;
  }

  /**
   * Get slack time for an action (how much it can be delayed without affecting project duration)
   */
  getSlackTime(actionId: string): number {
    const criticalPath = this.calculateCriticalPath();
    
    // Actions on critical path have zero slack
    if (criticalPath.includes(actionId)) {
      return 0;
    }

    // For non-critical actions, calculate the difference between
    // the longest path through this action and the critical path length
    const criticalDuration = this.getTotalCriticalDuration();
    const alternativeDuration = this.calculateLongestPathToAction(actionId);

    if (alternativeDuration === 0) {
      return 0;
    }

    // Slack is the difference between critical path duration and this path's duration
    // However, we need to consider when this action completes vs when it's needed
    const slack = criticalDuration - alternativeDuration;
    
    return Math.max(0, slack);
  }

  /**
   * Get summary metrics for the critical path
   */
  getCriticalPathMetrics(): CriticalPathMetrics {
    const criticalPath = this.calculateCriticalPath();
    const totalDuration = this.getTotalCriticalDuration();
    const bottleneckCount = criticalPath.length;
    const parallelPathCount = this.countParallelPaths();
    const criticalActionIds = [...criticalPath];
    
    // Calculate earliest completion date based on current date
    const earliestCompletionDate = this.calculateEarliestCompletionDate(totalDuration);

    return {
      totalDuration,
      bottleneckCount,
      parallelPathCount,
      criticalActionIds,
      earliestCompletionDate,
    };
  }

  /**
   * Get total duration of the critical path
   */
  private getTotalCriticalDuration(): number {
    const criticalPath = this.calculateCriticalPath();
    let total = 0;
    
    for (const actionId of criticalPath) {
      total += this.graph.getActionDuration(actionId);
    }
    
    return total;
  }

  /**
   * Count the number of parallel paths (immediate branches from critical path nodes)
   */
  private countParallelPaths(): number {
    const criticalPath = this.calculateCriticalPath();
    
    // Count all immediate branches from critical path nodes
    // (both critical and non-critical dependents)
    let count = 0;
    const countedPaths = new Set<string>();

    for (const actionId of criticalPath) {
      // Count all dependents (both those on and off critical path)
      const dependents = this.graph.getDependents(actionId);
      for (const dependent of dependents) {
        if (!countedPaths.has(dependent)) {
          countedPaths.add(dependent);
          count++;
        }
      }
    }

    return count || 1; // At least 1 path exists
  }

  /**
   * Find parallel alternatives for an action (sibling actions with same dependencies)
   */
  private findParallelAlternatives(actionId: string): string[] {
    const alternatives: string[] = [];
    const dependencies = this.graph.getDependencies(actionId);
    const dependents = this.graph.getDependents(actionId);

    // Find actions that share the same dependencies (parallel at same level)
    const allNodes = this.getAllGraphNodes();
    
    for (const node of allNodes) {
      if (node === actionId) continue;
      
      const nodeDeps = this.graph.getDependencies(node);
      const nodeDependents = this.graph.getDependents(node);

      // Parallel if they have some shared dependencies or dependents
      const sharedDeps = dependencies.filter(d => nodeDeps.includes(d));
      const sharedDependents = dependents.filter(d => nodeDependents.includes(d));

      if ((sharedDeps.length > 0 || sharedDependents.length > 0) && 
          dependencies.length === nodeDeps.length) {
        alternatives.push(node);
      }
    }

    return alternatives;
  }

  /**
   * Calculate the longest path duration that goes through a specific action
   */
  private calculateLongestPathToAction(actionId: string): number {
    // Get the longest path from any root to this action
    const allNodes = this.getAllGraphNodes();
    const visited = new Set<string>();
    const memo: Record<string, number> = {};

    const longestPath = (node: string): number => {
      if (memo[node] !== undefined) {
        return memo[node];
      }

      const deps = this.graph.getDependencies(node);
      if (deps.length === 0) {
        memo[node] = this.graph.getActionDuration(node);
        return memo[node];
      }

      let maxDepPath = 0;
      for (const dep of deps) {
        maxDepPath = Math.max(maxDepPath, longestPath(dep));
      }

      memo[node] = maxDepPath + this.graph.getActionDuration(node);
      return memo[node];
    };

    return longestPath(actionId);
  }

  /**
   * Get all nodes in the graph
   */
  private getAllGraphNodes(): string[] {
    const nodes = new Set<string>();
    
    // Collect from edges
    for (const node of Object.keys((this.graph as any).edges || {})) {
      nodes.add(node);
    }
    
    // Collect from reverse edges
    for (const node of Object.keys((this.graph as any).reverseEdges || {})) {
      nodes.add(node);
    }

    return Array.from(nodes);
  }

  /**
   * Calculate earliest completion date based on total duration
   */
  private calculateEarliestCompletionDate(totalDays: number): string {
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + Math.ceil(totalDays));
    return completionDate.toISOString().split('T')[0];
  }
}
