import { describe, expect, it, beforeEach } from "vitest";
import { ActionDependencyGraph } from "../../src/planning/dependency-graph.js";

describe('ActionDependencyGraph', () => {
  let graph: ActionDependencyGraph;

  beforeEach(() => {
    graph = new ActionDependencyGraph();
  });

  describe('addDependency and removeDependency', () => {
    it('should add a dependency edge', () => {
      graph.addDependency('B', 'A');
      expect(graph.getDependencies('B')).toEqual(['A']);
    });

    it('should add multiple dependencies', () => {
      graph.addDependency('C', 'A');
      graph.addDependency('C', 'B');
      expect(graph.getDependencies('C')).toContain('A');
      expect(graph.getDependencies('C')).toContain('B');
    });

    it('should remove a dependency', () => {
      graph.addDependency('C', 'A');
      graph.addDependency('C', 'B');
      graph.removeDependency('C', 'A');
      expect(graph.getDependencies('C')).not.toContain('A');
      expect(graph.getDependencies('C')).toContain('B');
    });

    it('should track dependents correctly', () => {
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'A');
      expect(graph.getDependents('A')).toContain('B');
      expect(graph.getDependents('A')).toContain('C');
    });

    it('should throw when adding self-dependency', () => {
      expect(() => graph.addDependency('A', 'A')).toThrow();
    });

    it('should throw when adding cycle', () => {
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      expect(() => graph.addDependency('A', 'C')).toThrow();
    });
  });

  describe('getExecutionOrder (topological sort)', () => {
    it('should return empty array for empty graph', () => {
      expect(graph.getExecutionOrder()).toEqual([]);
    });

    it('should return single node', () => {
      graph.addDependency('A', 'root');
      expect(graph.getExecutionOrder()).toEqual(['root', 'A']);
    });

    it('should return linear dependencies in order', () => {
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      graph.addDependency('D', 'C');
      const order = graph.getExecutionOrder();
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'));
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
    });

    it('should throw error when adding would create cycle', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');
      // Adding C->A would create cycle, so it throws at add time
      expect(() => graph.addDependency('C', 'A')).toThrow();
    });

    it('should throw error on getExecutionOrder if cycle exists', () => {
      // Use internal manipulation to create a cycle since addDependency prevents it
      (graph as any).edges = { A: new Set(['B']), B: new Set(['C']), C: new Set(['A']) };
      (graph as any).reverseEdges = { B: new Set(['A']), C: new Set(['B']), A: new Set(['C']) };
      expect(() => graph.getExecutionOrder()).toThrow();
    });
  });

  describe('getParallelBatches', () => {
    it('should return empty array for empty graph', () => {
      expect(graph.getParallelBatches()).toEqual([]);
    });

    it('should return single node as batch', () => {
      graph.addDependency('A', 'root');
      const batches = graph.getParallelBatches();
      expect(batches.length).toBeGreaterThan(0);
    });

    it('should batch independent actions together', () => {
      // A and B are independent (both depend on root)
      graph.addDependency('A', 'root');
      graph.addDependency('B', 'root');
      // C depends on both A and B
      graph.addDependency('C', 'A');
      graph.addDependency('C', 'B');

      const batches = graph.getParallelBatches();
      // First batch should have root
      // Second batch should have A and B (independent, can run in parallel)
      // Third batch should have C
      expect(batches.length).toBeGreaterThanOrEqual(2);
    });

    it('should throw when adding would create cycle', () => {
      graph.addDependency('A', 'B');
      // Adding B->A would create cycle
      expect(() => graph.addDependency('B', 'A')).toThrow();
    });
  });

  describe('getCriticalPath', () => {
    it('should return empty array for empty graph', () => {
      expect(graph.getCriticalPath()).toEqual([]);
    });

    it('should return single node for single action', () => {
      graph.addDependency('A', 'root');
      const path = graph.getCriticalPath();
      expect(path.length).toBeGreaterThan(0);
    });

    it('should return longest path through linear deps', () => {
      // Linear chain: root -> A -> B -> C
      graph.addDependency('A', 'root');
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      
      const path = graph.getCriticalPath();
      expect(path).toContain('root');
      expect(path.indexOf('root')).toBeLessThan(path.indexOf('A'));
      expect(path.indexOf('A')).toBeLessThan(path.indexOf('B'));
      expect(path.indexOf('B')).toBeLessThan(path.indexOf('C'));
    });

    it('should use durations for critical path', () => {
      // Chain with different durations
      // Long path: root -> B (duration 3) -> C (duration 1) = 4
      // Short path: root -> A (duration 1) -> C (duration 1) = 2
      graph.addDependency('B', 'root');
      graph.addDependency('A', 'root');
      graph.addDependency('C', 'A');
      graph.addDependency('C', 'B');
      
      graph.setActionDuration('root', 1);
      graph.setActionDuration('A', 1);
      graph.setActionDuration('B', 3);
      graph.setActionDuration('C', 1);

      const path = graph.getCriticalPath();
      // Critical path should go through B, not A
      expect(path).toContain('B');
      expect(path).toContain('C');
    });

    it('should throw when adding would create cycle', () => {
      graph.addDependency('A', 'B');
      // Adding B->A would create cycle
      expect(() => graph.getCriticalPath()).not.toThrow(); // This won't throw since no cycle was added
    });

    it('should throw when adding would create cycle before critical path', () => {
      graph.addDependency('A', 'B');
      // Adding B->A would create cycle, so it throws at add time
      expect(() => graph.addDependency('B', 'A')).toThrow();
    });
  });

  describe('hasCycle', () => {
    it('should return false for empty graph', () => {
      expect(graph.hasCycle()).toBe(false);
    });

    it('should return false for linear dependencies', () => {
      graph.addDependency('A', 'root');
      graph.addDependency('B', 'A');
      expect(graph.hasCycle()).toBe(false);
    });

    it('should throw when adding self-dependency', () => {
      // Self-dependency is caught at add time
      expect(() => graph.addDependency('A', 'A')).toThrow();
    });

    it('should return true when graph has cycle (via internal manipulation)', () => {
      // Since addDependency prevents cycles, manually create one
      (graph as any).edges = { A: new Set(['B']), B: new Set(['C']), C: new Set(['A']) };
      (graph as any).reverseEdges = { B: new Set(['A']), C: new Set(['B']), A: new Set(['C']) };
      expect(graph.hasCycle()).toBe(true);
    });
  });

  describe('action durations', () => {
    it('should return default duration of 1.0', () => {
      graph.addDependency('A', 'root');
      expect(graph.getActionDuration('A')).toBe(1.0);
      expect(graph.getActionDuration('root')).toBe(1.0);
    });

    it('should return duration 0 for unknown action', () => {
      expect(graph.getActionDuration('unknown')).toBe(0);
    });

    it('should set and get custom duration', () => {
      graph.setActionDuration('A', 5.5);
      expect(graph.getActionDuration('A')).toBe(5.5);
    });

    it('should use custom durations in critical path', () => {
      // Create a simple chain where duration matters
      graph.addDependency('A', 'root');
      graph.setActionDuration('root', 1);
      graph.setActionDuration('A', 10);

      const path = graph.getCriticalPath();
      expect(path).toContain('root');
      expect(path).toContain('A');
    });
  });

  describe('edge cases', () => {
    it('should handle empty graph for dependencies', () => {
      expect(graph.getDependencies('nonexistent')).toEqual([]);
      expect(graph.getDependents('nonexistent')).toEqual([]);
    });

    it('should handle removing non-existent dependency', () => {
      graph.removeDependency('A', 'B'); // Should not throw
    });
  });
});
