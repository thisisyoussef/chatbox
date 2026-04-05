# SC-006B Feature Spec

## Metadata

- Story ID: SC-006B
- Story Title: Flashcard Studio study mode and confidence tracking
- Author: Codex
- Date: 2026-04-05
- Parent story: `SC-006 Flashcard Studio deck authoring and study mode`

## Problem Statement

Flashcard Studio can already author and return a deck, but it cannot yet prove
the actual study loop that makes the app useful for a K-12 submission. Students
need a simple in-thread way to flip through cards, reveal answers, mark their
confidence, and hand a bounded study summary back to chat without introducing
full spaced-repetition complexity.

## User Story

- As a student, I want to flip through a flashcard deck and mark how confident
  I feel after seeing each answer so the app tracks what I know and what I
  still need to review.

## Acceptance Criteria

- [ ] AC-1: Users can enter study mode from a non-empty authored deck without
      leaving the reviewed app shell.
- [ ] AC-2: Study mode presents one card at a time and requires an explicit
      reveal step before confidence can be recorded.
- [ ] AC-3: Users can record `easy`, `medium`, or `hard` for the active card
      and then advance to the next card.
- [ ] AC-4: The host-owned snapshot records bounded study progress, including
      counts per confidence bucket and the current study position.
- [ ] AC-5: Completion summaries and app continuity mention weak areas and
      progress totals without dumping every answer into later-turn context.
- [ ] AC-6: Resuming an in-progress study session restores the current card,
      reveal state, and confidence marks already recorded.

## Edge Cases

- Entering study mode with an empty deck should fail closed and keep the user in
  authoring.
- Confidence should not be recordable before the answer is revealed.
- The last studied card should produce a clear completed-study state rather than
  silently wrapping around.
- Host rehydration should preserve prior study marks and the current index.
- Re-entering authoring after partial study should not discard authored cards or
  prior confidence counts.

## Out Of Scope

- Spaced repetition scheduling
- AI-generated hints or explanations per card
- Google Drive connect, save, load, or resume
- Multi-user, teacher, or classroom roster workflows

## Done Definition

- Flashcard Studio supports a simple authoring-to-study flow inside the reviewed
  launch runtime.
- The host snapshot and completion summary expose bounded study progress for
  later chat continuity.
- Integration proof exists for launch, study progress, completion, and
  follow-up continuity.
