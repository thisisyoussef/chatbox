# SC-006B Design Brief

## Metadata

- Story ID: SC-006B
- Story Title: Flashcard Studio study mode and confidence tracking
- Author: Codex
- Date: 2026-04-05

## Audience / Entry Context

- Primary audience: K-12 students studying a deck they just authored inside
  chat
- What brings them to this surface now: they already created or restored a deck
  and want to practice it immediately
- What they likely know before landing: the prompt/answer structure of their own
  cards and the existing Flashcard Studio authoring layout
- What they need to decide or do next: reveal each answer, decide how well they
  knew it, and finish with a useful progress summary

## Desired Feeling

- Primary feeling to create: focused momentum
- Secondary feelings to support: clarity, reassurance, lightweight achievement
- Feelings to avoid: test anxiety, dashboard bureaucracy, arcade gamification
- Why this emotional posture fits the story: the loop should feel like guided
  self-checking, not a grading interface

## Design Language Translation

- Cue 1: keep the warm paper study-desk language from authoring
- Cue 2: make the active card feel central and isolated
- Cue 3: make progress visible without looking like a scoreboard
- Cue 4: confidence buttons should feel deliberate and mutually exclusive
- Cue 5: weak-area feedback should read like review guidance, not failure
- Anti-cues to avoid: quiz-app neon, tiny carousel chrome, cramped stacked
  metadata, dense analytics charts

## System Direction

- Neutral role: cream paper and soft panel surfaces
- Primary role: warm orange for primary actions and active status
- Secondary role: muted olive/ink for explanatory study text
- Accent role: distinct confidence accents that still fit the paper palette
- Typography posture: same reviewed-runtime typography as authoring, with a
  stronger central study card
- Component or surface character: tactile study card over a calm notebook desk

## Layout Metaphor

- Physical-object or editorial analogy: one index card on top of a small study
  stack with the teacher's progress strip above it
- Why this metaphor fits: it emphasizes one-card-at-a-time recall while keeping
  overall progress visible
- Variation axis 1: top progress strip density
- Variation axis 2: answer reveal posture
- Variation axis 3: confidence control prominence

## Copy Direction

- Copy change status: small edit
- Voice and tone: direct, calm, non-judgmental
- Naming posture: plain study language such as `Reveal answer`, `How did that
  feel?`, `Keep editing`
- CTA posture: primary action advances study; secondary action returns to
  authoring
- Real draft copy required before design-grade review: no
- If no, why: this slice reuses existing runtime copy style and only adds a few
  tightly bounded labels

## Constraints / No-Go Decisions

- Scope constraints: no spaced repetition or long-term review plans
- Content constraints: do not expose all answers in the persistent summary block
- Accessibility constraints: reveal and confidence controls must stay
  button-driven and keyboard reachable
- Implementation constraints: stay inside the reviewed runtime generator and
  existing bridge contracts
- Explicit no-go decisions: no swipe-card interaction, no timer, no streak
  fireworks, no chart-heavy results screen

## Design Prompt Inputs

- Prompt phrase 1: one-card-at-a-time study loop inside a warm reviewed runtime
- Prompt phrase 2: flashcard reveal then self-rating confidence
- Prompt phrase 3: progress-first but non-competitive classroom tone
- Prompt phrase 4: bounded completion summary and weak-area visibility
- Prompt phrase 5: responsive, keyboard-safe controls inside the existing shell
