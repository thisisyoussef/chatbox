# ChatBridge Submission Packet

This is the canonical reviewer entry point for the ChatBridge submission on the
current `main` branch.

## Submission Target

- Production reviewer URL:
  [chatbox-web-two.vercel.app](https://chatbox-web-two.vercel.app/)
- Primary submission portfolio:
  - Chess
  - Drawing Kit
  - Flashcard Studio with Google Drive auth, save, load, and resume
- Extra utility proof:
  - Weather Dashboard

## Start Here

- Repo and local setup:
  [../README.md](../README.md),
  [BOOTSTRAP.md](./BOOTSTRAP.md)
- Deployment and hosted-shell verification:
  [DEPLOYMENT.md](./DEPLOYMENT.md)
- Product brief and grading context:
  [README.md](./README.md)
- Runtime, trust boundaries, and state ownership:
  [ARCHITECTURE.md](./ARCHITECTURE.md),
  [SERVICE_TOPOLOGY.md](./SERVICE_TOPOLOGY.md)
- Bridge, harness, and observability seams:
  [INTEGRATION_HARNESS.md](./INTEGRATION_HARNESS.md),
  [EVALS_AND_OBSERVABILITY.md](./EVALS_AND_OBSERVABILITY.md)
- Reviewed-partner contract and local harness:
  [PARTNER_SDK.md](./PARTNER_SDK.md)

## Recommended Reviewer Flow

Start on the deployed web shell, then use the seeded ChatBridge sessions in
this order:

1. `[Seeded] ChatBridge: Chess mid-game board context`
2. `[Seeded] ChatBridge: Drawing Kit doodle dare`
3. `[Seeded] ChatBridge: Flashcard Studio study mode`
4. `[Seeded] ChatBridge: Flashcard Studio Drive resume`
5. `[Seeded] ChatBridge: Flashcard Studio Drive denied reconnect`
6. `[Seeded] ChatBridge: Flashcard Studio Drive expired auth`
7. `[Seeded] ChatBridge: Runtime + route receipt`

The source of truth for those seeded sessions lives in
[../src/shared/chatbridge/live-seeds.ts](../src/shared/chatbridge/live-seeds.ts).

## Graded Scenario Checklist

### 1. Tool discovery and invocation from a natural-language request

- Repo proof:
  [../test/integration/chatbridge/scenarios/single-app-tool-discovery-and-invocation.test.ts](../test/integration/chatbridge/scenarios/single-app-tool-discovery-and-invocation.test.ts),
  [../test/integration/chatbridge/scenarios/live-reviewed-app-invocation.test.ts](../test/integration/chatbridge/scenarios/live-reviewed-app-invocation.test.ts)
- Live or prod proof:
  `chess-runtime`,
  `drawing-kit-doodle-dare`,
  `flashcard-studio-study-mode`
- Expected reviewer takeaway:
  the host selects an approved tool path and returns an inline reviewed app
  launch instead of falling back to a detached iframe or raw tool receipt.

### 2. App UI rendering inside chat

- Repo proof:
  [../test/integration/chatbridge/scenarios/reviewed-app-bridge-launch.test.ts](../test/integration/chatbridge/scenarios/reviewed-app-bridge-launch.test.ts),
  [../test/integration/chatbridge/scenarios/live-reviewed-app-invocation.test.ts](../test/integration/chatbridge/scenarios/live-reviewed-app-invocation.test.ts)
- Live or prod proof:
  `chess-mid-game-board-context`,
  `drawing-kit-doodle-dare`,
  `flashcard-studio-study-mode`
- Expected reviewer takeaway:
  the runtime stays inside the host-owned chat shell and preserves lifecycle
  state in the same message part.

### 3. User interaction with the app, then completion signaling back to chat

- Repo proof:
  [../test/integration/chatbridge/scenarios/drawing-kit-flagship.test.ts](../test/integration/chatbridge/scenarios/drawing-kit-flagship.test.ts),
  [../test/integration/chatbridge/scenarios/flashcard-studio-study-mode.test.ts](../test/integration/chatbridge/scenarios/flashcard-studio-study-mode.test.ts),
  [../test/integration/chatbridge/scenarios/weather-dashboard-flagship.test.ts](../test/integration/chatbridge/scenarios/weather-dashboard-flagship.test.ts)
- Live or prod proof:
  `drawing-kit-doodle-dare`,
  `flashcard-studio-study-mode`,
  `weather-dashboard`
- Expected reviewer takeaway:
  user actions update the inline runtime, and completion or close-to-chat
  summaries remain host-owned and explicit.

### 4. Follow-up questions after the app finishes, with context retention

- Repo proof:
  [../test/integration/chatbridge/scenarios/mid-game-board-context.test.ts](../test/integration/chatbridge/scenarios/mid-game-board-context.test.ts),
  [../test/integration/chatbridge/scenarios/app-aware-persistence.test.ts](../test/integration/chatbridge/scenarios/app-aware-persistence.test.ts),
  [../test/integration/chatbridge/scenarios/flashcard-studio-study-mode.test.ts](../test/integration/chatbridge/scenarios/flashcard-studio-study-mode.test.ts)
- Live or prod proof:
  `chess-mid-game-board-context`,
  `drawing-kit-doodle-dare`,
  `flashcard-studio-study-mode`
- Expected reviewer takeaway:
  later chat stays grounded in normalized host summaries and bounded weak-card
  or checkpoint context rather than raw app state dumps.

### 5. Multiple apps used in the same conversation

- Repo proof:
  [../test/integration/chatbridge/scenarios/multi-app-continuity.test.ts](../test/integration/chatbridge/scenarios/multi-app-continuity.test.ts),
  [../test/integration/chatbridge/scenarios/full-program-convergence.test.ts](../test/integration/chatbridge/scenarios/full-program-convergence.test.ts)
- Live or prod proof:
  repo scenario proof only for this requirement
- Expected reviewer takeaway:
  the host injects one active and one recent completed app context without
  leaking stale instances or collapsing continuity across apps.

### 6. Ambiguous requests routed to the correct app

- Repo proof:
  [../test/integration/chatbridge/scenarios/route-decision-live-artifacts.test.ts](../test/integration/chatbridge/scenarios/route-decision-live-artifacts.test.ts),
  [../test/integration/chatbridge/scenarios/single-app-tool-discovery-and-invocation.test.ts](../test/integration/chatbridge/scenarios/single-app-tool-discovery-and-invocation.test.ts)
- Live or prod proof:
  repo scenario proof only for clarify behavior
- Expected reviewer takeaway:
  ambiguous prompts surface a host-owned clarify artifact instead of launching
  the wrong reviewed app.

### 7. Refusal when a request should not invoke an app

- Repo proof:
  [../test/integration/chatbridge/scenarios/route-decision-live-artifacts.test.ts](../test/integration/chatbridge/scenarios/route-decision-live-artifacts.test.ts),
  [../test/integration/chatbridge/scenarios/single-app-tool-discovery-and-invocation.test.ts](../test/integration/chatbridge/scenarios/single-app-tool-discovery-and-invocation.test.ts)
- Live or prod proof:
  `runtime-and-route-receipt`
- Expected reviewer takeaway:
  the host keeps inappropriate requests in chat and shows an inline refusal
  receipt instead of forcing an app launch.

## Authenticated App Proof

Flashcard Studio is the authenticated third-party proof for the submission.

- Repo proof:
  [../test/integration/chatbridge/scenarios/flashcard-studio-drive-connect-save-load.test.ts](../test/integration/chatbridge/scenarios/flashcard-studio-drive-connect-save-load.test.ts),
  [../test/integration/chatbridge/scenarios/flashcard-studio-drive-auth-recovery.test.ts](../test/integration/chatbridge/scenarios/flashcard-studio-drive-auth-recovery.test.ts)
- Live or prod proof:
  `flashcard-studio-drive-resume`,
  `flashcard-studio-drive-denied`,
  `flashcard-studio-drive-expired`
- What to verify:
  Google Drive auth remains host-owned, save or reopen metadata stays bounded,
  and denied or expired auth keeps the local deck visible while the reconnect
  rail remains inline.

## Notes

- This packet covers the reviewer-ready index and graded-scenario mapping.
- Partner DX expansion and AI cost analysis remain follow-up submission slices
  under the broader `SC-008` convergence story.
