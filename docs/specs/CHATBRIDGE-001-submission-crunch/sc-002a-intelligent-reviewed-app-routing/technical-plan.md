# SC-002A Technical Plan

## Proposed Design

- Keep `resolveReviewedAppRouteDecision` as the single route/clarify/refuse
  contract.
- Add an optional semantic hint input that can upgrade low-lexical prompts into
  `invoke` or preserve an explainable `clarify`.
- Run a small model-assisted classifier from the renderer execution governor
  before the main chat turn when the lexical route is not already an explicit
  fast-path match.
- Bound the classifier with a short timeout and validate its output against the
  eligible reviewed-app catalog only.

## Modules

- `src/shared/chatbridge/routing.ts`
- `src/shared/chatbridge/governor-contract.ts`
- `src/renderer/packages/chatbridge/router/decision.ts`
- `src/renderer/packages/chatbridge/router/semantic.ts`
- `src/renderer/packages/chatbridge/single-app-tools.ts`
- `src/renderer/packages/chatbridge/runtime/execution-governor.ts`
- `src/renderer/packages/model-calls/stream-text.ts`
- `src/shared/chatbridge/live-seeds.ts`

## Trace Plan

- Existing event: `chatbridge.routing.reviewed-app-decision`
- New event: `chatbridge.routing.semantic-reviewed-app-classifier`
- Key outputs:
  - `routingStrategy`
  - `semanticClassifierStatus`
  - `decisionKind`
  - `selectedAppId`
  - `lexicalFallbackUsed`

## Test Plan

- Shared routing tests for semantic invoke and semantic clarify
- Renderer tool-set tests for semantic route acceptance and parse-fail fallback
- Integration tests for non-explicit Flashcard and Weather routing
- Live-seed tests and preset-session tests for the new prod inspection fixture
