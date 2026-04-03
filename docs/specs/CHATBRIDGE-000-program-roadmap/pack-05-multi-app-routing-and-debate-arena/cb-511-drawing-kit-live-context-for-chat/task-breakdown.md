# CB-511 Task Breakdown

## Story

- Story ID: CB-511
- Story Title: Drawing Kit live context for chat

## Execution Notes

- Keep this story read-only from the app-command perspective.
- Do not add new visible UI.
- Keep the screenshot path host-owned and snapshot-derived.

## Story Pack Alignment

- Higher-level pack objectives: O1, O3
- Why this story is cohesive with Pack 05: it hardens the active Drawing Kit
  flagship so later chat is grounded in what the app is currently showing.

## Tasks

| Task ID | Description | Dependency | Parallelizable | Validation |
|---|---|---|---|---|
| T001 | Define the bounded app-media and state-digest contract for selected app continuity. | must-have | no | Shared contract tests |
| T002 | Add Drawing Kit host-rendered screenshot generation from the trusted snapshot contract. | blocked-by:T001 | yes | Drawing Kit helper tests |
| T003 | Persist screenshot refs on reviewed Drawing Kit state updates and surface them through selected-app continuity prompts. | blocked-by:T001,T002 | no | Reviewed launch and app-memory tests |
| T004 | Attach layered Drawing Kit context to model messages and additional conversation info. | blocked-by:T001,T003 | no | Model-call tests |
| T005 | Add story docs and validation proof for the narrowed live-context scope. | blocked-by:T001,T002,T003,T004 | no | Repo validation |

Dependency values:
- `must-have`
- `blocked-by:<task-id list>`
- `optional`

Parallelizable values:
- `yes`
- `no`

## TDD Mapping

- T001 tests:
  - [ ] App-media retention is bounded and digest formatting stays deterministic
- T002 tests:
  - [ ] Drawing Kit screenshot rendering produces a valid data URL from bounded
    snapshot data
- T003 tests:
  - [ ] Reviewed Drawing Kit state updates persist screenshot refs and selected
    app context exposes screenshot descriptions
- T004 tests:
  - [ ] Model conversion and stream-text prompt building include the layered
    Drawing Kit context
- T005 tests:
  - [ ] Full repo validation passes for the touched scope

## Completion Criteria

- [ ] All must-have tasks complete
- [ ] Acceptance criteria mapped to completed tasks
- [ ] Tests added and passing for each implemented task
- [ ] Deferred work is documented as out of scope
