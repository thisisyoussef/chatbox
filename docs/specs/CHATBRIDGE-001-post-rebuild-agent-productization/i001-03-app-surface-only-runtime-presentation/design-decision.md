# I001-03 Design Decision

## Inputs Used

- `feature-spec.md`
- `technical-plan.md`
- `design-brief.md`
- `design-research.md`

## Options Considered

### Option 1: Pure Surface

- Thesis:
  real app surfaces render directly with no host shell around them
- Layout posture:
  the app starts immediately; tray controls are reduced to tiny utilities
  outside the primary reading path
- Strengths:
  matches the user request exactly, maximizes focus, removes duplicated copy,
  and works for chess plus other apps
- Risks:
  if applied too broadly it could hide important recovery context

### Option 2: Surface With Utility Strip

- Thesis:
  remove most host copy but keep a thin inline strip with app name and status
- Layout posture:
  app-first with one restrained utility row above the surface
- Strengths:
  preserves orientation and app identity
- Risks:
  still leaves visible wrapper chrome and does not fully satisfy "only the app
  view"

### Option 3: Reduced Card Shell

- Thesis:
  keep the existing shell pattern but compress it into a smaller card
- Layout posture:
  same composition, less vertical space
- Strengths:
  lowest implementation risk
- Risks:
  does not solve the real problem; it is replacement chrome instead of
  subtraction

## Scoring Rubric

Scale: 1 to 5, where 5 is best.

| Criterion | Option 1 | Option 2 | Option 3 |
| --- | --- | --- | --- |
| Match to user request | 5 | 3 | 1 |
| Information hierarchy and restraint | 5 | 4 | 2 |
| Consistency with existing app surfaces | 4 | 4 | 3 |
| Recovery clarity for non-app states | 4 | 4 | 5 |
| Accessibility and responsive feasibility | 4 | 4 | 4 |
| Implementation fit and testability | 4 | 4 | 5 |
| Total | 26 | 23 | 20 |

## Critique Pass

- Option 1 only wins if it is bounded carefully.
- The correct boundary is not lifecycle alone; it is whether the user is seeing
  a real renderable app surface.
- Route receipts, degraded completions, and fallback states still need the host
  shell because they are not the app.
- Floating tray controls must remain, but they should become utility controls
  rather than a second explanatory header.

## Chosen Direction

Chosen option: `Option 1: Pure Surface`

## Why It Won

- It is the only option that directly honors "just make it only the app view."
- It removes duplicated narration in both inline and tray presentations.
- It generalizes cleanly across chess, reviewed launch apps, Story Builder, and
  Debate Arena by using a shared rule:
  renderable app surface equals no host shell.
- It leaves safety artifacts explicit by keeping the shell for degraded,
  fallback, refusal, and clarify states.

## Discarded Options

### Option 2

Rejected because it still leaves visible host chrome competing with the app.

### Option 3

Rejected because it solves spacing, not focus.

## Copy Fidelity Status

- New copy required: no
- Main copy action:
  remove host-owned explanation wherever possible

## Implementation Implications

- `ChatBridgeMessagePart.tsx`
  needs a shared surface-only branch for renderable app content.
- `FloatingChatBridgeRuntimeShell.tsx`
  should drop the headline copy and keep only minimal tray utilities.
- `ChatBridgeShell.tsx`
  remains the wrapper for route/refuse/degraded/error and other non-renderable
  states.
- `ChessRuntime.tsx`
  should collapse from board-plus-rail into board-first presentation, keeping
  only the minimal status feedback needed to operate the board.
- `WeatherDashboardPanel.tsx`
  should remove remaining host-status and follow-up summary blocks that are not
  part of the dashboard itself.
- Tests must distinguish renderable app surfaces from host artifacts instead of
  assuming every app part renders through `chatbridge-shell`.
