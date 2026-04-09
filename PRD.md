---
repo: "uos-department-operations"
display_name: "@uos/department-operations"
package_name: "@uos/department-operations"
lane: "department overlay"
artifact_class: "TypeScript package / business-domain overlay"
maturity: "domain overlay focused on operating cadence and automation"
generated_on: "2026-04-03"
assumptions: "Grounded in the current split-repo contents, package metadata, README/PRD alignment pass, and the Paperclip plugin scaffold presence where applicable; deeper module-level inspection should refine implementation detail as the code evolves."
autonomy_mode: "maximum-capability autonomous work with deep research and explicit learning loops"
---

# PRD: @uos/department-operations

## 1. Product Intent

**Package / repo:** `@uos/department-operations`  
**Lane:** department overlay  
**Artifact class:** TypeScript package / business-domain overlay  
**Current maturity:** domain overlay focused on operating cadence and automation  
**Source-of-truth assumption:** Department-specific operations overlay.
**Runtime form:** Split repo with package code as the source of truth and a Paperclip plugin scaffold available for worker, manifest, UI, and validation surfaces when the repo needs runtime or operator-facing behavior.

@uos/department-operations translates planning cadence, knowledge operations, and workflow automation into a reusable operating layer. It exists to reduce coordination drag and make operating rhythms easier to run, inspect, and improve.

## 2. Problem Statement

Operations work often hides in meetings, docs, spreadsheets, and custom rituals. That makes planning brittle, decisions hard to trace, and automation opportunities invisible. This overlay should turn operating motion into observable, improvable workflows.

## 3. Target Users and Jobs to Be Done

- Operations leads running planning and execution cadences.
- Teams depending on fresh knowledge and clear next actions.
- Autonomous agents converting recurring manual work into automation.
- Leadership consumers of operating status and bottleneck signals.

## 4. Outcome Thesis

**North star:** Planning, decision, and execution loops become faster, cleaner, and more observable, with less manual coordination and better knowledge freshness.

### 12-month KPI targets
- 100% of recurring operating reviews produce owners, due dates, and follow-up artifacts.
- Stale knowledge backlog drops by 50% within the first 90 days of the new operating cadence.
- Automated routines cover the top 10 recurring operations tasks by frequency or coordination cost.
- Action closure rate reaches >= 85% within the agreed operating window.
- Meeting-to-action conversion completes in <= 24 hours for maintained planning loops.

### Acceptance thresholds for the next implementation wave
- There is a stable meeting-to-actions pipeline with clear ownership and escalation behavior.
- Knowledge freshness can be measured and stale assets can trigger refresh work automatically.
- Recurring routines and approvals are executable without losing auditability or human review points.
- Ops reporting surfaces expose blockers, throughput, and recurring drag, not just activity volume.

## 5. In Scope

- Planning cadence workflows and supporting artifacts.
- Knowledge freshness checks, capture, and retrieval support.
- Recurring operational automation and workflow orchestration.
- Decision tracking and action follow-through.
- Bottleneck detection across operating routines.

## 6. Explicit Non-Goals

- Owning domain-specific workflows that belong in other overlays.
- Building a generic note-taking layer with no operational model.
- Automating rituals that should instead be removed.

## 7. Maximum Tool and Connection Surface

- This repo should assume it may use any connection, API, browser flow, CLI, document surface, dataset, or storage system materially relevant to completing the job, as long as the access pattern is lawful, auditable, and proportionate to risk.
- Do not artificially limit execution to the tools already named in the repo if adjacent systems are clearly required to close the loop.
- Prefer first-party APIs and direct integrations when available, but use browser automation, provider CLIs, structured import/export, and human-review queues when they are the most reliable path to completion.
- Treat communication systems, docs, spreadsheets, issue trackers, code hosts, cloud consoles, dashboards, databases, and admin panels as valid operating surfaces whenever the repo's job depends on them.
- Escalate only when the action is irreversible, privacy-sensitive, financially material, or likely to create external side effects without adequate review.

### Priority surfaces for operations work
- Notion, Google Docs/Sheets, Airtable, calendars, Slack, email, task trackers, and planning systems such as Linear, Jira, or GitHub Projects needed to run real operating cadences and follow-through.
- Automation platforms, local CLIs, browser workflows, integration hubs, and scheduled-job surfaces when recurring coordination work should be converted into executable routines.
- Dashboards, status pages, audit trails, review artifacts, and BI/reporting surfaces when operations needs visibility into bottlenecks, completion, and policy adherence.
- Any tool that materially reduces coordination drag, clarifies ownership, or improves operating visibility across the rest of the UOS workspace.

### Selection rules
- Start by identifying the systems that would let the repo complete the real job end to end, not just produce an intermediate artifact.
- Use the narrowest safe action for high-risk domains, but not the narrowest tool surface by default.
- When one system lacks the evidence or authority needed to finish the task, step sideways into the adjacent system that does have it.
- Prefer a complete, reviewable workflow over a locally elegant but operationally incomplete one.

## 8. Autonomous Operating Model

This PRD assumes **maximum-capability autonomous work**. The repo should not merely accept tasks; it should research deeply, compare options, reduce uncertainty, ship safely, and learn from every outcome. Autonomy here means higher standards for evidence, reversibility, observability, and knowledge capture—not just faster execution.

### Required research before every material task
1. Read the repo README, this PRD, touched source modules, existing tests, and recent change history before proposing a solution.
1. Trace impact across adjacent UOS repos and shared contracts before changing interfaces, schemas, or runtime behavior.
1. Prefer evidence over assumption: inspect current code paths, add repro cases, and study real failure modes before implementing a fix.
1. Use external official documentation and standards for any upstream dependency, provider API, framework, CLI, or format touched by the task.
1. For non-trivial work, compare at least two approaches and explicitly choose based on reversibility, operational safety, and long-term maintainability.

### Repo-specific decision rules
- Reduce coordination overhead rather than adding reporting layers.
- Knowledge freshness matters only when linked to operational decisions.
- Automate recurring work only after clarifying the intended process.
- Prefer structured operating memory over ephemeral status chatter.

### Mandatory escalation triggers
- Automations that affect cross-functional commitments or compliance-sensitive records.
- Process changes that alter decision rights or accountability without agreement.
- Any workflow that could hide important dissent or nuanced context.

## 9. Continuous Learning Requirements

### Required learning loop after every task
- Every completed task must leave behind at least one durable improvement: a test, benchmark, runbook, migration note, ADR, or automation asset.
- Capture the problem, evidence, decision, outcome, and follow-up questions in repo-local learning memory so the next task starts smarter.
- Promote repeated fixes into reusable abstractions, templates, linters, validators, or code generation rather than solving the same class of issue twice.
- Track confidence and unknowns; unresolved ambiguity becomes a research backlog item, not a silent assumption.
- Prefer instrumented feedback loops: telemetry, evaluation harnesses, fixtures, or replayable traces should be added whenever feasible.

### Repo-specific research agenda
- Which operational rituals create the most drag for the least value?
- What knowledge types go stale fastest and with the highest cost?
- Which manual tasks recur often enough to justify codified automation?
- How can planning quality be measured instead of inferred from output volume?
- Where should operations automation stop and human judgment stay primary?

### Repo-specific memory objects that must stay current
- Cadence template library.
- Decision/action trace ledger.
- Knowledge freshness map.
- Automation candidate backlog.
- Bottleneck and waste log.

## 10. Core Workflows the Repo Must Master

1. Running recurring planning cycles and summarizing deltas.
1. Converting meetings and docs into actions with owners and due dates.
1. Auditing stale knowledge and triggering refresh loops.
1. Automating recurring operational routines and approvals.
1. Analyzing operating bottlenecks and proposing process changes.

## 11. Interfaces and Dependencies

- Paperclip plugin scaffold for worker, manifest, UI, and validation surfaces.

- `@uos/core` for orchestration and shared state.
- `@uos/plugin-operations-cockpit` for operating review visibility.
- Other department overlays that depend on ops cadence and knowledge hygiene.

## 12. Implementation Backlog

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

## 13. Risks and Mitigations

- Automating noise instead of reducing it.
- Treating knowledge freshness as an end in itself.
- Creating process bureaucracy under the banner of operational rigor.
- Weak linkage between planning artifacts and execution reality.

## 14. Definition of Done

A task in this repo is only complete when all of the following are true:

- The code, configuration, or skill behavior has been updated with clear intent.
- Tests, evals, replay cases, or validation artifacts were added or updated to protect the changed behavior.
- Documentation, runbooks, or decision records were updated when the behavior, contract, or operating model changed.
- The task produced a durable learning artifact rather than only a code diff.
- Cross-repo consequences were checked wherever this repo touches shared contracts, orchestration, or downstream users.

### Repo-specific completion requirements
- New workflows reduce manual ops load in measurable ways.
- Decision, action, and knowledge consequences are all captured.
- Automation includes traceability and safe fallback paths.

## 15. Recommended Repo-Local Knowledge Layout

- `/docs/research/` for research briefs, benchmark notes, and upstream findings.
- `/docs/adrs/` for decision records and contract changes.
- `/docs/lessons/` for task-by-task learning artifacts and postmortems.
- `/evals/` for executable quality checks, golden cases, and regression suites.
- `/playbooks/` for operator runbooks, migration guides, and incident procedures.
