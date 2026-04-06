# SC-008D Design Decision

## Decision

Implement the missing partner upload flow as a local, host-owned settings
surface instead of building a separate remote service.

## Why

- The reviewed runtime and registry already exist in-process.
- The submission requirement is to demonstrate the end-to-end platform flow,
  not a production marketplace backend.
- A settings-based queue is visible in the submission build, unlike `/dev`
  routes.
- Approved apps can join the existing reviewed catalog immediately, which keeps
  routing and launch behavior consistent with the flagship apps.

## Consequences

- The feature is complete inside this repo and demoable on the deployed shell.
- Reviewer identity is still local and simplified.
- Package upload is intentionally limited to single-file HTML for this story.
