# SC-008D Feature Spec

## Metadata

- Story ID: SC-008D
- Story Title: Partner submission intake, review queue, and catalog hydration
- Author: Codex
- Date: 2026-04-05
- Parent story: `SC-008 Submission proof pack, partner DX, and cost analysis`

## Problem Statement

ChatBridge has partner docs, a validator, and a local harness, but it still
does not have a real self-serve upload or publish flow. A reviewer can learn
the contract, but a new developer still cannot submit an app through the
product, and an approved upload cannot become launchable without code changes.

## User Story

- As a partner developer, I want to upload a reviewed manifest and optional
  runtime package through the product so I can enter review without editing the
  source tree.
- As a platform reviewer, I want to approve or reject that submission in a
  queue and have approved apps become launchable immediately.

## Acceptance Criteria

- [ ] AC-1: A visible settings route exists for partner submission intake.
- [ ] AC-2: The portal accepts a bare manifest or full reviewed catalog entry
      and validates it against the existing partner validator.
- [ ] AC-3: The portal can persist submitted records and optional HTML runtime
      packages.
- [ ] AC-4: A reviewer can approve or reject a submission from the same host
      shell.
- [ ] AC-5: Approval hydrates the reviewed catalog so the app is discoverable
      by the existing reviewed-app routing and tool path.
- [ ] AC-6: If an approved runtime package exists, the reviewed runtime iframe
      renders that uploaded HTML instead of the generic fallback markup.
- [ ] AC-7: Partner docs and submission docs point reviewers to the new flow.

## Edge Cases

- Duplicate `appId` or tool names must be blocked before submission or
  approval.
- Rejected submissions should not stay in the active conflict set.
- Missing or invalid runtime uploads must not corrupt the catalog.
- Startup hydration must recover approved apps after reload.

## Out Of Scope

- remote reviewer accounts
- marketplace billing
- multi-file asset packaging
- remote third-party deployment
