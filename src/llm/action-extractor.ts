/**
 * LLM-Powered Action Extractor
 * 
 * Extracts owned actions from planning inputs (meetings, documents, emails)
 * using LLM capabilities. This service transforms unstructured or semi-structured
 * planning content into well-formed OwnedAction objects with appropriate
 * priority, ownership, and completion criteria.
 */

import type {
  PlanningInput,
  OwnedAction,
  ActionPriority,
  PlanningInputType,
  CreateOwnedActionParams,
} from "../types.js";

export interface ActionExtractionPrompt {
  inputTitle: string;
  inputDescription: string;
  inputType: PlanningInputType;
  keyDecisions: string[];
  openQuestions: string[];
  stakeholders: string[];
}

export interface ExtractedAction {
  title: string;
  description: string;
  suggestedPriority: ActionPriority;
  suggestedOwnerRoleKey?: string;
  suggestedDueDate?: string;
  completionCriteria: string[];
  reasoning: string;
}

export interface ExtractActionsResult {
  extractedActions: ExtractedAction[];
  summary: string;
  confidence: number;
  reasoning: string;
}

export interface LLMClient {
  complete(prompt: string): Promise<string>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

const PRIORITY_KEYWORDS: Record<ActionPriority, string[]> = {
  critical: ["urgent", "critical", "asap", "immediately", "blocking", "blocker", "emergency"],
  high: ["important", "high priority", "soon", "this week", "needs attention"],
  medium: ["normal", "standard", "when possible", "backlog"],
  low: ["nice to have", "low priority", "eventually", "deferred"],
};

function inferPriorityFromText(text: string): ActionPriority {
  const lowerText = text.toLowerCase();
  
  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return priority as ActionPriority;
    }
  }
  
  return "medium";
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would", 
    "should", "could", "may", "might", "must", "can", "this", "that",
    "these", "those", "i", "we", "you", "he", "she", "it", "they"
  ]);
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
}

function calculateSimilarity(keywords1: string[], keywords2: string[]): number {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

export class LLMActionExtractor {
  private llmClient: LLMClient | null;
  private useRuleBasedFallback: boolean;

  constructor(llmClient?: LLMClient) {
    this.llmClient = llmClient ?? null;
    this.useRuleBasedFallback = true;
  }

  /**
   * Extract actions from a planning input using LLM or rule-based fallback
   */
  async extractActions(
    input: PlanningInput,
    maxActions: number = 5
  ): Promise<ExtractActionsResult> {
    if (this.llmClient) {
      return this.extractActionsWithLLM(input, maxActions);
    }
    return this.extractActionsRuleBased(input, maxActions);
  }

  /**
   * Extract actions using LLM
   */
  private async extractActionsWithLLM(
    input: PlanningInput,
    maxActions: number
  ): Promise<ExtractActionsResult> {
    const prompt = this.buildExtractionPrompt(input, maxActions);
    
    try {
      const response = await this.llmClient!.complete(prompt);
      return this.parseLLMResponse(response, input);
    } catch (error) {
      console.warn("LLM extraction failed, falling back to rule-based:", error);
      return this.extractActionsRuleBased(input, maxActions);
    }
  }

  /**
   * Build the extraction prompt for LLM
   */
  private buildExtractionPrompt(input: PlanningInput, maxActions: number): string {
    return `You are an operations expert analyzing a planning input to extract actionable items.

INPUT TYPE: ${input.type.toUpperCase()}
TITLE: ${input.title}
DESCRIPTION: ${input.description}
${input.sourceUrl ? `SOURCE: ${input.sourceUrl}` : ""}

KEY DECISIONS MADE:
${input.keyDecisions.length > 0 ? input.keyDecisions.map(d => `\- ${d}`).join("\n") : "(none)"}

OPEN QUESTIONS:
${input.openQuestions.length > 0 ? input.openQuestions.map(q => `\- ${q}`).join("\n") : "(none)"}

STAKEHOLDERS:
${input.stakeholders.length > 0 ? input.stakeholders.join(", ") : "(none specified)"}

TASK: Extract up to ${maxActions} the most important, actionable items from this input.
For each action, provide:
- title: Clear, actionable title (imperative verb phrase)
- description: What exactly needs to be done
- suggestedPriority: critical/high/medium/low based on urgency and impact
- suggestedOwnerRoleKey: Suggested role key for ownership (optional)
- completionCriteria: What defines "done" for this action

Format your response as JSON:
{
  "actions": [
    {
      "title": "Action title",
      "description": "What to do",
      "suggestedPriority": "high",
      "suggestedOwnerRoleKey": "ops-lead",
      "completionCriteria": ["Criteria 1", "Criteria 2"]
    }
  ],
  "summary": "Brief summary of what was extracted",
  "confidence": 0.85,
  "reasoning": "Why these actions were selected"
}`;
  }

  /**
   * Parse LLM response into structured result
   */
  private parseLLMResponse(
    response: string,
    input: PlanningInput
  ): ExtractActionsResult {
    try {
      const parsed = JSON.parse(response);
      return {
        extractedActions: parsed.actions.map((a: any) => ({
          title: a.title,
          description: a.description,
          suggestedPriority: a.suggestedPriority || "medium",
          suggestedOwnerRoleKey: a.suggestedOwnerRoleKey,
          suggestedDueDate: a.suggestedDueDate,
          completionCriteria: a.completionCriteria || [],
          reasoning: a.reasoning || "",
        })),
        summary: parsed.summary || "",
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || "",
      };
    } catch {
      return this.extractActionsRuleBased(input, 5);
    }
  }

  /**
   * Rule-based action extraction fallback
   */
  private extractActionsRuleBased(
    input: PlanningInput,
    maxActions: number
  ): ExtractActionsResult {
    const extractedActions: ExtractedAction[] = [];
    const allText = `${input.title} ${input.description} ${input.keyDecisions.join(" ")}`;
    const keywords = extractKeywords(allText);
    
    // Extract from key decisions
    for (const decision of input.keyDecisions) {
      if (extractedActions.length >= maxActions) break;
      
      const decisionKeywords = extractKeywords(decision);
      const similarity = calculateSimilarity(keywords, decisionKeywords);
      
      if (similarity > 0.2 || decision.length > 20) {
        extractedActions.push({
          title: `Follow up on: ${decision.substring(0, 60)}${decision.length > 60 ? "..." : ""}`,
          description: `Ensure the decision "${decision}" is implemented and tracked`,
          suggestedPriority: inferPriorityFromText(decision),
          completionCriteria: [
            "Decision is implemented",
            "Stakeholders are informed",
            "Outcome is documented"
          ],
          reasoning: `Extracted from key decision: "${decision}"`,
        });
      }
    }

    // Extract from open questions
    for (const question of input.openQuestions) {
      if (extractedActions.length >= maxActions) break;
      
      extractedActions.push({
        title: `Address: ${question.substring(0, 50)}${question.length > 50 ? "..." : ""}`,
        description: `Resolve or document the answer to: "${question}"`,
        suggestedPriority: inferPriorityFromText(question),
        completionCriteria: [
          "Question is resolved",
          "Answer is documented and shared"
        ],
        reasoning: `Extracted from open question: "${question}"`,
      });
    }

    // Generate a catch-all action if nothing was extracted
    if (extractedActions.length === 0) {
      extractedActions.push({
        title: `Process: ${input.title}`,
        description: input.description || `Review and process ${input.type}: ${input.title}`,
        suggestedPriority: inferPriorityFromText(allText),
        completionCriteria: [
          "Input is reviewed",
          "Next steps are determined",
          "Actions are created if needed"
        ],
        reasoning: "Generated from input content",
      });
    }

    return {
      extractedActions,
      summary: `Extracted ${extractedActions.length} actions from ${input.type}: ${input.title}`,
      confidence: 0.6,
      reasoning: "Rule-based extraction with keyword matching and priority inference",
    };
  }

  /**
   * Convert extracted actions to OwnedAction params
   */
  toOwnedActionParams(extracted: ExtractedAction, sourceInputId: string, sourceInputType: PlanningInputType): CreateOwnedActionParams {
    return {
      title: extracted.title,
      description: extracted.description,
      ownerRoleKey: extracted.suggestedOwnerRoleKey,
      priority: extracted.suggestedPriority,
      sourceInputId,
      sourceInputType,
      dueDate: extracted.suggestedDueDate,
      completionCriteria: extracted.completionCriteria,
      tags: ["llm-extracted"],
    };
  }

  /**
   * Set the LLM client for LLM-powered extraction
   */
  setLLMClient(client: LLMClient): void {
    this.llmClient = client;
  }
}

export default LLMActionExtractor;
