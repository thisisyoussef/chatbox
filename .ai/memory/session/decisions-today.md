# Decisions Today

- 2026-03-30: Imported the reusable `.ai` harness baseline from a neighboring
  repo, then pruned source-project state, history, and workflow assumptions so
  the harness matches Chatbox.
- 2026-03-30: Standardized harness validation guidance around the real root
  commands in this repo: `pnpm test`, `pnpm check`, `pnpm lint`, `pnpm build`,
  and `git diff --check`.
- 2026-04-02: Replaced the active Pencil gate with an autonomous UI design
  workflow: spec and technical plan first, then a design brief, targeted design
  research, 2 or 3 prompt-based directions, autonomous scoring, and a recorded
  design decision before implementation.
- 2026-04-02: Restricted the floating ChatBridge app tray to actual runtime
  parts and excluded clarify/refuse route artifacts so a later routing receipt
  cannot displace an already-active Chess tray.
- 2026-04-03: Promoted Weather Dashboard `route-ready` host turns directly into
  the reviewed app launch contract so a resolved location opens the dashboard
  immediately, while still honoring short launch-confirmation follow-ups from
  legacy `route-ready` receipts.
- 2026-04-03: Hardened Weather Dashboard geocoding with a provider-facing
  fallback for US city-plus-state inputs so free-form variants like `detroit
  michigan` and `Detroit, MI` can recover through validated city lookup before
  surfacing `location-not-found`.
- 2026-04-03: Narrowed Weather Dashboard launch interception to explicit
  weather-lookup intents and added place-sanity checks on derived location
  hints so follow-up advice like `What should I wear for this kind of weather?`
  stays in normal chat instead of reopening the dashboard with a fake location.
