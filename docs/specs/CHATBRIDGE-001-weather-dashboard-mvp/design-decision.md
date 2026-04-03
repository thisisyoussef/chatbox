# WD-103 Design Decision

## Inputs Used

- `feature-spec.md`
- `technical-plan.md`
- `task-breakdown.md`
- `design-brief.md`
- Current renderer surface in
  `src/renderer/components/chatbridge/apps/weather/WeatherDashboardPanel.tsx`

## Options Considered

### 1. Forecast Tape

- Thesis: lead with horizontally scrolling hourly cards and tuck host metadata
  into a narrow footer.
- Strengths: fast forecast scan, visually distinct from text receipts.
- Risks: stale-state and location clarity become secondary, which is wrong for a
  trust-bound weather surface.

### 2. Briefing Board

- Thesis: large current-condition anchor, paired host snapshot card cluster, and
  separate labeled sections for hourly, daily, and alerts.
- Strengths: balances “what is the weather” with “can I trust this snapshot.”
- Risks: slightly denser than the original shell, so spacing must stay tight.

### 3. Recovery-First Stack

- Thesis: lead with freshness and degraded messaging before current conditions.
- Strengths: strong for failure cases.
- Risks: makes healthy snapshots feel heavier and more operational than needed.

## Scoring Rubric

| Option | Task Clarity | Status Transparency | Chatbox Fit | Partial-Data Readability | Responsive Feasibility | Total |
|---|---:|---:|---:|---:|---:|---:|
| Forecast Tape | 3 | 2 | 3 | 3 | 4 | 15 |
| Briefing Board | 5 | 5 | 4 | 5 | 4 | 23 |
| Recovery-First Stack | 3 | 5 | 3 | 4 | 4 | 19 |

## Chosen Direction

- Winner: `Briefing Board`

It won because WD-103 is not just a forecast card. The story explicitly needs
status-state clarity and freshness text, so the design has to keep host trust
signals adjacent to the weather itself. The chosen shell makes current
conditions primary, but gives freshness, source, and retry guidance first-class
placement.

## What The Winner Means In Code

- Keep the existing top-level reviewed app card and refresh action.
- Add dedicated host metadata cards for freshness, source, state, and next
  step.
- Add explicit section-level empty states for hourly, daily, and alerts.
- Preserve the existing degraded footer banner and follow-up summary area.
- Use the already normalized `hourly`, `daily`, and `alerts` arrays instead of
  only the compact `forecast` preview.

## Discarded Directions

- `Forecast Tape` lost because it under-served freshness and degraded trust
  cues.
- `Recovery-First Stack` lost because it made healthy snapshots feel too much
  like an incident console.

## Copy Fidelity

- Host-owned copy from the shared snapshot remains the source of truth.
- New placeholder copy was added only for section-level empty states that the
  shared snapshot does not phrase directly.

## User Override Note

- Repo guidance normally routes visible UI through a Pencil checkpoint.
- For WD-103, the user explicitly asked to skip Pencil and have the design pass
  handled directly in implementation.
