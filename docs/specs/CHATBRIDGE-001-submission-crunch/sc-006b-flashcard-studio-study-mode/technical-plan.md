# SC-006B Technical Plan

## Metadata

- Story ID: SC-006B
- Story Title: Flashcard Studio study mode and confidence tracking
- Author: Codex
- Date: 2026-04-05

## Proposed Design

- Components/modules affected:
  - `src/shared/chatbridge/apps/flashcard-studio.ts`
  - `src/shared/chatbridge/apps/flashcard-studio.test.ts`
  - `src/shared/chatbridge/app-memory.ts`
  - `src/shared/chatbridge/app-state.ts`
  - `src/shared/chatbridge/app-state.test.ts`
  - `src/renderer/packages/chatbridge/bridge/reviewed-app-runtime.ts`
  - `src/renderer/packages/chatbridge/bridge/reviewed-app-runtime.test.ts`
  - `test/integration/chatbridge/scenarios/flashcard-studio-study-mode.test.ts`
- Public interfaces/contracts:
  - Flashcard Studio snapshot schema
  - bounded study summary and continuity digest
  - reviewed runtime controls for study entry, reveal, confidence marking, and
    completion

## Architecture Decisions

- Decision: extend the existing Flashcard Studio snapshot instead of creating a
  separate study-only payload.
- Rationale: authoring, rehydration, and later Drive persistence all need one
  host-owned source of truth for deck plus current study progress.
- Decision: keep confidence tracking aggregate-first.
- Rationale: the host needs enough structure to support later chat continuity
  without storing verbose per-turn answer transcripts in summary context.
- Decision: keep study mode state inside the reviewed runtime generator rather
  than adding a new React surface.
- Rationale: the bridge lifecycle, persistence, and completion contracts already
  exist there and were proven in `SC-006A`.

## Data Model

- Add study-oriented snapshot fields:
  - `mode`: `authoring` or `study`
  - `studyStatus`: `idle`, `studying`, or `complete`
  - `studyIndex`
  - `revealedCardId`
  - `studyMarks`: ordered bounded list of card-confidence marks
  - aggregate counts for `easy`, `medium`, and `hard`
- Constraints:
  - study index must point to a valid card when studying
  - reveal state must reference the current card only
  - study marks must reference existing cards and use allowed confidence values
  - completion summary remains bounded to counts, weak-card prompts, and
    current/next-step guidance

## Runtime Plan

- Add a mode toggle path inside the existing Flashcard runtime:
  - authoring remains the default
  - `Start study mode` appears only for non-empty decks
  - study mode shows one active card, a reveal action, confidence actions, and
    a progress/status strip
- Keep authoring controls reachable again from study mode so the user can
  revise the deck without losing state.
- Emit `app.state` after study entry, reveal, confidence marking, study
  completion, and authoring return.
- Emit `app.complete` with a bounded study summary when the user returns study
  results to chat.

## Trace-Driven Scenario Matrix

1. Happy path: author deck, enter study mode, reveal answers, rate all cards,
   return study summary to chat.
2. Expected user error: try to rate confidence before reveal; runtime refuses
   and preserves state.
3. Malformed/invalid input: persisted snapshot with invalid study index or
   confidence mark fails closed to a safe baseline.
4. Degraded path: runtime still emits a valid bounded snapshot after partial
   study and host recovery/resume.
5. Continuity path: a completed study session injects weak-area context into the
   next chat turn without exposing full answers.

## Test Strategy

- Unit tests:
  - snapshot creation for study mode
  - invalid study payload rejection
  - bounded summary/digest generation with confidence counts
- Integration tests:
  - launch to study mode transition
  - reveal-before-rate enforcement
  - completion continuity after study
- Validation:
  - targeted vitest runs first
  - repo-level validation after the slice is stable
