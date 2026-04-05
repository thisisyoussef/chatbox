# SC-007A Feature Spec

## Metadata

- Story ID: SC-007A
- Story Title: Flashcard Studio Drive connect, save, load, and resume
- Author: Codex
- Date: 2026-04-05
- Parent story: `SC-007 Flashcard Studio Google Drive connect, save, load, and resume`

## Problem Statement

Flashcard Studio can already author a deck and run a study round, but the deck
still disappears with the local session unless the student completes the flow in
one sitting. The submission also still needs an authenticated app that feels
natural for a K-12 use case. The missing piece is a host-owned Google Drive
connection that lets students explicitly connect Drive, save a deck as an
app-managed JSON file, reopen that deck later, and resume studying without
handing raw Google credentials to the reviewed app runtime.

## User Story

- As a student, I want to connect Google Drive, save my flashcard deck, reload
  it later, and continue studying from the same place so my work survives across
  sessions.

## Acceptance Criteria

- [ ] AC-1: Flashcard Studio exposes a host-owned `Connect Drive` action from
      the reviewed app shell and keeps the Drive credential flow outside the
      embedded runtime.
- [ ] AC-2: After Drive is connected, the host can save the current Flashcard
      Studio snapshot as a JSON deck file using a narrow Drive permission set.
- [ ] AC-3: The host can list and reopen recent app-managed Flashcard Studio
      decks without asking for broad Drive access.
- [ ] AC-4: Loading a saved deck rehydrates authoring and study progress in the
      reviewed app shell, including cards, deck title, study mode progress, and
      recorded confidence marks.
- [ ] AC-5: The app remembers enough saved-deck metadata locally to make resume
      explicit after reload, while keeping raw Google access tokens ephemeral.
- [ ] AC-6: Auth denial, token expiry, and save/load failures produce clear
      host-visible status and recovery guidance instead of silently failing.
- [ ] AC-7: Trace-backed proof exists for happy path, denied auth, malformed
      deck payload, degraded token/session behavior, and continuity after resume.

## Edge Cases

- Connect flow is denied or the popup/token request is closed before consent.
- Access token expires after connect but before save or load.
- A saved Drive file is no longer readable or contains malformed JSON.
- The student has not saved any decks yet and opens the resume surface.
- The loaded deck references an outdated or invalid snapshot shape.
- The preview web host lacks official Chatbox cloud user identity APIs.

## Out Of Scope

- Teacher-facing sharing or classroom roster workflows
- Google Picker integration
- Importing arbitrary existing Drive files outside the app-managed deck list
- Docs/Sheets export targets
- Multi-account account-switch UX
- Background sync or automatic save

## Done Definition

- Flashcard Studio has a host-owned Drive connect/save/load/resume path that
  works in the reviewed app shell on the web-first submission target.
- The Drive flow uses narrow permissions and keeps raw tokens out of the
  reviewed app runtime.
- Saved deck metadata, resume behavior, and failure states are visible in the
  host shell and replayable through seeded examples.
- Integration proof exists for success, failure, degraded, and continuity
  scenarios.
