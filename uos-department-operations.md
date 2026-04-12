# Operations Department Overlay

**Type:** EXISTING  
**Repo:** Ola-Turmo/uos-department-operations  
**Priority:** high  
**Tech Stack:** TypeScript, Paperclip Plugin SDK

## Overview

@uos/department-operations provides the operations department overlay for roles, jobs, skills, and connector policy. Operationalizes day-to-day operations work: runbook management, incident response, maintenance scheduling, and operational reporting. Split repo: package code + Paperclip plugin scaffold.

## Requirements

- Operational runbook management and execution workflows
- Incident response orchestration with severity classification
- Maintenance scheduling and dependency tracking
- Operational health dashboards and KPI reporting
- Connector policy enforcement for operations tools
- Paperclip plugin: worker, manifest, UI slots, typecheck + test
- Local plugin install: curl -X POST http://127.0.0.1:3100/api/plugins/install
- Validate: npm install && npm run check && npm run plugin:typecheck && npm run plugin:test

## Out of Scope

- Financial forecasting
- Customer-facing support flows
- Product launch management

## Success Criteria

Runbooks are executable via plugin. Incidents are classifiable and routable. Health dashboards render.

## Notes

- All repos follow the UOS split-repo pattern: package code as source of truth + Paperclip plugin scaffold
- All repos MUST provide a working Paperclip plugin manifest (manifest.ts), worker entrypoint, and UI slots where operator-facing
- All repos MUST pass `npm install && npm run check && npm run plugin:typecheck && npm run plugin:test` (or pnpm equivalent)
- All repos MUST support local plugin install: curl -X POST http://127.0.0.1:3100/api/plugins/install -H 'Content-Type: application/json' -d '{"packageName":"<absolute-path>","isLocalPath":true}'
- Implementation order: plugin scaffold -> manifest + types -> worker -> jobs -> UI (where applicable) -> validation
