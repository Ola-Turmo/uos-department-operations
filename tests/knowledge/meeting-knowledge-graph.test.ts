import { describe, it, expect } from "vitest";
import { OperationsKnowledgeGraph } from "../../src/knowledge/meeting-knowledge-graph";

describe("OperationsKnowledgeGraph", () => {
  it("ingests meeting and creates nodes", () => {
    const kg = new OperationsKnowledgeGraph();
    kg.ingestMeeting({
      meetingId: "mtg-001",
      summary: "Q1 planning session",
      date: "2024-01-15",
      attendees: ["alice", "bob"],
      actions: [{ description: "Deploy v2 API", owner: "alice", dueDate: "2024-02-01", priority: "high" }],
      topics: ["api", "deployment"],
      decisions: ["Use GraphQL"],
    });
    const stats = kg.stats();
    expect(stats.nNodes).toBeGreaterThan(0);
    expect(stats.nEdges).toBeGreaterThan(0);
  });

  it("queries stale actions", () => {
    const kg = new OperationsKnowledgeGraph();
    kg.ingestMeeting({
      meetingId: "mtg-old",
      summary: "Old meeting",
      date: "2020-01-01",
      attendees: ["alice"],
      actions: [{ description: "Fix critical bug", owner: "alice", priority: "critical" }],
      topics: [],
      decisions: [],
    });
    const { actions } = kg.query({ findStaleActions: { daysStale: 1 } });
    expect(actions.length).toBeGreaterThan(0);
  });

  it("finds meetings by topic", () => {
    const kg = new OperationsKnowledgeGraph();
    kg.ingestMeeting({
      meetingId: "mtg-api",
      summary: "API review",
      date: "2024-03-01",
      attendees: ["alice"],
      actions: [],
      topics: ["api", "rest"],
      decisions: [],
    });
    const { meetings } = kg.query({ findMeetingsByTopic: "api" });
    expect(meetings.length).toBeGreaterThan(0);
    expect(meetings[0].id).toBe("mtg-api");
  });

  it("links knowledge assets to actions", () => {
    const kg = new OperationsKnowledgeGraph();
    kg.ingestMeeting({ meetingId: "mtg-1", summary: "Sprint", date: "2024-01-01", attendees: ["alice"], actions: [{ description: "Review doc", owner: "alice" }], topics: [], decisions: [] });
    // Find the actual action node ID by querying all nodes
    const allNodeIds = Array.from((kg as any).nodes.keys() as Iterable<string>);
    const actionNodeId = allNodeIds.find((id: string) => id.startsWith("action:") && id.endsWith(":mtg-1"));
    expect(actionNodeId).toBeDefined();
    kg.linkAssetToAction(actionNodeId!, "doc:api-guide-v2");
    const { actions } = kg.query({ findAssetDependents: "doc:api-guide-v2" });
    expect(actions.length).toBeGreaterThan(0);
  });
});
