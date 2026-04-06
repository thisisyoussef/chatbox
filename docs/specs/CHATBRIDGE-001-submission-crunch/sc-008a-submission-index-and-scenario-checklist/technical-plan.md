# SC-008A Technical Plan

## Metadata

- Story ID: SC-008A
- Story Title: Submission index and graded-scenario checklist
- Author: Codex
- Date: 2026-04-05

## Proposed Design

- Components or docs affected:
  - `chatbridge/SUBMISSION.md`
  - `chatbridge/README.md`
  - `chatbridge/DEPLOYMENT.md`
  - `docs/specs/CHATBRIDGE-001-submission-crunch/sc-008a-submission-index-and-scenario-checklist/*`
  - `test/integration/chatbridge/scenarios/submission-packet.test.ts`
- Public interfaces or contracts:
  - canonical reviewer entry doc path
  - stable graded-scenario headings
  - stable proof links to docs, tests, and seeded session ids

## Implementation Notes

- Keep the packet additive; do not refactor the existing architecture or
  harness docs in this slice.
- Use the current merged runtime truth on `main`:
  Chess, Drawing Kit, Flashcard Studio with Drive auth, and Weather as an extra
  utility proof.
- Treat seeded prod coverage and repo-only coverage as separate categories in
  the checklist so the packet stays honest.

## Test Strategy

- Add one integration-style doc-contract test under
  `test/integration/chatbridge/scenarios/` that reads the submission packet
  from disk and asserts:
  - the deployed web URL is present
  - the required linked docs are named
  - all graded scenario headings exist
  - the expected repo-proof scenario files are referenced
  - the seeded prod ids for the active reviewer flow are referenced
- Run full repo validation after the doc slice lands.
