# ADR-0002: ML-Based Knowledge Freshness Scoring

## Status
Accepted

## Date
2026-04-13

## Context
Knowledge assets decay over time. Manual tracking of freshness is error-prone and doesn't scale. We need predictive freshness scoring to prioritize refresh efforts.

## Decision
Implement a weighted-factor ML model for freshness scoring:

### Scoring Factors
| Factor | Weight | Description |
|--------|--------|-------------|
| Review Recency | 0.35 | Days since last review |
| Update Recency | 0.25 | Days since content update |
| Interval Alignment | 0.20 | Alignment with expected refresh interval |
| Access Frequency | 0.10 | How often asset is accessed |
| Type Specific | varies | Asset type affects decay rate |
| Owner Assigned | 0.10 | Accountability factor |

### Type-Specific Multipliers
| Asset Type | Multiplier | Rationale |
|------------|------------|-----------|
| Policy | 1.5 | More stable content |
| Document | 1.0 | Standard decay |
| Guide | 0.8 | Moderate decay |
| Runbook | 0.7 | Degrades faster |
| Procedure | 0.7 | Degrades faster |
| Decision Record | 0.6 | Context-dependent |

### Status Classification
- **Fresh**: Score >= 70
- **Stale**: Score 40-69
- **Critical**: Score < 40 or 3x past interval

## Consequences
- Enables proactive refresh scheduling
- Quantifies freshness as 0-100 score
- Predicts days until staleness
