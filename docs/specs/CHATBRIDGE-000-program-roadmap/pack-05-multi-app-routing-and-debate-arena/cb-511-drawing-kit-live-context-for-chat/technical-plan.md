# CB-511 Technical Plan

## Metadata

- Story ID: CB-511
- Story Title: Drawing Kit live context for chat
- Author: Codex
- Date: 2026-04-02

## Proposed Design

- Components/modules affected:
  - `src/shared/chatbridge/app-state.ts`
  - `src/shared/chatbridge/app-memory.ts`
  - `src/shared/chatbridge/apps/drawing-kit.ts`
  - `src/renderer/packages/chatbridge/context.ts`
  - `src/renderer/packages/chatbridge/reviewed-app-launch.ts`
  - `src/renderer/packages/model-calls/message-utils.ts`
  - `src/renderer/packages/model-calls/stream-text.ts`
- Public interfaces/contracts:
  - app-linked screenshot reference contract under `MessageAppPart.values`
  - bounded app state digest contract for selected app continuity
  - Drawing Kit host-rendered screenshot data URL helper
- Data flow summary:
  Drawing Kit emits a trusted `app.state` snapshot -> the reviewed-app launch
  persistence layer optionally renders a bounded screenshot from that snapshot
  and stores an app-linked screenshot reference -> selected-app context emits
  summary plus digest plus screenshot description -> model conversion attaches
  summary/digest text and the latest screenshot file for assistant-side app
  parts.

## Architecture Decisions

- Decision:
  represent live app visibility as a tiered context model instead of replacing
  the current summary path.
- Alternatives considered:
  - inject the full raw snapshot into every prompt
  - rely on screenshot-only grounding
- Rationale:
  summary remains the cheapest continuity signal, digest adds deterministic
  state, and the screenshot artifact handles the visual gap without bloating
  all turns.

- Decision:
  render Drawing Kit screenshots from the trusted snapshot contract.
- Alternatives considered:
  - DOM screenshot capture from the iframe
  - generic pixel scraping or browser screenshot tooling
- Rationale:
  the snapshot already contains normalized prompt, caption, status, and
  preview marks. Rendering from that contract stays deterministic, bounded, and
  host-owned.

- Decision:
  store screenshot refs inside app-part values rather than a new media store
  abstraction.
- Alternatives considered:
  - separate screenshot database or bespoke app-media subsystem
  - transient in-memory only references
- Rationale:
  Chatbox already persists image artifacts and app-part values; linking the
  stored image key back to the app part is the smallest coherent extension.

## Data Model / API Contracts

- `ChatBridgeAppScreenshotRef`:
  app ID,
  app instance ID,
  storage key,
  capture timestamp,
  optional summary,
  and source label.
- `ChatBridgeAppMedia`:
  currently a bounded list of screenshot refs retained under
  `chatbridgeAppMedia`.
- `ChatBridgeAppStateDigest`:
  bounded title plus bullet lines derived from trusted snapshots.
  Initial support includes Chess and Drawing Kit.
- Drawing Kit screenshot helper:
  render a compact SVG data URL using:
  prompt,
  status,
  caption,
  checkpoint summary,
  and bounded preview marks.

## Dependency Plan

- Existing dependencies used:
  reviewed-app launch persistence,
  shared app-memory selection,
  model dependency image storage,
  and the existing Drawing Kit snapshot schema.
- New dependencies proposed:
  none.
- Risk and mitigation:
  - risk: too many screenshot refs or heavy artifacts
    mitigation: cap retained refs, skip blank states, and render compact SVG
    from bounded preview marks
  - risk: model receives stale or duplicate context
    mitigation: keep selected-app continuity selection centralized and always
    prefer the primary active app

## Test Strategy

- Unit tests:
  - state digest builders for Drawing Kit and screenshot retention bounding
  - Drawing Kit screenshot data URL generation
  - selected-app context prompt generation with screenshot description
- Integration tests:
  - reviewed-app launch state persistence attaches Drawing Kit screenshot refs
  - model-message conversion adds digest text plus screenshot file for app parts
  - stream-text additional info prefers selected live app context with the new
    layered prompt
- Edge-case coverage mapping:
  blank Drawing Kit states,
  missing stored images,
  malformed snapshots,
  and screenshot persistence failure handling

## UI Implementation Plan

- Behavior logic modules:
  keep screenshot rendering and app-state digest derivation in shared/runtime
  packages, not in presentational React components.
- Component structure:
  no new components are required for this story.

## Rollout and Risk Mitigation

- Rollback strategy:
  remove screenshot attachment and digest wiring while keeping the existing
  summary-only continuity path intact.
- Observability checks:
  reviewed `app.state` events remain the source of truth for when live context
  changes; screenshot capture failures warn but do not break session
  persistence.

## Validation Commands

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
git diff --check
```
