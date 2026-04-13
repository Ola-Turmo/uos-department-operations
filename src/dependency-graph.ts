/**
 * Dependency Graph for action planning.
 * Detects dependencies between actions and computes critical path.
 */
export interface Action {
  id: string;
  description: string;
  owner?: string;
  dependsOn: string[];
  estimatedHours?: number;
  priority?: number;
}

export interface DependencyResult {
  sortedIds: string[]; // topological sort order
  criticalPath: string[];
  parallelBatches: string[][];
  bottlenecks: string[];
  totalEstimatedDays: number;
}

export class DependencyGraph {
  /**
   * Topological sort + critical path detection for actions.
   */
  compute(actions: Action[]): DependencyResult {
    const ids = new Set(actions.flatMap(a => [a.id, ...a.dependsOn]));
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const id of ids) { inDegree.set(id, 0); adj.set(id, []); }
    for (const a of actions) {
      for (const dep of a.dependsOn) {
        adj.get(dep)?.push(a.id);
        inDegree.set(a.id, (inDegree.get(a.id) ?? 0) + 1);
      }
    }
    // Kahn's algorithm
    const queue = Array.from(ids).filter(id => inDegree.get(id) === 0);
    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      for (const neighbor of adj.get(current) ?? []) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) queue.push(neighbor);
      }
    }
    if (sorted.length !== ids.size) throw new Error("Cycle detected in action dependencies");
    // Critical path (longest path by estimated hours)
    const hours = new Map(actions.map(a => [a.id, a.estimatedHours ?? 8]));
    const dist = new Map<string, number>();
    const prev = new Map<string, string | undefined>();
    for (const id of ids) { dist.set(id, 0); }
    for (const id of sorted) {
      for (const neighbor of adj.get(id) ?? []) {
        const nd = (dist.get(id) ?? 0) + (hours.get(neighbor) ?? 8);
        if (nd > (dist.get(neighbor) ?? 0)) {
          dist.set(neighbor, nd);
          prev.set(neighbor, id);
        }
      }
    }
    const criticalEnd = Array.from(ids).reduce((a, b) => (dist.get(a) ?? 0) > (dist.get(b) ?? 0) ? a : b);
    const criticalPath: string[] = [];
    let cp = criticalEnd;
    while (cp) { criticalPath.unshift(cp); cp = prev.get(cp)!; }
    // Parallel batches (actions with same in-degree at each level)
    const batches: string[][] = [];
    const batchInDegree = new Map<string, number>();
    for (const a of actions) batchInDegree.set(a.id, a.dependsOn.length);
    const remaining = new Set(actions.map(a => a.id));
    while (remaining.size > 0) {
      const batch = Array.from(remaining).filter(id => batchInDegree.get(id) === 0);
      if (batch.length === 0) break;
      batches.push(batch);
      for (const id of batch) {
        remaining.delete(id);
        for (const neighbor of adj.get(id) ?? []) {
          batchInDegree.set(neighbor, (batchInDegree.get(neighbor) ?? 1) - 1);
        }
      }
    }
    // Bottlenecks: actions on critical path with no parallel alternatives
    const inCritical = new Set(criticalPath);
    const bottlenecks = criticalPath.filter(id => {
      const a = actions.find(ac => ac.id === id);
      return a && a.dependsOn.some(dep => inCritical.has(dep));
    });
    return {
      sortedIds: sorted,
      criticalPath,
      parallelBatches: batches,
      bottlenecks,
      totalEstimatedDays: Math.ceil((dist.get(criticalEnd) ?? 0) / 8),
    };
  }
}
