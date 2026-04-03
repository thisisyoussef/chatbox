# CB-512 Technical Plan

## Metadata

- Story ID: CB-512
- Story Title: Drawing Kit board-first surface and vision caption
- Author: Codex
- Date: 2026-04-03

## Current State

Drawing Kit already runs through the reviewed-app runtime and publishes bounded
state snapshots. The current gaps are:

- the runtime UI still includes a support rail and helper blocks that compete
  with the board
- the stored screenshot path is a host-rendered SVG derived from normalized
  snapshot data rather than the actual board image
- follow-up chat gets a summary and digest, but not a board-accurate
  image-to-text description of what is visible

## Proposed Design

- Components/modules affected:
  - `src/renderer/packages/chatbridge/bridge/reviewed-app-runtime.ts`
  - `src/shared/chatbridge/apps/drawing-kit.ts`
  - `src/shared/chatbridge/bridge-session.ts`
  - `src/shared/chatbridge/app-state.ts`
  - `src/shared/chatbridge/app-memory.ts`
  - `src/renderer/packages/chatbridge/reviewed-app-launch.ts`
  - `src/renderer/packages/model-calls/preprocess.ts`
  - `src/renderer/packages/model-calls/stream-text.ts`
  - `src/renderer/packages/model-calls/message-utils.ts`
  - focused Drawing Kit and ChatBridge tests
- Public interfaces/contracts:
  - reviewed-app `app.state` event payload for Drawing Kit board image
    checkpoints
  - Drawing Kit snapshot/continuity contract for persisted board description
  - selected-app digest and screenshot-description prompt path
- Data flow summary:
  Drawing Kit board mutates -> runtime emits normalized snapshot plus a bounded
  board image checkpoint when the visible board changes -> reviewed-app launch
  persistence stores the image -> host runs the existing image-to-text model
  path to generate a board description -> app-part values and selected-app
  continuity persist the latest screenshot ref plus board description -> model
  conversion attaches both text grounding and the latest board image file.

## Architecture Decisions

- Decision:
  simplify the active runtime through subtraction rather than adding a new host
  wrapper.
- Alternatives considered:
  - keep the current layout and only restyle the side rail
  - move the side rail below the board
- Rationale:
  the user request is explicit that the sketch board should dominate and the
  extra support surfaces should disappear.

- Decision:
  capture the actual Drawing Kit board image from the runtime instead of
  extending the current synthetic SVG path.
- Alternatives considered:
  - continue using snapshot-derived SVG summaries
  - scrape iframe DOM from the host
- Rationale:
  the user wants exact board understanding; the runtime already owns the board,
  while host DOM scraping would weaken the reviewed-app boundary.

- Decision:
  reuse the existing OCR/vision model seam for board description generation.
- Alternatives considered:
  - add a Drawing Kit specific caption service
  - leave continuity text summary-only and rely on the screenshot attachment
- Rationale:
  the repo already has model settings and image-processing seams for image
  inputs, so the smallest coherent change is to route stored board images
  through that path.

## Data Model / API Contracts

- `BridgeAppStateEvent` for Drawing Kit needs a bounded board image checkpoint
  field or equivalent event extension so the host can persist the actual board
  image.
- Drawing Kit continuity should retain:
  prompt,
  caption,
  round status,
  bounded stroke/sticker counts,
  latest screenshot ref,
  and latest board description.
- Screenshot retention remains bounded under the existing app-media contract;
  duplicate or blank images should be skipped.
- App-state digest text should prefer the latest board description when
  available, while still keeping a compact deterministic summary for degraded
  paths.

## Dependency Plan

- Existing dependencies used:
  reviewed-app launch persistence,
  storage `saveImage`,
  current Drawing Kit snapshot schema,
  and the existing image-to-text model path in model-calls packages
- New dependencies proposed:
  none
- Risk and mitigation:
  - risk: too many board updates create storage or caption churn
    mitigation: publish only on meaningful board changes and debounce
    persistence/caption generation
  - risk: board-image generation increases runtime cost
    mitigation: capture a bounded PNG/WebP data URL at board checkpoints rather
    than preserving raw stroke history
  - risk: captioning lags or fails
    mitigation: keep summary/digest fallback and never block drawing on caption
    completion

## Test Strategy

- Unit tests:
  - Drawing Kit snapshot helpers and board-checkpoint normalization
  - app-state digest prefers board description when present
  - retention rules skip blank/duplicate board images
- Integration tests:
  - reviewed-app launch persistence stores board screenshots from Drawing Kit
  - caption generation enriches app continuity without breaking degraded paths
  - model-message conversion includes the latest board image and description
- Component/runtime tests:
  - Drawing Kit active runtime renders as board-first with compact top actions
    and no side rail
- Edge-case coverage mapping:
  blank board,
  duplicate board image,
  storage failure,
  caption failure,
  replay/resume after prior board checkpoints

## UI Implementation Plan

- Behavior logic modules:
  keep screenshot/caption logic in the reviewed-app launch and shared
  continuity modules, not in presentational React wrappers.
- Component structure:
  - `reviewed-app-runtime.ts` collapses Drawing Kit to a compact top utility
    row plus the board
  - round prompt, bank, and chat handoff remain but move into compact,
    board-adjacent affordances instead of a secondary rail
- Accessibility implementation plan:
  preserve focusable controls, the keyboard shortcut cue, and labels for the
  active round state.
- Visual verification plan:
  capture 2 or 3 board-first directions through the design gate before code.

## Rollout and Risk Mitigation

- Rollback strategy:
  revert to the current synthetic screenshot-summary path while keeping the
  board-first UI if needed, or revert the UI independently if the contract work
  proves unstable.
- Observability checks:
  reviewed `app.state` remains the trigger for board continuity updates; board
  screenshot and caption failures warn but do not break session persistence.

## Validation Commands

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
git diff --check
```
