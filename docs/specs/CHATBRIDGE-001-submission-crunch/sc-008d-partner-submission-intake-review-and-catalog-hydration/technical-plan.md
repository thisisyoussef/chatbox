# SC-008D Technical Plan

## Metadata

- Story ID: SC-008D
- Story Title: Partner submission intake, review queue, and catalog hydration
- Author: Codex
- Date: 2026-04-05

## Proposed Design

- Shared contract:
  - `src/shared/chatbridge/partner-submissions.ts`
- Shared registry enhancement:
  - `src/shared/chatbridge/registry.ts`
- Renderer persistence and hydration:
  - `src/renderer/packages/chatbridge/partner-submissions.ts`
  - `src/renderer/index.tsx`
- Product surface:
  - `src/renderer/components/settings/chatbridge/PartnerPortal.tsx`
  - `src/renderer/routes/settings/chatbridge-partners.tsx`
  - `src/renderer/routes/settings/route.tsx`
- Runtime package launch seam:
  - `src/renderer/components/chatbridge/apps/ReviewedAppRuntimeFrame.tsx`
- Example assets and docs:
  - `chatbridge/PARTNER_SDK.md`
  - `chatbridge/SUBMISSION.md`
  - `chatbridge/examples/reviewed-partner-manifest.example.json`
  - `chatbridge/examples/reviewed-partner-runtime.example.html`

## Implementation Notes

- Store structured submission records through the existing renderer storage
  wrapper and keep uploaded runtime HTML in blob storage.
- Rebuild the reviewed registry from built-in apps plus approved submissions at
  startup and after every review action.
- Keep runtime upload intentionally narrow: single-file HTML only.
- Reuse the existing generic reviewed-app tool executor so newly approved apps
  are launchable without per-app code.

## Test Strategy

- Shared helper coverage for manifest normalization and approved catalog entry
  promotion.
- Renderer service coverage for submit, approve, reject, conflict detection,
  and runtime hydration.
- Runtime iframe coverage proving uploaded HTML is used for approved apps.
- Integration coverage proving approved uploads enter the routing catalog and
  execute through the reviewed host tool path.
