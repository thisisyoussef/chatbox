# SC-008B Technical Plan

## Metadata

- Story ID: SC-008B
- Story Title: Partner quickstart and manifest example
- Author: Codex
- Date: 2026-04-05

## Proposed Design

- Components or docs affected:
  - `chatbridge/PARTNER_SDK.md`
  - `chatbridge/SUBMISSION.md`
  - `chatbridge/examples/reviewed-partner-manifest.example.json`
  - `docs/specs/CHATBRIDGE-001-submission-crunch/sc-008b-partner-quickstart-and-manifest-example/*`
  - `test/integration/chatbridge/scenarios/partner-quickstart-docs.test.ts`
- Public interfaces or contracts:
  - partner quickstart headings and lifecycle vocabulary
  - example manifest artifact path
  - submission packet links to partner DX materials

## Implementation Notes

- Keep the quickstart grounded in the existing validator and harness APIs.
- Use a minimal `host-session` manifest example for the primary quickstart.
- Document the OAuth or API-key delta separately so the first pass stays easy
  to adopt while still preserving the host-owned auth boundary.

## Test Strategy

- Add one integration-style docs test that:
  - reads `chatbridge/PARTNER_SDK.md`
  - verifies the quickstart references the example manifest and the real
    validator or harness APIs
  - parses and validates the example manifest with
    `validateChatBridgePartnerManifest`
  - checks that `chatbridge/SUBMISSION.md` points to the quickstart and example
- Run the full repo validation set after the docs land.
