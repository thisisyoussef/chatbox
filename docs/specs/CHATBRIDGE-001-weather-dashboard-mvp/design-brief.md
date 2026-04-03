# WD-103 Design Brief

## Story

- Task: `WD-103`
- Scope: Weather Dashboard shell and rendering states
- Runtime: reviewed in-thread ChatBridge app surface

## Audience And Entry Context

- The user just asked for weather inside a normal chat thread.
- They need a quick read on current conditions, short forecast, freshness, and
  whether the host still trusts the snapshot.
- The shell must work inline without feeling like a detached dashboard product
  or a plain text receipt.

## Desired Feeling

- Calm
- Trustworthy
- Explicit about host state
- Readable at a glance

## Feelings To Avoid

- Generic widget soup
- Over-designed marketing chrome
- Hidden stale-state or recovery status
- Provider-centric terminology

## Design-Language Cues

- Weather briefing card, not control panel
- Large current-condition anchor with supporting metadata nearby
- Soft sky-tinted surfaces for healthy states
- Warm caution tint for degraded states
- Rose caution tint for unavailable states

## System Direction

- Keep the existing Chatbox rounded-card language and utility classes.
- Use a split hero: current conditions on one side, host snapshot metadata on
  the other.
- Make freshness text explicit in a dedicated card instead of burying it in the
  summary.
- Give hourly, daily, and alert data separate labeled sections so partial data
  remains legible.

## Layout Metaphor

- Top: one weather briefing header with location, headline, status badge, and
  refresh action.
- Middle: current conditions card plus host snapshot card group.
- Bottom: outlook sections for hourly, daily, and alerts.
- Footer: follow-up summary or degraded recovery notice.

## Copy Direction

- Preserve host-owned language from the shared snapshot contract.
- Use direct placeholder copy for loading and partial-data sections.
- Prefer “host snapshot”, “freshness window”, and “next step” over vague system
  wording.

## Constraints And No-Go Decisions

- Render only normalized snapshot data from
  `src/shared/chatbridge/apps/weather-dashboard.ts`.
- Do not invent provider fields or raw OpenWeather terms.
- Do not change runtime/persistence semantics inside the launch surface unless
  required by missing data.
- Keep the shell responsive inside the existing message container.

## Prompt-Ready Inputs

- Current surface: `src/renderer/components/chatbridge/apps/weather/WeatherDashboardPanel.tsx`
- Runtime boundary: `src/renderer/components/chatbridge/apps/weather/WeatherDashboardLaunchSurface.tsx`
- Shared contract: `src/shared/chatbridge/apps/weather-dashboard.ts`
- Acceptance focus: loading, fresh, partial-data, and degraded views; location
  label clarity; explicit freshness text
