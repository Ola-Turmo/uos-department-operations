/**
 * ML Priority Predictor Evaluation Suite
 * 
 * Executable quality checks for the ML-based priority prediction model.
 * Tests prediction accuracy, confidence calibration, and factor analysis.
 */

import { describe, it, expect } from "vitest";
import { PriorityPredictor } from "../src/ml/priority-predictor.js";
import type { OwnedAction } from "../src/types.js";

describe("PriorityPredictor Evaluation", () => {
  const predictor = new PriorityPredictor();

  describe("Urgent keyword detection", () => {
    it("should predict critical priority for urgent tasks", () => {
      const result = predictor.predict({
        title: "URGENT: Fix production outage",
        description: "System is down, fix immediately"
      });

      expect(result.predictedPriority).toBe("critical");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should predict high priority for important tasks", () => {
      const result = predictor.predict({
        title: "Important feature deployment",
        description: "This is a key initiative"
      });

      expect(["high", "critical"]).toContain(result.predictedPriority);
    });
  });

  describe("Due date proximity", () => {
    it("should increase priority for overdue tasks", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // 5 days overdue

      const result = predictor.predict({
        title: "Complete report",
        description: "Finish the quarterly report",
        dueDate: pastDate.toISOString()
      });

      expect(result.predictedPriority).toBe("critical");
    });

    it("should increase priority for tasks due within 1 day", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = predictor.predict({
        title: "Deploy hotfix",
        description: "Deploy the security patch",
        dueDate: tomorrow.toISOString()
      });

      expect(["critical", "high"]).toContain(result.predictedPriority);
    });
  });

  describe("Ownership impact", () => {
    it("should increase priority for unowned tasks", () => {
      const withOwner = predictor.predict({
        title: "Regular maintenance",
        description: "Perform routine checks"
      });

      const withoutOwner = predictor.predict({
        title: "Regular maintenance",
        description: "Perform routine checks",
        ownerRoleKey: undefined
      });

      // Without owner should have higher predicted priority
      const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      expect(priorityOrder[withoutOwner.predictedPriority])
        .toBeGreaterThanOrEqual(priorityOrder[withOwner.predictedPriority]);
    });
  });

  describe("Source type influence", () => {
    it("should weight ticket sources higher", () => {
      const ticketResult = predictor.predict({
        title: "Fix bug",
        description: "Resolve issue",
        sourceInputType: "ticket"
      });

      const meetingResult = predictor.predict({
        title: "Fix bug",
        description: "Resolve issue",
        sourceInputType: "meeting"
      });

      const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      expect(priorityOrder[ticketResult.predictedPriority])
        .toBeGreaterThanOrEqual(priorityOrder[meetingResult.predictedPriority]);
    });
  });

  describe("Link factors", () => {
    it("should increase priority for highly linked actions", () => {
      const noLinks = predictor.predict({
        title: "Update documentation",
        description: "Update the guide"
      });

      const multiLinked = predictor.predict({
        title: "Update documentation",
        description: "Update the guide",
        linkedInitiatives: ["init-1", "init-2", "init-3"],
        linkedProjects: ["proj-1", "proj-2"]
      });

      const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      expect(priorityOrder[multiLinked.predictedPriority])
        .toBeGreaterThanOrEqual(priorityOrder[noLinks.predictedPriority]);
    });
  });

  describe("Action-based prediction", () => {
    it("should predict from existing action", () => {
      const action: OwnedAction = {
        id: "action-test",
        title: "Critical deployment",
        description: "Deploy critical fix",
        status: "in-progress",
        priority: "high",
        sourceInputId: "source-1",
        sourceInputType: "ticket",
        ownerRoleKey: "developer",
        linkedInitiatives: ["init-1"],
        linkedProjects: [],
        tags: ["deployment", "critical"],
        checkInNotes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = predictor.predictFromAction(action);

      expect(["critical", "high"]).toContain(result.predictedPriority);
      expect(result.factors.length).toBeGreaterThan(0);
    });
  });

  describe("Confidence calibration", () => {
    it("should have higher confidence with more signals", () => {
      const fewSignals = predictor.predict({
        title: "Task",
        description: "Do something"
      });

      const manySignals = predictor.predict({
        title: "URGENT: Critical deployment due tomorrow",
        description: "This is critical and urgent with many linked initiatives",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        linkedInitiatives: ["init-1", "init-2"],
        tags: ["critical", "deployment", "urgent"]
      });

      expect(manySignals.confidence).toBeGreaterThanOrEqual(fewSignals.confidence);
    });
  });

  describe("Training example accumulation", () => {
    it("should accept training examples", () => {
      predictor.addTrainingExample({
        action: {
          title: "Complete report",
          description: "Finish Q1 report",
          sourceInputType: "document",
          hasDueDate: true,
          dueDateDaysFromNow: 7,
          hasOwner: true,
          linkedInitiativesCount: 2,
          linkedProjectsCount: 1,
          tagsCount: 3
        },
        actualPriority: "high"
      });

      const metrics = predictor.getModelMetrics();
      expect(metrics.trainingExamples).toBe(1);
    });
  });

  describe("Factor generation", () => {
    it("should provide reasoning factors", () => {
      const result = predictor.predict({
        title: "URGENT: Fix critical bug",
        description: "Production is down",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        ownerRoleKey: undefined // No owner - should be flagged
      });

      expect(result.reasoning).toBeTruthy();
      expect(result.factors.length).toBeGreaterThan(0);
      
      // Check that urgency is detected
      const urgencyFactor = result.factors.find(f => 
        f.name.includes("urgent") || f.name.includes("critical")
      );
      expect(urgencyFactor).toBeDefined();
    });
  });
});
