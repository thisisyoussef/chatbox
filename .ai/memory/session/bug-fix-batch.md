# Bug Fix Batch

## weather-prod-web-bridge

- Symptom: Weather Dashboard opens in the floating web runtime with a degraded `Desktop host required` state instead of live weather data.
- Expected behavior: The web build should fetch live weather through a Vercel/serverless bridge and render the real snapshot in the floating runtime.
- Evidence:
  - `src/renderer/components/chatbridge/apps/weather/WeatherDashboardLaunchSurface.tsx` previously fell back whenever `window.electronAPI` was absent.
  - `vercel env ls` shows `OPENWEATHER_API_KEY` is present in Production.
  - `https://chatbox-web-two.vercel.app/api/langsmith/start-run` responds, while `/api/weather/dashboard` currently falls through to app HTML.
- Regression coverage:
  - serverless route test for `/api/weather/dashboard`
  - renderer weather launch test for the web bridge path
  - full repo validation suite
- Touched files:
  - `api/weather/dashboard.ts`
  - `src/shared/chatbridge/weather-service.ts`
  - `src/shared/chatbridge/weather-dashboard-bridge.ts`
  - `src/main/chatbridge/weather/index.ts`
  - `src/renderer/components/chatbridge/apps/weather/WeatherDashboardLaunchSurface.tsx`
  - related tests
- Status: fixed

## weather-freeform-location-hardening

- Symptom: Production weather requests succeed for `Detroit` but return `location-not-found` for obvious stateful variants like `detroit michigan` and `Detroit, MI`.
- Expected behavior: Weather Dashboard should tolerate common city-plus-state phrasing and recover to the correct upstream location without asking the user to learn provider-specific formatting.
- Evidence:
  - `POST https://chatbox-web-two.vercel.app/api/weather/dashboard` returned `status: "unavailable"` for `location: "detroit michigan"` on 2026-04-03.
  - The same prod route returned `status: "unavailable"` for `location: "Detroit, MI"` on 2026-04-03.
  - The same prod route returned `status: "ready"` for `location: "Detroit"` on 2026-04-03.
- Regression coverage:
  - focused weather service test for stateful free-form geocode fallback
  - focused weather host-routing test coverage remains unchanged unless the correction expands beyond provider normalization
  - prod API smoke after deploy
- Touched files:
  - `src/shared/chatbridge/weather-service.ts`
  - `src/main/chatbridge/weather/index.test.ts`
  - related handoff notes if needed
- Status: fixed

## weather-context-followup-routing

- Symptom: Follow-up advice questions like `What should I wear for this kind of weather?` relaunch Weather Dashboard and stuff the phrase into the location field instead of staying in chat and using the active weather context.
- Expected behavior: Contextual follow-ups should remain normal chat turns unless the user is clearly asking for a new weather lookup or providing a real location clarification.
- Evidence:
  - Production user report on 2026-04-03 showed `weather_dashboard_open` relaunching with `location: "this kind of weather"`.
  - `src/shared/weather-dashboard/intent.ts` treated broad `weather` mentions as new lookup intents and allowed the leading-location parser to extract non-place phrases before `weather`.
  - `src/shared/chatbridge/apps/weather-dashboard.ts` accepted explicit `location` hints without validating that they looked like an actual place.
- Regression coverage:
  - weather host-routing tests for contextual follow-ups with and without a pending clarification
  - session submit test proving the turn falls through to normal generation after a prior weather launch
  - weather location-hint sanitizer tests
  - full repo validation suite
- Touched files:
  - `src/shared/weather-dashboard/intent.ts`
  - `src/shared/chatbridge/apps/weather-dashboard.ts`
  - `src/renderer/packages/weather-dashboard/host-routing.test.ts`
  - `src/renderer/stores/session/messages.weather.test.ts`
  - `src/shared/chatbridge/apps/weather-dashboard.test.ts`
- Status: fixed
