# SC-006A Design Brief

## Audience And Entry Context

- Audience: K-12 students building a lightweight study deck inside chat
- Entry context: the user asks to make or organize flashcards and the host opens
  the reviewed runtime inline

## Desired Feeling

- purposeful
- easy to scan
- classroom-friendly
- a little tactile, like organizing index cards on a desk

## Feelings To Avoid

- LMS bureaucracy
- generic admin dashboard chrome
- cramped modal behavior
- playful chaos that obscures edit controls

## Design-Language Cues

- reuse reviewed runtime framing and warm paper surfaces from Drawing Kit
- make the card list feel ordered and movable
- keep the editor surface calm and legible

## Anti-Cues

- dense spreadsheet layout
- flashy gamification
- oversized gradients that compete with form fields

## Layout Thesis

- desktop: left ordered deck rail, right editor/work surface
- mobile: stacked deck rail above the active editor
- hierarchy axis: deck status first, card order second, selected card editing
  third

## Copy Direction

- direct action labels
- explicit empty-state wording
- status text should say what changed, not just that something changed

## Constraints And No-Go Decisions

- no study controls in this story
- no Drive affordances in this story
- no hidden drag-and-drop dependency; reordering must be button-accessible

## Prompt-Ready Inputs

- build around host-owned reviewed runtime markup
- use warm paper and notebook-card cues
- prioritize clarity of deck order and edit state
- preserve responsive and keyboard-safe controls
