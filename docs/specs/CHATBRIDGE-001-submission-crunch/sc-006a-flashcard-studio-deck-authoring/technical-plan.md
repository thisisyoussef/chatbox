# SC-006A Technical Plan

## Metadata

- Story ID: SC-006A
- Story Title: Flashcard Studio deck authoring
- Author: Codex
- Date: 2026-04-05

## Proposed Design

- Components/modules affected:
  - `src/shared/chatbridge/apps/flashcard-studio.ts`
  - `src/shared/chatbridge/app-state.ts`
  - `src/shared/chatbridge/app-memory.ts`
  - `src/shared/chatbridge/reviewed-app-catalog.ts`
  - `src/renderer/packages/chatbridge/bridge/reviewed-app-runtime.ts`
  - `src/renderer/components/chatbridge/apps/ReviewedAppLaunchSurface.tsx`
  - targeted `src/**` and `test/integration/chatbridge/**` tests
- Public interfaces/contracts:
  - Flashcard Studio reviewed app id and tool name
  - host-owned deck snapshot schema
  - bounded continuity summary and digest contract
  - reviewed runtime controls for create, edit, reorder, delete, and complete

## Architecture Decisions

- Decision: model Flashcard Studio authoring as a reviewed launch runtime, not a
  bespoke React side panel.
- Rationale: the existing reviewed bridge path already supports host bootstrap,
  app state events, completion events, recovery, and session persistence.
- Decision: store full deck state in the host-owned snapshot but keep continuity
  summaries bounded to deck metadata and card labels.
- Rationale: the runtime needs the full deck to resume editing, while later-turn
  context should stay compact and explicit.

## Data Model

- Snapshot fields:
  - deck title
  - ordered card list
  - selected card id
  - latest authoring action
  - normalized status text
  - bounded summary
  - resume hint
- Constraints:
  - trim whitespace
  - cap deck size and text lengths
  - fail closed on malformed card payloads

## Runtime Plan

- Add a Flashcard Studio runtime generator beside the existing generic and
  Drawing Kit generators.
- Reuse `host.bootstrap`, `app.ready`, `app.state`, and `app.complete`.
- Keep the runtime browser-only and self-contained via `srcDoc`.
- Use a split layout with an ordered card rail and an edit surface.

## Test Strategy

- Unit tests:
  - snapshot creation
  - summary generation
  - digest generation
  - malformed snapshot rejection
- Integration tests:
  - reviewed launch to active deck-authoring state
  - create/edit/reorder/delete lifecycle
  - completion summary continuity
- Validation:
  - targeted vitest runs first
  - repo-level validation after the slice is stable
