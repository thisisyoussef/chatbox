# I001-03 Design Brief

## Metadata

- Story ID: I001-03
- Story Title: App-surface-only runtime presentation
- Author: Codex
- Date: 2026-04-02

## Audience / Entry Context

- Primary audience:
  users actively interacting with a reviewed ChatBridge app inside the thread
- What brings them to this surface now:
  they already launched an app and want to use the app itself, not read a host
  explanation of it
- What they likely know before landing:
  they know which app they opened and why they opened it
- What they need to decide or do next:
  continue using the live app surface without the host competing for visual
  attention

## Desired Feeling

- Primary feeling to create:
  directness
- Secondary feelings to support:
  confidence, calm, continuity
- Feelings to avoid:
  clutter, duplicated explanation, dashboard-itis, "tool wrapped in admin UI"
- Why this emotional posture fits the story:
  once an app is open, the host should recede and let the surface feel native
  to the conversation instead of narrating itself

## Design Language Translation

- Cue 1:
  the app surface should visually start higher on the card, with no heavy title
  stack above it
- Cue 2:
  host-owned metadata should disappear from the primary eye path
- Cue 3:
  if tray controls remain, they should be edge-attached utilities rather than a
  headline block
- Cue 4:
  chess should read as board-first, not board-plus-sidebar
- Cue 5:
  weather should read as dashboard-first, not dashboard-plus-host report
- Optional cue 6:
  any remaining chrome should feel infrastructural and recessive
- Optional cue 7:
  copy should be removed before it is rewritten
- Anti-cues to avoid:
  duplicate status chips, explanatory paragraphs above the app, trust rails,
  telemetry cards, and decorative wrapper panels that do not help operate the
  app

## System Direction

- Neutral role:
  preserve the current ChatBridge tokens and rounded surface language
- Primary role:
  remove host-owned wrapper chrome around real app views
- Secondary role:
  keep just enough structural framing that the app still feels anchored in the
  thread
- Accent role:
  minimal utility controls only if they remain necessary for tray behavior
- Typography posture:
  demote or eliminate host copy rather than inventing a smaller type system
- Component or surface character:
  "embedded product surface," not "status card about a product surface"

## Layout Metaphor

- Physical-object or editorial analogy:
  sliding a tool out of its shipping carton until only the tool remains in your
  hands
- Why this metaphor fits:
  the current problem is excess packaging around something the user already
  chose to use
- Variation axis 1:
  zero visible host chrome versus tiny persistent controls
- Variation axis 2:
  controls outside the surface boundary versus controls overlaid on the edge
- Variation axis 3:
  board-only purity versus tiny contextual utility strip

## Copy Direction

- Copy change status: materially changing
- Voice and tone:
  subtractive; if copy does not help operate the app, remove it
- Naming posture:
  use the app’s own identity, not repeated host labels
- CTA posture:
  utility-first and minimal
- Real draft copy required before design-grade review: no
- If no, why:
  this story is mostly about removing chrome, not introducing new narrative
  copy

## Constraints / No-Go Decisions

- Scope constraints:
  focus on real renderable app surfaces in inline and tray presentation
- Content constraints:
  do not redesign clarify/refuse or degraded recovery artifacts into blank
  surfaces
- Accessibility constraints:
  preserve operable controls and readable board/surface labels
- Implementation constraints:
  the eventual code must reuse the shared presentation contract instead of
  hardcoding a chess-only exception
- Explicit no-go decisions:
  do not replace removed chrome with different chrome; do not turn this into a
  visual redesign of every app’s internal content model

## Design Prompt Inputs

- Prompt phrase 1:
  board-first surface with host chrome stripped away
- Prompt phrase 2:
  pure embedded app view in a chat thread
- Prompt phrase 3:
  subtraction over explanation
- Prompt phrase 4:
  dock controls as tiny utilities, not header content
- Prompt phrase 5:
  the app is the main event
