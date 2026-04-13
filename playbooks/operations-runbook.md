# Audit Operations Runbook

## Overview
This runbook provides operational procedures for the audit-operations department, including routine maintenance, incident response, and escalation paths.

## Table of Contents
1. [Daily Operations](#daily-operations)
2. [Knowledge Freshness Maintenance](#knowledge-freshness-maintenance)
3. [Planning Cycle Management](#planning-cycle-management)
4. [Bottleneck Resolution](#bottleneck-resolution)
5. [Incident Response](#incident-response)

---

## Daily Operations

### Morning Health Check
1. Run the operations status summary:
   ```bash
   npm run check
   ```
2. Review the output for:
   - Overdue actions
   - Blocked items
   - Stale knowledge assets
   - Critical alerts

### Action Review Process
1. List all actions due within 24 hours
2. Identify blocked or at-risk actions
3. Redistribute work if any owner shows >5 active actions
4. Escalate persistent blockers to leadership

---

## Knowledge Freshness Maintenance

### Weekly Refresh Cycle
1. Generate freshness scores for all knowledge assets:
   ```typescript
   import { FreshnessScorer } from './src/ml/freshness-scorer';
   const scorer = new FreshnessScorer();
   // Score each asset...
   ```
2. Focus on assets flagged as `critical` or `stale`
3. Assign refresh tasks to asset owners
4. Document refresh completion in the audit trail

### Refresh Task Prioritization
| Status | Response Time | Action |
|--------|--------------|--------|
| Critical | Within 24 hours | Immediate review |
| Stale | Within 7 days | Schedule review |
| Fresh | Current interval | Maintain standard schedule |

---

## Planning Cycle Management

### Sprint Planning Checklist
- [ ] Review previous cycle completion rate
- [ ] Identify carried-over actions
- [ ] Generate action items from planning inputs
- [ ] Assign owners to all critical/high priority items
- [ ] Set realistic due dates based on capacity

### Cycle Closure Process
1. Review all generated actions for completion
2. Document deltas and blockers encountered
3. Calculate adherence score
4. Capture learnings for next cycle

---

## Bottleneck Resolution

### Detection and Response

#### Level 1: Action Delays
**Detection**: Actions open >14 days or no updates in 7+ days
**Response**:
1. Contact action owner for status
2. Break down if too large
3. Escalate or cancel if no progress

#### Level 2: Owner Concentration
**Detection**: Single owner has 5+ open actions
**Response**:
1. Review workload distribution
2. Redistribute to available team members
3. Consider adding resources

#### Level 3: Dependency Blocks
**Detection**: Actions in `blocked` status
**Response**:
1. Document blocker reason
2. Identify root cause
3. Escalate if unresolved in 48 hours

---

## Incident Response

### Severity Classification

| Severity | Description | Response Time |
|----------|-------------|---------------|
| P1 - Critical | Operations halted, data at risk | 15 minutes |
| P2 - High | Major function impaired | 1 hour |
| P3 - Medium | Partial impairment, workaround exists | 4 hours |
| P4 - Low | Minor issue, no immediate impact | 24 hours |

### Escalation Path
1. **Level 1**: Department lead
2. **Level 2**: Operations director
3. **Level 3**: Executive leadership

### Post-Incident Process
1. Document timeline and impact
2. Identify root cause
3. Capture action items
4. Update runbook if procedures need change
5. Conduct retrospective within 48 hours

---

## Key Contacts

| Role | Responsibility | Escalation |
|------|----------------|------------|
| Ops Lead | Day-to-day operations | Primary |
| Planning Manager | Planning cycles, action tracking | Secondary |
| Knowledge Manager | Asset freshness, documentation | Tertiary |

---

## Appendix: Useful Commands

```bash
# Run full check
npm run check

# Run tests only
npm run test

# Build distribution
npm run build

# Run LLM evaluations
node --test evals/*.ts
```
