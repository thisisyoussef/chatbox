# SC-007A Design Research

## Repo Findings

- The current reviewed Flashcard runtime already has a warm paper/study-desk
  visual language and a compact action strip that can absorb a small amount of
  host-owned utility chrome without needing a new screen. Source:
  `src/renderer/packages/chatbridge/bridge/reviewed-app-runtime.ts`
- The reviewed launch shell already branches per app and uses a dedicated React
  surface for Weather when host-owned controls are richer than the generic
  iframe wrapper. Source:
  `src/renderer/components/chatbridge/apps/ReviewedAppLaunchSurface.tsx`
- Live seed fixtures already expect Flashcard Studio to be inspectable in the
  active flagship catalog, so new Drive states need to be visible in seeded
  sessions rather than hidden behind implementation-only helpers. Source:
  `src/shared/chatbridge/live-seeds.ts`

## External Findings

- Google’s Drive scope guidance recommends choosing the most narrowly focused
  scope possible and explicitly calls out `drive.file` as the recommended
  non-sensitive scope for create/modify flows tied to files the app creates or
  opens. Source:
  [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- Google’s web OAuth guidance uses the Google Identity Services token model for
  browser-based apps. This reinforces an explicit button-driven connect action
  in the host shell rather than a hidden background auth flow. Source:
  [Use the token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- Drive file update semantics work cleanly for JSON save checkpoints, and
  `files.update` accepts the `drive.file` scope. Source:
  [files.update](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update)

## Design Implications

- The shell should not present itself as a generic Google Drive browser. The
  scope and product intent both point toward app-managed save/load actions plus
  a bounded recent-deck list.
- The connect action should be explicit and user-driven. That matches both the
  token model and the repo’s preference for visible lifecycle control.
- The best visual direction is to add a compact host-owned utility rail around
  the existing Flashcard shell instead of replacing the core authoring/study
  workspace.
