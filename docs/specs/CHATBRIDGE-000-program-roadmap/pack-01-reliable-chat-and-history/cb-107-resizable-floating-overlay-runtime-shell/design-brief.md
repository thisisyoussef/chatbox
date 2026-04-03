# CB-107 Design Brief

## Metadata

- Story ID: CB-107
- Story Title: Resizable floating overlay runtime shell
- Author: Codex
- Date: 2026-04-02

## Audience / Entry Context

- Primary audience:
  users actively controlling a ChatBridge app while continuing the surrounding
  conversation
- Entry context:
  an app is already active, the user keeps chatting, and the runtime should
  remain visible without becoming part of page layout

## Desired Feeling

- Immediate
- Movable and user-controlled
- Lightweight but reliable
- More like a host-owned mini-player than a docked tray

## Feelings to Avoid

- Heavy split-pane workstation
- Generic modal
- Browser popout clone
- Brittle overlay that obscures the thread or feels disconnected from the host

## Design Language Translation

- Cue 1: lower-corner picture-in-picture as the default desktop posture
- Cue 2: host-owned header chrome with just enough drag, resize, and state
  controls
- Cue 3: compact in-thread anchor that reads as a receipt, not a duplicate app
- Cue 4: restrained neutral surfaces with precise active-state accents
- Cue 5: explicit compact/expanded states that feel intentional instead of
  hidden hacks
- Anti-cues:
  freeform desktop-window mimicry, thick debug rails, permanent split panes,
  or novelty glassmorphism

## System Direction

- Color roles:
  stay on current Chatbox neutrals with sparing blue/emerald action emphasis
- Typography posture:
  concise host utility language, not product-marketing voice
- Component posture:
  rounded shell, thin utility header, visible resize affordances, compact
  minimized chip

## Layout Metaphor

- Core metaphor:
  “host-owned PiP overlay with thread receipt”
- Variation axes:
  - strict mini-player versus broader workspace panel
  - more visible utility chrome versus lighter chrome
  - stronger default app presence versus more collapsible/glanceable posture

## Copy Direction

- Copy change status: small edit
- Voice and tone:
  concise, operational, and host-owned
- Preferred labels:
  `Active app`, `Expand`, `Minimize`, `Return to message`, `Resize`, `Restore`
- Copy fidelity target:
  draft but real, no lorem ipsum

## Constraints / No-Go Decisions

- Desktop must become a true overlay, not a bottom-attached layout block.
- The overlay must not permanently reduce chat height.
- The in-thread anchor must remain present.
- Mobile/small-screen may retain a sheet-based fallback instead of desktop drag.
- Stay within existing Chatbox tokens and component tone.

## Prompt-Ready Inputs

- Design a Chatbox session screen where the active app runtime floats as a
  resizable overlay over the thread, similar in spirit to a YouTube
  mini-player, while the original message becomes a compact receipt anchor.
- Show one strict PiP option, one wider workspace-panel option, and one lighter
  minimized-first option.
- Keep the overlay host-owned and controlled, with drag handle, resize
  affordance, minimize, expand, and return-to-message controls.
- Preserve a clear mobile/small-screen fallback without forcing desktop drag
  behavior onto phones.
