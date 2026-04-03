## Agent 2 Implementation

- Promoted Weather Dashboard `route-ready` states into the reviewed app launch contract in `src/renderer/packages/weather-dashboard/host-routing.ts`.
- Preserved the original request text while passing the normalized location as the explicit launch hint.
- Updated `src/shared/weather-dashboard/intent.ts` to recognize short launch confirmations for legacy `route-ready` receipts.
- Updated `src/renderer/stores/session/messages.ts` to await the async weather interception path.
