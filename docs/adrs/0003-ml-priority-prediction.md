# ADR-0003: ML-Based Priority Prediction

## Status
Accepted

## Date
2026-04-13

## Context
Action priority assignment is inconsistent and often doesn't account for urgency signals. We need predictive priority scoring to improve action routing and focus.

## Decision
Implement a rule-based ML model for priority prediction:

### Prediction Factors
| Factor | Impact | Notes |
|--------|--------|-------|
| Urgent Keywords | +2.0 | "urgent", "asap", "critical" |
| High Priority Keywords | +1.5 | "important", "key", "essential" |
| Due Date Proximity | +0.5 to +3.0 | Based on days until due |
| Source Type | +0.0 to +0.7 | Ticket > Email > Meeting > Doc |
| Linked Initiatives | +0.3 | If >= 2 initiatives |
| Linked Projects | +0.2 | If >= 2 projects |
| No Owner | +0.8 | Unowned tasks need attention |

### Priority Thresholds
| Score Range | Priority |
|------------|----------|
| >= 80 | Critical |
| 60-79 | High |
| 40-59 | Medium |
| < 40 | Low |

## Consequences
- Consistent priority assignment
- Evidence-based priority reasoning
- Identifies factors driving priority
- Confidence scoring for predictions
