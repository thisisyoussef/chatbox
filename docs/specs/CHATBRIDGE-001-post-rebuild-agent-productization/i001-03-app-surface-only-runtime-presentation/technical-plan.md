# I001-03 Technical Plan

## Metadata

- Story ID: I001-03
- Story Title: App-surface-only runtime presentation
- Author: Codex
- Date: 2026-04-02

## Current State

Three layers currently add visible host chrome around ChatBridge apps:

- shared message shell in `src/renderer/components/chatbridge/ChatBridgeShell.tsx`
- floating tray shell in
  `src/renderer/components/chatbridge/FloatingChatBridgeRuntimeShell.tsx`
- app-specific metadata cards inside surfaces such as
  `src/renderer/components/chatbridge/apps/chess/ChessRuntime.tsx` and
  `src/renderer/components/chatbridge/apps/weather/WeatherDashboardPanel.tsx`

The renderer already distinguishes between real app surfaces and inline route
artifacts, but that distinction is not yet reused as a presentation contract.

## Proposed Design

- Components/modules affected:
  - `src/renderer/components/chatbridge/ChatBridgeMessagePart.tsx`
  - `src/renderer/components/chatbridge/ChatBridgeShell.tsx`
  - `src/renderer/components/chatbridge/FloatingChatBridgeRuntimeShell.tsx`
  - `src/renderer/components/chatbridge/floating-runtime.ts`
  - `src/renderer/components/chatbridge/chatbridge.ts`
  - `src/renderer/components/chatbridge/apps/surface.tsx`
  - `src/renderer/components/chatbridge/apps/chess/ChessRuntime.tsx`
  - `src/renderer/components/chatbridge/apps/weather/WeatherDashboardPanel.tsx`
  - focused ChatBridge renderer tests
- Public interfaces/contracts:
  - add one explicit surface-presentation contract that can answer:
    - does this part resolve to a real renderable app surface
    - should this presentation branch render shell chrome or app surface only
- Data flow summary:
  message app part -> surface-classification helper -> presentation branch
  chooses `surface-only` or `artifact-shell` -> shared shell/tray/app panels
  render the approved chrome level.

## Architecture Decisions

- Decision:
  treat shell chrome removal as a shared presentation-contract change, not as a
  chess-only exception.
- Decision:
  keep non-surface artifacts such as clarify/refuse/recovery receipts in their
  existing host-artifact posture.
- Decision:
  remove host-owned metadata cards from Chess active runtime rather than trying
  to restyle them into a second compact rail.
- Decision:
  trim obvious host telemetry/explanation cards from other app panels only when
  they duplicate shell-level or host-level context instead of app-native
  content.
- Alternatives considered:
  - leave shared shell intact and only simplify Chess
  - keep tray shell but hide inline shell
  - add a smaller shell instead of removing shell chrome
- Rationale:
  the user request is explicitly subtractive, and partial cleanup would leave
  the same clutter visible in other presentation branches.

## Data Model / API Contracts

- Request shape:
  no provider, bridge, or storage contract changes are expected.
- Response shape:
  no new host/runtime payload shape is expected.
- Storage/index changes:
  none expected; this should stay renderer-only unless tests reveal a seed
  update need.

## Dependency Plan

- Existing dependencies used:
  existing ChatBridge renderer stack, current shared chatbridge helpers,
  Mantine, and existing tests
- New dependencies proposed:
  none
- Risk and mitigation:
  shell removal can accidentally hide recovery or route states, so the new
  surface classifier must fail closed and keep non-surface artifacts on the old
  shell path.

## Test Strategy

- Unit tests:
  - surface-classification helper for renderable versus non-renderable app
    parts
  - chess active rendering assertions proving metadata rail removal
- Integration/component tests:
  - `ChatBridgeMessagePart.test.tsx` for inline and anchor/tray presentation
  - `FloatingChatBridgeRuntimeShell.test.tsx` for tray chrome reduction
  - app-panel tests for weather/chess if app-specific chrome is removed there
- Edge-case coverage mapping:
  - route artifacts stay shelled
  - degraded/error states stay shelled
  - real active surfaces render without duplicate host chrome

## UI Implementation Plan

- Behavior logic modules:
  add a shared presentation helper adjacent to the existing surface-selection
  code so message and tray rendering consume the same rule.
- Component structure:
  - `ChatBridgeMessagePart` gains a surface-only branch for real renderable
    surfaces
  - `FloatingChatBridgeRuntimeShell` stops adding heavy header copy above a
    renderable surface
  - `ChessRuntime` trims the active metadata rail to the approved minimal view
- Accessibility implementation plan:
  preserve app-surface labels, focus flow, and tray access even when shell text
  disappears.
- Visual regression capture plan:
  capture one inline chess example, one floated app example, and one
  non-surface route artifact after Pencil approval.

## Rollout and Risk Mitigation

- Rollback strategy:
  keep the old shell components intact enough that the new presentation branch
  can be reverted without touching runtime contracts.
- Feature flags/toggles:
  none planned unless the cleanup unexpectedly affects non-surface artifacts.
- Observability checks:
  not expected to require new tracing; the relevant risk is UI regression, not
  runtime-contract drift.

## Validation Commands

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
git diff --check
```
