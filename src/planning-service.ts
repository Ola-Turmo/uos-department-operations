/**
 * Planning to Action Service
 * VAL-DEPT-OPS-001: Planning inputs become owned actions with due dates and escalation metadata
 * 
 * Runs planning or review cadences, ingests meeting or doc inputs, and generates
 * actions with owners, due dates, and escalation metadata that remain inspectable.
 */

import type {
  PlanningInput,
  OwnedAction,
  PlanningCycle,
  PlanningWorkflowState,
  ActionPriority,
  ActionStatus,
  ActionEscalationLevel,
  PlanningInputType,
  IngestPlanningInputParams,
  CreateOwnedActionParams,
  CreatePlanningCycleParams,
  StartPlanningCycleParams,
  CompletePlanningCycleParams,
  UpdateActionStatusParams,
  EscalateActionParams,
  AddCheckInNoteParams,
} from "./types.js";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export class PlanningService {
  private state: PlanningWorkflowState;

  constructor(initialState?: PlanningWorkflowState) {
    this.state = initialState ?? {
      inputs: {},
      actions: {},
      cycles: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  // ============================================
  // Planning Input Management
  // ============================================

  /**
   * Ingest a planning input (meeting notes, document, email, etc.)
   * VAL-DEPT-OPS-001
   */
  ingestInput(params: IngestPlanningInputParams): PlanningInput {
    const now = new Date().toISOString();
    const input: PlanningInput = {
      id: generateId(),
      type: params.type,
      title: params.title,
      description: params.description,
      sourceUrl: params.sourceUrl,
      capturedAt: now,
      capturedByRoleKey: params.capturedByRoleKey,
      keyDecisions: params.keyDecisions ?? [],
      openQuestions: params.openQuestions ?? [],
      stakeholders: params.stakeholders ?? [],
    };

    this.state.inputs[input.id] = input;
    this.state.lastUpdated = now;
    return input;
  }

  /**
   * Get a planning input by ID
   */
  getInput(inputId: string): PlanningInput | undefined {
    return this.state.inputs[inputId];
  }

  /**
   * Get all planning inputs
   */
  getAllInputs(): PlanningInput[] {
    return Object.values(this.state.inputs);
  }

  /**
   * Get planning inputs by type
   */
  getInputsByType(type: PlanningInputType): PlanningInput[] {
    return Object.values(this.state.inputs).filter((i) => i.type === type);
  }

  // ============================================
  // Owned Action Management
  // ============================================

  /**
   * Create an owned action from a planning input or standalone
   * VAL-DEPT-OPS-001
   */
  createAction(params: CreateOwnedActionParams): OwnedAction {
    const now = new Date().toISOString();
    const action: OwnedAction = {
      id: generateId(),
      title: params.title,
      description: params.description,
      ownerRoleKey: params.ownerRoleKey,
      createdAt: now,
      updatedAt: now,
      dueDate: params.dueDate,
      status: "proposed",
      priority: params.priority ?? "medium",
      sourceInputId: params.sourceInputId,
      sourceInputType: params.sourceInputType,
      linkedInitiatives: params.linkedInitiatives ?? [],
      linkedProjects: params.linkedProjects ?? [],
      tags: params.tags ?? [],
      escalation: {
        level: "none",
      },
      completionCriteria: params.completionCriteria ?? [],
      checkInNotes: [],
    };

    this.state.actions[action.id] = action;
    this.state.lastUpdated = now;
    return action;
  }

  /**
   * Create multiple actions from a planning input
   * VAL-DEPT-OPS-001
   */
  createActionsFromInput(inputId: string, actionTemplates: Array<{
    title: string;
    description: string;
    ownerRoleKey?: string;
    priority?: ActionPriority;
    dueDate?: string;
    completionCriteria?: string[];
    tags?: string[];
  }>): OwnedAction[] {
    const input = this.state.inputs[inputId];
    if (!input) return [];

    const now = new Date().toISOString();
    const createdActions: OwnedAction[] = [];

    for (const template of actionTemplates) {
      const action: OwnedAction = {
        id: generateId(),
        title: template.title,
        description: template.description,
        ownerRoleKey: template.ownerRoleKey,
        createdAt: now,
        updatedAt: now,
        dueDate: template.dueDate,
        status: "proposed",
        priority: template.priority ?? "medium",
        sourceInputId: inputId,
        sourceInputType: input.type,
        linkedInitiatives: [],
        linkedProjects: [],
        tags: template.tags ?? [],
        escalation: {
          level: "none",
        },
        completionCriteria: template.completionCriteria ?? [],
        checkInNotes: [],
      };

      this.state.actions[action.id] = action;
      createdActions.push(action);
    }

    this.state.lastUpdated = now;
    return createdActions;
  }

  /**
   * Get an action by ID
   */
  getAction(actionId: string): OwnedAction | undefined {
    return this.state.actions[actionId];
  }

  /**
   * Get all actions
   */
  getAllActions(): OwnedAction[] {
    return Object.values(this.state.actions);
  }

  /**
   * Get actions by status
   */
  getActionsByStatus(status: ActionStatus): OwnedAction[] {
    return Object.values(this.state.actions).filter((a) => a.status === status);
  }

  /**
   * Get actions by priority
   */
  getActionsByPriority(priority: ActionPriority): OwnedAction[] {
    return Object.values(this.state.actions).filter((a) => a.priority === priority);
  }

  /**
   * Get actions by owner
   */
  getActionsByOwner(ownerRoleKey: string): OwnedAction[] {
    return Object.values(this.state.actions).filter((a) => a.ownerRoleKey === ownerRoleKey);
  }

  /**
   * Get actions from a planning input
   */
  getActionsByInput(inputId: string): OwnedAction[] {
    return Object.values(this.state.actions).filter((a) => a.sourceInputId === inputId);
  }

  /**
   * Get open actions (not completed, cancelled, or deferred)
   */
  getOpenActions(): OwnedAction[] {
    return Object.values(this.state.actions).filter(
      (a) => !["completed", "cancelled", "deferred"].includes(a.status)
    );
  }

  /**
   * Get overdue actions (past due date and not completed)
   */
  getOverdueActions(): OwnedAction[] {
    const now = new Date().toISOString();
    return Object.values(this.state.actions).filter((a) => {
      if (!a.dueDate) return false;
      if (["completed", "cancelled", "deferred"].includes(a.status)) return false;
      return a.dueDate < now;
    });
  }

  /**
   * Get actions that need escalation (blocked or overdue with high/critical priority)
   */
  getActionsNeedingEscalation(): OwnedAction[] {
    const now = new Date().toISOString();
    return Object.values(this.state.actions).filter((a) => {
      if (a.escalation.level !== "none") return false;
      if (["completed", "cancelled", "deferred"].includes(a.status)) return false;
      
      // Blocked actions always need escalation
      if (a.status === "blocked") return true;
      
      // Overdue high/critical actions need escalation
      if (a.dueDate && a.dueDate < now) {
        return a.priority === "critical" || a.priority === "high";
      }
      
      return false;
    });
  }

  /**
   * Update action status
   * VAL-DEPT-OPS-001
   */
  updateActionStatus(params: UpdateActionStatusParams): OwnedAction | undefined {
    const action = this.state.actions[params.actionId];
    if (!action) return undefined;

    const now = new Date().toISOString();
    action.status = params.status;
    action.updatedAt = now;

    if (params.notes && params.notes.length > 0) {
      action.checkInNotes.push(...params.notes);
    }

    if (params.blockedReason) {
      action.blockedReason = params.blockedReason;
    }

    if (params.status === "completed") {
      action.completedAt = now;
    }

    this.state.lastUpdated = now;
    return action;
  }

  /**
   * Add a check-in note to an action
   * VAL-DEPT-OPS-001
   */
  addCheckInNote(params: AddCheckInNoteParams): OwnedAction | undefined {
    const action = this.state.actions[params.actionId];
    if (!action) return undefined;

    const now = new Date().toISOString();
    const noteEntry = `[${now}] ${params.note}`;
    action.checkInNotes.push(noteEntry);
    action.updatedAt = now;

    this.state.lastUpdated = now;
    return action;
  }

  /**
   * Escalate an action
   * VAL-DEPT-OPS-001
   */
  escalateAction(params: EscalateActionParams): OwnedAction | undefined {
    const action = this.state.actions[params.actionId];
    if (!action) return undefined;

    const now = new Date().toISOString();
    action.escalation = {
      level: params.level,
      reason: params.reason,
      escalatedAt: now,
      escalatedByRoleKey: params.escalatedByRoleKey,
    };
    action.updatedAt = now;

    this.state.lastUpdated = now;
    return action;
  }

  /**
   * Get actions by escalation level
   */
  getActionsByEscalationLevel(level: ActionEscalationLevel): OwnedAction[] {
    return Object.values(this.state.actions).filter((a) => a.escalation.level === level);
  }

  // ============================================
  // Planning Cycle Management
  // ============================================

  /**
   * Create a planning cycle
   * VAL-DEPT-OPS-001
   */
  createPlanningCycle(params: CreatePlanningCycleParams): PlanningCycle {
    const now = new Date().toISOString();
    const cycle: PlanningCycle = {
      id: generateId(),
      name: params.name,
      type: params.type,
      ownerRoleKey: params.ownerRoleKey,
      status: "planned",
      plannedStartDate: params.plannedStartDate,
      plannedEndDate: params.plannedEndDate,
      inputIds: [],
      generatedActionIds: [],
      createdAt: now,
      updatedAt: now,
    };

    this.state.cycles[cycle.id] = cycle;
    this.state.lastUpdated = now;
    return cycle;
  }

  /**
   * Start a planning cycle
   * VAL-DEPT-OPS-001
   */
  startPlanningCycle(params: StartPlanningCycleParams): PlanningCycle | undefined {
    const cycle = this.state.cycles[params.cycleId];
    if (!cycle) return undefined;

    const now = new Date().toISOString();
    cycle.status = "in-progress";
    cycle.actualStartDate = now;
    cycle.updatedAt = now;

    this.state.lastUpdated = now;
    return cycle;
  }

  /**
   * Add an input to a planning cycle
   */
  addInputToCycle(cycleId: string, inputId: string): PlanningCycle | undefined {
    const cycle = this.state.cycles[cycleId];
    if (!cycle) return undefined;

    if (!cycle.inputIds.includes(inputId)) {
      cycle.inputIds.push(inputId);
      cycle.updatedAt = new Date().toISOString();
      this.state.lastUpdated = cycle.updatedAt;
    }

    return cycle;
  }

  /**
   * Link an action to a planning cycle
   */
  linkActionToCycle(cycleId: string, actionId: string): PlanningCycle | undefined {
    const cycle = this.state.cycles[cycleId];
    if (!cycle) return undefined;

    if (!cycle.generatedActionIds.includes(actionId)) {
      cycle.generatedActionIds.push(actionId);
      cycle.updatedAt = new Date().toISOString();
      this.state.lastUpdated = cycle.updatedAt;
    }

    return cycle;
  }

  /**
   * Complete a planning cycle
   * VAL-DEPT-OPS-001
   */
  completePlanningCycle(params: CompletePlanningCycleParams): PlanningCycle | undefined {
    const cycle = this.state.cycles[params.cycleId];
    if (!cycle) return undefined;

    const now = new Date().toISOString();
    cycle.status = "completed";
    cycle.actualEndDate = now;
    cycle.summary = params.summary;
    cycle.deltas = params.deltas;
    cycle.updatedAt = now;

    this.state.lastUpdated = now;
    return cycle;
  }

  /**
   * Get a planning cycle by ID
   */
  getCycle(cycleId: string): PlanningCycle | undefined {
    return this.state.cycles[cycleId];
  }

  /**
   * Get all planning cycles
   */
  getAllCycles(): PlanningCycle[] {
    return Object.values(this.state.cycles);
  }

  /**
   * Get active cycles
   */
  getActiveCycles(): PlanningCycle[] {
    return Object.values(this.state.cycles).filter((c) => c.status === "in-progress");
  }

  /**
   * Get cycles by owner
   */
  getCyclesByOwner(ownerRoleKey: string): PlanningCycle[] {
    return Object.values(this.state.cycles).filter((c) => c.ownerRoleKey === ownerRoleKey);
  }

  // ============================================
  // Summary and Reporting
  // ============================================

  /**
   * Generate a summary of the planning workflow
   */
  generateSummary(): {
    totalInputs: number;
    totalActions: number;
    openActions: number;
    completedActions: number;
    overdueActions: number;
    actionsNeedingEscalation: number;
    actionsByStatus: Record<ActionStatus, number>;
    actionsByPriority: Record<ActionPriority, number>;
    actionsByOwner: Record<string, number>;
    activeCycles: number;
    completedCycles: number;
  } {
    const actions = Object.values(this.state.actions);

    const actionsByStatus: Record<ActionStatus, number> = {
      proposed: 0,
      open: 0,
      "in-progress": 0,
      blocked: 0,
      completed: 0,
      cancelled: 0,
      deferred: 0,
    };

    const actionsByPriority: Record<ActionPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const actionsByOwner: Record<string, number> = {};

    for (const action of actions) {
      actionsByStatus[action.status]++;
      actionsByPriority[action.priority]++;
      if (action.ownerRoleKey) {
        actionsByOwner[action.ownerRoleKey] = (actionsByOwner[action.ownerRoleKey] ?? 0) + 1;
      }
    }

    const cycles = Object.values(this.state.cycles);

    return {
      totalInputs: Object.keys(this.state.inputs).length,
      totalActions: actions.length,
      openActions: this.getOpenActions().length,
      completedActions: actionsByStatus.completed,
      overdueActions: this.getOverdueActions().length,
      actionsNeedingEscalation: this.getActionsNeedingEscalation().length,
      actionsByStatus,
      actionsByPriority,
      actionsByOwner,
      activeCycles: cycles.filter((c) => c.status === "in-progress").length,
      completedCycles: cycles.filter((c) => c.status === "completed").length,
    };
  }

  // ============================================
  // State Management
  // ============================================

  /**
   * Get current state for persistence
   */
  getState(): PlanningWorkflowState {
    return this.state;
  }

  /**
   * Load state from persistence
   */
  loadState(state: PlanningWorkflowState): void {
    this.state = state;
  }
}
