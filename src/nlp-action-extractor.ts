import { callMiniMaxLLM } from "./nlp-client.js";

export interface ExtractedAction {
  description: string;
  owner?: string;
  dueDate?: string;
  priority: "critical" | "high" | "medium" | "low";
  confidence: number;
  sourceText: string;
}

export interface ExtractionResult {
  actions: ExtractedAction[];
  summary: string;
  keyDecisions: string[];
  topicsDiscussed: string[];
  meetingQuality: "high" | "medium" | "low";
}

/**
 * NLP-powered action extraction from meeting notes.
 * Replaces manual action tracking with AI extraction.
 */
export class NLPActionExtractor {
  /**
   * Extract actions from raw meeting notes or transcripts.
   */
  async extract(meetingText: string): Promise<ExtractionResult> {
    const prompt = `Extract actions, owners, and due dates from these meeting notes:

---
${meetingText.slice(0, 3000)}
---

Return JSON:
{
  "actions": [
    {"description": "action text", "owner": "person name if mentioned", "dueDate": "YYYY-MM-DD if mentioned", "priority": "critical|high|medium|low", "confidence": 0.0-1.0, "sourceText": "original sentence"}
  ],
  "summary": "1-2 sentence meeting summary",
  "keyDecisions": ["decision1", "decision2"],
  "topicsDiscussed": ["topic1", "topic2"],
  "meetingQuality": "high|medium|low"
}`;

    const response = await callMiniMaxLLM({
      prompt,
      system: "You are a meeting intelligence analyst. Extract all actionable items precisely.",
      maxTokens: 600,
      temperature: 0.4,
    });

    if (!response) return this.ruleBasedFallback(meetingText);

    try {
      const parsed = JSON.parse(response);
      return {
        actions: (parsed.actions ?? []).map((a: any) => ({
          description: a.description ?? "",
          owner: a.owner,
          dueDate: a.dueDate,
          priority: (["critical", "high", "medium", "low"].includes(a.priority)) ? a.priority : "medium",
          confidence: Math.max(0, Math.min(1, a.confidence ?? 0.6)),
          sourceText: a.sourceText ?? "",
        })),
        summary: parsed.summary ?? "",
        keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
        topicsDiscussed: Array.isArray(parsed.topicsDiscussed) ? parsed.topicsDiscussed : [],
        meetingQuality: ["high", "medium", "low"].includes(parsed.meetingQuality) ? parsed.meetingQuality : "medium",
      };
    } catch { return this.ruleBasedFallback(meetingText); }
  }

  /**
   * Score action completeness — detect vague or unowned actions.
   */
  scoreActionQuality(actions: ExtractedAction[]): {
    completeCount: number;
    vagueCount: number;
    unownedCount: number;
    overdueCount: number;
    overallScore: number;
  } {
    let vagueCount = 0, unownedCount = 0, overdueCount = 0;
    for (const a of actions) {
      if (!a.owner || a.owner.length < 2) unownedCount++;
      if (a.description.split(" ").length < 5) vagueCount++;
      if (a.dueDate && new Date(a.dueDate) < new Date()) overdueCount++;
    }
    const completeCount = actions.length - vagueCount - unownedCount;
    const overallScore = actions.length > 0 ? completeCount / actions.length : 0;
    return { completeCount, vagueCount, unownedCount, overdueCount, overallScore };
  }

  private ruleBasedFallback(text: string): ExtractionResult {
    // Simple regex-based extraction as fallback
    const actionPatterns = [
      /(?:action|todo|task|follow[- ]?up)[:\s]+(.+)/gi,
      /([A-Z][a-z]+ [A-Z][a-z]+) (?:will|should|to) (.+)/g,
    ];
    const actions: ExtractedAction[] = [];
    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        actions.push({
          description: match[1] || match[2] || "",
          priority: "medium",
          confidence: 0.3,
          sourceText: match[0],
        });
      }
    }
    return {
      actions: actions.slice(0, 10),
      summary: text.slice(0, 100) + "...",
      keyDecisions: [],
      topicsDiscussed: [],
      meetingQuality: "low",
    };
  }
}
