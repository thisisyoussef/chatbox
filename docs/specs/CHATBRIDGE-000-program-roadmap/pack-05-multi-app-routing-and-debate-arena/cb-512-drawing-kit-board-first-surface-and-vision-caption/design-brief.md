# CB-512 Design Brief

## Metadata

- Story ID: CB-512
- Story Title: Drawing Kit board-first surface and vision caption
- Author: Codex
- Date: 2026-04-03

## Audience / Entry Context

- Primary audience:
  a user already inside ChatBridge who wants to doodle a fast dare and hand it
  back to chat
- What brings them to this surface now:
  they launched Drawing Kit to sketch a quick answer to the current dare prompt
- What they likely know before landing:
  they know the round prompt and that chat will later ask what they drew
- What they need to decide or do next:
  pick a tool, sketch fast, optionally bank or caption the round, then return
  to chat without losing board context

## Desired Feeling

- Primary feeling to create:
  playful focus
- Secondary feelings to support:
  speed, directness, low stakes, confidence
- Feelings to avoid:
  dashboard clutter, admin rails, spreadsheet density, "creative app inside a
  settings page"
- Why this emotional posture fits the story:
  the round is a doodle dare, not a production design tool; the UI should feel
  like grabbing a sticky note and a marker

## Design Language Translation

- Cue 1:
  the board should dominate the frame immediately
- Cue 2:
  controls should read like chunky sticker or marker tabs, not a toolbar full
  of tiny chrome
- Cue 3:
  the prompt and round state should stay visible but compact
- Cue 4:
  bank and chat handoff should feel like light actions near the board, not a
  second reading column
- Cue 5:
  support copy should be trimmed to one-line cues where possible
- Optional cue 6:
  the layout should feel slightly handmade or poster-like without becoming
  messy
- Optional cue 7:
  stickers and doodles should feel like part of the board world, not inventory
  widgets
- Anti-cues to avoid:
  right-side rails, repeated button stacks in multiple places, long helper
  paragraphs, thin desktop-dashboard controls, and decorative shells that steal
  board space

## System Direction

- Neutral role:
  keep the current ChatBridge surface tokens and safe contrast baseline
- Primary role:
  maximize board area and make top controls compact and chunky
- Secondary role:
  preserve round status and handoff affordances without adding a second panel
- Accent role:
  use stickers and action chips as the playful accent rather than adding new
  decorative framing
- Typography posture:
  short, bold, readable labels with minimal support text
- Component or surface character:
  sticky-note game board with utility tabs

## Layout Metaphor

- Physical-object or editorial analogy:
  a doodle pad with a strip of chunky tabs clipped along the top edge
- Why this metaphor fits:
  it keeps the board as the object in hand and demotes everything else to
  near-edge utilities
- Variation axis 1:
  integrated top strip versus floating top chips
- Variation axis 2:
  prompt embedded in the header versus prompt pinned just above the board
- Variation axis 3:
  bank/handoff inline with tools versus isolated at the top-right edge

## Copy Direction

- Copy change status: materially changing
- Voice and tone:
  playful, spare, and action-led
- Naming posture:
  keep Drawing Kit and dare language but trim explanatory framing
- CTA posture:
  short imperative labels
- Real draft copy required before design-grade review: no
- If no, why:
  the story is mostly structural and subtractive; labels can stay close to the
  current vocabulary

## Constraints / No-Go Decisions

- Scope constraints:
  keep the existing round prompt, tool affordances, bank action, and chat
  handoff in scope, but simplify their presentation
- Content constraints:
  do not add a new gallery, sidebar, or sticker inventory browser
- Accessibility constraints:
  preserve keyboard operation, visible focus, and readable round status
- Implementation constraints:
  layout changes must stay inside the existing reviewed-app runtime seam and
  not invent a separate host wrapper
- Explicit no-go decisions:
  do not move key actions into hidden menus, do not require hover-only access,
  and do not replace removed rails with a smaller rail

## Design Prompt Inputs

- Prompt phrase 1:
  sticky-note doodle dare
- Prompt phrase 2:
  board-first surface with chunky top tabs
- Prompt phrase 3:
  no right rail, no admin chrome
- Prompt phrase 4:
  playful but restrained chat-embedded drawing app
- Prompt phrase 5:
  compact bank and handoff controls near the board
