# SC-008B Feature Spec

## Metadata

- Story ID: SC-008B
- Story Title: Partner quickstart and manifest example
- Author: Codex
- Date: 2026-04-05
- Parent story: `SC-008 Submission proof pack, partner DX, and cost analysis`

## Problem Statement

The current reviewed-partner doc explains the contract, but it still reads like
reference material. A new third-party developer does not yet get a fast path
for “copy an example manifest, validate it, run the harness, and confirm the
host lifecycle works.”

## User Story

- As a partner developer, I want a minimal quickstart, example manifest, and
  local harness recipe so I can understand how to build against ChatBridge
  quickly.

## Acceptance Criteria

- [ ] AC-1: `chatbridge/PARTNER_SDK.md` explains a concrete
      `register -> invoke -> render -> complete` flow.
- [ ] AC-2: A checked-in reviewed manifest example exists and validates against
      the current schema and partner validator.
- [ ] AC-3: The quickstart explains the local harness path and points to the
      working partner harness scenario.
- [ ] AC-4: The quickstart explicitly calls out the OAuth or API-key delta and
      preserves the host-owned auth boundary.
- [ ] AC-5: The submission packet points reviewers to the quickstart and the
      example artifact.

## Edge Cases

- The minimal example should not force OAuth complexity on the first read.
- The quickstart must stay accurate even though Story Builder still exists as
  an older partner-facing fixture in tests and docs.
- The manifest example must stay valid if the reviewed manifest schema changes.

## Out Of Scope

- New runtime features
- Marketplace packaging
- Teacher-facing docs

## Done Definition

- A new app developer can follow the doc and understand the reviewed app path
  without reading the source first.
- The example manifest and quickstart remain guarded by tests.
