# @uos/department-operations

@uos/department-operations translates planning cadence, knowledge operations, and workflow automation into a reusable operating layer. It exists to reduce coordination drag and make operating rhythms easier to run, inspect, and improve.

Built as part of the UOS split workspace on top of [Paperclip](https://github.com/paperclipai/paperclip), which remains the upstream control-plane substrate.

## What This Repo Owns

- Planning cadence workflows and supporting artifacts.
- Knowledge freshness checks, capture, and retrieval support.
- Recurring operational automation and workflow orchestration.
- Decision tracking and action follow-through.
- Bottleneck detection across operating routines.

## Runtime Form

- Split repo with package code as the source of truth and a Paperclip plugin scaffold available for worker, manifest, UI, and validation surfaces when the repo needs runtime or operator-facing behavior.

## Highest-Value Workflows

- Running recurring planning cycles and summarizing deltas.
- Converting meetings and docs into actions with owners and due dates.
- Auditing stale knowledge and triggering refresh loops.
- Automating recurring operational routines and approvals.
- Analyzing operating bottlenecks and proposing process changes.

## Key Connections and Operating Surfaces

- Notion, Google Docs/Sheets, Airtable, calendars, Slack, email, task trackers, and planning systems such as Linear, Jira, or GitHub Projects needed to run real operating cadences and follow-through.
- Automation platforms, local CLIs, browser workflows, integration hubs, and scheduled-job surfaces when recurring coordination work should be converted into executable routines.
- Dashboards, status pages, audit trails, review artifacts, and BI/reporting surfaces when operations needs visibility into bottlenecks, completion, and policy adherence.
- Any tool that materially reduces coordination drag, clarifies ownership, or improves operating visibility across the rest of the UOS workspace.

## KPI Targets

- 100% of recurring operating reviews produce owners, due dates, and follow-up artifacts.
- Stale knowledge backlog drops by 50% within the first 90 days of the new operating cadence.
- Automated routines cover the top 10 recurring operations tasks by frequency or coordination cost.
- Action closure rate reaches >= 85% within the agreed operating window.

## Implementation Backlog

### Now
- Formalize the recurring planning and review loops with owner, due-date, and escalation mechanics.
- Build the knowledge freshness and stale-asset detection workflow.
- Automate the first wave of high-volume operational routines that still depend on manual coordination.

### Next
- Reduce bottlenecks by instrumenting where actions stall or handoffs fail.
- Integrate operating outputs more tightly into the cockpit and workspace governance surfaces.
- Standardize approvals and exception handling across the highest-frequency routines.

### Later
- Support self-tuning operating cadences based on completion data and coordination cost.
- Expand from internal operations support to full cross-department routine orchestration.

## Local Plugin Use

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"<absolute-path-to-this-repo>","isLocalPath":true}'
```

## Validation

```bash
npm install
npm run check
npm run plugin:typecheck
npm run plugin:test
```
