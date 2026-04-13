import { describe, it, expect } from "vitest";
import { ProcessMiner } from "../../src/planning/process-miner";

describe("ProcessMiner", () => {
  it("discovers process from action logs", () => {
    const miner = new ProcessMiner();
    const logs = [
      { caseId: "case-1", activity: "Submit Request", timestamp: "2024-01-01T09:00:00Z", resource: "alice" },
      { caseId: "case-1", activity: "Review", timestamp: "2024-01-01T10:00:00Z", resource: "bob" },
      { caseId: "case-1", activity: "Approve", timestamp: "2024-01-01T11:00:00Z", resource: "charlie" },
      { caseId: "case-2", activity: "Submit Request", timestamp: "2024-01-02T09:00:00Z", resource: "alice" },
      { caseId: "case-2", activity: "Review", timestamp: "2024-01-02T10:00:00Z", resource: "bob" },
    ];
    const result = miner.discoverProcess(logs);
    expect(result.model.activities.size).toBeGreaterThan(0);
    expect(result.model.startActivities.size).toBeGreaterThan(0);
    expect(result.model.endActivities.size).toBeGreaterThan(0);
  });

  it("detects bottlenecks", () => {
    const miner = new ProcessMiner();
    const logs = [
      { caseId: "case-1", activity: "Fast Step", timestamp: "2024-01-01T09:00:00Z" },
      { caseId: "case-1", activity: "Slow Step", timestamp: "2024-01-01T12:00:00Z" },
      { caseId: "case-2", activity: "Fast Step", timestamp: "2024-01-02T09:00:00Z" },
      { caseId: "case-2", activity: "Slow Step", timestamp: "2024-01-02T12:00:00Z" },
    ];
    const result = miner.discoverProcess(logs);
    const slowBottleneck = result.bottlenecks.find(b => b.activity === "Slow Step");
    expect(slowBottleneck).toBeDefined();
    expect(slowBottleneck!.avgCycleTime).toBeGreaterThan(0);
  });

  it("calculates cycle time", () => {
    const miner = new ProcessMiner();
    const logs = [
      { caseId: "case-1", activity: "Start", timestamp: "2024-01-01T09:00:00Z" },
      { caseId: "case-1", activity: "End", timestamp: "2024-01-01T11:00:00Z" },
    ];
    const result = miner.discoverProcess(logs);
    expect(result.cycleTimeMinutes).toBeGreaterThan(0);
  });

  it("extracts discovered paths", () => {
    const miner = new ProcessMiner();
    const logs = [
      { caseId: "case-1", activity: "A", timestamp: "2024-01-01T09:00:00Z" },
      { caseId: "case-1", activity: "B", timestamp: "2024-01-01T10:00:00Z" },
      { caseId: "case-1", activity: "C", timestamp: "2024-01-01T11:00:00Z" },
    ];
    const result = miner.discoverProcess(logs);
    expect(result.discoveredPaths.length).toBeGreaterThan(0);
  });
});
