# SC-008D Design Research

## Existing Seams Reused

- `src/shared/chatbridge/manifest.ts`
- `src/shared/chatbridge/partner-validator.ts`
- `src/shared/chatbridge/registry.ts`
- `src/shared/chatbridge/reviewed-app-catalog.ts`
- `src/renderer/components/chatbridge/apps/ReviewedAppRuntimeFrame.tsx`
- `src/renderer/packages/chatbridge/single-app-tools.ts`
- `src/renderer/routes/settings/route.tsx`
- `src/renderer/storage/BaseStorage.ts`

## Key Observations

- Reviewed apps were already launchable through a generic host-owned tool and
  runtime path.
- The missing piece was persistence plus an approval-controlled way to add new
  entries into the registry.
- Renderer storage already supported both structured values and blob payloads,
  which makes manifest records and HTML runtime upload feasible without a new
  backend.
- The settings shell is the right visible product surface for a reviewer-facing
  intake flow in production.
