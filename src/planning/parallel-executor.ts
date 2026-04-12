import { ActionDependencyGraph } from './dependency-graph';

/**
 * Result of executing a single action
 */
export interface ActionResult {
  actionId: string;
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Result of executing a batch of actions
 */
export interface BatchResult {
  batchIndex: number;
  actionIds: string[];
  startedAt: string;
  completedAt?: string;
  results: ActionResult[];
}

/**
 * ParallelExecutor
 * 
 * Executes batches of independent actions based on a dependency graph.
 * Actions within a batch can run in parallel (no dependencies between them).
 * Batches are executed sequentially (each batch waits for the previous to complete).
 */
export class ParallelExecutor {
  private graph: ActionDependencyGraph;
  private batches: string[][] = [];
  private currentBatchIndex: number = 0;
  private executedCount: number = 0;
  private totalActions: number = 0;

  constructor(graph: ActionDependencyGraph) {
    this.graph = graph;
  }

  /**
   * Execute all actions in batches based on dependency graph
   */
  async executeBatches(actionIds: string[]): Promise<BatchResult[]> {
    if (actionIds.length === 0) {
      return [];
    }

    // Get parallel batches from graph
    this.batches = this.graph.getParallelBatches();
    this.totalActions = actionIds.length;
    this.currentBatchIndex = 0;
    this.executedCount = 0;

    const results: BatchResult[] = [];

    for (let i = 0; i < this.batches.length; i++) {
      const batchActionIds = this.batches[i];
      const batchResult = await this.executeSingleBatch(batchActionIds, i);
      results.push(batchResult);
      this.executedCount += batchActionIds.length;
    }

    return results;
  }

  /**
   * Get the next batch of actions ready to execute
   */
  getNextBatch(): string[] {
    if (this.batches.length === 0) {
      // Initialize batches from graph
      this.batches = this.graph.getParallelBatches();
      // Calculate total actions from all batches
      this.totalActions = this.batches.flat().length;
    }

    if (this.currentBatchIndex >= this.batches.length) {
      return [];
    }

    const batch = this.batches[this.currentBatchIndex];
    this.currentBatchIndex++;
    this.executedCount += batch.length;
    
    return batch;
  }

  /**
   * Check if all actions have been executed
   */
  isComplete(): boolean {
    return this.executedCount >= this.totalActions && this.totalActions > 0;
  }

  /**
   * Get the number of actions that have been executed
   */
  getExecutedCount(): number {
    return this.executedCount;
  }

  /**
   * Get the number of actions remaining to be executed
   */
  getRemainingCount(): number {
    if (this.totalActions === 0 && this.batches.length === 0) {
      // Auto-initialize from graph if not yet set
      this.batches = this.graph.getParallelBatches();
      this.totalActions = this.batches.flat().length;
    }
    return this.totalActions - this.executedCount;
  }

  /**
   * Execute a single batch of actions (mock implementation)
   * Resolves after 10ms delay and returns success for each action
   */
  private async simulateExecution(actionIds: string[]): Promise<ActionResult[]> {
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 10));

    // Return success for each action
    return actionIds.map(actionId => ({
      actionId,
      success: true
    }));
  }

  /**
   * Execute a single batch and return the result
   */
  private async executeSingleBatch(actionIds: string[], batchIndex: number): Promise<BatchResult> {
    const startedAt = new Date().toISOString();
    const results = await this.simulateExecution(actionIds);
    const completedAt = new Date().toISOString();

    return {
      batchIndex,
      actionIds,
      startedAt,
      completedAt,
      results
    };
  }
}
