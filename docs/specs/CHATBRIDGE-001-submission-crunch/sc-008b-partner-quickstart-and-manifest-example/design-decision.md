# SC-008B Design Decision

## Chosen Direction

Use `chatbridge/PARTNER_SDK.md` as the single partner-facing quickstart and
back it with one real example manifest JSON file plus a doc-contract test.

## Why This Direction

- The repo already has the validator and harness; the gap is onboarding, not
  platform capability.
- A checked-in example manifest is more trustworthy than pseudocode alone.
- The quickstart should stay close to the real harness scenario instead of
  inventing a parallel tutorial path.

## Rejected Alternatives

- Add a new separate quickstart doc:
  that would split the partner DX story between two surfaces.
- Add only more prose to `PARTNER_SDK.md` without a real example artifact:
  too easy for the docs to drift from the actual schema.
