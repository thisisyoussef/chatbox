# SC-008A Feature Spec

## Metadata

- Story ID: SC-008A
- Story Title: Submission index and graded-scenario checklist
- Author: Codex
- Date: 2026-04-05
- Parent story: `SC-008 Submission proof pack, partner DX, and cost analysis`

## Problem Statement

The current mainline branch has the underlying ChatBridge proof, but it does
not yet have one canonical reviewer-facing entry point that maps the graded
scenarios to real tests, seeded prod sessions, setup docs, deployment docs, and
architecture docs. Reviewers currently need to discover those paths manually.

## User Story

- As a reviewer, I want one submission packet that points to the deployed web
  shell, setup path, architecture docs, and a graded-scenario checklist so I
  can validate the project quickly.

## Acceptance Criteria

- [ ] AC-1: `chatbridge/SUBMISSION.md` exists and includes the production
      reviewer URL, setup links, architecture links, and bridge or harness
      links.
- [ ] AC-2: The submission packet maps all seven graded scenarios to real repo
      scenario tests and identifies seeded prod proof where it exists.
- [ ] AC-3: The authenticated Flashcard Studio Drive path is called out
      explicitly as submission proof, including happy-path and recovery-path
      evidence.
- [ ] AC-4: A doc-contract test fails if the canonical packet stops referencing
      the required docs, scenarios, or seeded proof ids.

## Edge Cases

- Some grader scenarios have repo-backed proof only and no seeded prod session.
- Existing foundational docs may still contain historical Story Builder or
  Weather references that should not be mistaken for the current primary
  submission lineup.
- The deployed URL must be present even though the doc itself is repo-hosted
  rather than rendered inside the product.

## Out Of Scope

- Partner quickstart expansion
- AI cost analysis
- Demo video script and screenshot inventory

## Done Definition

- The reviewer can open one doc and find the actual submission proof surfaces.
- The packet is traceable to real files on `main` rather than aspirational
  roadmap claims.
