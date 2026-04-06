# SC-007B Design Decision

## Chosen Direction

Use the existing host-owned Drive rail and differentiate recovery states only by
bounded status text and detail copy:

- denied consent -> reconnect-required `needs-auth`
- expired/revoked grant -> explicit `expired`
- malformed file or other content issues -> `error`

## Why This Direction

- It keeps the surface visually stable after `SC-007A`.
- It matches the repo's shared auth vocabulary for expired versus revoked or
  denied credentials.
- It gives reviewers a visible degraded-path proof without opening a new UI
  design branch.

## Rejected Alternatives

- Add a new modal or inline warning card:
  - too much visible chrome for a narrow recovery story
- Leave everything as `Drive action blocked`:
  - too ambiguous for reviewers and too weak for user recovery guidance
