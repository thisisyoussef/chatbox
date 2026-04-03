# CB-512 Feature Spec

## Metadata

- Story ID: CB-512
- Story Title: Drawing Kit board-first surface and vision caption
- Author: Codex
- Date: 2026-04-03
- Related PRD/phase gate: `CHATBRIDGE-000` / Pack 05 - Multi-App Routing and Debate Arena

## Problem Statement

Drawing Kit already launches inline and exposes bounded continuity, but the
active runtime still spends too much space on host-style support rails and
copy. The user wants the drawing experience to feel like a sticky-note doodle
dare: mostly the board, a small control strip, and a clean handoff back to chat
when the round stays active.

At the same time, the host still does not retain an exact board view. Current
follow-up chat relies on a synthetic snapshot summary plus a host-rendered SVG,
which is not faithful enough for "tell chat what you drew" style questions.
Each meaningful board change needs a stored board image and a model-generated
description so later chat turns can stay grounded in what is actually visible.

## Story Pack Objectives

- Higher-level pack goal: make live reviewed apps feel native, grounded, and
  trustworthy inside follow-up chat.
- Pack primary objectives: O1, O3
- How this story contributes to the pack: it removes excess runtime chrome from
  Drawing Kit while upgrading continuity from synthetic summaries to
  board-accurate image plus caption grounding.

## User Stories

- As a user, I want Drawing Kit to mostly be the sketch board, not a layout
  with extra rails and duplicate host explanation.
- As a user, I want compact controls that stay close to the board and do not
  compete with drawing space.
- As a user, when I hand the round back to chat, I want the assistant to know
  exactly what is on the board.
- As the host, I want to store bounded board checkpoints and a trusted
  description without persisting raw stroke history as prompt context.

## Acceptance Criteria

- [ ] AC-1: The active Drawing Kit runtime collapses to a board-first layout
      with only a compact control/header strip and no right-side support rail
      or duplicate helper panels.
- [ ] AC-2: Drawing Kit still exposes the round prompt, current round status,
      bank action, and chat handoff, but those actions remain compact and
      visually subordinate to the board.
- [ ] AC-3: Every meaningful board mutation can publish a trusted board image
      checkpoint to the host, and the host stores the image through the
      existing image-storage path.
- [ ] AC-4: The host generates a board description from the stored image using
      the existing image-to-text model path, then persists that description as
      part of Drawing Kit continuity.
- [ ] AC-5: Follow-up chat receives the latest trusted board description and
      latest stored board image so the assistant can answer board-state
      questions without guessing.
- [ ] AC-6: Blank or unchanged boards do not create unbounded image churn, and
      screenshot/caption failures degrade without breaking the reviewed-app
      session.
- [ ] AC-7: Seeded example data in
      `src/renderer/packages/initial_data.ts` is refreshed if the visible
      default Drawing Kit story output changed; otherwise the handoff states
      explicitly that no seed refresh was needed.

## Edge Cases

- Empty/null inputs:
  blank boards should keep a valid summary and prompt state without generating
  meaningless screenshots.
- Boundary values:
  frequent strokes and sticker drops must not flood storage or trigger
  duplicate captions for unchanged board states.
- Invalid/malformed data:
  malformed runtime image payloads or snapshots must fail closed and avoid
  storing broken artifacts.
- External-service failures:
  image-storage or vision-caption failure should warn and preserve the session
  with the last good summary/digest path.

## Non-Functional Requirements

- Security:
  keep the reviewed-app trust boundary; the host should receive a bounded board
  artifact and description, not arbitrary iframe introspection.
- Performance:
  board interaction must remain responsive and screenshot/caption work must stay
  debounced or otherwise bounded.
- Observability:
  board-image checkpoints and caption generation should remain traceable through
  the reviewed-app lifecycle.
- Reliability:
  replay, resume, bank, and chat handoff should continue to work if media or
  caption generation degrades.

## UI Requirements

- This story has visible UI scope.
- The final runtime should read as "sticky-note doodle dare": the board is the
  center, controls are compact, and supporting copy is trimmed aggressively.
- Produce 2 or 3 board-first UI directions and pause for explicit approval
  before implementation.
- The final UI must remain keyboard accessible and preserve the current
  round/bank/handoff affordances.

## Out of Scope

- Generic screenshot capture for every reviewed app
- Full drawing-history replay in prompt context
- User-facing gallery or timeline browsing of stored board screenshots
- Replacing the current Drawing Kit prompt/game rules with a different app

## Done Definition

- Drawing Kit renders as a board-first surface with approved compact controls.
- The host stores trusted board screenshots and a vision-generated board
  description for follow-up chat.
- Selected app continuity and model attachments use the new board description
  path.
- Tests cover UI structure, board checkpoint storage, caption generation, and
  degraded flows.
- Validation passes for the touched scope.
