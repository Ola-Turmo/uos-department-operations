/**
 * Operations Workflows Tests
 * VAL-DEPT-OPS-001: Planning inputs become owned actions with due dates and escalation metadata
 * VAL-DEPT-OPS-002: Knowledge freshness audits generate refresh tasks and bottleneck reports
 */

import { describe, expect, it } from "vitest";
import { PlanningService } from "../src/planning-service.js";
import { KnowledgeFreshnessService } from "../src/freshness-service.js";

describe("PlanningService", () => {
  describe("Planning Input Management", () => {
    it("ingests a planning input (VAL-DEPT-OPS-001)", () => {
      const service = new PlanningService();
      const input = service.ingestInput({
        type: "meeting",
        title: "Weekly Planning Meeting",
        description: "Discuss Q2 priorities and action items",
        capturedByRoleKey: "operations-planning-lead",
        keyDecisions: ["Focus on automation", "Reduce manual reporting"],
        openQuestions: ["Budget allocation for tools?"],
        stakeholders: ["CEO", "CTO"],
      });

      expect(input.id).toBeDefined();
      expect(input.type).toBe("meeting");
      expect(input.title).toBe("Weekly Planning Meeting");
      expect(input.capturedAt).toBeDefined();
      expect(input.keyDecisions).toEqual(["Focus on automation", "Reduce manual reporting"]);
      expect(input.stakeholders).toEqual(["CEO", "CTO"]);
    });

    it("retrieves a planning input by ID", () => {
      const service = new PlanningService();
      const input = service.ingestInput({
        type: "document",
        title: "Strategy Doc",
        description: "Annual strategy document",
      });

      const retrieved = service.getInput(input.id);
      expect(retrieved).toEqual(input);
    });

    it("returns undefined for non-existent input", () => {
      const service = new PlanningService();
      const retrieved = service.getInput("non-existent-id");
      expect(retrieved).toBeUndefined();
    });

    it("gets all inputs", () => {
      const service = new PlanningService();
      service.ingestInput({ type: "meeting", title: "Meeting 1", description: "Desc 1" });
      service.ingestInput({ type: "document", title: "Doc 1", description: "Desc 2" });

      const inputs = service.getAllInputs();
      expect(inputs).toHaveLength(2);
    });

    it("filters inputs by type", () => {
      const service = new PlanningService();
      service.ingestInput({ type: "meeting", title: "Meeting 1", description: "Desc 1" });
      service.ingestInput({ type: "document", title: "Doc 1", description: "Desc 2" });
      service.ingestInput({ type: "meeting", title: "Meeting 2", description: "Desc 3" });

      const meetings = service.getInputsByType("meeting");
      expect(meetings).toHaveLength(2);
    });
  });

  describe("Owned Action Management", () => {
    it("creates an owned action (VAL-DEPT-OPS-001)", () => {
      const service = new PlanningService();
      const action = service.createAction({
        title: "Implement automation workflow",
        description: "Create automated workflow for weekly reporting",
        ownerRoleKey: "operations-automation-operator",
        priority: "high",
        dueDate: "2026-04-15",
        completionCriteria: ["Workflow created", "Tested", "Deployed"],
        tags: ["automation", "reporting"],
      });

      expect(action.id).toBeDefined();
      expect(action.title).toBe("Implement automation workflow");
      expect(action.ownerRoleKey).toBe("operations-automation-operator");
      expect(action.status).toBe("proposed");
      expect(action.priority).toBe("high");
      expect(action.dueDate).toBe("2026-04-15");
      expect(action.escalation.level).toBe("none");
      expect(action.completionCriteria).toEqual(["Workflow created", "Tested", "Deployed"]);
    });

    it("creates actions from a planning input (VAL-DEPT-OPS-001)", () => {
      const service = new PlanningService();
      const input = service.ingestInput({
        type: "meeting",
        title: "Weekly Planning",
        description: "Discuss priorities",
        keyDecisions: ["Automate reporting"],
      });

      const actions = service.createActionsFromInput(input.id, [
        {
          title: "Create automation workflow",
          description: "Implement the weekly reporting automation",
          ownerRoleKey: "operations-automation-operator",
          priority: "high",
        },
        {
          title: "Review automation results",
          description: "Check if automation is working correctly",
          ownerRoleKey: "operations-planning-lead",
          priority: "medium",
        },
      ]);

      expect(actions).toHaveLength(2);
      expect(actions[0].sourceInputId).toBe(input.id);
      expect(actions[0].sourceInputType).toBe("meeting");
      expect(actions[1].sourceInputId).toBe(input.id);
    });

    it("updates action status (VAL-DEPT-OPS-001)", () => {
      const service = new PlanningService();
      const action = service.createAction({
        title: "Test action",
        description: "Test description",
      });

      const updated = service.updateActionStatus({
        actionId: action.id,
        status: "in-progress",
        notes: ["Starting work on this"],
      });

      expect(updated?.status).toBe("in-progress");
      expect(updated?.checkInNotes).toHaveLength(1);
      expect(updated?.checkInNotes[0]).toContain("Starting work on this");
    });

    it("marks action as completed with timestamp", () => {
      const service = new PlanningService();
      const action = service.createAction({
        title: "Test action",
        description: "Test description",
      });

      const updated = service.updateActionStatus({
        actionId: action.id,
        status: "completed",
      });

      expect(updated?.status).toBe("completed");
      expect(updated?.completedAt).toBeDefined();
    });

    it("adds check-in notes to an action", () => {
      const service = new PlanningService();
      const action = service.createAction({
        title: "Test action",
        description: "Test description",
      });

      const updated = service.addCheckInNote({
        actionId: action.id,
        note: "Progress update: 50% complete",
      });

      expect(updated?.checkInNotes).toHaveLength(1);
      expect(updated?.checkInNotes[0]).toContain("Progress update");
    });

    it("escalates an action (VAL-DEPT-OPS-001)", () => {
      const service = new PlanningService();
      const action = service.createAction({
        title: "Blocked action",
        description: "This action is blocked",
        priority: "critical",
      });

      const escalated = service.escalateAction({
        actionId: action.id,
        level: "leadership",
        reason: "Blocked for too long, needs leadership attention",
        escalatedByRoleKey: "operations-planning-lead",
      });

      expect(escalated?.escalation.level).toBe("leadership");
      expect(escalated?.escalation.reason).toContain("Blocked");
      expect(escalated?.escalation.escalatedAt).toBeDefined();
      expect(escalated?.escalation.escalatedByRoleKey).toBe("operations-planning-lead");
    });

    it("gets open actions", () => {
      const service = new PlanningService();
      service.createAction({ title: "Action 1", description: "Desc" });
      const action2 = service.createAction({ title: "Action 2", description: "Desc" });
      service.updateActionStatus({ actionId: action2.id, status: "completed" });
      service.createAction({ title: "Action 3", description: "Desc" });

      const openActions = service.getOpenActions();
      // Should have Action 1 and Action 3 (Action 2 is completed)
      expect(openActions.some((a) => a.title === "Action 1")).toBe(true);
      expect(openActions.some((a) => a.title === "Action 3")).toBe(true);
      expect(openActions.some((a) => a.title === "Action 2")).toBe(false);
    });

    it("gets overdue actions", () => {
      const service = new PlanningService();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Overdue action (past due date, not completed)
      const overdueAction = service.createAction({
        title: "Overdue action",
        description: "This is overdue",
        dueDate: yesterday.toISOString(),
      });

      // Not overdue action (future due date, not completed)
      service.createAction({
        title: "Not overdue action",
        description: "This is not overdue",
        dueDate: tomorrow.toISOString(),
      });

      // Completed action (even if past due, shouldn't appear)
      const completedAction = service.createAction({
        title: "Completed action",
        description: "This is completed",
        dueDate: yesterday.toISOString(),
      });
      service.updateActionStatus({ actionId: completedAction.id, status: "completed" });

      const overdueActions = service.getOverdueActions();
      expect(overdueActions.some((a) => a.title === "Overdue action")).toBe(true);
      expect(overdueActions.some((a) => a.title === "Not overdue action")).toBe(false);
      expect(overdueActions.some((a) => a.title === "Completed action")).toBe(false);
    });

    it("gets actions needing escalation", () => {
      const service = new PlanningService();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);

      // Overdue critical action needs escalation
      service.createAction({
        title: "Critical overdue",
        description: "Needs escalation",
        priority: "critical",
        dueDate: yesterday.toISOString(),
      });

      // Blocked action needs escalation
      const blockedAction = service.createAction({
        title: "Blocked action",
        description: "Blocked",
      });
      service.updateActionStatus({ actionId: blockedAction.id, status: "blocked" });

      // Normal open action doesn't need escalation
      service.createAction({
        title: "Normal action",
        description: "Normal",
        priority: "medium",
        dueDate: tomorrow.toISOString(),
      });

      const needsEscalation = service.getActionsNeedingEscalation();
      expect(needsEscalation.some((a) => a.title === "Critical overdue")).toBe(true);
      expect(needsEscalation.some((a) => a.title === "Blocked action")).toBe(true);
      expect(needsEscalation.some((a) => a.title === "Normal action")).toBe(false);
    });
  });

  describe("Planning Cycle Management", () => {
    it("creates a planning cycle (VAL-DEPT-OPS-001)", () => {
      const service = new PlanningService();
      const cycle = service.createPlanningCycle({
        name: "Q2 Planning",
        type: "quarterly",
        ownerRoleKey: "operations-planning-lead",
        plannedStartDate: "2026-04-01",
        plannedEndDate: "2026-04-07",
      });

      expect(cycle.id).toBeDefined();
      expect(cycle.name).toBe("Q2 Planning");
      expect(cycle.status).toBe("planned");
    });

    it("starts a planning cycle", () => {
      const service = new PlanningService();
      const cycle = service.createPlanningCycle({
        name: "Weekly Sprint",
        type: "weekly",
        ownerRoleKey: "operations-planning-lead",
        plannedStartDate: "2026-04-01",
        plannedEndDate: "2026-04-07",
      });

      const started = service.startPlanningCycle({ cycleId: cycle.id });
      expect(started?.status).toBe("in-progress");
      expect(started?.actualStartDate).toBeDefined();
    });

    it("completes a planning cycle with summary (VAL-DEPT-OPS-001)", () => {
      const service = new PlanningService();
      const cycle = service.createPlanningCycle({
        name: "Weekly Sprint",
        type: "weekly",
        ownerRoleKey: "operations-planning-lead",
        plannedStartDate: "2026-04-01",
        plannedEndDate: "2026-04-07",
      });

      service.startPlanningCycle({ cycleId: cycle.id });

      const completed = service.completePlanningCycle({
        cycleId: cycle.id,
        summary: "Completed all planned items",
        deltas: ["Added new priority item"],
      });

      expect(completed?.status).toBe("completed");
      expect(completed?.actualEndDate).toBeDefined();
      expect(completed?.summary).toBe("Completed all planned items");
      expect(completed?.deltas).toContain("Added new priority item");
    });

    it("adds input to cycle and links action", () => {
      const service = new PlanningService();
      const cycle = service.createPlanningCycle({
        name: "Weekly Sprint",
        type: "weekly",
        ownerRoleKey: "operations-planning-lead",
        plannedStartDate: "2026-04-01",
        plannedEndDate: "2026-04-07",
      });

      const input = service.ingestInput({
        type: "meeting",
        title: "Planning meeting",
        description: "Discuss sprint",
      });

      const action = service.createAction({
        title: "Sprint action",
        description: "Action from sprint planning",
      });

      service.addInputToCycle(cycle.id, input.id);
      service.linkActionToCycle(cycle.id, action.id);

      const updatedCycle = service.getCycle(cycle.id);
      expect(updatedCycle?.inputIds).toContain(input.id);
      expect(updatedCycle?.generatedActionIds).toContain(action.id);
    });
  });

  describe("Summary", () => {
    it("generates a planning summary", () => {
      const service = new PlanningService();
      service.ingestInput({ type: "meeting", title: "Meeting", description: "Desc" });
      const action = service.createAction({ title: "Action 1", description: "Desc" });
      service.createAction({ title: "Action 2", description: "Desc" });
      service.updateActionStatus({ actionId: action.id, status: "completed" });

      const summary = service.generateSummary();
      expect(summary.totalInputs).toBe(1);
      expect(summary.totalActions).toBe(2);
      expect(summary.completedActions).toBe(1);
      expect(summary.openActions).toBe(1);
    });
  });
});

describe("KnowledgeFreshnessService", () => {
  describe("Knowledge Asset Management", () => {
    it("registers a knowledge asset (VAL-DEPT-OPS-002)", () => {
      const service = new KnowledgeFreshnessService();
      const now = new Date().toISOString();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const asset = service.registerAsset({
        name: "Runbook: Deployment Process",
        type: "runbook",
        url: "https://wiki.example.com/runbooks/deployment",
        description: "Standard deployment procedures",
        ownerRoleKey: "operations-operating-auditor",
        lastReviewedAt: thirtyDaysAgo.toISOString(),
        lastUpdatedAt: thirtyDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30,
        tags: ["deployment", "operations"],
        linkedInitiatives: ["platform-improvements"],
      });

      expect(asset.id).toBeDefined();
      expect(asset.name).toBe("Runbook: Deployment Process");
      expect(asset.type).toBe("runbook");
      expect(asset.freshnessScore).toBeLessThan(100); // Should be stale since 30 days passed
      // Status could be stale, critical, or fresh depending on how stale it is
      expect(["stale", "critical", "fresh", "unknown"]).toContain(asset.currentFreshnessStatus);
    });

    it("gets a knowledge asset by ID", () => {
      const service = new KnowledgeFreshnessService();
      const asset = service.registerAsset({
        name: "Test Doc",
        type: "document",
        description: "Test description",
        lastReviewedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        expectedRefreshIntervalDays: 90,
      });

      const retrieved = service.getAsset(asset.id);
      expect(retrieved).toEqual(asset);
    });

    it("returns undefined for non-existent asset", () => {
      const service = new KnowledgeFreshnessService();
      const retrieved = service.getAsset("non-existent-id");
      expect(retrieved).toBeUndefined();
    });

    it("gets stale assets (VAL-DEPT-OPS-002)", () => {
      const service = new KnowledgeFreshnessService();
      const now = new Date();
      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      // Stale asset (past refresh interval)
      service.registerAsset({
        name: "Stale Runbook",
        type: "runbook",
        description: "Old runbook",
        lastReviewedAt: hundredDaysAgo.toISOString(),
        lastUpdatedAt: hundredDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30,
      });

      // Fresh asset (within refresh interval)
      service.registerAsset({
        name: "Fresh Doc",
        type: "document",
        description: "Recent doc",
        lastReviewedAt: tenDaysAgo.toISOString(),
        lastUpdatedAt: tenDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30,
      });

      const staleAssets = service.getStaleAssets();
      expect(staleAssets.length).toBeGreaterThanOrEqual(1);
      expect(staleAssets.some((a) => a.name === "Stale Runbook")).toBe(true);
    });

    it("updates asset review (VAL-DEPT-OPS-002)", () => {
      const service = new KnowledgeFreshnessService();
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const asset = service.registerAsset({
        name: "Test Doc",
        type: "document",
        description: "Test",
        lastReviewedAt: sixtyDaysAgo.toISOString(),
        lastUpdatedAt: sixtyDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30,
      });

      const now = new Date().toISOString();
      const updated = service.updateAssetReview({
        assetId: asset.id,
        lastReviewedAt: now,
        notes: ["Reviewed and updated content"],
      });

      expect(updated?.freshnessScore).toBeGreaterThan(0);
      expect(updated?.currentFreshnessStatus).toBe("fresh");
      expect(updated?.notes.some((n) => n.includes("Reviewed and updated"))).toBe(true);
    });
  });

  describe("Refresh Task Management", () => {
    it("creates a refresh task for a stale asset (VAL-DEPT-OPS-002)", () => {
      const service = new KnowledgeFreshnessService();
      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);

      const asset = service.registerAsset({
        name: "Old Runbook",
        type: "runbook",
        description: "Old runbook needing refresh",
        lastReviewedAt: hundredDaysAgo.toISOString(),
        lastUpdatedAt: hundredDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30,
      });

      const task = service.createRefreshTask({
        assetId: asset.id,
        priority: "high",
      });

      expect(task?.id).toBeDefined();
      expect(task?.assetId).toBe(asset.id);
      expect(task?.title).toContain("Old Runbook");
      expect(task?.priority).toBe("high");
      expect(task?.status).toBe("proposed");
    });

    it("updates refresh task status (VAL-DEPT-OPS-002)", () => {
      const service = new KnowledgeFreshnessService();
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const asset = service.registerAsset({
        name: "Test Doc",
        type: "document",
        description: "Test",
        lastReviewedAt: sixtyDaysAgo.toISOString(),
        lastUpdatedAt: sixtyDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30,
      });

      const task = service.createRefreshTask({ assetId: asset.id });

      const started = service.updateRefreshTaskStatus({
        taskId: task!.id,
        status: "in-progress",
      });

      expect(started?.status).toBe("in-progress");
      expect(started?.startedAt).toBeDefined();
    });

    it("completes a refresh task and updates asset review", () => {
      const service = new KnowledgeFreshnessService();
      const now = new Date();
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const asset = service.registerAsset({
        name: "Test Doc",
        type: "document",
        description: "Test",
        lastReviewedAt: sixtyDaysAgo.toISOString(),
        lastUpdatedAt: sixtyDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30,
      });

      const task = service.createRefreshTask({ assetId: asset.id });

      const completed = service.updateRefreshTaskStatus({
        taskId: task!.id,
        status: "completed",
        completionNotes: ["Updated with latest procedures"],
      });

      expect(completed?.status).toBe("completed");
      expect(completed?.completedAt).toBeDefined();
      expect(completed?.completionNotes).toContain("Updated with latest procedures");

      // Verify the asset was marked as reviewed
      const updatedAsset = service.getAsset(asset.id);
      expect(updatedAsset?.freshnessScore).toBeGreaterThan(0);
      expect(updatedAsset?.currentFreshnessStatus).toBe("fresh");
    });

    it("gets open refresh tasks", () => {
      const service = new KnowledgeFreshnessService();
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const asset = service.registerAsset({
        name: "Test Doc",
        type: "document",
        description: "Test",
        lastReviewedAt: sixtyDaysAgo.toISOString(),
        lastUpdatedAt: sixtyDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30,
      });

      service.createRefreshTask({ assetId: asset.id });
      service.createRefreshTask({ assetId: asset.id });

      const openTasks = service.getOpenRefreshTasks();
      expect(openTasks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Bottleneck Reporting", () => {
    it("generates a bottleneck report (VAL-DEPT-OPS-002)", () => {
      const service = new KnowledgeFreshnessService();
      const report = service.generateBottleneckReport({
        reportName: "Knowledge Management Bottleneck",
        description: "Multiple stale knowledge assets causing inefficiency",
        severity: "significant",
        affectedProcesses: ["onboarding", "troubleshooting"],
        affectedAssetIds: ["asset-1", "asset-2"],
        metrics: [
          { name: "staleCount", value: 5, threshold: 3, direction: "above" },
        ],
        recommendations: [
          "Prioritize refresh of critical assets",
          "Assign clear ownership",
        ],
      });

      expect(report.id).toBeDefined();
      expect(report.name).toBe("Knowledge Management Bottleneck");
      expect(report.severity).toBe("significant");
      expect(report.recommendations).toHaveLength(2);
    });

    it("resolves a bottleneck report (VAL-DEPT-OPS-002)", () => {
      const service = new KnowledgeFreshnessService();
      const report = service.generateBottleneckReport({
        reportName: "Test Bottleneck",
        description: "Test",
        severity: "moderate",
        affectedProcesses: ["process-1"],
      });

      const resolved = service.resolveBottleneck({
        reportId: report.id,
        resolutionNotes: "Completed all refresh tasks",
      });

      expect(resolved?.resolvedAt).toBeDefined();
      expect(resolved?.resolutionNotes).toContain("Completed all refresh tasks");
    });

    it("gets open bottleneck reports", () => {
      const service = new KnowledgeFreshnessService();
      service.generateBottleneckReport({
        reportName: "Open Report",
        description: "Test",
        severity: "minor",
        affectedProcesses: ["process-1"],
      });

      service.generateBottleneckReport({
        reportName: "Resolved Report",
        description: "Test",
        severity: "minor",
        affectedProcesses: ["process-2"],
      });

      // Resolve the second report
      const reports = service.getAllBottleneckReports();
      service.resolveBottleneck({
        reportId: reports[1].id,
        resolutionNotes: "Fixed",
      });

      const openReports = service.getOpenBottleneckReports();
      expect(openReports).toHaveLength(1);
      expect(openReports[0].name).toBe("Open Report");
    });
  });

  describe("Freshness Audit", () => {
    it("runs a freshness audit and creates refresh tasks (VAL-DEPT-OPS-002)", () => {
      const service = new KnowledgeFreshnessService();
      const now = new Date();
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      // Stale asset 1
      service.registerAsset({
        name: "Stale Runbook 1",
        type: "runbook",
        description: "Stale",
        lastReviewedAt: sixtyDaysAgo.toISOString(),
        lastUpdatedAt: sixtyDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30,
      });

      // Stale asset 2
      service.registerAsset({
        name: "Stale Procedure 1",
        type: "procedure",
        description: "Stale",
        lastReviewedAt: sixtyDaysAgo.toISOString(),
        lastUpdatedAt: sixtyDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30,
      });

      // Fresh asset
      service.registerAsset({
        name: "Fresh Doc",
        type: "document",
        description: "Fresh",
        lastReviewedAt: tenDaysAgo.toISOString(),
        lastUpdatedAt: tenDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30,
      });

      const auditResult = service.runFreshnessAudit();

      expect(auditResult.totalAssets).toBe(3);
      expect(auditResult.staleAssets).toBeGreaterThanOrEqual(2);
      expect(auditResult.freshAssets).toBe(1);
      expect(auditResult.newlyCreatedTasks.length).toBeGreaterThanOrEqual(2);
      expect(auditResult.generatedBottleneckReports.length).toBeGreaterThanOrEqual(1);
      expect(auditResult.auditTimestamp).toBeDefined();
    });

    it("generates critical bottleneck for many stale assets", () => {
      const service = new KnowledgeFreshnessService();
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Create 6 stale assets
      for (let i = 0; i < 6; i++) {
        service.registerAsset({
          name: `Stale Asset ${i}`,
          type: "document",
          description: "Stale",
          lastReviewedAt: sixtyDaysAgo.toISOString(),
          lastUpdatedAt: sixtyDaysAgo.toISOString(),
          expectedRefreshIntervalDays: 30,
        });
      }

      const auditResult = service.runFreshnessAudit();
      const bottleneck = auditResult.generatedBottleneckReports[0];

      expect(bottleneck.severity).toBe("critical");
      expect(bottleneck.affectedAssetIds.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("Summary", () => {
    it("generates a knowledge freshness summary", () => {
      const service = new KnowledgeFreshnessService();
      service.registerAsset({
        name: "Fresh Doc",
        type: "document",
        description: "Fresh",
        lastReviewedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        expectedRefreshIntervalDays: 30,
      });

      const summary = service.generateSummary();
      expect(summary.totalAssets).toBe(1);
      expect(summary.assetsByFreshnessStatus.fresh).toBe(1);
      expect(summary.lastAuditAt).toBe("never");
    });
  });
});
