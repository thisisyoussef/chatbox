# SC-008A Design Research

## Internal Sources

- `chatbridge/README.md`
- `chatbridge/BOOTSTRAP.md`
- `chatbridge/DEPLOYMENT.md`
- `chatbridge/ARCHITECTURE.md`
- `chatbridge/INTEGRATION_HARNESS.md`
- `chatbridge/EVALS_AND_OBSERVABILITY.md`
- `chatbridge/PARTNER_SDK.md`
- `src/shared/chatbridge/live-seeds.ts`
- `test/integration/chatbridge/scenarios/*.test.ts`

## Findings

- The core reviewer evidence already exists, but it is distributed across
  multiple docs and scenario files.
- The deployed web URL exists, but it is not currently promoted from one
  canonical reviewer-facing doc.
- Seeded prod sessions already expose the strongest manual proof for Chess,
  Drawing Kit, Flashcard Studio study, and Flashcard Studio Drive recovery.
- Ambiguous-routing and multi-app continuity are currently strongest as
  repo-backed scenario proofs rather than seeded prod sessions.

## Product Implications

- The submission packet should explicitly separate repo-backed proof from
  prod-seeded proof instead of pretending every grader scenario has the same
  manual path.
- The authenticated Flashcard Studio Drive path should be called out as its own
  reviewer proof because it satisfies a hard submission requirement beyond the
  seven scenario bullets.
