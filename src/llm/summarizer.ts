/**
 * LLM-Powered Summarizer
 * 
 * Generates concise, actionable summaries of planning cycles, bottleneck reports,
 * and operational status using LLM capabilities. Helps convert verbose operational
 * data into clear, human-readable summaries for stakeholders.
 */

import type {
  PlanningCycle,
  OwnedAction,
  BottleneckReport,
  KnowledgeAsset,
  RefreshTask,
} from "../types.js";

export interface LLMClient {
  complete(prompt: string): Promise<string>;
}

export interface CycleSummary {
  cycleId: string;
  cycleName: string;
  executiveSummary: string;
  keyOutcomes: string[];
  generatedActions: number;
  completedActions: number;
  adherenceScore: number;
  deltas: string[];
  nextSteps: string[];
}

export interface BottleneckSummary {
  reportId: string;
  reportName: string;
  executiveSummary: string;
  severity: string;
  keyMetrics: string[];
  recommendations: string[];
  affectedAreas: string[];
  resolutionTimeline?: string;
}

export interface OperationsStatusSummary {
  timestamp: string;
  overallHealth: "green" | "yellow" | "red";
  activeActionsCount: number;
  overdueActionsCount: number;
  blockedActionsCount: number;
  staleKnowledgeAssetsCount: number;
  openBottleneckReportsCount: number;
  criticalAlerts: string[];
  summary: string;
  recommendedActions: string[];
}

export class LLMSummarizer {
  private llmClient: LLMClient | null;

  constructor(llmClient?: LLMClient) {
    this.llmClient = llmClient ?? null;
  }

  /**
   * Summarize a planning cycle
   */
  async summarizeCycle(cycle: PlanningCycle, actions: OwnedAction[]): Promise<CycleSummary> {
    if (this.llmClient) {
      return this.summarizeCycleWithLLM(cycle, actions);
    }
    return this.summarizeCycleRuleBased(cycle, actions);
  }

  /**
   * Summarize a bottleneck report
   */
  async summarizeBottleneck(report: BottleneckReport): Promise<BottleneckSummary> {
    if (this.llmClient) {
      return this.summarizeBottleneckWithLLM(report);
    }
    return this.summarizeBottleneckRuleBased(report);
  }

  /**
   * Generate overall operations status summary
   */
  async summarizeOperationsStatus(
    actions: OwnedAction[],
    assets: KnowledgeAsset[],
    bottleneckReports: BottleneckReport[]
  ): Promise<OperationsStatusSummary> {
    const now = new Date().toISOString();
    
    const openActions = actions.filter(a => !["completed", "cancelled", "deferred"].includes(a.status));
    const overdueActions = openActions.filter(a => a.dueDate && a.dueDate < now);
    const blockedActions = openActions.filter(a => a.status === "blocked");
    const staleAssets = assets.filter(a => a.currentFreshnessStatus === "stale" || a.currentFreshnessStatus === "critical");
    const openReports = bottleneckReports.filter(r => !r.resolvedAt);

    const criticalAlerts: string[] = [];
    if (overdueActions.filter(a => a.priority === "critical").length > 0) {
      criticalAlerts.push(`${overdueActions.filter(a => a.priority === "critical").length} critical actions are overdue`);
    }
    if (blockedActions.length > 0) {
      criticalAlerts.push(`${blockedActions.length} actions are blocked and need attention`);
    }
    if (staleAssets.filter(a => a.currentFreshnessStatus === "critical").length > 0) {
      criticalAlerts.push(`${staleAssets.filter(a => a.currentFreshnessStatus === "critical").length} knowledge assets are critically stale`);
    }

    let overallHealth: "green" | "yellow" | "red" = "green";
    if (criticalAlerts.length > 2 || overdueActions.length > 10) {
      overallHealth = "red";
    } else if (criticalAlerts.length > 0 || overdueActions.length > 3) {
      overallHealth = "yellow";
    }

    if (this.llmClient) {
      return this.generateStatusSummaryWithLLM(
        openActions.length,
        overdueActions.length,
        blockedActions.length,
        staleAssets.length,
        openReports.length,
        criticalAlerts,
        overallHealth
      );
    }

    return {
      timestamp: now,
      overallHealth,
      activeActionsCount: openActions.length,
      overdueActionsCount: overdueActions.length,
      blockedActionsCount: blockedActions.length,
      staleKnowledgeAssetsCount: staleAssets.length,
      openBottleneckReportsCount: openReports.length,
      criticalAlerts,
      summary: this.generateRuleBasedStatusSummary(openActions.length, overdueActions.length, blockedActions.length),
      recommendedActions: this.generateRecommendedActions(openActions, overdueActions, blockedActions),
    };
  }

  /**
   * LLM-powered cycle summarization
   */
  private async summarizeCycleWithLLM(
    cycle: PlanningCycle,
    actions: OwnedAction[]
  ): Promise<CycleSummary> {
    const cycleActions = actions.filter(a => cycle.generatedActionIds.includes(a.id));
    const completedCount = cycleActions.filter(a => a.status === "completed").length;
    
    const prompt = `Summarize this planning cycle for an executive audience.

CYCLE: ${cycle.name}
TYPE: ${cycle.type}
STATUS: ${cycle.status}
PLANNED: ${cycle.plannedStartDate} to ${cycle.plannedEndDate}
${cycle.actualStartDate ? `ACTUAL: ${cycle.actualStartDate} to ${cycle.actualEndDate || "ongoing"}` : ""}

GENERATED ACTIONS: ${cycle.generatedActionIds.length}
COMPLETED ACTIONS: ${completedCount}

${cycle.summary ? `CYCLE SUMMARY:\n${cycle.summary}` : ""}
${cycle.deltas && cycle.deltas.length > 0 ? `DELTAS:\n${cycle.deltas.map(d => `- ${d}`).join("\n")}` : ""}

Provide a JSON response:
{
  "executiveSummary": "2-3 sentence summary of what this cycle accomplished",
  "keyOutcomes": ["Outcome 1", "Outcome 2", "Outcome 3"],
  "adherenceScore": 0.0-1.0,
  "nextSteps": ["Next step 1", "Next step 2"]
}`;

    try {
      const response = await this.llmClient!.complete(prompt);
      const parsed = JSON.parse(response);
      
      return {
        cycleId: cycle.id,
        cycleName: cycle.name,
        executiveSummary: parsed.executiveSummary || `Planning cycle ${cycle.name} completed with ${completedCount} of ${cycleActions.length} actions done.`,
        keyOutcomes: parsed.keyOutcomes || [],
        generatedActions: cycleActions.length,
        completedActions: completedCount,
        adherenceScore: parsed.adherenceScore ?? (cycleActions.length > 0 ? completedCount / cycleActions.length : 0),
        deltas: cycle.deltas || [],
        nextSteps: parsed.nextSteps || [],
      };
    } catch (error) {
      console.warn("LLM summarization failed, using rule-based:", error);
      return this.summarizeCycleRuleBased(cycle, actions);
    }
  }

  /**
   * Rule-based cycle summarization
   */
  private summarizeCycleRuleBased(
    cycle: PlanningCycle,
    actions: OwnedAction[]
  ): CycleSummary {
    const cycleActions = actions.filter(a => cycle.generatedActionIds.includes(a.id));
    const completedCount = cycleActions.filter(a => a.status === "completed").length;
    const adherenceScore = cycleActions.length > 0 ? completedCount / cycleActions.length : 0;

    const keyOutcomes: string[] = [];
    if (completedCount > 0) {
      keyOutcomes.push(`${completedCount} of ${cycleActions.length} planned actions were completed`);
    }
    if (cycle.deltas && cycle.deltas.length > 0) {
      keyOutcomes.push(...cycle.deltas.slice(0, 2));
    }

    const nextSteps = cycleActions
      .filter(a => a.status !== "completed" && a.status !== "cancelled")
      .slice(0, 3)
      .map(a => `Continue: ${a.title}`);

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      executiveSummary: `Planning cycle ${cycle.name} (${cycle.type}) ${cycle.status === "completed" ? "completed" : "is in progress"} with ${completedCount} of ${cycleActions.length} actions done.`,
      keyOutcomes,
      generatedActions: cycleActions.length,
      completedActions: completedCount,
      adherenceScore,
      deltas: cycle.deltas || [],
      nextSteps,
    };
  }

  /**
   * LLM-powered bottleneck summarization
   */
  private async summarizeBottleneckWithLLM(report: BottleneckReport): Promise<BottleneckSummary> {
    const prompt = `Summarize this bottleneck report for an executive audience.

REPORT: ${report.name}
SEVERITY: ${report.severity}
DESCRIPTION: ${report.description}

AFFECTED PROCESSES: ${report.affectedProcesses.join(", ")}

METRICS:
${report.metrics.map(m => `- ${m.name}: ${m.value} (threshold: ${m.threshold}, direction: ${m.direction})`).join("\n")}

RECOMMENDATIONS:
${report.recommendations.map(r => `- ${r}`).join("\n")}

Provide a JSON response:
{
  "executiveSummary": "2-3 sentence summary",
  "keyMetrics": ["Key metric 1", "Key metric 2"],
  "resolutionTimeline": "Suggested resolution timeline"
}`;

    try {
      const response = await this.llmClient!.complete(prompt);
      const parsed = JSON.parse(response);
      
      return {
        reportId: report.id,
        reportName: report.name,
        executiveSummary: parsed.executiveSummary || report.description,
        severity: report.severity,
        keyMetrics: parsed.keyMetrics || report.metrics.map(m => `${m.name}: ${m.value}`),
        recommendations: report.recommendations,
        affectedAreas: report.affectedProcesses,
        resolutionTimeline: parsed.resolutionTimeline,
      };
    } catch (error) {
      console.warn("LLM summarization failed, using rule-based:", error);
      return this.summarizeBottleneckRuleBased(report);
    }
  }

  /**
   * Rule-based bottleneck summarization
   */
  private summarizeBottleneckRuleBased(report: BottleneckReport): BottleneckSummary {
    return {
      reportId: report.id,
      reportName: report.name,
      executiveSummary: `${report.severity.toUpperCase()} bottleneck: ${report.description}`,
      severity: report.severity,
      keyMetrics: report.metrics.map(m => `${m.name}: ${m.value} (threshold: ${m.threshold})`),
      recommendations: report.recommendations,
      affectedAreas: report.affectedProcesses,
    };
  }

  /**
   * LLM-powered operations status summary
   */
  private async generateStatusSummaryWithLLM(
    activeCount: number,
    overdueCount: number,
    blockedCount: number,
    staleCount: number,
    openReportsCount: number,
    criticalAlerts: string[],
    overallHealth: "green" | "yellow" | "red"
  ): Promise<OperationsStatusSummary> {
    const prompt = `Generate an executive operations status summary.

METRICS:
- Active Actions: ${activeCount}
- Overdue Actions: ${overdueCount}
- Blocked Actions: ${blockedCount}
- Stale Knowledge Assets: ${staleCount}
- Open Bottleneck Reports: ${openReportsCount}

CRITICAL ALERTS:
${criticalAlerts.length > 0 ? criticalAlerts.map(a => `- ${a}`).join("\n") : "(none)"}

OVERALL HEALTH: ${overallHealth.toUpperCase()}

Provide a JSON response:
{
  "summary": "2-3 sentence overall status summary",
  "recommendedActions": ["Action 1", "Action 2", "Action 3"]
}`;

    try {
      const response = await this.llmClient!.complete(prompt);
      const parsed = JSON.parse(response);
      
      return {
        timestamp: new Date().toISOString(),
        overallHealth,
        activeActionsCount: activeCount,
        overdueActionsCount: overdueCount,
        blockedActionsCount: blockedCount,
        staleKnowledgeAssetsCount: staleCount,
        openBottleneckReportsCount: openReportsCount,
        criticalAlerts,
        summary: parsed.summary || this.generateRuleBasedStatusSummary(activeCount, overdueCount, blockedCount),
        recommendedActions: parsed.recommendedActions || this.generateRecommendedActions([], [], []),
      };
    } catch (error) {
      console.warn("LLM summary failed, using rule-based:", error);
      return {
        timestamp: new Date().toISOString(),
        overallHealth,
        activeActionsCount: activeCount,
        overdueActionsCount: overdueCount,
        blockedActionsCount: blockedCount,
        staleKnowledgeAssetsCount: staleCount,
        openBottleneckReportsCount: openReportsCount,
        criticalAlerts,
        summary: this.generateRuleBasedStatusSummary(activeCount, overdueCount, blockedCount),
        recommendedActions: this.generateRecommendedActions([], [], []),
      };
    }
  }

  /**
   * Generate rule-based status summary text
   */
  private generateRuleBasedStatusSummary(
    activeCount: number,
    overdueCount: number,
    blockedCount: number
  ): string {
    if (overdueCount === 0 && blockedCount === 0) {
      return `Operations are running smoothly with ${activeCount} active actions and no overdue or blocked items.`;
    }
    
    const issues: string[] = [];
    if (overdueCount > 0) issues.push(`${overdueCount} overdue action${overdueCount > 1 ? "s" : ""}`);
    if (blockedCount > 0) issues.push(`${blockedCount} blocked action${blockedCount > 1 ? "s" : ""}`);
    
    return `Operations have ${issues.join(" and ")} requiring attention among ${activeCount} active actions.`;
  }

  /**
   * Generate recommended actions based on current state
   */
  private generateRecommendedActions(
    openActions: OwnedAction[],
    overdueActions: OwnedAction[],
    blockedActions: OwnedAction[]
  ): string[] {
    const recommendations: string[] = [];

    if (overdueActions.length > 0) {
      const critical = overdueActions.filter(a => a.priority === "critical");
      if (critical.length > 0) {
        recommendations.push(`Urgent: Address ${critical.length} critical overdue action${critical.length > 1 ? "s" : ""} immediately`);
      }
      recommendations.push(`Review and update due dates for ${overdueActions.length} overdue action${overdueActions.length > 1 ? "s" : ""}`);
    }

    if (blockedActions.length > 0) {
      recommendations.push(`Unblock ${blockedActions.length} blocked action${blockedActions.length > 1 ? "s" : ""} or escalate`);
    }

    if (recommendations.length === 0) {
      recommendations.push("Continue current operations and monitor for new bottlenecks");
    }

    return recommendations;
  }

  /**
   * Set the LLM client
   */
  setLLMClient(client: LLMClient): void {
    this.llmClient = client;
  }
}

export default LLMSummarizer;
