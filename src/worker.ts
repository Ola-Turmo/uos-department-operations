import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { PlanningService } from "./planning-service.js";
import { KnowledgeFreshnessService } from "./freshness-service.js";
import {
  createInitialConnectorHealthState,
  updateConnectorHealthState,
  computeDepartmentHealthStatus,
  generateToolkitLimitations,
  formatAllLimitations,
  type ConnectorHealthState,
} from "./connector-health.js";
import type {
  IngestPlanningInputParams,
  CreateOwnedActionParams,
  CreatePlanningCycleParams,
  StartPlanningCycleParams,
  CompletePlanningCycleParams,
  UpdateActionStatusParams,
  EscalateActionParams,
  AddCheckInNoteParams,
  RegisterKnowledgeAssetParams,
  UpdateAssetReviewParams,
  CreateRefreshTaskParams,
  UpdateRefreshTaskStatusParams,
  RunFreshnessAuditParams,
  GenerateBottleneckReportParams,
  ResolveBottleneckParams,
  ConnectorHealthSummary,
  SetConnectorHealthParams,
  GetConnectorHealthParams,
} from "./types.js";

// Initialize services
const planningService = new PlanningService();
const freshnessService = new KnowledgeFreshnessService();

// Connector health state (XAF-007)
let connectorHealthState: ConnectorHealthState[] = createInitialConnectorHealthState();

const plugin = definePlugin({
  async setup(ctx) {
    ctx.events.on("issue.created", async (event) => {
      const issueId = event.entityId ?? "unknown";
      await ctx.state.set({ scopeKind: "issue", scopeId: issueId, stateKey: "seen" }, true);
      ctx.logger.info("Observed issue.created", { issueId });
    });

    // Health check (now includes connector health status - XAF-007)
    ctx.data.register("health", async () => {
      const limitations = generateToolkitLimitations(connectorHealthState);
      const overallStatus = computeDepartmentHealthStatus(connectorHealthState);
      return {
        status: overallStatus,
        checkedAt: new Date().toISOString(),
        hasLimitations: limitations.length > 0,
        limitations: limitations,
      };
    });

    // Connector health data (XAF-007)
    ctx.data.register("connectorHealth", async (params) => {
      const p = params as unknown as GetConnectorHealthParams;
      if (p?.toolkitId) {
        const state = connectorHealthState.find((s) => s.toolkitId === p.toolkitId);
        if (!state) {
          return { error: `Connector '${p.toolkitId}' not found` };
        }
        const limitations = state.status !== "ok"
          ? generateToolkitLimitations([state])
          : [];
        return { connector: state, limitations };
      }
      const limitations = generateToolkitLimitations(connectorHealthState);
      const overallStatus = computeDepartmentHealthStatus(connectorHealthState);
      const summary: ConnectorHealthSummary = {
        overallStatus,
        checkedAt: new Date().toISOString(),
        connectors: connectorHealthState,
        limitations,
        hasLimitations: limitations.length > 0,
      };
      return summary;
    });

    // Ping action for testing
    ctx.actions.register("ping", async () => {
      ctx.logger.info("Ping action invoked");
      return { pong: true, at: new Date().toISOString() };
    });

    // ============================================
    // Connector Health Actions (XAF-007)
    // ============================================

    /**
     * Set connector health status (for simulation/testing)
     * XAF-007: Simulate connector degradation to verify limitation messaging
     */
    ctx.actions.register("connector.setHealth", async (params) => {
      const p = params as unknown as SetConnectorHealthParams;
      ctx.logger.info("Setting connector health", { toolkitId: p.toolkitId, status: p.status });
      connectorHealthState = updateConnectorHealthState(
        connectorHealthState,
        p.toolkitId,
        p.status,
        p.error
      );
      const limitations = generateToolkitLimitations(connectorHealthState);
      const overallStatus = computeDepartmentHealthStatus(connectorHealthState);
      return {
        success: true,
        toolkitId: p.toolkitId,
        status: p.status,
        overallStatus,
        limitations,
        formattedLimitations: limitations.length > 0 ? formatAllLimitations(limitations) : undefined,
      };
    });

    /**
     * Get connector health summary
     * XAF-007
     */
    ctx.actions.register("connector.getHealth", async () => {
      const limitations = generateToolkitLimitations(connectorHealthState);
      const overallStatus = computeDepartmentHealthStatus(connectorHealthState);
      return {
        overallStatus,
        checkedAt: new Date().toISOString(),
        connectors: connectorHealthState,
        limitations,
        hasLimitations: limitations.length > 0,
      };
    });

    /**
     * Simulate connector degradation for testing
     * XAF-007
     */
    ctx.actions.register("connector.simulateDegradation", async (params) => {
      const p = params as unknown as { toolkitId: string; severity?: "degraded" | "error" };
      const status = p.severity ?? "degraded";
      ctx.logger.info("Simulating connector degradation", { toolkitId: p.toolkitId, status });
      connectorHealthState = updateConnectorHealthState(
        connectorHealthState,
        p.toolkitId,
        status,
        status === "error"
          ? "Simulated: Connector authentication failed"
          : "Simulated: Connector responding slowly"
      );
      const limitations = generateToolkitLimitations(connectorHealthState);
      const overallStatus = computeDepartmentHealthStatus(connectorHealthState);
      return {
        success: true,
        toolkitId: p.toolkitId,
        status,
        overallStatus,
        limitations,
        formattedLimitations: limitations.length > 0 ? formatAllLimitations(limitations) : undefined,
      };
    });

    /**
     * Restore connector to healthy state
     * XAF-007
     */
    ctx.actions.register("connector.restore", async (params) => {
      const p = params as unknown as { toolkitId: string };
      ctx.logger.info("Restoring connector health", { toolkitId: p.toolkitId });
      connectorHealthState = updateConnectorHealthState(
        connectorHealthState,
        p.toolkitId,
        "ok"
      );
      const limitations = generateToolkitLimitations(connectorHealthState);
      const overallStatus = computeDepartmentHealthStatus(connectorHealthState);
      return {
        success: true,
        toolkitId: p.toolkitId,
        status: "ok",
        overallStatus,
        limitations,
        hasLimitations: limitations.length > 0,
      };
    });

    // ============================================
    // Planning to Action Actions (VAL-DEPT-OPS-001)
    // ============================================

    /**
     * Ingest a planning input (meeting notes, document, etc.)
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.ingestInput", async (params) => {
      const p = params as unknown as IngestPlanningInputParams;
      ctx.logger.info("Ingesting planning input", { type: p.type, title: p.title });
      const input = planningService.ingestInput(p);
      return { input };
    });

    /**
     * Get a planning input by ID
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.getInput", async (params) => {
      const p = params as unknown as { inputId: string };
      const input = planningService.getInput(p.inputId);
      return { input: input ?? null };
    });

    /**
     * Get all planning inputs
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.getAllInputs", async () => {
      const inputs = planningService.getAllInputs();
      return { inputs };
    });

    /**
     * Create an owned action
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.createAction", async (params) => {
      const p = params as unknown as CreateOwnedActionParams;
      ctx.logger.info("Creating owned action", { title: p.title });
      const action = planningService.createAction(p);
      return { action };
    });

    /**
     * Create multiple actions from a planning input
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.createActionsFromInput", async (params) => {
      const p = params as unknown as { inputId: string; actionTemplates: Array<{
        title: string;
        description: string;
        ownerRoleKey?: string;
        priority?: "critical" | "high" | "medium" | "low";
        dueDate?: string;
        completionCriteria?: string[];
        tags?: string[];
      }> };
      ctx.logger.info("Creating actions from input", { inputId: p.inputId, count: p.actionTemplates.length });
      const actions = planningService.createActionsFromInput(p.inputId, p.actionTemplates);
      return { actions };
    });

    /**
     * Get an action by ID
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.getAction", async (params) => {
      const p = params as unknown as { actionId: string };
      const action = planningService.getAction(p.actionId);
      return { action: action ?? null };
    });

    /**
     * Get all actions
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.getAllActions", async () => {
      const actions = planningService.getAllActions();
      return { actions };
    });

    /**
     * Get open actions
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.getOpenActions", async () => {
      const actions = planningService.getOpenActions();
      return { actions };
    });

    /**
     * Get overdue actions
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.getOverdueActions", async () => {
      const actions = planningService.getOverdueActions();
      return { actions };
    });

    /**
     * Get actions needing escalation
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.getActionsNeedingEscalation", async () => {
      const actions = planningService.getActionsNeedingEscalation();
      return { actions };
    });

    /**
     * Update action status
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.updateActionStatus", async (params) => {
      const p = params as unknown as UpdateActionStatusParams;
      ctx.logger.info("Updating action status", { actionId: p.actionId, status: p.status });
      const action = planningService.updateActionStatus(p);
      return { action: action ?? null };
    });

    /**
     * Add a check-in note to an action
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.addCheckInNote", async (params) => {
      const p = params as unknown as AddCheckInNoteParams;
      const action = planningService.addCheckInNote(p);
      return { action: action ?? null };
    });

    /**
     * Escalate an action
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.escalateAction", async (params) => {
      const p = params as unknown as EscalateActionParams;
      ctx.logger.info("Escalating action", { actionId: p.actionId, level: p.level });
      const action = planningService.escalateAction(p);
      return { action: action ?? null };
    });

    /**
     * Create a planning cycle
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.createCycle", async (params) => {
      const p = params as unknown as CreatePlanningCycleParams;
      ctx.logger.info("Creating planning cycle", { name: p.name });
      const cycle = planningService.createPlanningCycle(p);
      return { cycle };
    });

    /**
     * Start a planning cycle
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.startCycle", async (params) => {
      const p = params as unknown as StartPlanningCycleParams;
      ctx.logger.info("Starting planning cycle", { cycleId: p.cycleId });
      const cycle = planningService.startPlanningCycle(p);
      return { cycle: cycle ?? null };
    });

    /**
     * Complete a planning cycle
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.completeCycle", async (params) => {
      const p = params as unknown as CompletePlanningCycleParams;
      ctx.logger.info("Completing planning cycle", { cycleId: p.cycleId });
      const cycle = planningService.completePlanningCycle(p);
      return { cycle: cycle ?? null };
    });

    /**
     * Get a planning cycle
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.getCycle", async (params) => {
      const p = params as unknown as { cycleId: string };
      const cycle = planningService.getCycle(p.cycleId);
      return { cycle: cycle ?? null };
    });

    /**
     * Get active planning cycles
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.getActiveCycles", async () => {
      const cycles = planningService.getActiveCycles();
      return { cycles };
    });

    /**
     * Get planning workflow summary
     * VAL-DEPT-OPS-001
     */
    ctx.actions.register("planning.getSummary", async () => {
      const summary = planningService.generateSummary();
      return { summary };
    });

    // ============================================
    // Knowledge Freshness Actions (VAL-DEPT-OPS-002)
    // ============================================

    /**
     * Register a knowledge asset
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.registerAsset", async (params) => {
      const p = params as unknown as RegisterKnowledgeAssetParams;
      ctx.logger.info("Registering knowledge asset", { name: p.name });
      const asset = freshnessService.registerAsset(p);
      return { asset };
    });

    /**
     * Get a knowledge asset by ID
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.getAsset", async (params) => {
      const p = params as unknown as { assetId: string };
      const asset = freshnessService.getAsset(p.assetId);
      return { asset: asset ?? null };
    });

    /**
     * Get all knowledge assets
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.getAllAssets", async () => {
      const assets = freshnessService.getAllAssets();
      return { assets };
    });

    /**
     * Get stale knowledge assets
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.getStaleAssets", async () => {
      const assets = freshnessService.getStaleAssets();
      return { assets };
    });

    /**
     * Update asset review timestamp
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.updateAssetReview", async (params) => {
      const p = params as unknown as UpdateAssetReviewParams;
      ctx.logger.info("Updating asset review", { assetId: p.assetId });
      const asset = freshnessService.updateAssetReview(p);
      return { asset: asset ?? null };
    });

    /**
     * Create a refresh task for an asset
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.createRefreshTask", async (params) => {
      const p = params as unknown as CreateRefreshTaskParams;
      ctx.logger.info("Creating refresh task", { assetId: p.assetId });
      const task = freshnessService.createRefreshTask(p);
      return { task: task ?? null };
    });

    /**
     * Get a refresh task by ID
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.getRefreshTask", async (params) => {
      const p = params as unknown as { taskId: string };
      const task = freshnessService.getRefreshTask(p.taskId);
      return { task: task ?? null };
    });

    /**
     * Get all refresh tasks
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.getAllRefreshTasks", async () => {
      const tasks = freshnessService.getAllRefreshTasks();
      return { tasks };
    });

    /**
     * Get open refresh tasks
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.getOpenRefreshTasks", async () => {
      const tasks = freshnessService.getOpenRefreshTasks();
      return { tasks };
    });

    /**
     * Update refresh task status
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.updateRefreshTaskStatus", async (params) => {
      const p = params as unknown as UpdateRefreshTaskStatusParams;
      ctx.logger.info("Updating refresh task status", { taskId: p.taskId, status: p.status });
      const task = freshnessService.updateRefreshTaskStatus(p);
      return { task: task ?? null };
    });

    /**
     * Start a refresh task
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.startRefreshTask", async (params) => {
      const p = params as unknown as { taskId: string };
      const task = freshnessService.startRefreshTask(p.taskId);
      return { task: task ?? null };
    });

    /**
     * Complete a refresh task
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.completeRefreshTask", async (params) => {
      const p = params as unknown as { taskId: string; completionNotes?: string[] };
      ctx.logger.info("Completing refresh task", { taskId: p.taskId });
      const task = freshnessService.completeRefreshTask(p.taskId, p.completionNotes);
      return { task: task ?? null };
    });

    /**
     * Run a freshness audit
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.runAudit", async (params) => {
      const p = params as unknown as RunFreshnessAuditParams;
      ctx.logger.info("Running freshness audit");
      const auditResult = freshnessService.runFreshnessAudit(p);
      return { auditResult };
    });

    /**
     * Generate a bottleneck report
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.generateBottleneckReport", async (params) => {
      const p = params as unknown as GenerateBottleneckReportParams;
      ctx.logger.info("Generating bottleneck report", { name: p.reportName });
      const report = freshnessService.generateBottleneckReport(p);
      return { report };
    });

    /**
     * Get a bottleneck report by ID
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.getBottleneckReport", async (params) => {
      const p = params as unknown as { reportId: string };
      const report = freshnessService.getBottleneckReport(p.reportId);
      return { report: report ?? null };
    });

    /**
     * Get all bottleneck reports
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.getAllBottleneckReports", async () => {
      const reports = freshnessService.getAllBottleneckReports();
      return { reports };
    });

    /**
     * Get open bottleneck reports
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.getOpenBottleneckReports", async () => {
      const reports = freshnessService.getOpenBottleneckReports();
      return { reports };
    });

    /**
     * Resolve a bottleneck report
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.resolveBottleneck", async (params) => {
      const p = params as unknown as ResolveBottleneckParams;
      ctx.logger.info("Resolving bottleneck", { reportId: p.reportId });
      const report = freshnessService.resolveBottleneck(p);
      return { report: report ?? null };
    });

    /**
     * Get knowledge freshness summary
     * VAL-DEPT-OPS-002
     */
    ctx.actions.register("freshness.getSummary", async () => {
      const summary = freshnessService.generateSummary();
      return { summary };
    });
  },

  async onHealth() {
    return { status: "ok", message: "Plugin worker is running" };
  }
});

export default plugin;
// @ts-ignore - import.meta is only available in ES modules
runWorker(plugin, import.meta.url);
