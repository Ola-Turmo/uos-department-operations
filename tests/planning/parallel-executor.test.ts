import { ActionDependencyGraph } from '../../src/planning/dependency-graph';
import { ParallelExecutor, BatchResult, ActionResult } from '../../src/planning/parallel-executor';

describe('ParallelExecutor', () => {
  let graph: ActionDependencyGraph;
  let executor: ParallelExecutor;

  beforeEach(() => {
    graph = new ActionDependencyGraph();
  });

  describe('executeBatches', () => {
    it('should return empty results for empty graph', async () => {
      executor = new ParallelExecutor(graph);
      const results = await executor.executeBatches([]);
      expect(results).toEqual([]);
    });

    it('should execute single action', async () => {
      graph.addDependency('A', 'root');
      executor = new ParallelExecutor(graph);
      const results = await executor.executeBatches(['A', 'root']);
      
      expect(results.length).toBeGreaterThan(0);
      const allActionIds = results.flatMap((r: BatchResult) => r.actionIds);
      expect(allActionIds).toContain('A');
      expect(allActionIds).toContain('root');
    });

    it('should execute linear dependency chain in batches', async () => {
      // Linear: root -> A -> B -> C
      graph.addDependency('A', 'root');
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      
      executor = new ParallelExecutor(graph);
      const results = await executor.executeBatches(['root', 'A', 'B', 'C']);
      
      // Should have 4 batches (one per action in linear chain)
      expect(results.length).toBe(4);
      
      // Each batch should have completedAt
      for (const batch of results) {
        expect(batch.completedAt).toBeDefined();
        expect(batch.results.length).toBeGreaterThan(0);
      }
    });

    it('should batch independent actions together', async () => {
      // Parallel: root -> A, root -> B, A -> C, B -> C
      graph.addDependency('A', 'root');
      graph.addDependency('B', 'root');
      graph.addDependency('C', 'A');
      graph.addDependency('C', 'B');
      
      executor = new ParallelExecutor(graph);
      const results = await executor.executeBatches(['root', 'A', 'B', 'C']);
      
      // Batch 0: root (no deps)
      // Batch 1: A, B (independent, parallel)
      // Batch 2: C (depends on both A and B)
      expect(results.length).toBeGreaterThanOrEqual(2);
      
      // Check that A and B are in the same batch (if parallel batching works)
      const batchWithAB = results.find((r: BatchResult) => r.actionIds.includes('A') && r.actionIds.includes('B'));
      expect(batchWithAB).toBeDefined();
    });

    it('should mark all actions as successful in mock execution', async () => {
      graph.addDependency('A', 'root');
      executor = new ParallelExecutor(graph);
      const results = await executor.executeBatches(['root', 'A']);
      
      for (const batch of results) {
        for (const result of batch.results) {
          expect(result.success).toBe(true);
          expect(result.error).toBeUndefined();
        }
      }
    });
  });

  describe('getNextBatch', () => {
    it('should return first batch of independent actions', () => {
      graph.addDependency('A', 'root');
      graph.addDependency('B', 'root');
      executor = new ParallelExecutor(graph);
      
      const batch = executor.getNextBatch();
      expect(batch).toContain('root');
    });

    it('should return empty array when no more batches', () => {
      graph.addDependency('A', 'root');
      executor = new ParallelExecutor(graph);
      
      executor.getNextBatch(); // Get first batch
      executor.getNextBatch(); // Get second batch
      
      const batch = executor.getNextBatch();
      expect(batch).toEqual([]);
    });
  });

  describe('isComplete', () => {
    it('should return false when actions remain', () => {
      graph.addDependency('A', 'root');
      executor = new ParallelExecutor(graph);
      
      expect(executor.isComplete()).toBe(false);
    });

    it('should return true when all actions executed', () => {
      graph.addDependency('A', 'root');
      executor = new ParallelExecutor(graph);
      
      executor.getNextBatch(); // root
      executor.getNextBatch(); // A
      
      expect(executor.isComplete()).toBe(true);
    });
  });

  describe('getExecutedCount', () => {
    it('should return 0 initially', () => {
      graph.addDependency('A', 'root');
      executor = new ParallelExecutor(graph);
      
      expect(executor.getExecutedCount()).toBe(0);
    });

    it('should increment count as batches execute', () => {
      graph.addDependency('A', 'root');
      executor = new ParallelExecutor(graph);
      
      executor.getNextBatch();
      expect(executor.getExecutedCount()).toBe(1);
      
      executor.getNextBatch();
      expect(executor.getExecutedCount()).toBe(2);
    });
  });

  describe('getRemainingCount', () => {
    it('should return total count initially', () => {
      graph.addDependency('A', 'root');
      executor = new ParallelExecutor(graph);
      
      expect(executor.getRemainingCount()).toBe(2);
    });

    it('should decrement as batches are executed', () => {
      graph.addDependency('A', 'root');
      executor = new ParallelExecutor(graph);
      
      executor.getNextBatch();
      expect(executor.getRemainingCount()).toBe(1);
    });
  });

  describe('BatchResult structure', () => {
    it('should have correct batch index sequence', async () => {
      graph.addDependency('A', 'root');
      executor = new ParallelExecutor(graph);
      const results = await executor.executeBatches(['root', 'A']);
      
      results.forEach((batch: BatchResult, index: number) => {
        expect(batch.batchIndex).toBe(index);
      });
    });

    it('should have valid timestamps', async () => {
      graph.addDependency('A', 'root');
      executor = new ParallelExecutor(graph);
      const results = await executor.executeBatches(['root', 'A']);
      
      for (const batch of results) {
        expect(batch.startedAt).toBeDefined();
        expect(batch.completedAt).toBeDefined();
        // completedAt should be after startedAt
        expect(new Date(batch.completedAt!).getTime()).toBeGreaterThanOrEqual(
          new Date(batch.startedAt).getTime()
        );
      }
    });

    it('should have correct action IDs in results', async () => {
      graph.addDependency('A', 'root');
      executor = new ParallelExecutor(graph);
      const results = await executor.executeBatches(['root', 'A']);
      
      const actionIds = results.flatMap((r: BatchResult) => r.actionIds);
      expect(actionIds).toContain('root');
      expect(actionIds).toContain('A');
    });
  });
});
