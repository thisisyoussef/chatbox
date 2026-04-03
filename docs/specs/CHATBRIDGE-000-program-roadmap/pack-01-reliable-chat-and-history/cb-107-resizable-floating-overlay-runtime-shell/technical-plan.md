# CB-107 Technical Plan

## Metadata

- Story ID: CB-107
- Story Title: Resizable floating overlay runtime shell
- Author: Codex
- Date: 2026-04-02

## Current State

The current `CB-106` shell already promotes one app instance out of scrollback,
but it is still mounted inline in the session route:

- [`src/renderer/routes/session/$sessionId.tsx`](/private/tmp/chatbox-floating-app-tray-overlay/src/renderer/routes/session/$sessionId.tsx)
  renders `FloatingChatBridgeRuntimeShell` between `MessageList` and `InputBox`.
- [`src/renderer/components/chatbridge/FloatingChatBridgeRuntimeShell.tsx`](/private/tmp/chatbox-floating-app-tray-overlay/src/renderer/components/chatbridge/FloatingChatBridgeRuntimeShell.tsx)
  uses a normal section container with fixed max-height rules.
- [`src/renderer/stores/uiStore.ts`](/private/tmp/chatbox-floating-app-tray-overlay/src/renderer/stores/uiStore.ts)
  stores only `appInstanceId` and `minimized` for the floating shell.

## Proposed Design

- Move the active runtime host into a true overlay layer rendered through a
  portal at the session-route level.
- Keep one canonical floated app instance per session using the existing target
  selection rules.
- Extend session-scoped UI state to track:
  - overlay mode (`expanded` / `minimized`)
  - desktop position (`x`, `y`)
  - desktop size (`width`, `height`)
- Clamp drag and resize updates against the visible session viewport.
- Preserve the compact in-thread anchor path so the message artifact remains the
  durable record and source-jump affordance.

## Implementation Strategy

1. Refactor the floating shell component into a real overlay host:
   - render through Mantine `Portal` or equivalent host portal
   - use `position: fixed` or viewport-relative placement
   - separate desktop overlay and small-screen sheet modes
2. Extend UI-store state for per-session overlay geometry and helpers.
3. Add host-owned drag logic on the shell header and resize handles on the
   shell frame; reuse the repo’s existing pointer-driven resize style where
   possible.
4. Keep the app runtime surface itself unchanged by wrapping the existing
   `ChatBridgeMessagePart` tray presentation inside the new shell container.
5. Preserve source-jump, minimize, restore, and fail-closed behavior.

## Data Model / State

- No durable message schema change is required.
- UI-store additions are expected:
  - `bounds` or `frame` object for overlay geometry
  - update helpers for drag and resize
  - default geometry bootstrap when the overlay first appears
- Session-scoped persistence in `ui-store` is preferred so reload continuity
  works without writing into message history.

## Test Strategy

- Unit tests:
  - geometry bootstrap and clamp helpers
  - selector behavior for deciding when to reuse or reset geometry
- Component tests:
  - desktop overlay renders through the overlay host
  - minimized chip restores cleanly
  - source-jump and focus controls remain visible
- Integration tests:
  - the thread keeps the compact anchor while the overlay floats separately
  - geometry state survives rerenders/reloads for the active session
  - stale or invalid app parts collapse back to the in-thread anchor

## Validation Commands

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
git diff --check
```

## Current Gate

No implementation edits should start until one overlay variation is approved.
