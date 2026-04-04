/**
 * Operations Workflow Types
 * VAL-DEPT-OPS-001: Planning inputs become owned actions with due dates and escalation metadata
 * VAL-DEPT-OPS-002: Knowledge freshness audits generate refresh tasks and bottleneck reports
 */

// ============================================
// Planning to Action Types (VAL-DEPT-OPS-001)
// ============================================

export type ActionPriority = "critical" | "high" | "medium" | "low";
export type ActionStatus = "proposed" | "open" | "in-progress" | "blocked" | "completed" | "cancelled" | "deferred";
export type ActionEscalationLevel = "none" | "team" | "leadership" | "executive";
export type PlanningInputType = "meeting" | "document" | "email" | "ticket" | "task" | "other";

export interface PlanningInput {
  id: string;
  type: PlanningInputType;
  title: string;
  description: string;
  sourceUrl?: string;
  capturedAt: string;
  capturedByRoleKey?: string;
  keyDecisions: string[];
  openQuestions: string[];
  stakeholders: string[];
}

export interface OwnedAction {
  id: string;
  title: string;
  description: string;
  ownerRoleKey?: string;
  ownerEmail?: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  status: ActionStatus;
  priority: ActionPriority;
  sourceInputId?: string;
  sourceInputType?: PlanningInputType;
  linkedInitiatives: string[];
  linkedProjects: string[];
  tags: string[];
  escalation: {
    level: ActionEscalationLevel;
    reason?: string;
    escalatedAt?: string;
    escalatedByRoleKey?: string;
  };
  completionCriteria: string[];
  checkInNotes: string[];
  completedAt?: string;
  blockedReason?: string;
}

export interface PlanningCycle {
  id: string;
  name: string;
  type: "weekly" | "monthly" | "quarterly" | "ad-hoc";
  ownerRoleKey: string;
  status: "planned" | "in-progress" | "completed" | "cancelled";
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  inputIds: string[];
  generatedActionIds: string[];
  summary?: string;
  deltas?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlanningWorkflowState {
  inputs: Record<string, PlanningInput>;
  actions: Record<string, OwnedAction>;
  cycles: Record<string, PlanningCycle>;
  lastUpdated: string;
}

// ============================================
// Knowledge Freshness Types (VAL-DEPT-OPS-002)
// ============================================

export type KnowledgeAssetType = "document" | "runbook" | "procedure" | "policy" | "guide" | "decision-record" | "other";
export type AssetFreshnessStatus = "fresh" | "stale" | "critical" | "unknown";
export type RefreshTaskStatus = "proposed" | "in-progress" | "completed" | "cancelled" | "blocked";
export type BottleneckSeverity = "minor" | "moderate" | "significant" | "critical";

export interface KnowledgeAsset {
  id: string;
  name: string;
  type: KnowledgeAssetType;
  url?: string;
  description: string;
  ownerRoleKey?: string;
  lastReviewedAt: string;
  lastUpdatedAt: string;
  expectedRefreshIntervalDays: number;
  currentFreshnessStatus: AssetFreshnessStatus;
  freshnessScore: number; // 0-100
  tags: string[];
  linkedInitiatives: string[];
  notes: string[];
}

export interface RefreshTask {
  id: string;
  assetId: string;
  assetName: string;
  title: string;
  description: string;
  priority: ActionPriority;
  status: RefreshTaskStatus;
  ownerRoleKey?: string;
  proposedAt: string;
  startedAt?: string;
  completedAt?: string;
  dueDate?: string;
  blockedReason?: string;
  completionNotes?: string[];
}

export interface BottleneckReport {
  id: string;
  name: string;
  description: string;
  severity: BottleneckSeverity;
  affectedProcesses: string[];
  affectedAssetIds: string[];
  affectedActionIds: string[];
  metrics: {
    name: string;
    value: number;
    threshold: number;
    direction: "above" | "below";
  }[];
  recommendations: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolutionNotes?: string[];
}

export interface KnowledgeFreshnessState {
  assets: Record<string, KnowledgeAsset>;
  refreshTasks: Record<string, RefreshTask>;
  bottleneckReports: Record<string, BottleneckReport>;
  lastAuditAt: string;
  lastUpdated: string;
}

// ============================================
// Combined State for Plugin
// ============================================

export interface OperationsWorkflowState extends PlanningWorkflowState, KnowledgeFreshnessState {}

// ============================================
// Action Parameters
// ============================================

// Planning to Action Parameters
export interface IngestPlanningInputParams {
  type: PlanningInputType;
  title: string;
  description: string;
  sourceUrl?: string;
  capturedByRoleKey?: string;
  keyDecisions?: string[];
  openQuestions?: string[];
  stakeholders?: string[];
}

export interface CreateOwnedActionParams {
  title: string;
  description: string;
  ownerRoleKey?: string;
  priority?: ActionPriority;
  sourceInputId?: string;
  sourceInputType?: PlanningInputType;
  linkedInitiatives?: string[];
  linkedProjects?: string[];
  dueDate?: string;
  completionCriteria?: string[];
  tags?: string[];
}

export interface CreatePlanningCycleParams {
  name: string;
  type: "weekly" | "monthly" | "quarterly" | "ad-hoc";
  ownerRoleKey: string;
  plannedStartDate: string;
  plannedEndDate: string;
}

export interface StartPlanningCycleParams {
  cycleId: string;
}

export interface CompletePlanningCycleParams {
  cycleId: string;
  summary: string;
  deltas?: string[];
}

export interface UpdateActionStatusParams {
  actionId: string;
  status: ActionStatus;
  notes?: string[];
  blockedReason?: string;
}

export interface EscalateActionParams {
  actionId: string;
  level: ActionEscalationLevel;
  reason: string;
  escalatedByRoleKey: string;
}

export interface AddCheckInNoteParams {
  actionId: string;
  note: string;
}

// Knowledge Freshness Parameters
export interface RegisterKnowledgeAssetParams {
  name: string;
  type: KnowledgeAssetType;
  url?: string;
  description: string;
  ownerRoleKey?: string;
  lastReviewedAt: string;
  lastUpdatedAt: string;
  expectedRefreshIntervalDays: number;
  tags?: string[];
  linkedInitiatives?: string[];
}

export interface UpdateAssetReviewParams {
  assetId: string;
  lastReviewedAt: string;
  notes?: string[];
}

export interface CreateRefreshTaskParams {
  assetId: string;
  title?: string;
  description?: string;
  priority?: ActionPriority;
  ownerRoleKey?: string;
  dueDate?: string;
}

export interface UpdateRefreshTaskStatusParams {
  taskId: string;
  status: RefreshTaskStatus;
  completionNotes?: string[];
  blockedReason?: string;
}

export interface RunFreshnessAuditParams {
  auditTimestamp?: string;
}

export interface GenerateBottleneckReportParams {
  reportName: string;
  description: string;
  severity: BottleneckSeverity;
  affectedProcesses: string[];
  affectedAssetIds?: string[];
  affectedActionIds?: string[];
  metrics?: {
    name: string;
    value: number;
    threshold: number;
    direction: "above" | "below";
  }[];
  recommendations?: string[];
}

export interface ResolveBottleneckParams {
  reportId: string;
  resolutionNotes: string;
}

// ============================================
// Connector Health Types (XAF-007)
// ============================================

export type ConnectorHealthStatus = "ok" | "degraded" | "error" | "unknown";

export interface ConnectorHealthState {
  toolkitId: string;
  status: ConnectorHealthStatus;
  lastChecked: string;
  error?: string;
  limitationMessage?: string;
}

export interface ToolkitLimitation {
  toolkitId: string;
  displayName: string;
  limitationMessage: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedWorkflows: string[];
  suggestedAction: string;
}

export interface ConnectorHealthSummary {
  overallStatus: ConnectorHealthStatus;
  checkedAt: string;
  connectors: ConnectorHealthState[];
  limitations: ToolkitLimitation[];
  hasLimitations: boolean;
}

export interface SetConnectorHealthParams {
  toolkitId: string;
  status: ConnectorHealthStatus;
  error?: string;
}

export interface GetConnectorHealthParams {
  toolkitId?: string;
}
