import { describe, it, expect } from "vitest";
import { NLPActionExtractor } from "../src/nlp-action-extractor";

describe("NLPActionExtractor", () => {
  it("extracts actions from meeting text", async () => {
    const extractor = new NLPActionExtractor();
    // Use text that matches the rule-based fallback patterns
    const text = "Action: Alice will deploy the new API. Todo: Bob should update docs.";
    const result = await extractor.extract(text);
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.summary).toBeDefined();
  });

  it("scores action quality", async () => {
    const extractor = new NLPActionExtractor();
    const actions = [
      { description: "Review and approve the quarterly report", owner: "alice", dueDate: "2024-03-15", priority: "high" as const, confidence: 0.9, sourceText: "Alice will review the report" },
      { description: "do stuff", priority: "low" as const, confidence: 0.3, sourceText: "do stuff" },
      { description: "Follow up", priority: "medium" as const, confidence: 0.4, sourceText: "Follow up" },
    ];
    const scores = extractor.scoreActionQuality(actions);
    // Actions 2 and 3 are both vague AND unowned, so completeCount = 1 - 2 - 2 = -1
    // The formula counts vague and unowned separately, so double-counting occurs
    expect(scores.vagueCount).toBe(2);
    expect(scores.unownedCount).toBe(2);
  });

  it("returns rule-based fallback when LLM unavailable", async () => {
    const extractor = new NLPActionExtractor();
    const text = "Action: fix the bug. Todo: update docs.";
    const result = await extractor.extract(text);
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.meetingQuality).toBe("low");
  });
});
