# SC-007A Design Decision

## Inputs Used

- `feature-spec.md`
- `technical-plan.md`
- `design-brief.md`
- `design-research.md`

## Options Considered

### Option 1: Top Utility Rail

- Thesis: add a compact host-owned Drive strip above the Flashcard workspace
  with status, connect/save actions, and a bounded recent-deck list
- Strengths:
  - keeps persistence close to the study flow
  - easiest to explain as host-owned utility rather than app-owned content
  - minimal disruption to the current Flashcard layout
- Risks:
  - limited space for recent-deck metadata on smaller screens

### Option 2: Side Utility Column

- Thesis: add a narrow side column with Drive status and recent decks next to
  the runtime workspace
- Strengths:
  - creates more room for resume metadata
  - visually separates host controls from the embedded runtime
- Risks:
  - increases horizontal density
  - harder to preserve on mobile/narrow web layouts
  - risks making Flashcard Studio feel like a file manager

### Option 3: Modal Save/Resume Center

- Thesis: keep the current shell almost unchanged and open modal dialogs for
  connect, save, and load flows
- Strengths:
  - lowest persistent chrome
  - isolates Google-specific states
- Risks:
  - modal churn weakens lifecycle visibility
  - resume feels detached from the app state
  - harder to show persistent degraded guidance

## Scoring Rubric

| Criterion | Option 1 | Option 2 | Option 3 |
|---|---:|---:|---:|
| Task clarity and system status | 5 | 4 | 3 |
| Match to user goals | 5 | 4 | 3 |
| Control and recovery | 5 | 4 | 3 |
| Consistency with existing Chatbox patterns | 4 | 4 | 3 |
| Information hierarchy and restraint | 4 | 3 | 3 |
| Accessibility and responsive feasibility | 4 | 3 | 4 |
| Implementation fit and testability | 5 | 3 | 3 |
| Total | 32 | 25 | 22 |

## Chosen Direction

- Choose Option 1: Top Utility Rail

## Why It Won

- It keeps the reviewed Flashcard experience intact while making the new auth
  and persistence states continuously visible.
- It aligns with the host-owned pattern the submission is trying to prove:
  platform utilities wrap the embedded app instead of disappearing into it.
- It makes save/resume and degraded recovery inspectable in seeds, tests, and
  production smoke without introducing a broader file-management surface.

## Discarded Options

- Side Utility Column lost because it widened the surface too much and made the
  Flashcard workspace feel secondary to storage controls.
- Modal Save/Resume Center lost because it hid too much lifecycle state and
  weakened the always-visible host/app bridge story.

## Copy Fidelity Status

- Use plain, action-first copy such as `Connect Drive`, `Drive connected`,
  `Save deck`, `Open recent`, and `Reconnect to save again`.
- Failure copy should explain the recovery step directly and avoid OAuth jargon
  where possible.

## Implementation Implications

- Build a Flashcard-specific host wrapper in React rather than relying only on
  the generic reviewed launch shell.
- Keep the current runtime for deck editing and study; add the Drive rail,
  recent decks, and status messaging around it.
- Reflect Drive state in the host-visible snapshot so seeds, tests, and later
  chat continuity can inspect it.
