# ChatBridge Partner Setup Guide

This guide is the local quickstart for reviewed third-party developers building
against the ChatBridge contract in this repository.

Use it together with [PARTNER_API.md](./PARTNER_API.md). The setup guide tells
you how to work in this repo; the API guide tells you what contract your app
must satisfy.

## Current Branch Reality

- The architecture and partner contract are documented now.
- The dedicated manifest validator and full local harness are planned follow-on
  work, not a finished self-serve product on this branch.
- You should still target the documented manifest and bridge lifecycle so your
  app is ready for review against the same contract later.

## Prerequisites

- Node.js 20.x to 22.x
- `pnpm` 10 or newer
- A stable app origin you control for the reviewed runtime
- A partner app idea that fits the reviewed-partner model rather than an open
  marketplace assumption

## Repo Setup

1. Clone the repository.

```bash
git clone https://github.com/chatboxai/chatbox.git
cd chatbox
```

2. Install dependencies.

```bash
pnpm install
```

3. Start the desktop app.

```bash
pnpm dev
```

4. If your integration depends on the local Chatbox API origin at
   `http://localhost:8002`, use:

```bash
pnpm dev:local
```

5. Use the normal validation gates from the repo root when your doc or code
   changes are ready:

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
git diff --check
```

## Read These Before You Build

- [PARTNER_API.md](./PARTNER_API.md): manifest, lifecycle, auth, and completion
  contract
- [ARCHITECTURE.md](./ARCHITECTURE.md): trust boundaries and state ownership
- [PRESEARCH.md](./PRESEARCH.md): platform rationale, reviewed-partner model,
  and why completion semantics matter

## First App Checklist

1. Pick the right app category.
   Internal, public external, and authenticated partner apps have different
   auth expectations. If your app needs user-specific third-party data, plan on
   host-mediated auth rather than raw token access from the runtime.

2. Draft the manifest first.
   Define `appId`, `origin`, `uiEntry`, permissions, tool schemas, supported
   events, completion modes, and safety metadata before you build the UI.

3. Implement the lifecycle explicitly.
   Your runtime should intentionally handle `host.init`, send `app.ready`,
   publish resumable `app.state` updates, and end with `app.complete`.

4. Design for degraded paths early.
   Plan how your app behaves when policy blocks launch, auth is denied,
   network access fails, or completion arrives twice.

5. Keep memory host-owned.
   The app may suggest summaries, but the host decides what becomes model- or
   conversation-visible memory.

## Suggested Local App Layout

Use any stack you want for the app runtime, but keep the ownership split clear.
A minimal starting point looks like this:

```text
partner-app/
  manifest.json
  src/
    bridge.ts
    state.ts
    ui/
  test/
    bridge.spec.ts
```

- `manifest.json`: reviewed manifest metadata and schemas
- `src/bridge.ts`: event handling and lifecycle envelope logic
- `src/state.ts`: app-local state that can be resumed or summarized
- `src/ui/`: embedded UI surface
- `test/`: event ordering, replay, timeout, and completion tests

## Local Harness Path

The intended in-repo harness location is:

```text
test/integration/chatbridge/
```

That full harness is planned but not fully shipped on this branch yet. Until it
lands, mirror the repo's existing integration-test patterns and keep your
partner development flow close to them:

- use `test/integration/file-conversation/` as the closest current harness
  exemplar for fixture-driven integration tests
- organize future ChatBridge tests under `fixtures/`, `mocks/`, and
  `scenarios/`
- default to secretless mocks for registry, policy, auth, persistence, and
  telemetry
- opt into live integrations only when API compatibility is itself the behavior
  under test

## Minimum Scenarios To Validate

Before asking for partner review, prove these paths locally:

- app session starts and emits `app.ready`
- resumable state updates emit `app.state`
- explicit completion emits `app.complete`
- duplicate completion or replay is rejected cleanly
- policy denial or missing availability does not launch the app silently
- auth denied, expired, or unavailable flows remain user-readable
- follow-up chat after completion can rely on a normalized summary rather than
  raw UI state

## Submission Handoff To The Platform Team

Provide this bundle for review:

- manifest and app version
- approved origin list
- permission rationale
- tool schemas with example inputs
- auth model and any provider dependencies
- lifecycle notes for `app.ready`, `app.state`, `app.complete`, and
  degraded/error states
- a short demo script or scenario checklist that shows the host can reason
  about the app before, during, and after completion

## Common Mistakes To Avoid

- treating ChatBridge like an unreviewed plugin marketplace
- depending on raw user credentials in the app runtime
- assuming the host can infer completion without `app.complete`
- writing free-form summaries directly into model memory
- skipping error, timeout, and replay behavior until the end
