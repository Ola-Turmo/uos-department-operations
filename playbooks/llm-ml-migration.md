# Migration Guide: LLM and ML Capabilities Integration

## Overview
This guide covers the integration of LLM-powered capabilities and ML models into the audit-operations workflow.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-13 | Initial LLM/ML integration |

---

## LLM Integration

### Prerequisites
- Node.js >= 20
- Access to LLM API endpoint
- Configured LLM client credentials

### Configuration
```typescript
import { LLMActionExtractor } from './src/llm/action-extractor';
import type { LLMClient } from './src/llm/action-extractor';

class ProductionLLMClient implements LLMClient {
  async complete(prompt: string): Promise<string> {
    // Call your LLM API here
    const response = await fetch('https://api.example.com/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    return response.text();
  }
}

const extractor = new LLMActionExtractor(new ProductionLLMClient());
```

### Fallback Behavior
The LLM extraction automatically falls back to rule-based extraction if:
- LLM client is not configured
- LLM API call fails
- Response parsing fails

### Rate Limiting
Implement rate limiting for LLM calls:
```typescript
const rateLimiter = new Map<string, number>();
const RATE_LIMIT = 100; // calls per minute

async function rateLimitedComplete(prompt: string): Promise<string> {
  const now = Date.now();
  const key = 'llm'; // or user-specific key
  const lastCall = rateLimiter.get(key) || 0;
  
  if (now - lastCall < 60000 / RATE_LIMIT) {
    await sleep(60000 / RATE_LIMIT);
  }
  
  rateLimiter.set(key, Date.now());
  return llmClient.complete(prompt);
}
```

---

## ML Model Integration

### Freshness Scorer
```typescript
import { FreshnessScorer } from './src/ml/freshness-scorer';

const scorer = new FreshnessScorer(undefined, true); // enable ML mode

// Score a knowledge asset
const freshnessScore = scorer.score(asset);
console.log(`Asset freshness: ${freshnessScore.score}/100`);
console.log(`Status: ${freshnessScore.status}`);
console.log(`Days until stale: ${freshnessScore.predictedDaysUntilStale}`);
```

### Priority Predictor
```typescript
import { PriorityPredictor } from './src/ml/priority-predictor';

const predictor = new PriorityPredictor(true); // enable ML mode

// Predict priority for new action
const prediction = predictor.predict({
  title: "Deploy critical fix",
  description: "Production issue requires immediate attention",
  dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  linkedInitiatives: ["init-1", "init-2"]
});

console.log(`Predicted priority: ${prediction.predictedPriority}`);
console.log(`Confidence: ${prediction.confidence}`);
```

### Bottleneck Detector
```typescript
import { BottleneckDetector } from './src/ml/bottleneck-detector';

const detector = new BottleneckDetector(0.75); // 75% detection threshold

// Detect bottlenecks
const result = detector.detect(actions, assets, refreshTasks);

for (const signal of result.signals) {
  console.log(`[${signal.severity}] ${signal.type}: ${signal.description}`);
  console.log(`Affected: ${signal.affectedIds.length} items`);
  console.log(`Confidence: ${signal.confidence}`);
}
```

---

## Data Migration

### Action Format Upgrade
Old format:
```typescript
interface OldAction {
  title: string;
  owner: string;
  dueDate: string;
}
```

New format:
```typescript
import type { OwnedAction } from './src/types';

interface NewAction extends OwnedAction {
  sourceInputId: string;
  sourceInputType: PlanningInputType;
  completionCriteria: string[];
  tags: string[];
  linkedInitiatives: string[];
  linkedProjects: string[];
}
```

### Asset Freshness Fields
Add ML-computed fields to knowledge assets:
```typescript
interface FreshnessMetadata {
  score: number;           // 0-100
  status: FreshnessStatus; // fresh | stale | critical
  predictedDaysUntilStale: number;
  confidence: number;
  factors: FreshnessFactor[];
}
```

---

## Rollback Procedures

### Disabling LLM
Set `llmClient` to `null` in the extractor:
```typescript
extractor.setLLMClient(null);
// Falls back to rule-based extraction
```

### Disabling ML
Pass `false` to ML model constructors:
```typescript
const scorer = new FreshnessScorer(undefined, false); // rule-based only
const predictor = new PriorityPredictor(false);
const detector = new BottleneckDetector(0.5); // more sensitive
```

---

## Testing

### LLM Evaluation
```bash
npm run test -- evals/action-extraction-eval.ts
npm run test -- evals/summarization-eval.ts
```

### ML Evaluation
```bash
npm run test -- evals/freshness-scorer-eval.ts
npm run test -- evals/priority-predictor-eval.ts
npm run test -- evals/bottleneck-detector-eval.ts
```

---

## Performance Considerations

| Component | Latency Target | Notes |
|-----------|---------------|-------|
| LLM extraction | < 5s | Add caching |
| Freshness scoring | < 100ms | Batch processing |
| Priority prediction | < 50ms | Real-time |
| Bottleneck detection | < 200ms | Run on schedule |

---

## Security

### API Key Management
- Store LLM credentials in environment variables
- Rotate keys quarterly
- Never commit credentials to source control

### Data Privacy
- Sanitize prompts before sending to LLM
- Avoid sending PII in action descriptions
- Log LLM interactions for audit
