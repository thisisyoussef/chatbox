# SC-008B Design Research

## Internal Sources

- `chatbridge/PARTNER_SDK.md`
- `chatbridge/SUBMISSION.md`
- `src/shared/chatbridge/manifest.ts`
- `src/shared/chatbridge/partner-validator.ts`
- `test/integration/chatbridge/fixtures/reviewed-app-manifests.ts`
- `test/integration/chatbridge/mocks/partner-harness.ts`
- `test/integration/chatbridge/scenarios/partner-sdk-harness.test.ts`

## Findings

- The partner validator already emits guidance rich enough to support a
  quickstart flow.
- The harness scenario already demonstrates the exact lifecycle a new partner
  should debug locally.
- The missing piece is a real copyable manifest example and a step-by-step
  document that connects validation, harness bootstrap, render, state, and
  completion.

## Product Implications

- The quickstart should lead with the simplest host-session reviewed app path,
  then describe the OAuth and API-key delta separately.
- The reviewer packet should link directly to the quickstart and example
  manifest so “developer workflow” is auditable from the same submission entry
  point.
