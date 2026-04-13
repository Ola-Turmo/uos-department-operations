/**
 * ML Bottleneck Detector Evaluation Suite
 * 
 * Executable quality checks for the ML-based bottleneck detection model.
 * Tests signal detection accuracy, severity classification, and recommendations.
 */

import { describe, it, expect } from "vitest";
import { BottleneckDetector } from "../src/ml/bottleneck-detector.js";
import type { OwnedAction, KnowledgeAsset, RefreshTask } from "../src/types.js";

describe("BottleneckDetector Evaluation", () => {
  const detector = new BottleneckDetector();

  describe("Action delay detection", () => {
    it("should detect delayed actions", () => {
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

      const actions: OwnedAction[] = [
        {
          id: "delayed-1",
          title: "Long pending task",
          description: "This has been open for 15 days",
          status: "in-progress",
          priority: "medium",
          sourceInputId: "",
          sourceInputType: "meeting",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: twoWeeksAgo.toISOString(),
          updatedAt: twoWeeksAgo.toISOString()
        }
      ];

      const result = detector.detect(actions, [], []);

      const delaySignal = result.signals.find(s => s.type === "action-delay");
      expect(delaySignal).toBeDefined();
      expect(delaySignal!.affectedIds).toContain("delayed-1");
    });

    it("should flag critical delayed actions", () => {
      const now = new Date();
      const longAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const actions: OwnedAction[] = [
        {
          id: "critical-delayed",
          title: "Overdue critical task",
          description: "Critical task that is overdue",
          status: "in-progress",
          priority: "critical",
          dueDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
          sourceInputId: "",
          sourceInputType: "meeting",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: longAgo.toISOString(),
          updatedAt: longAgo.toISOString()
        }
      ];

      const result = detector.detect(actions, [], []);

      const delaySignal = result.signals.find(s => s.type === "action-delay");
      expect(delaySignal).toBeDefined();
      expect(delaySignal!.severity).toBe("critical");
    });
  });

  describe("Owner concentration detection", () => {
    it("should detect overloaded owners", () => {
      const actions: OwnedAction[] = [
        {
          id: `overload-1`,
          title: "Task 1",
          description: "",
          status: "in-progress",
          priority: "medium",
          ownerRoleKey: "busy-person",
          sourceInputId: "",
          sourceInputType: "task",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: `overload-2`,
          title: "Task 2",
          description: "",
          status: "in-progress",
          priority: "medium",
          ownerRoleKey: "busy-person",
          sourceInputId: "",
          sourceInputType: "task",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: `overload-3`,
          title: "Task 3",
          description: "",
          status: "in-progress",
          priority: "medium",
          ownerRoleKey: "busy-person",
          sourceInputId: "",
          sourceInputType: "task",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: `overload-4`,
          title: "Task 4",
          description: "",
          status: "in-progress",
          priority: "medium",
          ownerRoleKey: "busy-person",
          sourceInputId: "",
          sourceInputType: "task",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: `overload-5`,
          title: "Task 5",
          description: "",
          status: "in-progress",
          priority: "medium",
          ownerRoleKey: "busy-person",
          sourceInputId: "",
          sourceInputType: "task",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const result = detector.detect(actions, [], []);

      const concentrationSignal = result.signals.find(s => s.type === "owner-concentration");
      expect(concentrationSignal).toBeDefined();
      expect(concentrationSignal!.affectedIds).toContain("busy-person");
    });
  });

  describe("Dependency chain detection", () => {
    it("should detect blocked actions", () => {
      const actions: OwnedAction[] = [
        {
          id: "blocked-1",
          title: "Waiting on deployment",
          description: "",
          status: "blocked",
          blockedReason: "Waiting for infrastructure",
          priority: "high",
          sourceInputId: "",
          sourceInputType: "task",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const result = detector.detect(actions, [], []);

      const dependencySignal = result.signals.find(s => s.type === "dependency-chain");
      expect(dependencySignal).toBeDefined();
      expect(dependencySignal!.affectedIds).toContain("blocked-1");
      expect(dependencySignal!.severity).toBe("critical");
    });
  });

  describe("Knowledge gap detection", () => {
    it("should detect stale knowledge assets", () => {
      const now = new Date();
      const staleDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);

      const assets: KnowledgeAsset[] = [
        {
          id: "stale-doc-1",
          name: "Old Runbook",
          type: "runbook",
          description: "Not updated in 100 days",
          currentFreshnessStatus: "stale",
          lastReviewedAt: staleDate.toISOString(),
          lastUpdatedAt: staleDate.toISOString(),
          expectedRefreshIntervalDays: 30,
          ownerRoleKey: "ops-lead",
          linkedInitiatives: [],
          tags: [],
          createdAt: staleDate.toISOString(),
          updatedAt: staleDate.toISOString()
        },
        {
          id: "stale-doc-2",
          name: "Old Procedure",
          type: "procedure",
          description: "Outdated procedure",
          currentFreshnessStatus: "stale",
          lastReviewedAt: staleDate.toISOString(),
          lastUpdatedAt: staleDate.toISOString(),
          expectedRefreshIntervalDays: 60,
          ownerRoleKey: "ops-lead",
          linkedInitiatives: [],
          tags: [],
          createdAt: staleDate.toISOString(),
          updatedAt: staleDate.toISOString()
        },
        {
          id: "stale-doc-3",
          name: "Old Guide",
          type: "guide",
          description: "Guide needs update",
          currentFreshnessStatus: "stale",
          lastReviewedAt: staleDate.toISOString(),
          lastUpdatedAt: staleDate.toISOString(),
          expectedRefreshIntervalDays: 90,
          ownerRoleKey: "ops-lead",
          linkedInitiatives: [],
          tags: [],
          createdAt: staleDate.toISOString(),
          updatedAt: staleDate.toISOString()
        }
      ];

      const result = detector.detect([], assets, []);

      const knowledgeSignal = result.signals.find(s => s.type === "knowledge-gap");
      expect(knowledgeSignal).toBeDefined();
      expect(knowledgeSignal!.affectedIds.length).toBeGreaterThanOrEqual(3);
    });

    it("should detect critical stale assets", () => {
      const now = new Date();
      const criticalDate = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000);

      const assets: KnowledgeAsset[] = [
        {
          id: "critical-doc",
          name: "Ancient Policy",
          type: "policy",
          description: "Policy not reviewed in over 6 months",
          currentFreshnessStatus: "critical",
          lastReviewedAt: criticalDate.toISOString(),
          lastUpdatedAt: criticalDate.toISOString(),
          expectedRefreshIntervalDays: 180,
          ownerRoleKey: undefined,
          linkedInitiatives: [],
          tags: [],
          createdAt: criticalDate.toISOString(),
          updatedAt: criticalDate.toISOString()
        }
      ];

      const result = detector.detect([], assets, []);

      const knowledgeSignal = result.signals.find(s => s.type === "knowledge-gap");
      expect(knowledgeSignal).toBeDefined();
      expect(knowledgeSignal!.severity).toBe("critical");
    });
  });

  describe("Overall severity calculation", () => {
    it("should report critical overall when any critical signal exists", () => {
      const actions: OwnedAction[] = [
        {
          id: "critical-blocked",
          title: "Blocked critical",
          description: "",
          status: "blocked",
          priority: "critical",
          sourceInputId: "",
          sourceInputType: "task",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const result = detector.detect(actions, [], []);

      expect(result.overallSeverity).toBe("critical");
    });

    it("should report minor overall when no significant issues", () => {
      const actions: OwnedAction[] = [
        {
          id: "healthy-action",
          title: "Normal task",
          description: "",
          status: "in-progress",
          priority: "low",
          sourceInputId: "",
          sourceInputType: "task",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const result = detector.detect(actions, [], []);

      expect(result.signals.length).toBe(0);
    });
  });

  describe("Recommendation generation", () => {
    it("should generate actionable recommendations", () => {
      const actions: OwnedAction[] = [
        {
          id: "blocked-critical",
          title: "Critical blocked task",
          description: "",
          status: "blocked",
          priority: "critical",
          sourceInputId: "",
          sourceInputType: "task",
          tags: [],
          linkedInitiatives: [],
          linkedProjects: [],
          checkInNotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const result = detector.detect(actions, [], []);

      expect(result.recommendedActions.length).toBeGreaterThan(0);
      expect(result.recommendedActions.some(r => r.includes("URGENT"))).toBe(true);
    });
  });

  describe("Detection statistics", () => {
    it("should return detection stats", () => {
      const stats = detector.getStats();

      expect(stats).toHaveProperty("historicalDataPoints");
      expect(stats).toHaveProperty("detectionThreshold");
      expect(typeof stats.historicalDataPoints).toBe("number");
      expect(typeof stats.detectionThreshold).toBe("number");
    });
  });
});
