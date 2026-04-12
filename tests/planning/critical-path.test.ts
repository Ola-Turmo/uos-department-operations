import { ActionDependencyGraph } from '../../src/planning/dependency-graph';
import { CriticalPathCalculator } from '../../src/planning/critical-path';

describe('CriticalPathCalculator', () => {
  let graph: ActionDependencyGraph;

  beforeEach(() => {
    graph = new ActionDependencyGraph();
  });

  describe('calculateCriticalPath', () => {
    it('should return critical path for a simple 3-node chain', () => {
      // A -> B -> C
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      graph.setActionDuration('A', 3);
      graph.setActionDuration('B', 2);
      graph.setActionDuration('C', 1);

      const calculator = new CriticalPathCalculator(graph);
      const criticalPath = calculator.calculateCriticalPath();

      expect(criticalPath).toEqual(['A', 'B', 'C']);
    });

    it('should return critical path for parallel branches', () => {
      //      -> B (long: 5 days)
      // A ->
      //      -> C (short: 2 days)
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'A');
      graph.addDependency('D', 'B');
      graph.addDependency('D', 'C');
      graph.setActionDuration('A', 1);
      graph.setActionDuration('B', 5);
      graph.setActionDuration('C', 2);
      graph.setActionDuration('D', 1);

      const calculator = new CriticalPathCalculator(graph);
      const criticalPath = calculator.calculateCriticalPath();

      // Critical path should be A -> B -> D
      expect(criticalPath).toEqual(['A', 'B', 'D']);
    });

    it('should return empty array for empty graph', () => {
      const calculator = new CriticalPathCalculator(graph);
      const criticalPath = calculator.calculateCriticalPath();

      expect(criticalPath).toEqual([]);
    });
  });

  describe('getBottleneckActions', () => {
    it('should identify bottlenecks on critical path', () => {
      // A -> B -> C where B is the bottleneck (longest duration)
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      graph.setActionDuration('A', 2);
      graph.setActionDuration('B', 5);
      graph.setActionDuration('C', 1);

      const calculator = new CriticalPathCalculator(graph);
      const bottlenecks = calculator.getBottleneckActions();

      expect(bottlenecks.length).toBe(3); // All are on critical path
      const bottleneckIds = bottlenecks.map((b: { actionId: string }) => b.actionId);
      expect(bottleneckIds).toContain('A');
      expect(bottleneckIds).toContain('B');
      expect(bottleneckIds).toContain('C');
    });

    it('should mark positions correctly as start, middle, end', () => {
      // A -> B -> C
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      graph.setActionDuration('A', 3);
      graph.setActionDuration('B', 2);
      graph.setActionDuration('C', 1);

      const calculator = new CriticalPathCalculator(graph);
      const bottlenecks = calculator.getBottleneckActions();

      const a = bottlenecks.find((b: { actionId: string }) => b.actionId === 'A');
      const b = bottlenecks.find((b: { actionId: string }) => b.actionId === 'B');
      const c = bottlenecks.find((b: { actionId: string }) => b.actionId === 'C');

      expect(a?.position).toBe('start');
      expect(b?.position).toBe('middle');
      expect(c?.position).toBe('end');
    });
  });

  describe('getSlackTime', () => {
    it('should return 0 for actions on critical path', () => {
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      graph.setActionDuration('A', 3);
      graph.setActionDuration('B', 2);
      graph.setActionDuration('C', 1);

      const calculator = new CriticalPathCalculator(graph);

      expect(calculator.getSlackTime('A')).toBe(0);
      expect(calculator.getSlackTime('B')).toBe(0);
      expect(calculator.getSlackTime('C')).toBe(0);
    });

    it('should return positive slack for non-critical actions', () => {
      //      -> B (5 days)
      // A ->
      //      -> C (2 days)
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'A');
      graph.setActionDuration('A', 1);
      graph.setActionDuration('B', 5);
      graph.setActionDuration('C', 2);

      const calculator = new CriticalPathCalculator(graph);

      // A is on critical path (A -> B is 6 days vs A -> C is 3 days)
      expect(calculator.getSlackTime('A')).toBe(0);
      // B is on critical path
      expect(calculator.getSlackTime('B')).toBe(0);
      // C has slack: it can be delayed by 3 days without affecting project duration
      expect(calculator.getSlackTime('C')).toBe(3);
    });
  });

  describe('getCriticalPathMetrics', () => {
    it('should calculate total duration correctly', () => {
      // A -> B -> C (total: 3 + 2 + 1 = 6 days)
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      graph.setActionDuration('A', 3);
      graph.setActionDuration('B', 2);
      graph.setActionDuration('C', 1);

      const calculator = new CriticalPathCalculator(graph);
      const metrics = calculator.getCriticalPathMetrics();

      expect(metrics.totalDuration).toBe(6);
      expect(metrics.criticalActionIds).toEqual(['A', 'B', 'C']);
    });

    it('should count parallel paths', () => {
      //      -> B
      // A ->
      //      -> C
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'A');
      graph.setActionDuration('A', 1);
      graph.setActionDuration('B', 5);
      graph.setActionDuration('C', 2);

      const calculator = new CriticalPathCalculator(graph);
      const metrics = calculator.getCriticalPathMetrics();

      expect(metrics.parallelPathCount).toBe(2);
    });

    it('should count bottleneck actions', () => {
      graph.addDependency('B', 'A');
      graph.addDependency('C', 'B');
      graph.setActionDuration('A', 3);
      graph.setActionDuration('B', 2);
      graph.setActionDuration('C', 1);

      const calculator = new CriticalPathCalculator(graph);
      const metrics = calculator.getCriticalPathMetrics();

      expect(metrics.bottleneckCount).toBe(3);
    });
  });
});
