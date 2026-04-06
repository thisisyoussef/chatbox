# ChatBridge Partner API and Bridge Contract

This document describes the current contract target for reviewed third-party
developers building a ChatBridge app for this repository. It is grounded in
[PRESEARCH.md](./PRESEARCH.md) and
[ARCHITECTURE.md](./ARCHITECTURE.md).

Important: this branch documents the contract before every enforcement tool is
fully productized. Use this as the source of truth for the reviewed-partner
integration shape, not as evidence that an open marketplace or self-serve SDK
already exists.

## Operating Model

ChatBridge is not a generic plugin marketplace. It is a reviewed-partner model.

- The host owns routing, auth, lifecycle, and model-visible memory.
- The app owns its UI, app-local interaction state, and partner-specific logic.
- The backend is intended to become authoritative for durable app state, auth
  grants, app events, and policy.
- Partners receive scoped context and capability access, not raw desktop access
  or full conversation history by default.

## App Categories

| Category | Typical use | Auth expectation |
| --- | --- | --- |
| Internal app | First-party host surface | No separate partner auth |
| Public external app | Public or app-level integration | No raw user credential handling in the app |
| Authenticated partner app | User-specific workflows such as Drive-backed save/load | Host starts auth and returns scoped access or credential handles |

## Required Manifest

The exact validator implementation is planned follow-on work, but the manifest
fields below are already the contract target.

| Field | Why it exists |
| --- | --- |
| `appId` | Stable unique identity for the app across reviews and launches |
| `name` | Human-readable display name |
| `version` | Contract and rollout version |
| `origin` | Trusted runtime origin for the app surface |
| `uiEntry` | Entrypoint the host renders for the app |
| `authMode` | Declares whether the app needs no auth, app-level auth, or host-mediated user auth |
| `permissions` | Requested host capabilities and context scope |
| `toolSchemas` | Reviewed tool definitions and input schemas |
| `supportedEvents` | Declared bridge events the app will emit or consume |
| `completionModes` | How the app signals terminal state; explicit completion is expected |
| `timeouts` | Readiness, idle, or long-running operation thresholds |
| `safetyMetadata` | Review-time safety classification and partner notes |
| `tenantAvailability` | Which tenants, classrooms, or contexts can enable the app |
| `healthcheck` | Lightweight endpoint or signal for operational health |

### Example Manifest

This is a representative manifest shape, not a generated schema file:

```json
{
  "appId": "com.example.flashcards",
  "name": "Example Flashcards",
  "version": "1.0.0",
  "origin": "https://partner.example.com",
  "uiEntry": "/chatbridge/index.html",
  "authMode": "none",
  "permissions": [
    "conversation.summary.read",
    "app.state.write"
  ],
  "toolSchemas": [
    {
      "name": "start_session",
      "description": "Start a flashcard session for a topic",
      "inputSchema": {
        "type": "object",
        "properties": {
          "topic": {
            "type": "string"
          }
        },
        "required": [
          "topic"
        ],
        "additionalProperties": false
      }
    }
  ],
  "supportedEvents": [
    "app.ready",
    "app.state",
    "app.complete",
    "app.error"
  ],
  "completionModes": [
    "explicit"
  ],
  "timeouts": {
    "readyMs": 5000,
    "idleMs": 300000
  },
  "safetyMetadata": {
    "contentClass": "education",
    "reviewTier": "reviewed-partner"
  },
  "tenantAvailability": {
    "default": "disabled"
  },
  "healthcheck": "/healthz"
}
```

## Common Message Envelope

Every bridge message should carry enough metadata for the host to validate,
order, correlate, and safely replay or reject it.

| Field | Notes |
| --- | --- |
| `type` | Event name such as `host.init` or `app.complete` |
| `correlationId` | Correlates request/response and multi-step flows |
| `appInstanceId` | Launch-scoped app instance identifier |
| `sequence` | Monotonic sequence number for bound-session ordering |
| `idempotencyKey` | Required for state-changing events |
| `protocolVersion` | Host/app protocol compatibility guard |
| `timestamp` | Event creation time for auditability and debugging |
| `payload` | Event-specific body |

## Bridge Lifecycle

### Host-to-app events

| Event | Purpose | Minimum expectation |
| --- | --- | --- |
| `host.init` | Start a reviewed app session | Signed init envelope, bridge session metadata, approved permissions, initial context |
| `host.invokeTool` | Ask the app or app-owned capability to act on validated args | Invocation id, reviewed tool name, validated arguments, retry classification |
| `host.syncContext` | Send the latest approved host context | Only scoped context the host allows the app to see |
| `host.resume` | Rehydrate a resumable app instance | Saved state snapshot, summary, and revision info |
| `host.cancel` | Tell the app to stop, close, or roll back local work | Explicit cancellation reason and expected cleanup path |

### App-to-host events

| Event | Purpose | Minimum expectation |
| --- | --- | --- |
| `app.ready` | Confirm the app mounted successfully | App version, capabilities, and ready state |
| `app.state` | Publish resumable state and progress | State snapshot, status, and safe summary candidate |
| `app.complete` | End the app flow explicitly | Completion mode, normalized result payload, summary suggestion |
| `app.error` | Report recoverable or terminal failure | Error code, severity, user-safe message, retry advice |
| `app.requestAuth` | Ask the host to begin partner auth | Provider, requested scope, and user-facing reason |
| `app.telemetry` | Emit health or debugging signals | Non-sensitive metrics or lifecycle breadcrumbs |

### Session Handshake Rules

The bridge session is launch-scoped, not just origin-scoped. Each app launch
should mint a `bridgeSession` with:

- `appInstanceId`
- expected origin
- protocol version
- capability list
- expiry timestamp
- launch-scoped opaque bridge token
- dedicated `MessagePort`

The host should send a signed bootstrap envelope, transfer the dedicated
`MessagePort`, and require a nonce-based acknowledgment before accepting normal
traffic. After that point, the host should accept only messages that arrive on
the bound port, match the expected `appInstanceId`, advance the sequence, and
carry an idempotency key when they can change state.

## Example Lifecycle Messages

### `host.init`

```json
{
  "type": "host.init",
  "correlationId": "corr_123",
  "appInstanceId": "appinst_123",
  "protocolVersion": "1.0",
  "payload": {
    "bridgeSession": {
      "token": "opaque-session-token",
      "expectedOrigin": "https://partner.example.com",
      "capabilities": [
        "app.state.write",
        "conversation.summary.read"
      ],
      "expiresAt": "2026-04-05T17:00:00Z"
    },
    "launchContext": {
      "userIntent": "start a flashcard session",
      "allowedTools": [
        "start_session"
      ]
    },
    "nonce": "init_nonce_123"
  }
}
```

### `app.complete`

```json
{
  "type": "app.complete",
  "correlationId": "corr_123",
  "appInstanceId": "appinst_123",
  "sequence": 9,
  "idempotencyKey": "complete_123",
  "payload": {
    "completionMode": "explicit",
    "result": {
      "sessionId": "sess_456",
      "score": 8
    },
    "summarySuggestion": "Completed an 8-card flashcard session with 8 correct answers.",
    "resumable": false
  }
}
```

## Tool Execution Rules

Tool execution is host-governed even when the app owns the visible UI.

- The host validates arguments again at runtime against the reviewed schema.
- Side-effecting calls must carry idempotency keys.
- Retry behavior must be explicit and classified as safe or unsafe.
- Schema compatibility must be versioned and fail closed on mismatch.
- Host logs should keep normalized invocation payloads rather than arbitrary raw
  partner blobs.

If the host sees a schema mismatch or unsupported protocol version, it should
reject the invocation instead of attempting a best-effort fallback.

## Auth and Permission Rules

Partners should treat auth as host-mediated.

- The app does not store long-lived raw user credentials.
- The host starts the auth flow and stores or refreshes credentials.
- The app receives scoped access or a credential handle, not the raw token.
- Protected third-party APIs should be called through a host-mediated resource
  layer when user-grant auth is involved.

For context and permissions:

- Ask for the minimum permissions needed.
- Do not assume access to full conversation history.
- Expect tenant, classroom, or teacher policy to narrow availability.

## Completion and Memory Rules

Completion is explicit. The app must not assume the host can infer the end of
work from UI state alone.

- Emit `app.complete` when the task reaches a terminal state.
- Include a structured result payload and a concise summary suggestion.
- Expect the host to validate, redact if needed, and turn that into the final
  `summaryForModel`.
- Treat duplicate or replayed completion events as rejectable by design.

The host, not the app, decides what becomes durable conversation memory.

## Security Rules

Every reviewed app should satisfy these baseline expectations:

- Use a fixed reviewed origin.
- Minimize iframe sandbox and capability scope.
- Never depend on blanket access to the desktop runtime.
- Never read or persist more student or conversation content than the task
  requires.
- Support degraded behavior when auth, policy, network, or partner services
  fail.

## Review Checklist

Before handing an app to the platform team, confirm that:

- the manifest is complete and internally consistent
- all tool schemas are explicit and validated
- the app emits `app.ready`, `app.state`, and `app.complete` intentionally
- auth requests are host-mediated
- completion payloads are normalized and resumable behavior is named explicitly
- error, timeout, and policy-denied states are documented and testable
