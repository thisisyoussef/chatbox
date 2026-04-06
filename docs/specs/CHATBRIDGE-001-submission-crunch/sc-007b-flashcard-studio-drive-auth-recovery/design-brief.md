# SC-007B Design Brief

## Goal

Keep the existing Flashcard Drive rail and runtime layout, but make degraded
auth behavior legible enough that a reviewer can immediately tell:

- the deck is still open locally
- Drive is currently unavailable
- reconnecting is the next action

## UI Scope

- No layout rework
- No new panels or drawers
- Status copy and bounded fixture states only

## Copy Direction

- Denied consent should sound recoverable and user-controlled:
  - `Reconnect Drive to resume`
  - `Google Drive permission was not granted. Connect Drive when you want to save or reopen decks.`
- Expired auth should sound time-bound and explicit:
  - `Reconnect Drive to continue`
  - `Drive authorization expired before the host could finish this action. Reconnect and try again; your current deck is still open locally.`

## Review Notes

- Keep the same host-owned rail visual language from `SC-007A`.
- Do not introduce red-alert styling or catastrophic language for recoverable
  auth failures.
- Preserve recent-deck visibility so the reviewer can see what reconnect will
  restore.
