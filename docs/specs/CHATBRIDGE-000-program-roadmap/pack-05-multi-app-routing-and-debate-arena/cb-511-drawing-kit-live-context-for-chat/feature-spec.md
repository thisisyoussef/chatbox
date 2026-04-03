# CB-511 Feature Spec

## Metadata

- Story ID: CB-511
- Story Title: Drawing Kit live context for chat
- Author: Codex
- Date: 2026-04-02
- Related PRD/phase gate: `CHATBRIDGE-000` / Pack 05 - Multi-App Routing and Debate Arena

## Problem Statement

Drawing Kit can launch inline and persist bounded checkpoints, but the model
still lacks a strong, current view of what the user is actually drawing. A
plain summary is often not enough for follow-up questions like "what do you
think?" or "what's happening in the canvas right now?" The host needs a better
multi-layer context path that stays trusted and bounded.

## Story Pack Objectives

- Higher-level pack goal: make active reviewed apps feel native and grounded in
  follow-up chat without weakening the host-owned trust boundary.
- Pack primary objectives: O1, O3
- How this story contributes to the pack: it upgrades Drawing Kit continuity
  from summary-only recall to a layered context model with structured state and
  a host-rendered screenshot artifact.

## User Stories

- As a user, I want the assistant to answer questions about my current Drawing
  Kit canvas without guessing.
- As a user, I want follow-up chat about Drawing Kit to stay grounded in the
  latest trusted checkpoint or live state.
- As the host, I want the model to receive bounded drawing context without
  exposing raw iframe internals.

## Acceptance Criteria

- [ ] AC-1: Selected Drawing Kit app context can expose a tiered continuity
  model made of:
  the normalized summary,
  a bounded state digest,
  and a latest screenshot description when available.
- [ ] AC-2: Reviewed Drawing Kit `app.state` events can persist an app-linked
  screenshot reference derived from the trusted host snapshot rather than raw
  runtime DOM capture.
- [ ] AC-3: Model conversion can pass Drawing Kit continuity through both text
  context and an attached screenshot file so the assistant can answer visual
  follow-ups more accurately.
- [ ] AC-4: Screenshot retention stays bounded, blank states do not create
  screenshots, and capture failures degrade without breaking the reviewed-app
  session.

## Edge Cases

- Empty/null inputs: blank canvases should still keep a valid summary and
  digest without attaching a meaningless screenshot.
- Boundary values: many marks or repeated updates must stay bounded in the
  digest and screenshot reference list.
- Invalid/malformed data: malformed snapshots should fail closed and avoid
  persisting untrusted media references.
- External-service failures: image storage failures should warn and continue
  without corrupting the app part or record store.

## Non-Functional Requirements

- Security: do not expose iframe DOM or unbounded renderer state to the model.
- Performance: screenshot generation should reuse the bounded Drawing Kit
  snapshot contract and avoid large raw bitmap capture paths.
- Observability: screenshot persistence should remain attached to the reviewed
  app lifecycle path so later debugging can trace where the artifact came from.
- Reliability: later turns should continue to work even if screenshot capture
  fails and only summary plus digest remain available.

## UI Requirements

- No visible UI changes are in scope for this story.
- The user-facing behavior changes only through better chat grounding and model
  awareness of Drawing Kit state.

## Out of Scope

- Chat-issued Drawing Kit draw, erase, or tool commands
- Generic screenshot capture for every reviewed app
- Raw pixel scraping from arbitrary iframe content
- New timeline UI for screenshot browsing

## Done Definition

- Drawing Kit follow-up chat can use trusted summary, bounded state, and a
  latest host-rendered screenshot artifact together.
- The screenshot contract is app-linked, bounded, and covered by tests.
- Validation passes for the touched scope.
