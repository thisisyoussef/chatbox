# SC-002A Feature Spec

## Metadata

- Story ID: SC-002A
- Story Title: Intelligent reviewed-app routing for all flagship apps
- Author: Codex
- Date: 2026-04-05
- Related initiative: `CHATBRIDGE-001` follow-on hardening

## Problem Statement

The current reviewed-app router is safe and explainable, but most of its
selection power still comes from lexical scoring plus a Chess-specific
fallback. That makes routing feel brittle when users describe study, drawing,
or weather intent without explicitly naming the target app.

## User Stories

- As a user, I want loose study prompts like “I need to cram for tomorrow’s
  quiz” to open Flashcard Studio without me learning the app name.
- As a user, I want loose visual prompts like “help me sketch a poster” to
  open Drawing Kit when that is the best reviewed fit.
- As a user, I want loose weather prompts like “do I need an umbrella?” to
  open Weather Dashboard when that is the best reviewed fit.
- As the host, I want ambiguous prompts to stay explainable and clarifying
  instead of silently guessing.

## Acceptance Criteria

- [ ] AC-1: reviewed-app routing can use the active chat model to classify
      non-explicit prompts across the reviewed app catalog.
- [ ] AC-2: the current lexical router remains the fail-closed fallback when
      semantic classification times out, errors, or returns invalid output.
- [ ] AC-3: explicit exact app matches still take the fast lexical path.
- [ ] AC-4: route-decision traces distinguish lexical routing from semantic
      routing and show classifier status.
- [ ] AC-5: a seeded production-visible session demonstrates semantic invoke
      receipts plus an ambiguous clarify receipt.

## Out Of Scope

- General marketplace recommendation
- Unreviewed app discovery
- A second independent routing model or provider-specific structured-output API
- Changing the user-facing app portfolio
