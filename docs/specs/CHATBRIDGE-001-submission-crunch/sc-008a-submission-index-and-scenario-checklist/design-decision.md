# SC-008A Design Decision

## Chosen Direction

Use a single additive doc, `chatbridge/SUBMISSION.md`, as the canonical
reviewer entry point and back it with a small doc-contract test.

## Why This Direction

- Reviewer feedback asked for a clearer adoption and evaluation path, not more
  runtime surface.
- The repo already has the underlying bootstrap, deployment, architecture,
  harness, and partner docs; the main gap is discoverability.
- A testable doc surface is less fragile than relying on an ad hoc PR summary.

## Rejected Alternatives

- Spread the checklist across existing docs:
  too easy to drift and too hard for a reviewer to follow quickly.
- Add a web-only reviewer page:
  out of scope for a docs convergence slice and harder to keep accurate than
  repo-backed markdown.
