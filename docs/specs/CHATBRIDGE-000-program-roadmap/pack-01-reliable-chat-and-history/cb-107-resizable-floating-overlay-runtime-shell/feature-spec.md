# CB-107 Feature Spec

## Metadata

- Story ID: CB-107
- Story Title: Resizable floating overlay runtime shell
- Author: Codex
- Date: 2026-04-02
- Related PRD/phase gate: `CHATBRIDGE-000` / Pack 01 - Reliable Chat and History
- Supersedes design direction from: `CB-106` split-tray shell

## Problem Statement

`CB-106` moved the active runtime out of scrollback, but it still behaves like
session layout chrome instead of a true floating surface. The current shell:

- is mounted inline between the message list and composer
- permanently consumes vertical page space
- cannot be dragged or resized
- does not feel like a picture-in-picture or overlay utility surface

The user now wants the active app to behave more like a YouTube mini-player:
visible while the chat continues, layered over the session, movable, and
expandable without becoming part of the thread layout.

## User Stories

- As a user, I want the active app to float over the session instead of taking
  space away from the chat column.
- As a user, I want to move and resize the app shell based on what I am doing
  in the thread.
- As a user, I want the app to collapse to a compact chip or mini-player state
  and reopen without losing context.
- As the host, I want the durable message record to remain in-thread while the
  live runtime is promoted into a single overlay surface.

## Acceptance Criteria

- [ ] AC-1: On desktop, the active ChatBridge runtime renders through a true
  overlay/portal layer instead of inline session layout.
- [ ] AC-2: The overlay defaults to a lower-corner picture-in-picture position
  and does not reduce the height of the message list or composer.
- [ ] AC-3: The overlay can be dragged within the session viewport bounds.
- [ ] AC-4: The overlay can be resized through explicit host-owned handles and
  preserves sane min/max bounds.
- [ ] AC-5: The overlay supports compact/minimized and expanded states without
  losing the compact in-thread anchor card.
- [ ] AC-6: The thread still keeps a compact durable artifact for the floated
  app instance with a clear restore/focus affordance.
- [ ] AC-7: Small-screen/mobile behavior remains explicit and constrained; it
  may stay sheet-based rather than mimicking desktop drag behavior.
- [ ] AC-8: Focus order, keyboard reachability, and pointer interactions remain
  test-covered for open, drag-start affordance, resize affordance, minimize,
  restore, and return-to-source actions.

## Edge Cases

- Empty sessions with no eligible app part should render exactly as today.
- Stale, malformed, or no-longer-renderable app parts must fail closed to the
  message anchor rather than leaving an orphaned overlay.
- Session reload must restore a valid overlay position/size state or fall back
  safely to the default lower-corner placement.
- Oversized app content should scroll within the shell rather than growing the
  overlay beyond its viewport constraints.
- Dragging or resizing should not allow the shell to disappear completely off
  screen.

## Non-Functional Requirements

- Security: the overlay must stay host-owned and must not bypass lifecycle or
  runtime promotion rules.
- Performance: drag and resize interactions must feel responsive without
  destabilizing message-list scrolling.
- Reliability: renderer state for position, size, and minimize mode must be
  recoverable per session without mutating durable message history.
- Accessibility: overlay actions need clear labels and keyboard fallback paths.

## UI Requirements

- This is a visible UI story and must go through the repo’s required design
  checkpoint before implementation.
- Desktop should feel like a controlled host utility surface, not a browser
  window clone.
- The visual language must stay inside current Chatbox neutral surfaces and
  component tone.
- The desktop overlay should privilege real runtime visibility over ornamental
  chrome.

## Out of Scope

- Multiple simultaneous floating app windows
- Cross-session persistence of one overlay between unrelated sessions
- Native OS-level always-on-top windows outside the renderer
- Replacing the underlying app-part persistence contract

## Done Definition

- The approved overlay shell is implemented and validated.
- The thread retains its compact durable app anchor.
- Desktop overlay and small-screen fallback behavior are both covered by tests.
- Validation passes for the touched scope.
- Seeded examples are refreshed if the visible default ChatBridge experience
  changes; otherwise the handoff states why no refresh was needed.
