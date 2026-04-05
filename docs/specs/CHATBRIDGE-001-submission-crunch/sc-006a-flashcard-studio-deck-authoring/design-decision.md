# SC-006A Design Decision

## Inputs Used

- `feature-spec.md`
- `technical-plan.md`
- `design-brief.md`
- `design-research.md`

## Options Considered

### Option 1: Split Index-Card Studio

- Thesis: keep the ordered deck visible on one side and the active card editor
  on the other
- Strengths:
  - strongest visibility of order and current selection
  - easy to support create, edit, reorder, and delete without hidden gestures
  - aligns with the “desk of study cards” metaphor
- Risks:
  - needs careful responsive collapse on smaller widths

### Option 2: Worksheet Table

- Thesis: show cards in a compact table with inline editing
- Strengths:
  - dense and efficient for larger decks
  - easy to scan count and order
- Risks:
  - feels administrative
  - weak empty state
  - cramped on mobile and less friendly for multiline answers

### Option 3: Stepper Composer

- Thesis: create one card at a time with next/back navigation
- Strengths:
  - simple mental model
  - easy form validation
- Risks:
  - poor visibility into deck order
  - reorder/delete become awkward
  - too much flow chrome for a basic authoring task

## Scoring Rubric

| Criterion | Option 1 | Option 2 | Option 3 |
|---|---:|---:|---:|
| Task clarity and system status | 5 | 3 | 3 |
| Match to user goals | 5 | 3 | 2 |
| Control and recovery | 5 | 3 | 2 |
| Consistency with existing Chatbox patterns | 4 | 3 | 3 |
| Information hierarchy and restraint | 4 | 3 | 3 |
| Accessibility and responsive feasibility | 4 | 3 | 3 |
| Implementation fit and testability | 5 | 4 | 3 |
| Total | 32 | 22 | 19 |

## Chosen Direction

- Choose Option 1: Split Index-Card Studio

## Why It Won

- It exposes all required authoring actions in one place.
- It preserves order visibility, which is the main thing the other layouts hide.
- It fits the existing reviewed runtime style without turning the app into a
  generic CRUD dashboard.

## Discarded Options

- Worksheet Table lost because it looked too administrative and weak on mobile.
- Stepper Composer lost because it hides deck order and makes reorder/delete
  secondary.

## Copy Fidelity Status

- Use direct button labels and explicit empty-state wording.
- Status copy should read as the latest deck mutation, not a vague success
  toast.

## Implementation Implications

- Add a left rail with card order controls.
- Keep a single active editor with prompt and answer fields.
- Provide explicit buttons for add, save, delete, move up, and move down.
- Emit host snapshots after each mutation and a bounded completion summary when
  the user returns the deck to chat.
