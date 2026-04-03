# Pack 01 Status

- Control state: validated backfills complete, with `CB-107` implemented and
  awaiting merge as the user-directed shell follow-on
- Single-agent scope: Pack 01 reopened for `CB-107` finalization and the final
  hygiene pass `CB-105`
- Story state model: `planned`, `in_progress`, `code_complete`, `validated`, `merged`

## Story Ledger

| Story | State | Notes |
|---|---|---|
| CB-101 | merged | Historical prerequisite assumed satisfied before Pack 02; not retro-audited by this control layer. |
| CB-102 | merged | Historical prerequisite assumed satisfied before Pack 02; not retro-audited by this control layer. |
| CB-103 | merged | Historical prerequisite assumed satisfied before Pack 02; not retro-audited by this control layer. |
| CB-104 | merged | Historical prerequisite assumed satisfied before Pack 02; not retro-audited by this control layer. |
| CB-106 | merged | User-directed Pack 01 backfill landed the approved split-tray shell so the active runtime stays visible outside scrollback while the thread keeps a compact anchor. |
| CB-107 | validated | Approved PiP overlay is implemented: the active runtime now portals above the message viewport, preserves a compact in-thread anchor, and persists drag/resize geometry per session with a constrained small-screen sheet fallback. |
| CB-105 | validated | `sessionType` prop leaks and focused `aria-hidden` shell-close warnings are covered by targeted renderer regression tests. |

## Monitoring Notes

- Pack 01 was reopened by `smoke-audit-master.md` finding SA-007.
- `CB-106` is a user-directed shell evolution layered on top of the historical
  Pack 01 baseline and should land before more Pack 05 runtime UI work.
- `CB-107` supersedes the `CB-106` docked-shell direction at explicit user
  request by pursuing a true floating overlay / mini-player interpretation.
- No direct seeded-example refresh in `src/renderer/packages/initial_data.ts`
  was required because `CB-107` changes host-owned shell chrome and session UI
  state, not the seeded ChatBridge message artifacts themselves.
- `CB-105` closes SA-007 by filtering the leaked `sessionType` prop at the
  avatar seam and releasing focus before sidebar/thread-history drawers hide
  their subtree.
- No direct seeded-example refresh in `src/renderer/packages/initial_data.ts`
  was required because CB-105 does not change seeded ChatBridge behavior.
