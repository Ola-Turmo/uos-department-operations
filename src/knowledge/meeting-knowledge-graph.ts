// src/knowledge/meeting-knowledge-graph.ts
/**
 * Operations Knowledge Graph — connects meetings, actions, owners, and knowledge assets.
 * Pattern: meeting → action → owner → knowledge asset → freshness → dependency
 */

export type KGRuleType = "contains" | "assigns" | "depends_on" | "references" | "blocks" | "owned_by" | "discussed_in";

export interface KGNode {
  id: string;
  type: "meeting" | "action" | "knowledge_asset" | "owner" | "project" | "topic";
  label: string;
  metadata: Record<string, string | number | boolean>;
}

export interface KGEdge {
  source: string;
  target: string;
  relation: KGRuleType;
  metadata: Record<string, string | number | boolean>;
}

export interface KGQuery {
  findActionsByMeeting?: string;
  findMeetingsByTopic?: string;
  findAssetDependents?: string;
  findStaleActions?: { owner?: string; daysStale?: number };
}

/**
 * In-memory knowledge graph for operations intelligence.
 * Models the cocoindex pattern: meeting notes → extracted entities → graph → queries.
 */
export class OperationsKnowledgeGraph {
  private nodes = new Map<string, KGNode>();
  private edges: KGEdge[] = [];
  private adjacency = new Map<string, KGEdge[]>();

  // ── Node Management ──────────────────────────────────────────────────────

  addNode(node: KGNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: KGEdge): void {
    this.edges.push(edge);
    if (!this.adjacency.has(edge.source)) this.adjacency.set(edge.source, []);
    this.adjacency.get(edge.source)!.push(edge);
  }

  getNode(id: string): KGNode | undefined {
    return this.nodes.get(id);
  }

  getEdges(sourceId: string): KGEdge[] {
    return this.adjacency.get(sourceId) ?? [];
  }

  // ── Meeting Ingestion ────────────────────────────────────────────────────

  ingestMeeting(params: {
    meetingId: string;
    summary: string;
    date: string;
    attendees: string[];
    actions: Array<{ description: string; owner?: string; dueDate?: string; priority?: string }>;
    topics: string[];
    decisions: string[];
    knowledgeAssetIds?: string[];
  }): void {
    // Create meeting node
    this.addNode({
      id: params.meetingId,
      type: "meeting",
      label: params.summary.slice(0, 80),
      metadata: { date: params.date, attendeeCount: params.attendees.length, nActions: params.actions.length },
    });

    // Create owner nodes + action nodes
    for (const action of params.actions) {
      const actionId = `action:${hashStr(action.description)}:${params.meetingId}`;
      const priority = action.priority ?? "medium";
      this.addNode({
        id: actionId,
        type: "action",
        label: action.description,
        metadata: {
          status: "open",
          owner: action.owner ?? "unassigned",
          dueDate: action.dueDate ?? "",
          priority,
          createdAt: params.date,
          meetingId: params.meetingId,
        },
      });
      this.addEdge({ source: params.meetingId, target: actionId, relation: "contains", metadata: {} });

      if (action.owner) {
        const ownerId = `owner:${hashStr(action.owner)}`;
        this.addNode({
          id: ownerId,
          type: "owner",
          label: action.owner,
          metadata: { name: action.owner },
        });
        this.addEdge({ source: actionId, target: ownerId, relation: "owned_by", metadata: {} });
      }

      if (action.dueDate) {
        const projectId = `project:${hashStr(action.dueDate)}`;
        this.addNode({ id: projectId, type: "project", label: `Due ${action.dueDate}`, metadata: { dueDate: action.dueDate } });
        this.addEdge({ source: actionId, target: projectId, relation: "depends_on", metadata: {} });
      }
    }

    // Create topic nodes + link to meeting
    for (const topic of params.topics) {
      const topicId = `topic:${hashStr(topic)}`;
      this.addNode({ id: topicId, type: "topic", label: topic, metadata: { name: topic } });
      this.addEdge({ source: params.meetingId, target: topicId, relation: "discussed_in", metadata: {} });
    }

    // Link knowledge assets discussed
    for (const assetId of (params.knowledgeAssetIds ?? [])) {
      this.addEdge({ source: params.meetingId, target: assetId, relation: "references", metadata: {} });
    }
  }

  // ── Knowledge Asset Integration ──────────────────────────────────────────

  linkAssetToAction(actionId: string, assetId: string): void {
    if (!this.nodes.has(assetId)) {
      this.addNode({ id: assetId, type: "knowledge_asset", label: assetId, metadata: {} });
    }
    this.addEdge({ source: actionId, target: assetId, relation: "references", metadata: {} });
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  query(q: KGQuery): { actions: KGNode[]; meetings: KGNode[]; assets: KGNode[] } {
    const actions: KGNode[] = [];
    const meetings: KGNode[] = [];
    const assets: KGNode[] = [];

    if (q.findActionsByMeeting) {
      const edges = this.getEdges(q.findActionsByMeeting);
      for (const edge of edges) {
        const node = this.nodes.get(edge.target);
        if (node?.type === "action") actions.push(node);
        if (node?.type === "meeting") meetings.push(node);
      }
    }

    if (q.findMeetingsByTopic) {
      const topicId = `topic:${hashStr(q.findMeetingsByTopic)}`;
      for (const edge of this.edges) {
        if (edge.target === topicId && edge.relation === "discussed_in") {
          const node = this.nodes.get(edge.source);
          if (node?.type === "meeting") meetings.push(node);
        }
      }
    }

    if (q.findAssetDependents) {
      for (const edge of this.edges) {
        if (edge.target === q.findAssetDependents && edge.relation === "references") {
          const node = this.nodes.get(edge.source);
          if (node?.type === "action") actions.push(node);
        }
      }
    }

    if (q.findStaleActions) {
      const { owner, daysStale = 30 } = q.findStaleActions;
      const cutoff = new Date(Date.now() - daysStale * 86400000).toISOString();
      for (const node of this.nodes.values()) {
        if (node.type === "action") {
          const createdAt = String(node.metadata.createdAt ?? "");
          if (createdAt < cutoff && (!owner || node.metadata.owner === owner)) {
            actions.push(node);
          }
        }
      }
    }

    return { actions: deduplicate(actions), meetings: deduplicate(meetings), assets: deduplicate(assets) };
  }

  // ── Dependency Path Finding ─────────────────────────────────────────────

  findDependencyPath(startActionId: string, endActionId: string): string[] {
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (current: string, path: string[]): boolean => {
      if (current === endActionId) { path.push(current); return true; }
      visited.add(current);
      path.push(current);
      for (const edge of this.getEdges(current)) {
        if (edge.relation === "depends_on" && !visited.has(edge.target)) {
          if (dfs(edge.target, path)) return true;
        }
      }
      path.pop();
      return false;
    };

    dfs(startActionId, path);
    return path;
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  stats(): { nNodes: number; nEdges: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const node of this.nodes.values()) {
      byType[node.type] = (byType[node.type] ?? 0) + 1;
    }
    return { nNodes: this.nodes.size, nEdges: this.edges.length, byType };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashStr(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function deduplicate<T>(arr: T[]): T[] {
  return Array.from(new Set(arr.map(x => JSON.stringify(x)))).map(x => JSON.parse(x) as T);
}
