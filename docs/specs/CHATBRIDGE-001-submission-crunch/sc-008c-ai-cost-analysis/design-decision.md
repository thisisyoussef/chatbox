# SC-008C Design Decision

## Decision

Represent the cost story with:

1. one Markdown packet for reviewers
2. one checked-in JSON assumptions file for repeatable math
3. contract tests that pin the packet to the assumptions file and submission
   index

## Rationale

- The spec explicitly asks for development spend plus 100/1K/10K/100K user
  projections.
- The repo can honestly prove zero live spend for the checked-in harness, but
  it cannot honestly reconstruct private off-repo experimentation.
- A JSON assumptions artifact keeps the projection math inspectable and easier
  to refresh than freehand prose only.

## Rejected Alternative

Put raw numbers only in `SUBMISSION.md`.

That would satisfy the letter of the requirement but make the cost model hard
to audit, hard to refresh, and easy to drift from its assumptions.
