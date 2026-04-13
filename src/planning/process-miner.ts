// src/planning/process-miner.ts
/**
 * Process Miner — discovers actual process models from operational action logs.
 * Implements Alpha Algorithm variant for directly-follows graph construction.
 */

export interface ActionLogEntry {
  caseId: string;
  activity: string;
  timestamp: string;
  resource?: string;
}

export interface DirectlyFollowsRelation {
  a: string;
  b: string;
  count: number;
}

export interface ProcessModel {
  activities: Set<string>;
  startActivities: Set<string>;
  endActivities: Set<string>;
  directlyFollows: Map<string, Map<string, number>>;
  parallelActivities: Array<[string, string]>;
  loops: Array<[string, string]>;  // activity pairs that form loops
}

export interface BottleneckAnalysis {
  activity: string;
  avgCycleTime: number;  // minutes
  waitTime: number;  // minutes
  throughputRate: number;  // cases per hour
  utilization: number;  // 0-1
  severity: "critical" | "bottleneck" | "normal";
}

export interface ProcessMiningResult {
  model: ProcessModel;
  bottlenecks: BottleneckAnalysis[];
  cycleTimeMinutes: number;
  avgThroughputPerHour: number;
  discoveredPaths: Array<{ path: string[]; frequency: number }>;
}

/**
 * Alpha Algorithm process miner.
 * Discovers process model from action execution logs.
 */
export class ProcessMiner {
  /**
   * Discover process model from action logs using Alpha Algorithm.
   */
  discoverProcess(logs: ActionLogEntry[]): ProcessMiningResult {
    // 1. Build directly-follows graph
    const dfg = this.buildDirectlyFollowsGraph(logs);

    // 2. Find start/end activities
    const { startActivities, endActivities } = this.findStartEndActivities(logs);

    // 3. Find parallel activities and loops
    const { parallelActivities, loops } = this.analyzeRelations(dfg);

    // 4. Extract high-frequency paths
    const discoveredPaths = this.extractPaths(dfg, startActivities, endActivities);

    // 5. Bottleneck analysis
    const bottlenecks = this.analyzeBottlenecks(logs);

    // 6. Cycle time
    const cycleTime = this.calculateCycleTime(logs);

    return {
      model: {
        activities: new Set(logs.map(l => l.activity)),
        startActivities,
        endActivities,
        directlyFollows: dfg,
        parallelActivities,
        loops,
      },
      bottlenecks,
      cycleTimeMinutes: cycleTime,
      avgThroughputPerHour: this.calculateThroughput(logs),
      discoveredPaths,
    };
  }

  private buildDirectlyFollowsGraph(logs: ActionLogEntry[]): Map<string, Map<string, number>> {
    // Group by case
    const cases = new Map<string, ActionLogEntry[]>();
    for (const entry of logs) {
      if (!cases.has(entry.caseId)) cases.set(entry.caseId, []);
      cases.get(entry.caseId)!.push(entry);
    }

    // Sort each case by timestamp
    for (const [, events] of cases) {
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    // Build directly-follows
    const dfg = new Map<string, Map<string, number>>();
    for (const [, events] of cases) {
      for (let i = 0; i < events.length - 1; i++) {
        const a = events[i].activity;
        const b = events[i + 1].activity;
        if (!dfg.has(a)) dfg.set(a, new Map());
        const transitions = dfg.get(a)!;
        transitions.set(b, (transitions.get(b) ?? 0) + 1);
      }
    }

    return dfg;
  }

  private findStartEndActivities(logs: ActionLogEntry[]): {
    startActivities: Set<string>;
    endActivities: Set<string>;
  } {
    const caseFirst = new Map<string, string>();
    const caseLast = new Map<string, string>();
    for (const entry of logs) {
      const ts = new Date(entry.timestamp).getTime();
      if (!caseFirst.has(entry.caseId) || ts < new Date(caseFirst.get(entry.caseId)!).getTime()) {
        caseFirst.set(entry.caseId, entry.activity);
      }
      if (!caseLast.has(entry.caseId) || ts > new Date(caseLast.get(entry.caseId)!).getTime()) {
        caseLast.set(entry.caseId, entry.activity);
      }
    }
    const startActivities = new Set<string>(caseFirst.values());
    const endActivities = new Set<string>(caseLast.values());
    return { startActivities, endActivities };
  }

  private analyzeRelations(dfg: Map<string, Map<string, number>>): {
    parallelActivities: Array<[string, string]>;
    loops: Array<[string, string]>;
  } {
    const parallel: Array<[string, string]> = [];
    const loops: Array<[string, string]> = [];

    for (const [a, transitions] of dfg) {
      for (const [b, count] of transitions) {
        if (dfg.has(b)) {
          const back = dfg.get(b)!.get(a);
          if (back != null && back > 0) {
            parallel.push([a, b]);
          }
        }
        // Self-loop
        if (a === b && count > 1) {
          loops.push([a, a]);
        }
      }
    }

    return { parallelActivities: parallel, loops };
  }

  private extractPaths(
    dfg: Map<string, Map<string, number>>,
    startActivities: Set<string>,
    endActivities: Set<string>
  ): Array<{ path: string[]; frequency: number }> {
    const paths: Array<{ path: string[]; frequency: number }> = [];

    const dfs = (current: string, path: string[], freq: number): void => {
      if (endActivities.has(current)) {
        paths.push({ path: [...path], frequency: freq });
      }
      const transitions = dfg.get(current);
      if (!transitions) return;
      for (const [next, count] of transitions) {
        if (!path.includes(next) || path.filter(a => a === next).length < 2) {
          dfs(next, [...path, next], Math.min(freq, count));
        }
      }
    };

    for (const start of startActivities) {
      dfs(start, [start], 999999);
    }

    return paths.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
  }

  private analyzeBottlenecks(logs: ActionLogEntry[]): BottleneckAnalysis[] {
    // Group by activity
    const byActivity = new Map<string, { start: number; end: number; count: number }>();

    for (const entry of logs) {
      const ts = new Date(entry.timestamp).getTime();
      if (!byActivity.has(entry.activity)) {
        byActivity.set(entry.activity, { start: ts, end: ts, count: 0 });
      }
      const stat = byActivity.get(entry.activity)!;
      stat.start = Math.min(stat.start, ts);
      stat.end = Math.max(stat.end, ts);
      stat.count++;
    }

    const results: BottleneckAnalysis[] = [];

    for (const [activity, stat] of byActivity) {
      const avgCycleTime = (stat.end - stat.start) / 60000 / Math.max(1, stat.count);
      const waitTime = avgCycleTime * 0.3;  // estimate: 30% of cycle time is waiting
      const severity: BottleneckAnalysis["severity"] =
        avgCycleTime > 240 ? "critical" :
        avgCycleTime > 120 ? "bottleneck" : "normal";

      results.push({
        activity,
        avgCycleTime: Math.round(avgCycleTime * 10) / 10,
        waitTime: Math.round(waitTime * 10) / 10,
        throughputRate: stat.count / Math.max(1, (stat.end - stat.start) / 3600000),
        utilization: Math.min(1, stat.count / 10),
        severity,
      });
    }

    return results.sort((a, b) => b.avgCycleTime - a.avgCycleTime);
  }

  private calculateCycleTime(logs: ActionLogEntry[]): number {
    const cases = new Map<string, { start: number; end: number }>();
    for (const entry of logs) {
      const ts = new Date(entry.timestamp).getTime();
      if (!cases.has(entry.caseId)) cases.set(entry.caseId, { start: ts, end: ts });
      const c = cases.get(entry.caseId)!;
      c.start = Math.min(c.start, ts);
      c.end = Math.max(c.end, ts);
    }
    if (cases.size === 0) return 0;
    const totalMs = Array.from(cases.values()).reduce((s, c) => s + (c.end - c.start), 0);
    return totalMs / 60000 / cases.size;
  }

  private calculateThroughput(logs: ActionLogEntry[]): number {
    const cases = new Map<string, number>();
    for (const entry of logs) {
      cases.set(entry.caseId, new Date(entry.timestamp).getTime());
    }
    if (cases.size < 2) return 0;
    const timestamps = Array.from(cases.values()).sort((a, b) => a - b);
    const spanHours = (timestamps[timestamps.length - 1] - timestamps[0]) / 3600000;
    return spanHours > 0 ? cases.size / spanHours : cases.size;
  }
}
