# SC-006B Design Decision

## Inputs Used

- `feature-spec.md`
- `technical-plan.md`
- `design-brief.md`
- `design-research.md`

## Options Considered

### Option 1: Center Card Study Desk

- Thesis: move from the split authoring layout into a centered active card with
  progress/status above and confidence controls below
- Strengths:
  - strongest focus on one-card-at-a-time retrieval
  - easiest to enforce reveal-before-rate
  - feels distinct from authoring without inventing a new visual system
- Risks:
  - needs a clear path back to editing so the app does not feel trapped in study

### Option 2: Dual-Pane Study Review

- Thesis: keep the authored deck rail visible while showing the active study
  card on the right
- Strengths:
  - deck context stays visible
  - easy to inspect what is coming next
- Risks:
  - weakens focus on the active card
  - looks too similar to authoring
  - invites skipping ahead instead of practicing sequentially

### Option 3: Full Results Dashboard

- Thesis: emphasize analytics with counts and cards needing review around a
  smaller card area
- Strengths:
  - surfaces outcomes immediately
  - makes confidence buckets prominent
- Risks:
  - overbuilt for this slice
  - feels evaluative and noisy
  - shifts attention away from the actual study loop

## Scoring Rubric

| Criterion | Option 1 | Option 2 | Option 3 |
|---|---:|---:|---:|
| Task clarity and system status | 5 | 4 | 3 |
| Match to user goals | 5 | 3 | 2 |
| Control and recovery | 4 | 4 | 3 |
| Consistency with existing Chatbox patterns | 4 | 5 | 3 |
| Information hierarchy and restraint | 5 | 3 | 2 |
| Accessibility and responsive feasibility | 4 | 4 | 3 |
| Implementation fit and testability | 5 | 4 | 2 |
| Total | 32 | 27 | 18 |

## Chosen Direction

- Choose Option 1: Center Card Study Desk

## Why It Won

- It makes the study loop feel meaningfully different from authoring while
  preserving the same reviewed-runtime visual language.
- It supports the retrieval-practice cadence directly: focus on the prompt,
  reveal the answer, then make a confidence judgment.
- It keeps the UI compact enough that the implementation can stay inside the
  current runtime generator and still remain responsive.

## Discarded Options

- Dual-Pane Study Review lost because it preserved too much authoring chrome and
  diluted the one-card study focus.
- Full Results Dashboard lost because it introduced too much analytics posture
  for a submission-crunch MVP.

## Copy Fidelity Status

- Use direct study copy with no grading language.
- Confidence labels stay simple: `Easy`, `Medium`, `Hard`.
- Weak-area summary copy should point to review needs, not failure.

## Implementation Implications

- Keep the authoring layout for `mode=authoring`, but switch to a centered study
  card layout for `mode=study`.
- Add explicit controls for reveal, confidence, next/progress, and return to
  editing.
- Extend the status strip to show study progress and confidence totals.
- Preserve bounded host summaries by surfacing only counts and a small set of
  hard-card prompts.
