# Lesson Learned: Freshness Model Deployment

**Date**: 2026-04-13
**Feature**: ML Freshness Scorer
**Team**: audit-operations

## Overview
Deployed ML-based freshness scoring for knowledge assets. Initial accuracy was lower than expected due to data quality issues.

## Key Learning
**Data quality matters more than model complexity.**

## Details

### Initial Approach
- Implemented complex weighted model with 6 factors
- Expected 90% accuracy based on offline testing

### Reality
- Production accuracy: 72%
- Root cause: stale timestamps in source data

### Fix Applied
1. Added data validation layer
2. Implemented timestamp normalization
3. Added confidence scores based on data quality
4. Final accuracy: 85%

## Takeaways

### What Worked
- Confidence scoring helped identify uncertain predictions
- Type-specific multipliers were effective
- Fallback to rule-based when confidence low

### What Didn't Work
- Assuming data quality without validation
- Not monitoring data freshness separately
- No alerting for low-confidence predictions

## Metrics Comparison

| Phase | Accuracy | Notes |
|-------|----------|-------|
| Offline | 90% | Clean test data |
| Initial Prod | 72% | Raw data |
| After Fix | 85% | Validated data |

## Recommendations

1. **Validate data before model deployment**
2. **Monitor data quality separately**
3. **Use confidence scores for routing**
4. **Plan for data cleaning iterations**

## Related ADRs
- ADR-0002: ML-Based Knowledge Freshness Scoring
