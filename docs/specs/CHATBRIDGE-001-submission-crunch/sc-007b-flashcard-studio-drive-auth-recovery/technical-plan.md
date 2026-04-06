# SC-007B Technical Plan

## Metadata

- Story ID: SC-007B
- Story Title: Flashcard Studio Drive auth recovery states
- Author: Codex
- Date: 2026-04-05

## Proposed Design

- Components/modules affected:
  - `src/shared/chatbridge/apps/flashcard-studio.ts`
  - `src/shared/chatbridge/apps/flashcard-studio.test.ts`
  - `src/renderer/packages/chatbridge/flashcard-drive.ts`
  - `src/renderer/packages/chatbridge/flashcard-drive.test.ts`
  - `src/renderer/components/chatbridge/apps/flashcard/FlashcardStudioLaunchSurface.tsx`
  - `src/renderer/components/chatbridge/apps/flashcard/FlashcardStudioLaunchSurface.test.tsx`
  - `src/shared/chatbridge/live-seeds.ts`
  - `src/shared/chatbridge/live-seeds.test.ts`
  - `src/renderer/dev/chatbridgeManualSmoke.ts`
  - `src/renderer/dev/chatbridgeManualSmoke.test.ts`
  - `src/renderer/packages/initial_data.test.ts`
  - `src/renderer/setup/preset_sessions.test.ts`
  - `test/integration/chatbridge/scenarios/flashcard-studio-drive-auth-recovery.test.ts`
- Public interfaces/contracts:
  - Flashcard Studio Drive status enum and bounded summary language
  - Flashcard Drive failure classification for denied and expired auth
  - seeded fixture IDs and prod audit paths for degraded auth recovery

## Architecture Decisions

- Decision: add an explicit Flashcard Drive `expired` status instead of
  overloading every degraded auth case into `error`.
- Rationale: the repo already models `expired` auth semantics in
  `src/shared/chatbridge/auth.ts` and Story Builder, and the user needs a clear
  reconnect signal for save/load recovery.

- Decision: keep consent denial as a reconnect-required `needs-auth` state.
- Rationale: denial does not imply an invalid prior grant; it means Drive is
  unavailable until the student chooses to reconnect.

- Decision: preserve the current local deck/study snapshot on auth failure.
- Rationale: Drive auth is a host-owned persistence boundary, not the source of
  truth for the currently open flashcard session.

## Runtime Plan

- Extend Flashcard Drive status helpers to describe `expired` distinctly in the
  host shell, summary, and resume hint.
- Teach Drive fetch helpers to classify `401` and `403` responses as
  expired-auth failures and update the persisted local grant metadata before the
  error returns to the UI shell.
- Replace generic failure rendering in `FlashcardStudioLaunchSurface` with
  classified Drive recovery snapshots so denied and expired auth recover
  differently.
- Add seeded fixtures for denied and expired recovery states and wire them into
  the smoke metadata and preset-session tests.

## Trace-Driven Scenario Matrix

1. Denied auth: `Connect Drive` is rejected and the shell returns to reconnect
   guidance without dropping local deck state.
2. Expired auth: save/load fails with expired authorization and the shell shows
   an explicit reconnect-needed state with saved-deck metadata intact.
3. Persisted expired grant: hydration reopens directly into reconnect guidance
   before any new Drive action is attempted.
4. Continuity path: later chat still receives bounded weak-card and reconnect
   context instead of raw answers or auth payloads.

## Test Strategy

- Unit tests:
  - status/detail/summary handling for `expired`
  - local grant hydration when persisted status is `expired` or `revoked`
  - Drive failure classification for denied and expired auth
- Component tests:
  - denied connect keeps the deck active and returns the shell to reconnect
    guidance
  - expired save/load lands in explicit reconnect copy instead of generic
    blocked-error copy
- Integration tests:
  - denied and expired auth recovery through the reviewed launch persistence
    seam
- Validation:
  - focused Vitest runs during development
  - full repo validation before merge
