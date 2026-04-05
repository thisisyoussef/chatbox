# SC-006A Feature Spec

## Metadata

- Story ID: SC-006A
- Story Title: Flashcard Studio deck authoring
- Author: Codex
- Date: 2026-04-05
- Parent story: `SC-006 Flashcard Studio deck authoring and study mode`

## Problem Statement

Flashcard Studio needs a first usable slice before study mode and Drive auth are
worth implementing. The app should let a student build a small deck directly in
the shared ChatBridge container and return a bounded deck summary back to chat.

## User Story

- As a student, I want to create and edit flashcards so I can build a study
  deck inside chat.

## Acceptance Criteria

- [ ] AC-1: Users can create cards with a prompt and answer inside the reviewed
      app shell.
- [ ] AC-2: Users can edit existing cards without leaving the thread.
- [ ] AC-3: Users can reorder and delete cards from the current deck.
- [ ] AC-4: The empty-deck state is explicit and does not imply study progress.
- [ ] AC-5: Host-owned summaries stay bounded to deck metadata and preview
      labels rather than dumping the full deck into later-turn context.

## Edge Cases

- Adding a card with blank prompt or answer should fail closed in the runtime.
- Reordering the first or last card should not corrupt deck order.
- Deleting the last card should fall back to the explicit empty state.
- Rehydrating from persisted host state should restore the deck and selection.

## Out Of Scope

- Study mode and confidence marking
- Spaced repetition logic
- Google Drive connect, save, load, or resume
- Multi-user or teacher workflows

## Done Definition

- Flashcard Studio is launchable through the reviewed app path.
- Deck authoring works end-to-end in the host-owned runtime.
- A normalized deck summary reaches the host app context after launch and
  completion.
