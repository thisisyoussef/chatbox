# CB-107 Design Research

## Metadata

- Story ID: CB-107
- Story Title: Resizable floating overlay runtime shell
- Author: Codex
- Date: 2026-04-02

## Repo Findings

- [`src/renderer/routes/session/$sessionId.tsx`](/private/tmp/chatbox-floating-app-tray-overlay/src/renderer/routes/session/$sessionId.tsx)
  already has the runtime-target selection seam and is the right place to own
  session-level shell promotion.
- [`src/renderer/components/chatbridge/FloatingChatBridgeRuntimeShell.tsx`](/private/tmp/chatbox-floating-app-tray-overlay/src/renderer/components/chatbridge/FloatingChatBridgeRuntimeShell.tsx)
  is presentation-only today and can be evolved into the overlay host.
- [`src/renderer/stores/uiStore.ts`](/private/tmp/chatbox-floating-app-tray-overlay/src/renderer/stores/uiStore.ts)
  already persists session-scoped shell state, which makes it the right store
  for overlay geometry.
- [`src/renderer/Sidebar.tsx`](/private/tmp/chatbox-floating-app-tray-overlay/src/renderer/Sidebar.tsx)
  provides a simple pointer-driven resize seam worth reusing conceptually.

## External Findings

### Mantine Portal

- Source: [Mantine Portal docs](https://mantine.dev/core/portal/)
- Takeaway:
  Portal is the repo-aligned way to render fixed-position content outside the
  parent tree so parent layout and z-index do not constrain the overlay.
- Implementation implication:
  the desktop runtime shell should be portaled instead of mounted inline inside
  the session flex column.

### CSS Resize Limits

- Source: [MDN `resize` docs](https://developer.mozilla.org/en-US/docs/Web/CSS/resize)
- Takeaway:
  native `resize` only applies to overflowed elements and replaced content like
  iframes/videos; it is too narrow for a complete host-controlled overlay shell
  with bounded corner resizing and custom chrome.
- Implementation implication:
  use host-managed geometry updates and explicit resize handles instead of
  relying on raw CSS `resize`.

## Design Implications

- The best fit is a true desktop overlay/PiP shell rendered through a portal.
- The shell needs explicit host-owned drag and resize affordances rather than a
  general-purpose modal.
- Small-screen should keep a constrained sheet model instead of pretending drag
  affordances are equally useful everywhere.
