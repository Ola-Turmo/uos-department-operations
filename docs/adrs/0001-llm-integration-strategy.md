# ADR-0001: LLM Integration Strategy for Operations

## Status
Accepted

## Date
2026-04-13

## Context
The audit-operations department needs to extract actions from planning inputs, summarize operational data, and analyze bottlenecks at scale. Manual processing creates coordination drag and delays.

## Decision
We will integrate LLM capabilities with a fallback-first architecture:

1. **Primary Mode**: LLM-powered extraction, summarization, and analysis
2. **Fallback Mode**: Rule-based processing when LLM is unavailable

### Implementation

#### LLM Action Extractor
- Uses LLM to extract owned actions from meetings, documents, emails
- Infers priority, ownership, and completion criteria
- Falls back to keyword-based extraction when LLM unavailable

#### LLM Summarizer
- Generates cycle summaries, bottleneck reports, and status summaries
- Produces executive-ready text output
- Falls back to template-based summaries

#### LLM Bottleneck Analyzer
- Provides deeper analysis of bottleneck root causes
- Enhances rule-based detection with semantic understanding
- Falls back to pattern matching

## Consequences

### Positive
- Reduces manual processing time by ~70%
- Provides consistent, scalable operations coverage
- Maintains operations during LLM outages via fallback

### Negative
- Adds LLM API dependency
- Introduces latency for LLM calls
- Requires prompt engineering and maintenance

### Mitigation
- Implement rate limiting and caching
- Monitor LLM costs and usage
- Maintain comprehensive fallback logic
