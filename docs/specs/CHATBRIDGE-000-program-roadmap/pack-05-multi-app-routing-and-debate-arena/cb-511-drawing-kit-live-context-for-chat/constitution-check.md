# CB-511 Constitution Check

## Story Context

- Story ID: CB-511
- Story Title: Drawing Kit live context for chat
- Pack: Pack 05 - Multi-App Routing and Debate Arena
- Owner: Codex
- Date: 2026-04-02

## Constraints

1. Keep the host as the owner of model-visible app context, lifecycle, and
   persisted artifacts.
   Sources:
   `AGENTS.md`,
   `src/shared/chatbridge/app-memory.ts`,
   `src/renderer/packages/chatbridge/context.ts`
2. Prefer bounded app summaries and normalized snapshot derivatives over raw
   renderer internals or freeform pixel scraping.
   Sources:
   `src/shared/chatbridge/apps/chess.ts`,
   `src/shared/chatbridge/apps/drawing-kit.ts`,
   `docs/specs/CHATBRIDGE-000-program-roadmap/pack-05-multi-app-routing-and-debate-arena/cb-509-drawing-kit-flagship-app/feature-spec.md`
3. Reuse existing reviewed-app launch, app-part, and model-message seams before
   introducing a new storage or media subsystem.
   Sources:
   `src/renderer/packages/chatbridge/reviewed-app-launch.ts`,
   `src/renderer/packages/model-calls/message-utils.ts`,
   `src/shared/types/session.ts`
4. Keep UI scope out of this story. No new tray, inspector, or inline controls
   should be added here, so Pencil is not required.
   Sources:
   `AGENTS.md`,
   `.ai/docs/PENCIL_UI_WORKFLOW.md`
5. Validation stays at the repo baseline.
   Source:
   `AGENTS.md`

## Structural Map

- Likely surface: `src/shared/chatbridge/`
- Likely surface: `src/renderer/packages/chatbridge/`
- Likely surface: `src/renderer/packages/model-calls/`
- Likely surface: `docs/specs/CHATBRIDGE-000-program-roadmap/pack-05-multi-app-routing-and-debate-arena/`

## Exemplars

1. `src/shared/chatbridge/apps/chess.ts`
   Bounded host-owned snapshot precedent with a richer state digest.
2. `src/shared/chatbridge/apps/drawing-kit.ts`
   Existing bounded Drawing Kit snapshot contract with preview marks and
   checkpoint summaries.
3. `src/shared/chatbridge/app-memory.ts`
   Current selected-app continuity path used for later-turn context.
4. `src/renderer/packages/chatbridge/reviewed-app-launch.ts`
   Existing reviewed runtime persistence seam for `app.state` and
   `app.complete`.
5. `src/renderer/packages/model-calls/message-utils.ts`
   Model conversion seam where app context can become text and file inputs.

## Lane Decision

- Lane: `standard`
- Why: this changes host-owned continuity behavior across shared ChatBridge and
  model-call paths, introduces an app-linked media contract, and affects how
  later turns reason about an active flagship app.
- Required gates: constitution check, feature spec, technical plan, task
  breakdown, focused tests, and full repo validation.

## Outcome Notes

- The live-context layer should be tiered:
  summary first,
  structured digest second,
  screenshot artifact third.
- The screenshot representation should come from trusted snapshot data rendered
  by the host, not from asking the model to inspect arbitrary iframe DOM state.
