# I001-03 Feature Spec

## Metadata

- Story ID: I001-03
- Story Title: App-surface-only runtime presentation
- Author: Codex
- Date: 2026-04-02
- Related initiative:
  `docs/specs/CHATBRIDGE-001-post-rebuild-agent-productization/`

## Problem Statement

Real ChatBridge app surfaces are currently wrapped in multiple layers of
host-owned presentation chrome: the shared inline shell, the tray shell, and
some app-specific metadata rails. That produces a UI where the user sees the
host explaining the app instead of the app itself.

The current Chess runtime makes the issue obvious. The board is the core
surface, but the message also shows selection text, a move ledger, host-sync
telemetry, and extra shell copy. The user explicitly wants the app view only
and does not want surrounding host details or explanatory components.

## Story Objectives

- Initiative goal:
  make real ChatBridge runtime surfaces feel productized and intentional rather
  than over-explained by the host shell.
- How this story contributes:
  it reduces real app presentations to the app surface itself while keeping
  non-surface artifacts readable inline.

## User Stories

- As a user, when a real app is open, I want to see the app itself rather than
  a large host wrapper describing it.
- As a user, when Chess is active, I want the trusted board surface to be the
  only thing taking visual focus.
- As a maintainer, I want one explicit presentation rule for
  "surface-only" versus "artifact shell" so the same cleanup applies across
  current and future apps.

## Acceptance Criteria

- [ ] AC-1: Real renderable app surfaces in the timeline no longer show the
      generic ChatBridge shell title, description, status chip, or
      surface-description chrome around the app surface.
- [ ] AC-2: The floating app tray no longer adds a large tray header or
      duplicate explanatory copy above a real renderable app surface.
- [ ] AC-3: The Chess active runtime collapses to a board-first surface and
      removes the extra "Latest update", "Selection", "Move ledger", and
      "Host sync" side-panel cards from the normal active view.
- [ ] AC-4: Other flagship app surfaces follow the same principle and do not
      add host-owned explanatory or telemetry blocks when the core app surface
      is already visible.
- [ ] AC-5: Clarify/refuse receipts, degraded recovery shells, and other
      non-surface artifacts remain explicit inline artifacts instead of being
      forced into a surface-only presentation.
- [ ] AC-6: Focused renderer tests cover at least one real app surface and at
      least one non-surface artifact to prove the new presentation contract is
      applied selectively.
- [ ] AC-7: Seeded examples are refreshed only if the visible default story
      output changes; if no seed refresh is needed, the handoff says so
      explicitly.

## Edge Cases

- Empty/null inputs:
  if a part has no real renderable surface, it must not render as a blank
  surface-only card.
- Boundary values:
  tray, anchor, and inline rendering must agree on whether a part is a real
  surface, even after reload or lifecycle transitions.
- Invalid/malformed data:
  malformed runtime payloads must keep the existing fallback path instead of
  rendering an empty surface.
- Mixed histories:
  conversations containing both real app surfaces and route receipts must keep
  the surfaces minimal without hiding the inline route explanation artifacts.

## Non-Functional Requirements

- Maintainability:
  surface-only behavior should derive from an explicit shared presentation
  contract rather than hardcoded per-component branching.
- Reliability:
  the same part should not render with shell chrome in one surface and without
  it in another unless the presentation mode explicitly requires that
  difference.
- Accessibility:
  removing chrome must not remove the keyboard access or labeling required to
  operate the actual app surface.
- Performance:
  presentation cleanup should stay inside existing renderer seams and avoid
  introducing heavy runtime indirection.

## UI Requirements

- This is visible UI work and must go through Pencil review before code lands.
- The design direction should bias toward subtraction, not replacement: remove
  host-owned chrome before inventing new framing.
- "App view only" means preserve core app-native controls and content while
  removing surrounding host-owned status, summary, telemetry, and duplicate
  explanation blocks.
- Route receipts, refuses, and degraded recovery states are not considered real
  app views and should remain inline host artifacts.

## Out of Scope

- Rewriting route-artifact copy or recovery flows where there is no real app
  surface to show
- Changing Chess move validation, persistence, or AI move behavior
- Changing reviewed-app bridge security, routing policy, or launch semantics
- Inventing a new global ChatBridge visual language instead of removing chrome

## Done Definition

- A shared presentation contract distinguishes real app surfaces from
  non-surface artifacts.
- Approved renderable surfaces show the app view with materially less chrome.
- Chess and other active app surfaces no longer expose duplicate host-detail
  panels in the normal active view.
- Tests cover the selective presentation behavior.
- Validation passes for the implementation diff.
