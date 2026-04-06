# SC-008C Feature Spec

## Metadata

- Story ID: SC-008C
- Story Title: AI cost analysis and projection packet
- Author: Codex
- Date: 2026-04-05
- Parent story: `SC-008 Submission proof pack, partner DX, and cost analysis`

## Problem Statement

The submission packet now covers reviewer routing and partner onboarding, but
it still does not satisfy the spec’s explicit AI cost-analysis requirement.
Reviewers need one place to see actual reproducible proof spend, production
assumptions, and 100/1K/10K/100K user projections.

## User Story

- As a reviewer, I want a cost-analysis packet that clearly separates actual
  reproducible development spend from modeled production projections so I can
  judge whether ChatBridge was designed with realistic AI economics in mind.

## Acceptance Criteria

- [ ] AC-1: `chatbridge/AI_COST_ANALYSIS.md` exists and links from
      `chatbridge/SUBMISSION.md`.
- [ ] AC-2: The packet reports actual reproducible development/test spend for
      the checked-in proof, including LLM cost, tokens, API calls, and other
      AI-related costs.
- [ ] AC-3: The packet includes monthly projections for 100, 1,000, 10,000,
      and 100,000 users.
- [ ] AC-4: The packet cites current official pricing sources for the reference
      model profiles it uses.
- [ ] AC-5: A checked-in assumptions artifact and doc-contract test keep the
      packet, submission index, and projection math aligned.

## Edge Cases

- The repo does not centrally meter private ad hoc model usage outside the
  checked-in harness.
- The submission apps do not currently require embeddings or paid web search,
  so the cost model must state those as excluded rather than silently assuming
  zero.
- Provider pricing is time-sensitive and must be easy to refresh.

## Out Of Scope

- Live billing telemetry
- Vercel or infrastructure cost accounting
- Product changes to optimize the runtime for cost

## Done Definition

- A reviewer can open one packet and understand what costs are real today,
  what costs are estimated, and how the monthly projections were derived.
