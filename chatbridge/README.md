# ChatBridge Docs Index

ChatBridge is the reviewed-partner application model described for this Chatbox
workspace. The goal is to let third-party apps live inside the conversation
without giving up host authority over routing, auth, memory, or safety.

These docs are the current developer-facing entry points for that contract.
They are intentionally honest about the branch state: the architecture and
partner contract are defined here first, while the validator and full local
harness are planned follow-on work.

## Start Here

- [PARTNER_SETUP.md](./PARTNER_SETUP.md): local prerequisites, repo commands,
  and the expected quickstart path for reviewed partners
- [PARTNER_API.md](./PARTNER_API.md): the partner manifest, bridge lifecycle,
  auth, security, and completion contract
- [ARCHITECTURE.md](./ARCHITECTURE.md): the higher-level system design, trust
  boundaries, and state-ownership model
- [PRESEARCH.md](./PRESEARCH.md): the longer-form rationale behind the reviewed
  partner model and the platform's guardrails

## What ChatBridge Means In This Repo

- The Electron app remains the user-facing shell.
- The host runtime owns routing, lifecycle, validation, and model-facing memory.
- Partner apps are reviewed, scoped, and less trusted than the host.
- Explicit completion signaling matters more than clever UI alone.

## Current Contract Status

- The partner manifest fields and bridge events are defined in
  [PARTNER_API.md](./PARTNER_API.md) and grounded in
  [PRESEARCH.md](./PRESEARCH.md).
- Local development should use the existing Chatbox repo commands documented in
  [PARTNER_SETUP.md](./PARTNER_SETUP.md).
- The dedicated partner validator and the fuller `test/integration/chatbridge/`
  harness path are planned but not fully shipped on this branch yet. Until they
  land, partners should target the documented contract and mirror the repo's
  existing integration-harness patterns.
