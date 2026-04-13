/**
 * LLM Action Extraction Evaluation Suite
 * 
 * Executable quality checks for the LLM-powered action extraction capability.
 * Tests extraction accuracy, priority inference, and completion criteria generation.
 */

import { describe, it, expect } from "vitest";
import { LLMActionExtractor } from "../src/llm/action-extractor.js";
import type { PlanningInput } from "../src/types.js";

// Mock LLM client for testing
class MockLLMClient {
  private shouldFail: boolean;
  
  constructor(shouldFail = false) {
    this.shouldFail = shouldFail;
  }

  async complete(prompt: string): Promise<string> {
    if (this.shouldFail) {
      throw new Error("LLM unavailable");
    }
    
    // Simulate good extraction based on keywords
    if (prompt.includes("urgent") || prompt.includes("critical")) {
      return JSON.stringify({
        actions: [
          {
            title: "Address critical issue in system",
            description: "Resolve the urgent matter identified",
            suggestedPriority: "critical",
            suggestedOwnerRoleKey: "ops-lead",
            completionCriteria: ["Issue resolved", "Stakeholders informed"]
          }
        ],
        summary: "Extracted 1 critical action",
        confidence: 0.9,
        reasoning: "Keyword analysis detected urgent terms"
      });
    }
    
    return JSON.stringify({
      actions: [
        {
          title: "Follow up on decision",
          description: "Ensure the decision is implemented",
          suggestedPriority: "medium",
          completionCriteria: ["Decision implemented", "Documentation updated"]
        }
      ],
      summary: "Extracted 1 action",
      confidence: 0.75,
      reasoning: "Standard extraction"
    });
  }
}

describe("LLMActionExtractor Evaluation", () => {
  describe("Rule-based fallback", () => {
    const extractor = new LLMActionExtractor();

    it("should extract actions from meeting input", async () => {
      const input: PlanningInput = {
        id: "test-1",
        type: "meeting",
        title: "Q1 Planning Session",
        description: "We need to address the urgent deployment issue",
        keyDecisions: ["Migrate to new infrastructure by EOM"],
        openQuestions: ["What is the budget for Q1?"],
        stakeholders: ["engineering", "product"],
        createdAt: new Date().toISOString(),
        tags: []
      };

      const result = await extractor.extractActions(input, 5);

      expect(result.extractedActions.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should infer priority from keywords", async () => {
      const input: PlanningInput = {
        id: "test-2",
        type: "document",
        title: "Critical Security Update",
        description: "This requires immediate attention",
        keyDecisions: ["Apply security patch ASAP"],
        openQuestions: [],
        stakeholders: ["security-team"],
        createdAt: new Date().toISOString(),
        tags: []
      };

      const result = await extractor.extractActions(input, 5);

      const criticalActions = result.extractedActions.filter(
        a => a.suggestedPriority === "critical"
      );
      expect(criticalActions.length).toBeGreaterThan(0);
    });

    it("should generate completion criteria", async () => {
      const input: PlanningInput = {
        id: "test-3",
        type: "email",
        title: "Follow up needed",
        description: "Review and update the documentation",
        keyDecisions: [],
        openQuestions: ["Should we update all docs or just user guides?"],
        stakeholders: [],
        createdAt: new Date().toISOString(),
        tags: []
      };

      const result = await extractor.extractActions(input, 5);

      for (const action of result.extractedActions) {
        expect(action.completionCriteria.length).toBeGreaterThan(0);
      }
    });
  });

  describe("LLM-powered extraction", () => {
    it("should use LLM client when available", async () => {
      const mockClient = new MockLLMClient();
      const extractor = new LLMActionExtractor(mockClient);

      const input: PlanningInput = {
        id: "test-4",
        type: "meeting",
        title: "Sprint Planning",
        description: "Regular sprint planning session",
        keyDecisions: ["Complete user auth by Friday"],
        openQuestions: [],
        stakeholders: ["team"],
        createdAt: new Date().toISOString(),
        tags: []
      };

      const result = await extractor.extractActions(input, 5);

      expect(result.extractedActions.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should fall back to rule-based on LLM failure", async () => {
      const failingClient = new MockLLMClient(true);
      const extractor = new LLMActionExtractor(failingClient);

      const input: PlanningInput = {
        id: "test-5",
        type: "ticket",
        title: "Bug Fix Required",
        description: "Fix the critical bug in production",
        keyDecisions: [],
        openQuestions: [],
        stakeholders: [],
        createdAt: new Date().toISOString(),
        tags: []
      };

      const result = await extractor.extractActions(input, 5);

      // Should still produce results via fallback
      expect(result.extractedActions.length).toBeGreaterThan(0);
    });
  });

  describe("Quality benchmarks", () => {
    it("should meet minimum extraction rate", async () => {
      const extractor = new LLMActionExtractor();
      
      const testInputs: PlanningInput[] = [
        {
          id: "bench-1",
          type: "meeting",
          title: "Planning",
          description: "Discuss roadmap",
          keyDecisions: ["Feature A in Q1", "Feature B in Q2"],
          openQuestions: ["Timeline?"],
          stakeholders: ["team"],
          createdAt: new Date().toISOString(),
          tags: []
        },
        {
          id: "bench-2",
          type: "document",
          title: "RFC",
          description: "Architecture review",
          keyDecisions: ["Use microservices"],
          openQuestions: ["Database choice?"],
          stakeholders: ["architects"],
          createdAt: new Date().toISOString(),
          tags: []
        }
      ];

      let totalActions = 0;
      for (const input of testInputs) {
        const result = await extractor.extractActions(input, 5);
        totalActions += result.extractedActions.length;
      }

      // Should extract at least 1 action per input on average
      expect(totalActions / testInputs.length).toBeGreaterThanOrEqual(1);
    });
  });
});

export { MockLLMClient };
