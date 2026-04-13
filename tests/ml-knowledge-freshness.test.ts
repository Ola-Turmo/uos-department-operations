import { describe, it, expect } from "vitest";
import { MLKnowledgeFreshness } from "../src/ml-knowledge-freshness";

describe("MLKnowledgeFreshness", () => {
  it("scores fresh asset as high freshness", async () => {
    const scorer = new MLKnowledgeFreshness();
    const asset = {
      id: "doc-1",
      title: "Getting Started Guide",
      lastUpdated: new Date(Date.now() - 7 * 86400000).toISOString(),
      lastReviewed: new Date(Date.now() - 7 * 86400000).toISOString(),
      category: "onboarding",
      viewCount30d: 500,
      helpfulVotes: 45,
      unhelpfulVotes: 3,
      linkedDocIds: ["doc-2"],
      tags: ["onboarding", "beginner"],
    };
    const result = await scorer.score(asset);
    expect(result.freshnessScore).toBeGreaterThan(0.6);
    expect(result.stalenessRisk).toMatch(/^(low|medium)$/);
  });

  it("scores old asset as stale", async () => {
    const scorer = new MLKnowledgeFreshness();
    const asset = {
      id: "doc-2",
      title: "Legacy API Docs",
      lastUpdated: new Date(Date.now() - 365 * 86400000).toISOString(),
      lastReviewed: new Date(Date.now() - 365 * 86400000).toISOString(),
      category: "technical",
      viewCount30d: 2,
      helpfulVotes: 1,
      unhelpfulVotes: 5,
      linkedDocIds: [],
      tags: ["api", "legacy"],
    };
    const result = await scorer.score(asset);
    expect(result.freshnessScore).toBeLessThan(0.3);
    expect(["high", "critical", "medium"]).toContain(result.stalenessRisk);
  });

  it("scores batch and returns prioritized list", async () => {
    const scorer = new MLKnowledgeFreshness();
    const assets = [
      { id: "d1", title: "Fresh", lastUpdated: new Date().toISOString(), lastReviewed: new Date().toISOString(), category: "a", viewCount30d: 100, helpfulVotes: 10, unhelpfulVotes: 1, linkedDocIds: [], tags: [] },
      { id: "d2", title: "Stale", lastUpdated: new Date(Date.now() - 500 * 86400000).toISOString(), lastReviewed: new Date(Date.now() - 500 * 86400000).toISOString(), category: "b", viewCount30d: 2, helpfulVotes: 1, unhelpfulVotes: 5, linkedDocIds: [], tags: [] },
    ];
    const results = await scorer.scoreBatch(assets);
    expect(results.length).toBe(2);
    expect(results[0].priorityRefresh).toBeGreaterThanOrEqual(results[1].priorityRefresh);
  });
});
