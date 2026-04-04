/**
 * Knowledge Freshness Service
 * VAL-DEPT-OPS-002: Knowledge freshness audits generate refresh tasks and bottleneck reports
 * 
 * Detects stale knowledge assets, generates refresh work, and surfaces
 * operational bottlenecks instead of only listing stale documents.
 */

import type {
  KnowledgeAsset,
  KnowledgeAssetType,
  AssetFreshnessStatus,
  RefreshTask,
  RefreshTaskStatus,
  BottleneckReport,
  BottleneckSeverity,
  KnowledgeFreshnessState,
  RegisterKnowledgeAssetParams,
  UpdateAssetReviewParams,
  CreateRefreshTaskParams,
  UpdateRefreshTaskStatusParams,
  RunFreshnessAuditParams,
  GenerateBottleneckReportParams,
  ResolveBottleneckParams,
  ActionPriority,
} from "./types.js";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function calculateFreshnessScore(
  lastReviewedAt: string,
  lastUpdatedAt: string,
  expectedRefreshIntervalDays: number
): number {
  const now = new Date().toISOString();
  const daysSinceReview = daysBetween(lastReviewedAt, now);
  const daysSinceUpdate = daysBetween(lastUpdatedAt, now);
  
  // Base score on how stale the asset is relative to expected refresh interval
  const reviewRatio = Math.max(0, 1 - (daysSinceReview / expectedRefreshIntervalDays));
  const updateRatio = Math.max(0, 1 - (daysSinceUpdate / (expectedRefreshIntervalDays * 2)));
  
  // Weight review freshness more heavily
  const score = (reviewRatio * 0.7) + (updateRatio * 0.3);
  
  return Math.round(Math.max(0, Math.min(100, score * 100)));
}

function determineFreshnessStatus(
  freshnessScore: number,
  lastReviewedAt: string,
  expectedRefreshIntervalDays: number
): AssetFreshnessStatus {
  const now = new Date().toISOString();
  const daysSinceReview = daysBetween(lastReviewedAt, now);
  
  // Critical if never reviewed or massively overdue
  if (daysSinceReview > expectedRefreshIntervalDays * 3) {
    return "critical";
  }
  
  // Stale if past the expected refresh interval
  if (daysSinceReview > expectedRefreshIntervalDays) {
    return "stale";
  }
  
  // Fresh if within the expected interval
  if (freshnessScore >= 50) {
    return "fresh";
  }
  
  return "unknown";
}

export class KnowledgeFreshnessService {
  private state: KnowledgeFreshnessState;

  constructor(initialState?: KnowledgeFreshnessState) {
    this.state = initialState ?? {
      assets: {},
      refreshTasks: {},
      bottleneckReports: {},
      lastAuditAt: "",
      lastUpdated: new Date().toISOString(),
    };
  }

  // ============================================
  // Knowledge Asset Management
  // ============================================

  /**
   * Register a new knowledge asset
   * VAL-DEPT-OPS-002
   */
  registerAsset(params: RegisterKnowledgeAssetParams): KnowledgeAsset {
    const now = new Date().toISOString();
    const freshnessScore = calculateFreshnessScore(
      params.lastReviewedAt,
      params.lastUpdatedAt,
      params.expectedRefreshIntervalDays
    );

    const asset: KnowledgeAsset = {
      id: generateId(),
      name: params.name,
      type: params.type,
      url: params.url,
      description: params.description,
      ownerRoleKey: params.ownerRoleKey,
      lastReviewedAt: params.lastReviewedAt,
      lastUpdatedAt: params.lastUpdatedAt,
      expectedRefreshIntervalDays: params.expectedRefreshIntervalDays,
      currentFreshnessStatus: determineFreshnessStatus(freshnessScore, params.lastReviewedAt, params.expectedRefreshIntervalDays),
      freshnessScore,
      tags: params.tags ?? [],
      linkedInitiatives: params.linkedInitiatives ?? [],
      notes: [],
    };

    this.state.assets[asset.id] = asset;
    this.state.lastUpdated = now;
    return asset;
  }

  /**
   * Get an asset by ID
   */
  getAsset(assetId: string): KnowledgeAsset | undefined {
    return this.state.assets[assetId];
  }

  /**
   * Get all assets
   */
  getAllAssets(): KnowledgeAsset[] {
    return Object.values(this.state.assets);
  }

  /**
   * Get assets by type
   */
  getAssetsByType(type: KnowledgeAssetType): KnowledgeAsset[] {
    return Object.values(this.state.assets).filter((a) => a.type === type);
  }

  /**
   * Get assets by freshness status
   */
  getAssetsByFreshnessStatus(status: AssetFreshnessStatus): KnowledgeAsset[] {
    return Object.values(this.state.assets).filter((a) => a.currentFreshnessStatus === status);
  }

  /**
   * Get stale assets (stale or critical)
   */
  getStaleAssets(): KnowledgeAsset[] {
    return Object.values(this.state.assets).filter(
      (a) => a.currentFreshnessStatus === "stale" || a.currentFreshnessStatus === "critical"
    );
  }

  /**
   * Update asset review timestamp
   * VAL-DEPT-OPS-002
   */
  updateAssetReview(params: UpdateAssetReviewParams): KnowledgeAsset | undefined {
    const asset = this.state.assets[params.assetId];
    if (!asset) return undefined;

    const now = new Date().toISOString();
    asset.lastReviewedAt = params.lastReviewedAt;
    asset.freshnessScore = calculateFreshnessScore(
      params.lastReviewedAt,
      asset.lastUpdatedAt,
      asset.expectedRefreshIntervalDays
    );
    asset.currentFreshnessStatus = determineFreshnessStatus(
      asset.freshnessScore,
      params.lastReviewedAt,
      asset.expectedRefreshIntervalDays
    );

    if (params.notes && params.notes.length > 0) {
      asset.notes.push(...params.notes);
    }

    this.state.lastUpdated = now;
    return asset;
  }

  /**
   * Add a note to an asset
   */
  addAssetNote(assetId: string, note: string): KnowledgeAsset | undefined {
    const asset = this.state.assets[assetId];
    if (!asset) return undefined;

    const now = new Date().toISOString();
    asset.notes.push(`[${now}] ${note}`);
    this.state.lastUpdated = now;
    return asset;
  }

  /**
   * Get assets by owner
   */
  getAssetsByOwner(ownerRoleKey: string): KnowledgeAsset[] {
    return Object.values(this.state.assets).filter((a) => a.ownerRoleKey === ownerRoleKey);
  }

  /**
   * Get assets linked to an initiative
   */
  getAssetsByInitiative(initiativeId: string): KnowledgeAsset[] {
    return Object.values(this.state.assets).filter((a) => a.linkedInitiatives.includes(initiativeId));
  }

  // ============================================
  // Refresh Task Management
  // ============================================

  /**
   * Create a refresh task for a knowledge asset
   * VAL-DEPT-OPS-002
   */
  createRefreshTask(params: CreateRefreshTaskParams): RefreshTask | undefined {
    const asset = this.state.assets[params.assetId];
    if (!asset) return undefined;

    const now = new Date().toISOString();
    const priorityMap: Record<AssetFreshnessStatus, ActionPriority> = {
      critical: "critical",
      stale: "high",
      fresh: "low",
      unknown: "medium",
    };

    const task: RefreshTask = {
      id: generateId(),
      assetId: params.assetId,
      assetName: asset.name,
      title: params.title ?? `Refresh: ${asset.name}`,
      description: params.description ?? `Review and refresh knowledge asset: ${asset.name}`,
      priority: params.priority ?? priorityMap[asset.currentFreshnessStatus],
      status: "proposed",
      ownerRoleKey: params.ownerRoleKey ?? asset.ownerRoleKey,
      proposedAt: now,
      dueDate: params.dueDate,
    };

    this.state.refreshTasks[task.id] = task;
    this.state.lastUpdated = now;
    return task;
  }

  /**
   * Get a refresh task by ID
   */
  getRefreshTask(taskId: string): RefreshTask | undefined {
    return this.state.refreshTasks[taskId];
  }

  /**
   * Get all refresh tasks
   */
  getAllRefreshTasks(): RefreshTask[] {
    return Object.values(this.state.refreshTasks);
  }

  /**
   * Get refresh tasks by status
   */
  getRefreshTasksByStatus(status: RefreshTaskStatus): RefreshTask[] {
    return Object.values(this.state.refreshTasks).filter((t) => t.status === status);
  }

  /**
   * Get refresh tasks by priority
   */
  getRefreshTasksByPriority(priority: ActionPriority): RefreshTask[] {
    return Object.values(this.state.refreshTasks).filter((t) => t.priority === priority);
  }

  /**
   * Get open refresh tasks
   */
  getOpenRefreshTasks(): RefreshTask[] {
    return Object.values(this.state.refreshTasks).filter(
      (t) => !["completed", "cancelled", "blocked"].includes(t.status)
    );
  }

  /**
   * Get refresh tasks for a specific asset
   */
  getRefreshTasksForAsset(assetId: string): RefreshTask[] {
    return Object.values(this.state.refreshTasks).filter((t) => t.assetId === assetId);
  }

  /**
   * Update refresh task status
   * VAL-DEPT-OPS-002
   */
  updateRefreshTaskStatus(params: UpdateRefreshTaskStatusParams): RefreshTask | undefined {
    const task = this.state.refreshTasks[params.taskId];
    if (!task) return undefined;

    const now = new Date().toISOString();
    task.status = params.status;

    if (params.status === "in-progress") {
      task.startedAt = now;
    } else if (params.status === "completed") {
      task.completedAt = now;
      if (params.completionNotes) {
        task.completionNotes = params.completionNotes;
      }
      // Mark the asset as reviewed
      this.updateAssetReview({
        assetId: task.assetId,
        lastReviewedAt: now,
        notes: params.completionNotes,
      });
    } else if (params.status === "blocked" && params.blockedReason) {
      task.blockedReason = params.blockedReason;
    }

    this.state.lastUpdated = now;
    return task;
  }

  /**
   * Start working on a refresh task
   */
  startRefreshTask(taskId: string): RefreshTask | undefined {
    return this.updateRefreshTaskStatus({ taskId, status: "in-progress" });
  }

  /**
   * Complete a refresh task
   */
  completeRefreshTask(taskId: string, completionNotes?: string[]): RefreshTask | undefined {
    return this.updateRefreshTaskStatus({
      taskId,
      status: "completed",
      completionNotes,
    });
  }

  /**
   * Cancel a refresh task
   */
  cancelRefreshTask(taskId: string): RefreshTask | undefined {
    return this.updateRefreshTaskStatus({ taskId, status: "cancelled" });
  }

  // ============================================
  // Bottleneck Reporting
  // ============================================

  /**
   * Generate a bottleneck report
   * VAL-DEPT-OPS-002
   */
  generateBottleneckReport(params: GenerateBottleneckReportParams): BottleneckReport {
    const now = new Date().toISOString();
    const report: BottleneckReport = {
      id: generateId(),
      name: params.reportName,
      description: params.description,
      severity: params.severity,
      affectedProcesses: params.affectedProcesses,
      affectedAssetIds: params.affectedAssetIds ?? [],
      affectedActionIds: params.affectedActionIds ?? [],
      metrics: params.metrics ?? [],
      recommendations: params.recommendations ?? [],
      createdAt: now,
      updatedAt: now,
    };

    this.state.bottleneckReports[report.id] = report;
    this.state.lastUpdated = now;
    return report;
  }

  /**
   * Get a bottleneck report by ID
   */
  getBottleneckReport(reportId: string): BottleneckReport | undefined {
    return this.state.bottleneckReports[reportId];
  }

  /**
   * Get all bottleneck reports
   */
  getAllBottleneckReports(): BottleneckReport[] {
    return Object.values(this.state.bottleneckReports);
  }

  /**
   * Get open (unresolved) bottleneck reports
   */
  getOpenBottleneckReports(): BottleneckReport[] {
    return Object.values(this.state.bottleneckReports).filter((r) => !r.resolvedAt);
  }

  /**
   * Get bottleneck reports by severity
   */
  getBottleneckReportsBySeverity(severity: BottleneckSeverity): BottleneckReport[] {
    return Object.values(this.state.bottleneckReports).filter((r) => r.severity === severity);
  }

  /**
   * Resolve a bottleneck report
   * VAL-DEPT-OPS-002
   */
  resolveBottleneck(params: ResolveBottleneckParams): BottleneckReport | undefined {
    const report = this.state.bottleneckReports[params.reportId];
    if (!report) return undefined;

    const now = new Date().toISOString();
    report.resolvedAt = now;
    report.resolutionNotes = [params.resolutionNotes];
    report.updatedAt = now;

    this.state.lastUpdated = now;
    return report;
  }

  // ============================================
  // Freshness Audit
  // ============================================

  /**
   * Run a freshness audit to detect stale assets and generate refresh tasks
   * VAL-DEPT-OPS-002
   */
  runFreshnessAudit(params?: RunFreshnessAuditParams): {
    auditTimestamp: string;
    totalAssets: number;
    freshAssets: number;
    staleAssets: number;
    criticalAssets: number;
    newlyCreatedTasks: RefreshTask[];
    generatedBottleneckReports: BottleneckReport[];
  } {
    const now = params?.auditTimestamp ?? new Date().toISOString();
    this.state.lastAuditAt = now;

    const assets = Object.values(this.state.assets);
    const staleAssets = assets.filter(
      (a) => a.currentFreshnessStatus === "stale" || a.currentFreshnessStatus === "critical"
    );

    // Generate refresh tasks for stale assets that don't have open tasks
    const newlyCreatedTasks: RefreshTask[] = [];
    for (const asset of staleAssets) {
      const existingOpenTasks = this.getRefreshTasksForAsset(asset.id).filter(
        (t) => !["completed", "cancelled"].includes(t.status)
      );

      if (existingOpenTasks.length === 0) {
        const task = this.createRefreshTask({
          assetId: asset.id,
          priority: asset.currentFreshnessStatus === "critical" ? "critical" : "high",
        });
        if (task) {
          newlyCreatedTasks.push(task);
        }
      }
    }

    // Generate bottleneck reports if there are significant stale assets
    const generatedBottleneckReports: BottleneckReport[] = [];
    if (staleAssets.length > 0) {
      const criticalCount = staleAssets.filter((a) => a.currentFreshnessStatus === "critical").length;
      const staleCount = staleAssets.filter((a) => a.currentFreshnessStatus === "stale").length;

      let severity: BottleneckSeverity = "minor";
      if (criticalCount > 0 || staleCount > 5) {
        severity = "critical";
      } else if (criticalCount > 0 || staleCount > 3) {
        severity = "significant";
      } else if (staleCount > 1) {
        severity = "moderate";
      }

      const report = this.generateBottleneckReport({
        reportName: `Knowledge Freshness Audit: ${new Date(now).toLocaleDateString()}`,
        description: `Found ${staleAssets.length} stale knowledge assets requiring refresh (${criticalCount} critical, ${staleCount} stale).`,
        severity,
        affectedProcesses: ["knowledge-management"],
        affectedAssetIds: staleAssets.map((a) => a.id),
        metrics: [
          {
            name: "staleAssetsCount",
            value: staleAssets.length,
            threshold: 3,
            direction: "above",
          },
          {
            name: "criticalAssetsCount",
            value: criticalCount,
            threshold: 1,
            direction: "above",
          },
        ],
        recommendations: [
          "Review and update stale knowledge assets on priority",
          "Consider increasing review frequency for high-impact assets",
          "Assign clear ownership for knowledge asset maintenance",
        ],
      });

      generatedBottleneckReports.push(report);
    }

    this.state.lastUpdated = now;

    return {
      auditTimestamp: now,
      totalAssets: assets.length,
      freshAssets: assets.filter((a) => a.currentFreshnessStatus === "fresh").length,
      staleAssets: staleAssets.length,
      criticalAssets: staleAssets.filter((a) => a.currentFreshnessStatus === "critical").length,
      newlyCreatedTasks,
      generatedBottleneckReports,
    };
  }

  // ============================================
  // Summary and Reporting
  // ============================================

  /**
   * Generate a summary of knowledge freshness state
   */
  generateSummary(): {
    totalAssets: number;
    assetsByFreshnessStatus: Record<AssetFreshnessStatus, number>;
    assetsByType: Record<KnowledgeAssetType, number>;
    totalRefreshTasks: number;
    openRefreshTasks: number;
    completedRefreshTasks: number;
    openBottleneckReports: number;
    lastAuditAt: string;
    averageFreshnessScore: number;
  } {
    const assets = Object.values(this.state.assets);
    const tasks = Object.values(this.state.refreshTasks);

    const assetsByFreshnessStatus: Record<AssetFreshnessStatus, number> = {
      fresh: 0,
      stale: 0,
      critical: 0,
      unknown: 0,
    };

    const assetsByType: Record<KnowledgeAssetType, number> = {
      document: 0,
      runbook: 0,
      procedure: 0,
      policy: 0,
      guide: 0,
      "decision-record": 0,
      other: 0,
    };

    let totalFreshnessScore = 0;
    for (const asset of assets) {
      assetsByFreshnessStatus[asset.currentFreshnessStatus]++;
      if (asset.type in assetsByType) {
        assetsByType[asset.type as KnowledgeAssetType]++;
      } else {
        assetsByType.other++;
      }
      totalFreshnessScore += asset.freshnessScore;
    }

    return {
      totalAssets: assets.length,
      assetsByFreshnessStatus,
      assetsByType,
      totalRefreshTasks: tasks.length,
      openRefreshTasks: this.getOpenRefreshTasks().length,
      completedRefreshTasks: tasks.filter((t) => t.status === "completed").length,
      openBottleneckReports: this.getOpenBottleneckReports().length,
      lastAuditAt: this.state.lastAuditAt || "never",
      averageFreshnessScore: assets.length > 0 ? Math.round(totalFreshnessScore / assets.length) : 0,
    };
  }

  // ============================================
  // State Management
  // ============================================

  /**
   * Get current state for persistence
   */
  getState(): KnowledgeFreshnessState {
    return this.state;
  }

  /**
   * Load state from persistence
   */
  loadState(state: KnowledgeFreshnessState): void {
    this.state = state;
  }
}
