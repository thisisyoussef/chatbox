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
