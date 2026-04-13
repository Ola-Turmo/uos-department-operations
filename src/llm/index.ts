/**
 * LLM Module - AI-Powered Operations Capabilities
 * 
 * This module provides LLM-powered capabilities for the audit-operations department,
 * including action extraction, summarization, and bottleneck analysis.
 */

export { LLMActionExtractor } from "./action-extractor.js";
export type { 
  ActionExtractionPrompt, 
  ExtractedAction, 
  ExtractActionsResult,
  LLMClient 
} from "./action-extractor.js";

export { LLMSummarizer } from "./summarizer.js";
export type {
  CycleSummary,
  BottleneckSummary,
  OperationsStatusSummary,
} from "./summarizer.js";

export { LLMBottleneckAnalyzer } from "./bottleneck-analyzer.js";
export type {
  BottleneckAnalysis,
  BottleneckAnalysisType,
  ActionFlowMetrics,
  BottleneckDetectionInput,
} from "./bottleneck-analyzer.js";
