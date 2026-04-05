# SC-007A Design Brief

## Metadata

- Story ID: SC-007A
- Story Title: Flashcard Studio Drive connect, save, load, and resume
- Author: Codex
- Date: 2026-04-05

## Audience / Entry Context

- Primary audience: K-12 students who built a deck and now need to keep it
  across sessions
- Entry moment: the student is already inside Flashcard Studio and realizes
  they want to save or resume work
- What they already know: the current warm Flashcard authoring/study shell and
  the deck they have been editing
- What they need to decide next: connect Drive if needed, save the current
  deck, or reopen a recent deck and continue

## Desired Feeling

- Primary feeling to create: safe persistence
- Secondary feelings to support: clarity, calm control, explicit recovery
- Feelings to avoid: account-settings sprawl, storage anxiety, modal overload,
  cloud-admin complexity
- Why this posture fits the story: the user should feel that save/resume is a
  simple extension of studying, not a separate product area

## Design Language Translation

- Cue 1: preserve the paper desk and warm notebook language from Flashcard
  Studio
- Cue 2: present Drive state as a teacher note or desk utility rail, not a
  foreign settings panel
- Cue 3: show save/load actions as explicit but compact controls near the app
  header
- Cue 4: recent decks should read like a tidy notebook index, not a file
  manager
- Cue 5: failures should stay visible and human-readable without overpowering
  the study surface
- Anti-cues to avoid: raw Google branding overload, giant permission cards,
  sidebar file explorers, enterprise admin chrome

## System Direction

- Neutral role: cream paper surfaces and warm borders from the current runtime
- Primary role: warm orange for save/connect actions and success states
- Secondary role: muted ink and olive for status copy and recent-deck metadata
- Alert role: soft rust/red for auth or save/load failures
- Typography posture: stay within the existing runtime system, with a compact
  utility header rather than a new large title region
- Component or surface character: notebook utility strip wrapped around the
  study desk, still clearly host-owned

## Layout Metaphor

- Physical-object or editorial analogy: a study desk with a slim cloud-sync
  tray and a small notebook index of saved decks
- Why this metaphor fits: it keeps persistence close to the task without
  turning the app into a file browser
- Variation axis 1: top utility strip versus side utility column
- Variation axis 2: inline recent decks versus dropdown/list overlay
- Variation axis 3: save-state emphasis versus deck-resume emphasis

## Copy Direction

- Copy change status: medium
- Voice and tone: direct, reassuring, classroom-friendly
- Naming posture: plain labels such as `Connect Drive`, `Save deck`,
  `Open recent`, `Reconnect to save again`
- CTA posture: connect or save is explicit; loading a recent deck always names
  the deck being opened
- Real draft copy required before design-grade review: no
- If no, why: the flow is small and utility-driven, so bounded production copy
  is enough

## Constraints / No-Go Decisions

- Scope constraints: no Google Picker and no arbitrary full-Drive browsing
- Content constraints: do not expose raw token/debug values in the visible UI
- Accessibility constraints: all Drive actions must remain button-driven and
  keyboard accessible
- Implementation constraints: the host shell owns auth and file actions; the
  runtime keeps editing/study behavior
- Explicit no-go decisions: no modal-heavy account wizard, no permanent full
  file manager sidebar, no automatic save loop in this slice

## Design Prompt Inputs

- Prompt phrase 1: warm Flashcard study desk with a compact Drive utility rail
- Prompt phrase 2: save and resume deck flow without leaving the thread
- Prompt phrase 3: host-owned Drive state that feels like classroom notebook
  metadata
- Prompt phrase 4: explicit recovery guidance for denied or expired auth
- Prompt phrase 5: recent saved decks as a bounded notebook index
