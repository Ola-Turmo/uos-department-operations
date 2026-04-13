import { describe, it, expect } from "vitest";
import { DependencyGraph } from "../src/dependency-graph";

describe("DependencyGraph", () => {
  it("computes topological sort", () => {
    const graph = new DependencyGraph();
    const result = graph.compute([
      { id: "a", description: "A", dependsOn: [] },
      { id: "b", description: "B", dependsOn: ["a"] },
      { id: "c", description: "C", dependsOn: ["a"] },
      { id: "d", description: "D", dependsOn: ["b", "c"] },
    ]);
    expect(result.sortedIds).toBeDefined();
    expect(result.sortedIds.length).toBe(4);
    // a must come before b and c, b and c before d
    expect(result.sortedIds.indexOf("a")).toBeLessThan(result.sortedIds.indexOf("b"));
    expect(result.sortedIds.indexOf("b")).toBeLessThan(result.sortedIds.indexOf("d"));
  });

  it("detects critical path", () => {
    const graph = new DependencyGraph();
    const result = graph.compute([
      { id: "start", description: "Start", dependsOn: [], estimatedHours: 1 },
      { id: "fast", description: "Fast", dependsOn: ["start"], estimatedHours: 2 },
      { id: "slow", description: "Slow", dependsOn: ["start"], estimatedHours: 8 },
      { id: "end", description: "End", dependsOn: ["fast", "slow"], estimatedHours: 1 },
    ]);
    expect(result.criticalPath).toContain("slow");
  });

  it("groups parallel batches", () => {
    const graph = new DependencyGraph();
    const result = graph.compute([
      { id: "start", description: "Start", dependsOn: [] },
      { id: "a", description: "A", dependsOn: ["start"] },
      { id: "b", description: "B", dependsOn: ["start"] },
      { id: "c", description: "C", dependsOn: ["a", "b"] },
    ]);
    expect(result.parallelBatches.length).toBeGreaterThan(0);
    const batchSizes = result.parallelBatches.map(b => b.length);
    expect(Math.max(...batchSizes)).toBeGreaterThan(1); // at least one parallel batch
  });
});
