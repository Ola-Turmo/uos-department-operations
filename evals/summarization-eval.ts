/**
 * LLM Summarization Evaluation Suite
 * 
 * Executable quality checks for the LLM-powered summarization capability.
 * Tests cycle summaries, bottleneck summaries, and operations status summaries.
 */

import { describe, it, expect } from "vitest";
import { LLMSummarizer } from "../src/llm/summarizer.js";
import type { PlanningCycle, OwnedAction, BottleneckReport, KnowledgeAsset, RefreshTask } from "../src/types.js";

// Mock LLM client for testing
class MockSummarizerClient {
  async complete(prompt: string): Promise<string> {
    if (prompt.includes("cycle")) {
      return JSON.stringify({
        executiveSummary: "Sprint completed successfully with 85% action completion",
        keyOutcomes: ["Feature shipped", "Tech debt reduced"],
        adherenceScore: 0.85,
        nextSteps: ["Plan next sprint", "Review metrics"]
      });
    }
    
    if (prompt.includes("bottleneck")) {
      return JSON.stringify({
        executiveSummary: "Moderate bottleneck detected in deployment pipeline",
        keyMetrics: ["Queue depth: 15", "Avg wait time: 45 min"],
        resolutionTimeline: "2-3 days"
      });
    }
    
    return JSON.stringify({
      summary: "Operations running normally",
      recommendedActions: ["Continue monitoring"]
    });
  }
}

describe("LLMSummarizer Evaluation", () => {
  describe("Cycle summarization", () => {
    const summarizer = new LLMSummarizer(new MockSummarizerClient());

    it("should summarize completed planning cycle", async () => {
      const cycle: PlanningCycle = {
        id: "cycle-1",
        name: "Q1 Sprint 1",
        type: "sprint",
        status: "completed",
        generatedActionIds: ["action-1", "action-2", "action-3"],
        plannedStartDate: "2026-01-01",
        plannedEndDate: "2026-01-14",
        actualStartDate: "2026-01-01",
        actualEndDate: "2026-01-14",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-14"
      };

      const actions: OwnedAction[] = [
        {
          id: "action-1",
          title: "Complete auth module",
          description: "Implement OAuth",
          status: "completed",
          priority: "high",
          ownerRoleKey: "developer",
          sourceInputId: "cycle-1",
          sourceInputType: "meeting",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: "2026-01-01",
          updatedAt: "2026-01-10"
        },
        {
          id: "action-2",
          title: "Write tests",
          description: "Add unit tests",
          status: "completed",
          priority: "medium",
          ownerRoleKey: "developer",
          sourceInputId: "cycle-1",
          sourceInputType: "meeting",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: "2026-01-01",
          updatedAt: "2026-01-12"
        },
        {
          id: "action-3",
          title: "Deploy to staging",
          description: "Deploy for testing",
          status: "completed",
          priority: "high",
          ownerRoleKey: "devops",
          sourceInputId: "cycle-1",
          sourceInputType: "meeting",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: "2026-01-01",
          updatedAt: "2026-01-14"
        }
      ];

      const summary = await summarizer.summarizeCycle(cycle, actions);

      expect(summary.cycleId).toBe("cycle-1");
      expect(summary.completedActions).toBe(3);
      expect(summary.generatedActions).toBe(3);
      expect(summary.adherenceScore).toBeGreaterThan(0.8);
    });

    it("should calculate adherence score correctly", async () => {
      const cycle: PlanningCycle = {
        id: "cycle-2",
        name: "Partial Sprint",
        type: "sprint",
        status: "completed",
        generatedActionIds: ["a1", "a2", "a3", "a4"],
        plannedStartDate: "2026-01-01",
        plannedEndDate: "2026-01-14",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-14"
      };

      const actions: OwnedAction[] = [
        { id: "a1", title: "Task 1", description: "", status: "completed", priority: "high", sourceInputId: "", sourceInputType: "meeting", tags: [], linkedInitiatives: [], linkedProjects: [], checkInNotes: [], createdAt: "", updatedAt: "" },
        { id: "a2", title: "Task 2", description: "", status: "completed", priority: "medium", sourceInputId: "", sourceInputType: "meeting", tags: [], linkedInitiatives: [], linkedProjects: [], checkInNotes: [], createdAt: "", updatedAt: "" },
        { id: "a3", title: "Task 3", description: "", status: "in-progress", priority: "low", sourceInputId: "", sourceInputType: "meeting", tags: [], linkedInitiatives: [], linkedProjects: [], checkInNotes: [], createdAt: "", updatedAt: "" },
        { id: "a4", title: "Task 4", description: "", status: "cancelled", priority: "medium", sourceInputId: "", sourceInputType: "meeting", tags: [], linkedInitiatives: [], linkedProjects: [], checkInNotes: [], createdAt: "", updatedAt: "" }
      ];

      const summary = await summarizer.summarizeCycle(cycle, actions);

      // 2 completed out of 4 generated = 0.5 adherence
      expect(summary.adherenceScore).toBe(0.5);
      expect(summary.completedActions).toBe(2);
    });
  });

  describe("Operations status summarization", () => {
    it("should detect red health status", async () => {
      const summarizer = new LLMSummarizer();
      
      const actions: OwnedAction[] = [
        {
          id: "critical-1",
          title: "Critical task",
          description: "",
          status: "in-progress",
          priority: "critical",
          dueDate: "2020-01-01", // Overdue
          sourceInputId: "",
          sourceInputType: "meeting",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: "",
          updatedAt: ""
        },
        {
          id: "blocked-1",
          title: "Blocked task",
          description: "",
          status: "blocked",
          priority: "high",
          sourceInputId: "",
          sourceInputType: "meeting",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: "",
          updatedAt: ""
        }
      ];

      const assets: KnowledgeAsset[] = [];
      const reports: BottleneckReport[] = [];

      const status = await summarizer.summarizeOperationsStatus(actions, assets, reports);

      expect(status.overallHealth).toBe("red");
      expect(status.overdueActionsCount).toBeGreaterThan(0);
      expect(status.blockedActionsCount).toBeGreaterThan(0);
      expect(status.criticalAlerts.length).toBeGreaterThan(0);
    });

    it("should detect yellow health status", async () => {
      const summarizer = new LLMSummarizer();
      
      const actions: OwnedAction[] = [
        {
          id: "overdue-1",
          title: "Overdue task",
          description: "",
          status: "in-progress",
          priority: "medium",
          dueDate: "2020-01-01",
          sourceInputId: "",
          sourceInputType: "meeting",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: "",
          updatedAt: ""
        }
      ];

      const status = await summarizer.summarizeOperationsStatus(actions, [], []);

      expect(status.overallHealth).toBe("yellow");
    });

    it("should show green health when healthy", async () => {
      const summarizer = new LLMSummarizer();
      
      const actions: OwnedAction[] = [
        {
          id: "healthy-1",
          title: "On track task",
          description: "",
          status: "in-progress",
          priority: "low",
          dueDate: "2030-01-01", // Future date
          sourceInputId: "",
          sourceInputType: "meeting",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: "",
          updatedAt: ""
        }
      ];

      const status = await summarizer.summarizeOperationsStatus(actions, [], []);

      expect(status.overallHealth).toBe("green");
    });
  });

  describe("Bottleneck summarization", () => {
    const summarizer = new LLMSummarizer(new MockSummarizerClient());

    it("should summarize bottleneck report", async () => {
      const report: BottleneckReport = {
        id: "bottleneck-1",
        name: "Deployment Pipeline Issue",
        description: "Slow deployment pipeline causing delays",
        severity: "significant",
        affectedProcesses: ["deployment", "releases"],
        affectedAssetIds: [],
        affectedActionIds: ["action-1"],
        metrics: [
          { name: "Queue Depth", value: 15, threshold: 5, direction: "above" },
          { name: "Avg Wait Time", value: 45, threshold: 10, direction: "above" }
        ],
        recommendations: [
          "Scale build agents",
          "Optimize build scripts"
        ],
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01"
      };

      const summary = await summarizer.summarizeBottleneck(report);

      expect(summary.reportId).toBe("bottleneck-1");
      expect(summary.severity).toBe("significant");
      expect(summary.keyMetrics.length).toBeGreaterThan(0);
      expect(summary.recommendations.length).toBeGreaterThan(0);
    });
  });
});
