import { z } from 'zod';

/**
 * Generates a unique ID following the planning-service.ts pattern
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Input validation schemas
 */
export const ActionIdSchema = z.string().min(1);
export const DependencySchema = z.object({
  actionId: z.string().min(1),
  dependsOn: z.string().min(1),
});

/**
 * Action Dependency Graph
 * 
 * A directed acyclic graph (DAG) for action dependencies with:
 * - Edge storage: Record<actionId, Set<dependencyActionId>>
 * - Cycle detection to maintain DAG property
 * - Topological sorting for execution order
 * - Parallel batch identification
 * - Critical path calculation with durations
 */
export class ActionDependencyGraph {
  private edges: Record<string, Set<string>> = {};
  private reverseEdges: Record<string, Set<string>> = {};
  private durations: Record<string, number> = {};
  private defaultDuration = 1.0;

  /**
   * Add a dependency edge: actionId depends on dependsOn
   * Throws if adding creates a cycle
   */
  addDependency(actionId: string, dependsOn: string): void {
    const validated = DependencySchema.parse({ actionId, dependsOn });
    
    if (validated.actionId === validated.dependsOn) {
      throw new Error(`Action cannot depend on itself: ${validated.actionId}`);
    }

    // Initialize sets if needed
    if (!this.edges[validated.actionId]) {
      this.edges[validated.actionId] = new Set();
    }
    if (!this.reverseEdges[validated.dependsOn]) {
      this.reverseEdges[validated.dependsOn] = new Set();
    }

    // Check if this would create a cycle
    // If dependsOn transitively depends on actionId, adding this edge creates a cycle
    const allDeps = this.getAllDependenciesInternal(validated.dependsOn);
    if (allDeps.includes(validated.actionId)) {
      throw new Error(
        `Adding dependency would create cycle: ${validated.actionId} -> ${validated.dependsOn}`
      );
    }

    this.edges[validated.actionId].add(validated.dependsOn);
    this.reverseEdges[validated.dependsOn].add(validated.actionId);
  }

  /**
   * Remove a dependency edge
   */
  removeDependency(actionId: string, dependsOn: string): void {
    const validated = DependencySchema.parse({ actionId, dependsOn });

    if (this.edges[actionId]) {
      this.edges[actionId].delete(dependsOn);
    }
    if (this.reverseEdges[dependsOn]) {
      this.reverseEdges[dependsOn].delete(actionId);
    }
  }

  /**
   * Get direct dependencies of an action
   */
  getDependencies(actionId: string): string[] {
    const validated = ActionIdSchema.parse(actionId);
    if (!this.edges[validated]) {
      return [];
    }
    return Array.from(this.edges[validated]);
  }

  /**
   * Get actions that directly depend on this action
   */
  getDependents(actionId: string): string[] {
    const validated = ActionIdSchema.parse(actionId);
    if (!this.reverseEdges[validated]) {
      return [];
    }
    return Array.from(this.reverseEdges[validated]);
  }

  /**
   * Get all transitive dependencies (all ancestors)
   */
  getAllDependencies(actionId: string): string[] {
    const validated = ActionIdSchema.parse(actionId);
    return this.getAllDependenciesInternal(validated);
  }

  private getAllDependenciesInternal(actionId: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const traverse = (id: string) => {
      const deps = this.edges[id];
      if (!deps) return;
      
      for (const dep of deps) {
        if (!visited.has(dep)) {
          visited.add(dep);
          result.push(dep);
          traverse(dep);
        }
      }
    };

    traverse(actionId);
    return result;
  }

  /**
   * Check if the graph has any cycles
   */
  hasCycle(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = this.edges[node];
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) return true;
          } else if (recursionStack.has(neighbor)) {
            return true;
          }
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of this.getAllNodes()) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }

    return false;
  }

  /**
   * Get topological sort using Kahn's algorithm
   * Returns execution order (dependencies come before dependents)
   * Alias: getExecutionOrder()
   */
  getExecutionOrder(): string[] {
    return this.topologicalSort();
  }

  /**
   * Get topological sort using Kahn's algorithm
   * Returns execution order (dependencies come before dependents)
   */
  topologicalSort(): string[] {
    if (this.hasCycle()) {
      throw new Error('Cannot perform topological sort: graph contains a cycle');
    }

    const inDegree: Record<string, number> = {};
    const allNodes = this.getAllNodes();

    // Initialize in-degrees
    for (const node of allNodes) {
      inDegree[node] = 0;
    }

    // Calculate in-degrees
    for (const [node, deps] of Object.entries(this.edges)) {
      for (const dep of deps) {
        inDegree[node] = (inDegree[node] || 0) + 1;
      }
    }

    // Start with nodes that have no dependencies
    const queue: string[] = [];
    for (const node of allNodes) {
      if (inDegree[node] === 0) {
        queue.push(node);
      }
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const dependents = this.reverseEdges[current];
      if (dependents) {
        for (const dependent of dependents) {
          inDegree[dependent]--;
          if (inDegree[dependent] === 0) {
            queue.push(dependent);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get groups of actions that can run in parallel
   * Actions in the same batch have no dependencies on each other
   */
  getParallelBatches(): string[][] {
    if (this.hasCycle()) {
      throw new Error('Cannot get parallel batches: graph contains a cycle');
    }

    const batches: string[][] = [];
    const completed = new Set<string>();
    const allNodes = this.getAllNodes();

    while (completed.size < allNodes.length) {
      const batch: string[] = [];

      for (const node of allNodes) {
        if (completed.has(node)) continue;

        const deps = this.edges[node];
        if (!deps || deps.size === 0) {
          // No dependencies - can run immediately
          batch.push(node);
          continue;
        }

        // Check if all dependencies are completed
        let allDepsCompleted = true;
        for (const dep of deps) {
          if (!completed.has(dep)) {
            allDepsCompleted = false;
            break;
          }
        }

        if (allDepsCompleted) {
          batch.push(node);
        }
      }

      if (batch.length === 0 && completed.size < allNodes.length) {
        throw new Error('Cannot determine batches: graph may have a cycle');
      }

      batches.push(batch);
      for (const node of batch) {
        completed.add(node);
      }
    }

    return batches;
  }

  /**
   * Get duration for an action (default 1.0, returns 0 for unknown)
   */
  getActionDuration(actionId: string): number {
    if (actionId in this.durations) {
      return this.durations[actionId];
    }
    // Check if action exists in graph
    if (this.edges[actionId] || this.reverseEdges[actionId]) {
      return this.defaultDuration;
    }
    return 0;
  }

  /**
   * Set duration for an action in days
   */
  setActionDuration(actionId: string, days: number): void {
    this.durations[actionId] = days;
  }

  /**
   * Get the critical path through the graph
   * Returns the longest weighted path from any root to any leaf
   * Uses Kahn's algorithm for topological ordering and dynamic programming for longest path
   */
  getCriticalPath(): string[] {
    if (this.hasCycle()) {
      throw new Error('Cannot compute critical path: graph contains a cycle');
    }

    const allNodes = this.getAllNodes();
    if (allNodes.length === 0) {
      return [];
    }

    // Find all root nodes (no dependencies)
    const roots: string[] = [];
    for (const node of allNodes) {
      const deps = this.edges[node];
      if (!deps || deps.size === 0) {
        roots.push(node);
      }
    }

    if (roots.length === 0) {
      return [];
    }

    // Find all end nodes (no dependents)
    const endNodes: string[] = [];
    for (const node of allNodes) {
      const dependents = this.reverseEdges[node];
      if (!dependents || dependents.size === 0) {
        endNodes.push(node);
      }
    }

    if (endNodes.length === 0) {
      return [];
    }

    // Dynamic programming to find longest weighted path
    // dist[node] = longest path duration ending at node (not count)
    // prev[node] = previous node in the longest path
    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};

    for (const node of allNodes) {
      dist[node] = this.getActionDuration(node);
      prev[node] = null;
    }

    // Process in topological order
    const topoOrder = this.topologicalSort();
    
    for (const node of topoOrder) {
      const currentDist = dist[node];
      const dependents = this.reverseEdges[node];
      
      if (dependents) {
        for (const dependent of dependents) {
          const newDist = currentDist + this.getActionDuration(dependent);
          if (dist[dependent] < newDist) {
            dist[dependent] = newDist;
            prev[dependent] = node;
          }
        }
      }
    }

    // Find the end node with maximum distance
    let maxDist = -1;
    let endNode: string | null = null;
    
    for (const node of endNodes) {
      if (dist[node] > maxDist) {
        maxDist = dist[node];
        endNode = node;
      }
    }

    if (endNode === null) {
      return [];
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | null = endNode;
    
    while (current !== null) {
      path.unshift(current);
      current = prev[current];
    }

    return path;
  }

  private getAllNodes(): string[] {
    const nodes = new Set<string>();
    
    for (const [node, deps] of Object.entries(this.edges)) {
      nodes.add(node);
      for (const dep of deps) {
        nodes.add(dep);
      }
    }

    // Also add nodes that are only dependents (no dependencies defined)
    for (const node of Object.keys(this.reverseEdges)) {
      nodes.add(node);
    }

    return Array.from(nodes);
  }
}
