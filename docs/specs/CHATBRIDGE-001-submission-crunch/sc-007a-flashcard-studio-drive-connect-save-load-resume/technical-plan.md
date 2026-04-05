# SC-007A Technical Plan

## Metadata

- Story ID: SC-007A
- Story Title: Flashcard Studio Drive connect, save, load, and resume
- Author: Codex
- Date: 2026-04-05

## Proposed Design

- Components/modules affected:
  - `src/shared/chatbridge/apps/flashcard-studio.ts`
  - `src/shared/chatbridge/apps/flashcard-studio.test.ts`
  - `src/shared/chatbridge/reviewed-app-catalog.ts`
  - `src/renderer/components/chatbridge/apps/ReviewedAppLaunchSurface.tsx`
  - `src/renderer/packages/chatbridge/bridge/reviewed-app-runtime.ts`
  - `src/renderer/packages/chatbridge/reviewed-app-launch.ts`
  - `src/renderer/packages/chatbridge/bridge/reviewed-app-runtime.test.ts`
  - `src/renderer/platform/web_platform.ts`
  - `src/renderer/platform/desktop_platform.ts`
  - `src/shared/chatbridge/live-seeds.ts`
  - `src/renderer/dev/chatbridgeSeeds.ts`
  - `src/renderer/packages/initial_data.ts`
  - `src/renderer/setup/preset_sessions.ts`
  - `test/integration/chatbridge/scenarios/flashcard-studio-drive-connect-save-load.test.ts`
- Public interfaces/contracts:
  - Flashcard Studio reviewed-app catalog permissions and auth mode
  - host-owned Flashcard Drive state embedded in the app snapshot
  - local saved-deck metadata contract
  - Google Drive deck JSON file format

## Architecture Decisions

- Decision: keep Google auth and Drive file operations in the host shell, not
  the reviewed runtime.
- Rationale: the repo already models oauth apps as host-mediated and the
  submission feedback specifically values a real host/app bridge instead of an
  unbounded iframe app.

- Decision: use `drive.file` and app-managed JSON files for the MVP.
- Rationale: Google currently recommends the narrowest possible scope, and
  `drive.file` is the smallest practical scope for create/update/open behavior.

- Decision: persist only grant metadata and recent saved-deck metadata locally;
  keep raw access tokens ephemeral.
- Rationale: this preserves resume affordances without turning local storage
  into a long-lived secret store.

- Decision: rehydrate the runtime by pushing host-generated snapshot updates
  through the existing reviewed-app persistence path.
- Rationale: `SC-006A` and `SC-006B` already proved that the Flashcard runtime
  can recover from host-owned `app.state` snapshots.

- Decision: use the platform config UUID as the stable fallback identity key on
  preview hosts when official Chatbox cloud browser APIs are unavailable.
- Rationale: the submission target is a non-official web host, so host-managed
  grants cannot depend on `chatboxai.app` browser identity.

## Data Model

- Extend the Flashcard Studio snapshot with a bounded Drive block:
  - `drive.status`: `needs-auth`, `connecting`, `connected`, `saving`,
    `loading`, `error`
  - `drive.statusText`
  - `drive.detail`
  - `drive.connectedAs`
  - `drive.lastSavedDeckId`
  - `drive.lastSavedDeckName`
  - `drive.lastSavedAt`
  - `drive.recentDecks`: bounded list of recent app-managed deck records
- Add a local host metadata record keyed by stable user identity plus app ID:
  - grant status metadata
  - recent deck descriptors
  - last-opened deck ID
- Keep the saved Drive JSON payload aligned to the Flashcard snapshot schema
  with a small envelope for app/file metadata.

## Runtime Plan

- Add a Flashcard-specific host shell around the existing reviewed runtime:
  - host toolbar for `Connect Drive`, `Save deck`, and `Load recent`
  - compact Drive status strip above or alongside the runtime
  - bounded recent-deck list for resume
- Continue using the existing runtime markup for authoring/study interactions.
- Save and load actions originate in React and update the persisted app part
  through `persistReviewedAppLaunchBridgeEvent(...)` with host-generated
  snapshots.
- When Drive auth or a Drive action fails, keep the runtime active and only
  update the Drive block plus host-visible recovery guidance.

## Trace-Driven Scenario Matrix

1. Happy path: connect Drive, save an authored deck, reload the session, reopen
   the saved deck, resume study from the saved snapshot.
2. Expected user error: user closes or denies the Drive consent flow; shell
   returns to `needs-auth` with guidance.
3. Malformed input: Drive returns an unreadable or invalid deck payload; host
   fails closed and keeps the prior snapshot intact.
4. Degraded path: token/session expires between connect and save/load; shell
   surfaces reconnect guidance without losing local deck state.
5. Continuity path: saved study progress rehydrates after reload and later chat
   still stays grounded in the restored weak-card summary.

## Test Strategy

- Unit tests:
  - Flashcard Drive snapshot creation and validation
  - local metadata record helpers
  - save/load envelope parsing and malformed payload handling
- Integration tests:
  - host-owned connect/save/load/resume lifecycle
  - auth denial and expired-session recovery
  - continuity after restored study progress
- Validation:
  - targeted vitest runs during the slice
  - repo-level validation before finalization
