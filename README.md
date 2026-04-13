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

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     OPERATIONS SYSTEM                                 │
│                                                                       │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐    │
│  │   NOTION    │   │  MEETINGS   │   │   OPERATIONAL LOGS      │    │
│  │  Meeting    │──▶│   NOTES     │──▶│   (Action Logs)         │    │
│  │  Connector  │   │             │   │                         │    │
│  └─────────────┘   └──────┬──────┘   └──────────┬──────────────┘    │
│                           │                      │                    │
│                           ▼                      ▼                    │
│                   ┌─────────────────┐   ┌─────────────────────┐      │
│                   │  NLP ACTION    │   │   PROCESS MINER     │      │
│                   │  EXTRACTOR     │   │   (Alpha Algorithm) │      │
│                   │                 │   │                     │      │
│                   └────────┬────────┘   └──────────┬──────────┘      │
│                            │                       │                  │
│                            ▼                       ▼                  │
│                   ┌─────────────────────────────────────────────┐    │
│                   │        OPERATIONS KNOWLEDGE GRAPH           │    │
│                   │  meeting → action → owner → knowledge asset  │    │
│                   │                                             │    │
│                   └──────────┬───────────────┬─────────────────┘    │
│                              │               │                       │
│                              ▼               ▼                       │
│                   ┌─────────────────┐  ┌─────────────────────┐       │
│                   │   ML FRESHNESS │  │   DEPENDENCY GRAPH  │       │
│                   │    SCORER      │  │   (Critical Path)   │       │
│                   │                 │  │                     │       │
│                   └────────┬────────┘  └──────────┬──────────┘       │
│                            │                      │                  │
│                            ▼                      ▼                  │
│                   ┌─────────────────────────────────────────────┐    │
│                   │          FRESHNESS + EXECUTION              │    │
│                   │    Stale Asset Detection / Action Planning  │    │
│                   └─────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

## Phase 1+2 Features

### NLP Action Extractor (`src/nlp-action-extractor.ts`)
Automatically extracts actionable items, owners, and due dates from raw meeting notes or transcripts using LLM-powered NLP. Falls back to rule-based extraction when LLM is unavailable.

- **Key capabilities:**
  - Extracts actions with owner, due date, priority, and confidence scores
  - Generates meeting summaries and identifies key decisions
  - Scores action completeness (detects vague or unowned actions)
  - Rule-based fallback for offline/unavailable LLM scenarios

- **Quality scoring:**
  - `completeCount` — actions with owners, due dates, and detailed descriptions
  - `vagueCount` — actions that are too short or lack specificity
  - `unownedCount` — actions without assigned owners
  - `overdueCount` — actions past their due date

### ML Knowledge Freshness Scorer (`src/ml-knowledge-freshness.ts`)
Predicts knowledge base staleness before it happens using engagement signals + time decay modeling.

- **Key capabilities:**
  - Scores freshness 0–1 (1 = fresh)
  - Predicts staleness risk: critical / high / medium / low
  - Computes priority refresh score (0–100) for triage
  - Batch scoring returns a prioritized refresh queue

- **Scoring factors:**
  - Days since last update (up to 40% decay weight)
  - Days since last review (up to 30% decay weight)
  - Helpful vote ratio (penalty if < 60%)
  - Recent view count (low views trigger penalty)

### Dependency Graph — Critical Path (`src/dependency-graph.ts`)
Computes topological execution order and critical path for action planning.

- **Key capabilities:**
  - Topological sort (Kahn's algorithm) with cycle detection
  - Critical path detection via longest-path calculation
  - Parallel batch grouping for concurrent execution
  - Bottleneck identification on the critical path

- **Output:**
  - `sortedIds` — topologically sorted action IDs
  - `criticalPath` — longest-duration path through the dependency graph
  - `parallelBatches` — groups of actions that can run concurrently
  - `bottlenecks` — actions on the critical path with no parallel alternatives

### Operations Knowledge Graph (`src/knowledge/meeting-knowledge-graph.ts`)
In-memory graph connecting meetings → actions → owners → knowledge assets for operations intelligence. Models the cocoindex pattern: meeting notes → extracted entities → graph → queries.

- **Node types:** meeting, action, knowledge_asset, owner, project, topic
- **Edge relations:** contains, assigns, depends_on, references, blocks, owned_by, discussed_in
- **Key queries:**
  - `findMeetingsByTopic` — find all meetings covering a topic
  - `findStaleActions` — find actions older than N days, optionally filtered by owner
  - `findAssetDependents` — find actions that reference a knowledge asset
  - `findActionsByMeeting` — get all actions from a meeting

### Notion Meeting Connector (`src/connectors/notion-meeting-connector.ts`)
Fetches meeting notes from Notion databases and parses them into structured `NotionMeetingPage` records.

- **Key capabilities:**
  - Queries Notion databases with filters (date range, type)
  - Parses Notion page properties: Title/Name, Date, Attendees, Type
  - Fetches page block content for full text extraction
  - Gracefully degrades when `NOTION_API_KEY` is not set

### Process Mining — Alpha Algorithm (`src/planning/process-miner.ts`)
Discovers actual process models from operational action execution logs. Implements a directly-follows graph construction variant of the Alpha Algorithm.

- **Key capabilities:**
  - Discovers process models from action logs
  - Identifies start and end activities
  - Detects parallel activities and loops
  - Extracts high-frequency execution paths
  - Bottleneck analysis: cycle time, wait time, throughput, utilization
  - Overall cycle time and throughput calculations

- **Input:** `ActionLogEntry[]` with caseId, activity, timestamp, resource
- **Output:** `ProcessMiningResult` with activities, paths, bottlenecks, cycle times

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
