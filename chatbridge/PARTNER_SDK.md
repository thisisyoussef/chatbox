# ChatBridge Partner SDK and Local Harness

This guide is the Pack 07 reviewed-partner development surface for ChatBridge.
It is intentionally narrow: build against the current host-owned contract,
validate early, and debug through the local harness before requesting platform
review.

## What This Covers

- a concrete `register -> invoke -> render -> complete` quickstart
- a checked-in reviewed manifest example you can copy
- reviewed manifest validation against the current host support matrix
- launch-scoped bridge expectations for embedded partner runtimes
- host-managed auth expectations for reviewed apps
- explicit completion signaling and host-owned summary rules
- a local mock harness for partner-runtime conformance tests
- a self-serve intake portal for manifest upload, review, and catalog ingest

Authoritative repo surfaces:

- `src/shared/chatbridge/partner-validator.ts`
- `test/integration/chatbridge/mocks/partner-harness.ts`
- `test/integration/chatbridge/scenarios/partner-sdk-harness.test.ts`
- `chatbridge/examples/reviewed-partner-manifest.example.json`
- `chatbridge/examples/reviewed-partner-runtime.example.html`
- `src/renderer/components/settings/chatbridge/PartnerPortal.tsx`
- `src/renderer/packages/chatbridge/partner-submissions.ts`

## Quickstart

This is the shortest safe path for a new reviewed partner app developer:

1. Copy the checked-in manifest example from
   `chatbridge/examples/reviewed-partner-manifest.example.json`.
2. Update the app metadata, URLs, permissions, and tool schema for your app.
3. Run `validateChatBridgePartnerManifest` locally before asking for platform
   review.
4. Use `createChatBridgePartnerHarness` to exercise the launch-scoped bridge.
5. Make your runtime acknowledge `host.bootstrap` with `app.ready`.
6. Confirm the host can send `host.render`, then emit `app.state` and
   `app.complete`.
7. If your app needs OAuth or API-key access, add `app.requestAuth` and keep
   credentials host-owned.
8. Use the self-serve intake portal when you want to test upload, review, and
   approval inside the product shell.

If you want one working reference before adapting anything, start here:

- manifest fixture:
  `test/integration/chatbridge/fixtures/reviewed-app-manifests.ts`
- harness scenario:
  `test/integration/chatbridge/scenarios/partner-sdk-harness.test.ts`

## Minimal Reviewed Manifest Example

The checked-in example manifest lives at:

- `chatbridge/examples/reviewed-partner-manifest.example.json`

It is intentionally minimal and uses `host-session` auth so the first harness
pass stays focused on the reviewed lifecycle rather than OAuth complexity.

Use it as the baseline for:

- `appId`, `name`, `version`, `origin`, and `uiEntry`
- one reviewed tool schema with an object-root input schema
- required lifecycle events
- launch surfaces and tenant availability
- reviewed approval metadata

## Minimal HTML Runtime Example

The checked-in example runtime package lives at:

- `chatbridge/examples/reviewed-partner-runtime.example.html`

It is a single-file reviewed runtime that:

- accepts `host.bootstrap`
- acknowledges with `app.ready`
- emits resumable `app.state` snapshots
- completes with `app.complete`

This is the easiest format to test through the new intake portal because it
can be uploaded directly without any extra bundling.

## Self-Serve Intake Portal

The product now includes a host-owned intake and review surface at:

- `Settings -> ChatBridge Partners`

That portal lets a developer or reviewer:

1. paste a reviewed manifest JSON payload
2. optionally upload a single-file HTML runtime package
3. validate the manifest against the current host contract
4. submit it into the local review queue
5. approve or reject it from the same shell
6. hydrate approved apps into the reviewed catalog immediately

For the current submission build, this is intentionally local and host-owned.
There is no separate marketplace backend, but the full reviewed flow now exists
inside the app:

- submission persistence
- review queue
- approval and rejection
- catalog ingest
- uploaded runtime lookup at launch time

If your app later needs host-managed OAuth or API-key access, keep the same
shape and add the auth-mode delta documented below.

## Validator Entry Point

Use `validateChatBridgePartnerManifest` to fail fast before a manifest enters
review:

```ts
import { validateChatBridgePartnerManifest } from '@shared/chatbridge'

const report = validateChatBridgePartnerManifest(candidateEntry)

if (!report.valid) {
  console.error(report.issues)
}
```

The report gives you:

- `valid`: whether the manifest matches the current reviewed-host contract
- `issues`: structured errors and warnings
- `support`: current protocol, auth-mode, event, and completion support
- `guidance`: required manifest events, auth boundary, completion schema, and
  debugging checklist

Validation is fail-closed. Unsupported protocol versions, unsupported auth
modes, malformed schemas, or missing mandatory lifecycle events are errors.

For the checked-in example manifest, a successful validation report should tell
you:

- the manifest is valid
- the supported contract matches the current host support matrix
- the guidance block lists the lifecycle and auth boundary rules you must
  follow in the runtime

## Required Reviewed-App Contract

Your manifest must stay aligned with the current reviewed-app contract in
`src/shared/chatbridge/manifest.ts`.

Required lifecycle expectations:

- declare `host.init`
- declare `app.ready`
- declare `app.complete`
- for `oauth` or `api-key` apps, also declare `app.requestAuth`

Strongly recommended:

- declare `app.state` so the host can preserve resumable snapshots
- declare `app.error` so degraded recovery is explicit instead of inferred

The host currently supports:

- protocol version `1`
- auth modes `none`, `host-session`, `oauth`, `api-key`
- bridge lifecycle events from the reviewed manifest support matrix
- completion modes `message`, `summary`, `state`, `handoff`

## Register -> Invoke -> Render -> Complete

This is the practical flow a new partner should implement and debug locally.

### 1. Register

Start from the example manifest and validate it:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateChatBridgePartnerManifest } from '@shared/chatbridge'

const exampleEntry = JSON.parse(
  readFileSync(resolve(process.cwd(), 'chatbridge/examples/reviewed-partner-manifest.example.json'), 'utf8')
)

const report = validateChatBridgePartnerManifest(exampleEntry)

if (!report.valid) {
  console.error(report.issues)
  throw new Error('Manifest did not pass the reviewed-partner contract.')
}
```

### 2. Invoke

Create the local harness so the host bootstrap and runtime lifecycle stay
deterministic while you build:

```ts
import { createChatBridgePartnerHarness } from '../test/integration/chatbridge/mocks/partner-harness'

const harness = createChatBridgePartnerHarness({
  appId: exampleEntry.manifest.appId,
  appName: exampleEntry.manifest.name,
  appVersion: exampleEntry.manifest.version,
  appInstanceId: 'partner-instance-1',
  expectedOrigin: exampleEntry.manifest.origin,
  capabilities: ['render-html-preview'],
  createIds: ['bridge-session-1', 'bridge-token-1', 'bridge-nonce-1', 'render-1'],
})
```

### 3. Render

Your runtime must acknowledge `host.bootstrap` with `app.ready` before the host
may trust later traffic. After that, the host can send `host.render` updates
and your runtime can emit `app.state` snapshots.

```ts
const readyPromise = harness.waitForReady()

harness.sendAppEvent({
  kind: 'app.ready',
  bridgeSessionId: 'bridge-session-1',
  appInstanceId: 'partner-instance-1',
  bridgeToken: 'bridge-token-1',
  ackNonce: 'bridge-nonce-1',
  sequence: 1,
})

await readyPromise

harness.renderHtml('<html><body><h1>Checkpoint Coach</h1></body></html>')

harness.sendAppEvent({
  kind: 'app.state',
  bridgeSessionId: 'bridge-session-1',
  appInstanceId: 'partner-instance-1',
  bridgeToken: 'bridge-token-1',
  sequence: 2,
  idempotencyKey: 'state-2',
  snapshot: {
    route: '/checkpoints/checkpoint-42',
    checkpointId: 'checkpoint-42',
  },
})
```

### 4. Complete

Completion is explicit. Emit `app.complete` with structured outcome data and an
optional suggested summary. The host validates the payload and decides what
later chat turns may see.

```ts
import { CHATBRIDGE_COMPLETION_SCHEMA_VERSION } from '@shared/chatbridge'

harness.sendAppEvent({
  kind: 'app.complete',
  bridgeSessionId: 'bridge-session-1',
  appInstanceId: 'partner-instance-1',
  bridgeToken: 'bridge-token-1',
  sequence: 3,
  idempotencyKey: 'complete-3',
  completion: {
    schemaVersion: CHATBRIDGE_COMPLETION_SCHEMA_VERSION,
    status: 'success',
    outcomeData: {
      checkpointId: 'checkpoint-42',
    },
    suggestedSummary: {
      text: 'Checkpoint Coach finished the current checkpoint and returned the saved state to chat.',
    },
  },
})
```

The working end-to-end reference for this path is:

- `test/integration/chatbridge/scenarios/partner-sdk-harness.test.ts`
- `test/integration/chatbridge/scenarios/partner-submission-intake.test.ts`

## Launch-Scoped Bridge Rules

The local harness exercises the same launch-scoped bridge controller the host
uses for approved runtimes.

Rules that partner runtimes must respect:

- accept the `host.bootstrap` envelope only from the expected origin
- treat `bridgeSessionId`, `bridgeToken`, and `bootstrapNonce` as launch-scoped
  secrets
- acknowledge with `app.ready` before sending `app.state`, `app.complete`, or
  `app.error`
- send strictly increasing `sequence` values
- send unique `idempotencyKey` values for `app.state`, `app.complete`, and
  `app.error`

The current bridge-runtime event surface is:

- `app.ready`
- `app.state`
- `app.complete`
- `app.error`

Replay, stale sequence numbers, duplicate idempotency keys, malformed payloads,
and expired bridge sessions are rejected explicitly.

## Auth Expectations

Reviewed partner apps do not own raw long-lived credentials.

Auth rules by mode:

- `none`: no platform or app grant required
- `host-session`: Chatbox platform session required, but no app grant
- `oauth` / `api-key`: platform session plus host-managed app grant required

For `oauth` and `api-key` apps:

- the host is the credential owner
- the runtime should request access through host-managed auth flows
- the runtime should use scoped credential handles or host-mediated resource
  access
- raw Drive, OAuth, or API tokens should never live inside the partner runtime

Relevant contract surfaces:

- `src/shared/chatbridge/auth.ts`
- `src/shared/chatbridge/resource-proxy.ts`

## OAuth Or API-Key Delta

The checked-in manifest example is `host-session` on purpose. If your app needs
`oauth` or `api-key` instead:

1. switch `authMode`
2. add the required app-specific permissions
3. include `app.requestAuth` in `supportedEvents`
4. request access through the host-managed auth flow
5. keep raw tokens and long-lived credentials out of the partner runtime

The validator will fail closed if an `oauth` or `api-key` manifest omits
`app.requestAuth`.

## Completion and Memory Expectations

Completion is mandatory and explicit.

Use `app.complete` with the structured payload contract in
`src/shared/chatbridge/completion.ts`.

Key rules:

- emit `schemaVersion: 1`
- use a supported completion mode from the manifest
- keep outcome data structured
- a partner may provide `suggestedSummary`
- only the host may write `summaryForModel`

That last rule is critical: partner runtimes do not write directly into model
memory. They provide structured output; the host validates, normalizes, and
decides what later chat turns may see.

## Local Harness

The local/mock host harness lives in:

- `test/integration/chatbridge/mocks/partner-harness.ts`

It wraps the real host controller so partners can verify:

- bootstrap envelope handling
- `app.ready` acknowledgement
- `host.render` delivery
- accepted versus rejected runtime events
- observability signals
- recovery decisions for malformed or replayed traffic

Representative usage lives in:

- `test/integration/chatbridge/scenarios/partner-sdk-harness.test.ts`

Keep new partner fixtures deterministic and secretless. The local harness is
for contract compatibility and failure debugging, not for bypassing reviewed
host controls.

## Debugging Checklist

Before asking for platform review, confirm all of these locally:

- your manifest validates with `validateChatBridgePartnerManifest`
- your runtime acknowledges `host.bootstrap` with `app.ready`
- the harness receives at least one `host.render` message
- your runtime emits monotonic sequence numbers
- your runtime emits unique idempotency keys for `app.state` and
  `app.complete`
- your completion payload uses `schemaVersion: 1`
- the host, not the runtime, owns `summaryForModel`
