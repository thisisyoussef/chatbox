# CB-512 Design Decision

## Inputs Used

- `feature-spec.md`
- `technical-plan.md`
- `design-brief.md`
- `design-research.md`

## Options Considered

### Option 1: Top Tab Strip

- Thesis:
  move the round label, prompt, tools, bank, and chat handoff into a single
  chunky strip attached to the top of the board
- Layout posture:
  one compact band above the canvas, no secondary rail, no extra support cards
- Strengths:
  strongest board focus, shortest eye path, and closest match to the user’s
  "only the sketch board, maybe small action items on top" request
- Risks:
  the top strip can become too dense if every action gets equal visual weight

### Option 2: Floating Corner Chips

- Thesis:
  keep the board almost pure and float a few chunky chips over its top edge for
  tools and round actions
- Layout posture:
  board-first with minimal floating controls pinned to the corners
- Strengths:
  maximizes raw board area and feels playful
- Risks:
  overlay controls may interfere with drawing space and responsive behavior

### Option 3: Split Utility Row

- Thesis:
  keep tools in a short top row and move bank plus chat handoff into a second,
  lighter row directly beneath it
- Layout posture:
  still board-first, but with a small amount of grouped separation
- Strengths:
  easiest to scan and lowest usability risk
- Risks:
  starts to recreate the old stacked-helper feeling and adds more chrome than
  the request calls for

## Scoring Rubric

Scale: 1 to 5, where 5 is best.

| Criterion | Option 1 | Option 2 | Option 3 |
| --- | --- | --- | --- |
| Match to user request | 5 | 4 | 3 |
| Board focus and restraint | 5 | 5 | 3 |
| Prompt and action clarity | 4 | 3 | 5 |
| Accessibility and responsive feasibility | 4 | 3 | 5 |
| Implementation fit | 4 | 3 | 5 |
| Total | 22 | 18 | 21 |

## Critique Pass

- Option 2 wins on playfulness, but the control overlays are the most likely to
  hurt canvas usability.
- Option 3 is safer, but it risks drifting back toward "tool UI plus support
  UI plus board" rather than keeping the board dominant.
- Option 1 stays closest to the user’s desired posture as long as the strip is
  compact and the handoff actions are visually subordinate to tool selection.

## Approved Direction

Approved option: `Option 3: Split Utility Row`

## Why It Won

- The user explicitly chose the two-row version after reviewing the variants.
- It still removes the right-side rail and keeps the board dominant.
- The extra separation between round state and drawing actions makes the active
  controls easier to scan without restoring the old side-panel layout.

## Discarded Directions For Now

### Option 2

Not the default because the overlay pattern creates more interaction and
responsive risk than the story needs.

### Option 1

Not selected because the denser single-strip version traded away too much
scannability once the full control set stayed visible.

## Copy Fidelity Status

- New copy required: no
- Main copy action:
  trim explanatory support text and keep short action-led labels

## Implementation Implications

- `reviewed-app-runtime.ts`
  should collapse Drawing Kit into two compact utility rows plus the board.
- Right-rail bank and handoff cards should be removed from the active view.
- The prompt and round status should remain visible in the first row, while
  tool selection and banking stay in the second row.
- Board continuity work should remain invisible in the UI unless failure states
  need a compact fallback.
