import { z } from 'zod'
import { ChatBridgeSuccessCompletionPayloadSchema, type ChatBridgeSuccessCompletionPayload } from '../completion'
import { isPlausibleWeatherLocation } from '../../weather-dashboard/intent'

export const WEATHER_DASHBOARD_APP_ID = 'weather-dashboard'
export const WEATHER_DASHBOARD_APP_NAME = 'Weather Dashboard'
export const WEATHER_DASHBOARD_SNAPSHOT_SCHEMA_VERSION = 1 as const
export const WEATHER_DASHBOARD_FRESHNESS_MS = 10 * 60 * 1000
export const WEATHER_DASHBOARD_HOURLY_LIMIT = 8
export const WEATHER_DASHBOARD_DAILY_LIMIT = 6
export const WEATHER_DASHBOARD_FORECAST_PREVIEW_LIMIT = 4
export const WEATHER_DASHBOARD_ALERT_LIMIT = 3

export const WeatherDashboardUnitsSchema = z.enum(['imperial', 'metric'])
export type WeatherDashboardUnits = z.infer<typeof WeatherDashboardUnitsSchema>

export const WeatherDashboardStatusSchema = z.enum(['loading', 'ready', 'degraded', 'unavailable'])
export type WeatherDashboardStatus = z.infer<typeof WeatherDashboardStatusSchema>

export const WeatherDashboardCacheStatusSchema = z.enum(['none', 'miss', 'hit', 'refreshed', 'stale-fallback'])
export type WeatherDashboardCacheStatus = z.infer<typeof WeatherDashboardCacheStatusSchema>

export const WeatherDashboardDegradedReasonSchema = z.enum([
  'missing-location',
  'location-not-found',
  'upstream-timeout',
  'upstream-error',
  'invalid-response',
])
export type WeatherDashboardDegradedReason = z.infer<typeof WeatherDashboardDegradedReasonSchema>

export const WeatherDashboardCurrentConditionsSchema = z
  .object({
    temperature: z.number(),
    apparentTemperature: z.number().optional(),
    weatherCode: z.number().int().nonnegative(),
    conditionLabel: z.string().trim().min(1),
    windSpeed: z.number().nonnegative().optional(),
  })
  .strict()
export type WeatherDashboardCurrentConditions = z.infer<typeof WeatherDashboardCurrentConditionsSchema>

export const WeatherDashboardForecastDaySchema = z
  .object({
    dateKey: z.string().trim().min(1),
    dayLabel: z.string().trim().min(1),
    high: z.number(),
    low: z.number(),
    weatherCode: z.number().int().nonnegative(),
    conditionLabel: z.string().trim().min(1),
    precipitationChance: z.number().min(0).max(100).optional(),
  })
  .strict()
export type WeatherDashboardForecastDay = z.infer<typeof WeatherDashboardForecastDaySchema>

export const WeatherDashboardHourlyForecastSchema = z
  .object({
    timeKey: z.string().trim().min(1),
    hourLabel: z.string().trim().min(1),
    temperature: z.number(),
    weatherCode: z.number().int().nonnegative(),
    conditionLabel: z.string().trim().min(1),
    precipitationChance: z.number().min(0).max(100).optional(),
  })
  .strict()
export type WeatherDashboardHourlyForecast = z.infer<typeof WeatherDashboardHourlyForecastSchema>

export const WeatherDashboardAlertSchema = z
  .object({
    source: z.string().trim().min(1),
    event: z.string().trim().min(1),
    startsAt: z.number().int().nonnegative(),
    endsAt: z.number().int().nonnegative().optional(),
    description: z.string().trim().min(1),
    tags: z.array(z.string().trim().min(1)).max(6).default([]),
  })
  .strict()
export type WeatherDashboardAlert = z.infer<typeof WeatherDashboardAlertSchema>

export const WeatherDashboardDegradedStateSchema = z
  .object({
    reason: WeatherDashboardDegradedReasonSchema,
    title: z.string().trim().min(1),
    message: z.string().trim().min(1),
    retryable: z.boolean(),
    usingStaleSnapshot: z.boolean().default(false),
  })
  .strict()
export type WeatherDashboardDegradedState = z.infer<typeof WeatherDashboardDegradedStateSchema>

export const WeatherDashboardSnapshotSchema = z
  .object({
    schemaVersion: z.literal(WEATHER_DASHBOARD_SNAPSHOT_SCHEMA_VERSION),
    appId: z.literal(WEATHER_DASHBOARD_APP_ID),
    request: z.string().trim().min(1).optional(),
    locationQuery: z.string().trim().min(1).optional(),
    locationName: z.string().trim().min(1),
    timezone: z.string().trim().min(1).optional(),
    units: WeatherDashboardUnitsSchema,
    status: WeatherDashboardStatusSchema,
    statusText: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    headline: z.string().trim().min(1),
    dataStateLabel: z.string().trim().min(1),
    lastUpdatedLabel: z.string().trim().min(1),
    sourceLabel: z.string().trim().min(1),
    cacheStatus: WeatherDashboardCacheStatusSchema,
    refreshHint: z.string().trim().min(1),
    fetchedAt: z.number().int().nonnegative(),
    staleAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    current: WeatherDashboardCurrentConditionsSchema.optional(),
    hourly: z.array(WeatherDashboardHourlyForecastSchema).max(WEATHER_DASHBOARD_HOURLY_LIMIT).default([]),
    daily: z.array(WeatherDashboardForecastDaySchema).max(WEATHER_DASHBOARD_DAILY_LIMIT).default([]),
    alerts: z.array(WeatherDashboardAlertSchema).max(WEATHER_DASHBOARD_ALERT_LIMIT).default([]),
    forecast: z.array(WeatherDashboardForecastDaySchema).max(WEATHER_DASHBOARD_FORECAST_PREVIEW_LIMIT).default([]),
    degraded: WeatherDashboardDegradedStateSchema.optional(),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    if (snapshot.staleAt < snapshot.fetchedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'staleAt cannot be earlier than fetchedAt',
        path: ['staleAt'],
      })
    }
  })
export type WeatherDashboardSnapshot = z.infer<typeof WeatherDashboardSnapshotSchema>

export const ChatBridgeWeatherDashboardQuerySchema = z
  .object({
    request: z.string().trim().min(1).optional(),
    location: z.string().trim().min(1).optional(),
    units: WeatherDashboardUnitsSchema.optional(),
    refresh: z.boolean().default(false),
    traceParentRunId: z.string().trim().min(1).optional(),
  })
  .strict()
export type ChatBridgeWeatherDashboardQuery = z.infer<typeof ChatBridgeWeatherDashboardQuerySchema>

export const ChatBridgeWeatherDashboardResultSchema = z
  .object({
    snapshot: WeatherDashboardSnapshotSchema,
  })
  .strict()
export type ChatBridgeWeatherDashboardResult = z.infer<typeof ChatBridgeWeatherDashboardResultSchema>

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Heavy showers',
  82: 'Violent showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm and hail',
  99: 'Severe thunderstorm and hail',
  200: 'Thunderstorm',
  201: 'Thunderstorm with rain',
  202: 'Heavy thunderstorm',
  230: 'Thunderstorm with drizzle',
  300: 'Light drizzle',
  301: 'Drizzle',
  302: 'Heavy drizzle',
  500: 'Light rain',
  501: 'Moderate rain',
  502: 'Heavy rain',
  511: 'Freezing rain',
  520: 'Rain showers',
  600: 'Light snow',
  601: 'Snow',
  602: 'Heavy snow',
  701: 'Mist',
  711: 'Smoke',
  721: 'Haze',
  741: 'Fog',
  800: 'Clear sky',
  801: 'Few clouds',
  802: 'Scattered clouds',
  803: 'Broken clouds',
  804: 'Overcast',
}

function capitalizeWords(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function stripTrailingForecastPhrases(value: string) {
  return value
    .replace(/\b(?:and\s+show(?:\s+me)?|and\s+give(?:\s+me)?|and\s+tell(?:\s+me)?|and\s+open)\b.*$/gi, '')
    .replace(/\b(weather|forecast|temperature|conditions|today|tonight|tomorrow|right now|this week|this weekend)\b/gi, '')
    .replace(/\b(open|show|launch|check|tell me|give me|dashboard)\b/gi, '')
    .replace(/\band\b$/i, '')
    .replace(/\b(in|for|at|near)\b$/i, '')
}

function trimLeadingFiller(value: string) {
  return value
    .replace(/^(what(?:'s| is)|show me|tell me|give me|open|launch|check|can you show me|could you show me)\s+/i, '')
    .replace(/^(the\s+)?weather(\s+dashboard)?\s+/i, '')
}

export function normalizeWeatherLocationHint(location?: string, request?: string) {
  const explicitLocation = location?.trim()
  if (explicitLocation && isPlausibleWeatherLocation(explicitLocation)) {
    return explicitLocation
  }

  const normalizedRequest = normalizeWhitespace(request ?? '')
  if (!normalizedRequest) {
    return undefined
  }

  const patterns = [
    /\b(?:weather|forecast|conditions)\s+(?:in|for|at|near)\s+(.+?)(?:[?.!,]|$)/i,
    /\bopen\s+weather\s+dashboard\s+(?:in|for|at|near)\s+(.+?)(?:[?.!,]|$)/i,
    /\bshow\s+me\s+(?:the\s+)?(?:weather|forecast)\s+(?:in|for|at|near)\s+(.+?)(?:[?.!,]|$)/i,
    /^(.+?)\s+(?:weather|forecast|conditions)(?:[?.!,]|$)/i,
  ]

  for (const pattern of patterns) {
    const match = normalizedRequest.match(pattern)
    const candidate = match?.[1] ? stripTrailingForecastPhrases(match[1]) : ''
    const cleaned = normalizeWhitespace(candidate)
    if (cleaned && isPlausibleWeatherLocation(cleaned)) {
      return capitalizeWords(cleaned)
    }
  }

  const simplified = stripTrailingForecastPhrases(trimLeadingFiller(normalizedRequest))
  const fallback = normalizeWhitespace(simplified)
  return fallback.length >= 2 && isPlausibleWeatherLocation(fallback) ? capitalizeWords(fallback) : undefined
}

export function resolveWeatherUnits(request?: string, units?: WeatherDashboardUnits) {
  if (units) {
    return units
  }

  const normalizedRequest = normalizeWhitespace(request ?? '').toLowerCase()
  if (/\b(celsius|metric|centigrade|km\/h|kph)\b/.test(normalizedRequest)) {
    return 'metric'
  }

  if (/\b(fahrenheit|imperial|mph)\b/.test(normalizedRequest)) {
    return 'imperial'
  }

  return 'imperial'
}

export function getWeatherConditionLabel(weatherCode: number) {
  return WEATHER_CODE_LABELS[weatherCode] ?? 'Unknown conditions'
}

export function normalizeWeatherConditionLabel(weatherCode: number, description?: string) {
  const explicitDescription = normalizeWhitespace(description ?? '')
  if (explicitDescription) {
    return capitalizeWords(explicitDescription)
  }

  return getWeatherConditionLabel(weatherCode)
}

export function formatWeatherTemperature(value: number, units: WeatherDashboardUnits) {
  return `${Math.round(value)}°${units === 'imperial' ? 'F' : 'C'}`
}

export function formatWeatherWindSpeed(value: number, units: WeatherDashboardUnits) {
  return `${Math.round(value)} ${units === 'imperial' ? 'mph' : 'km/h'}`
}

function parseWeatherTimezoneOffset(timezone?: string) {
  if (!timezone) {
    return null
  }

  const match = /^([+-])(\d{2}):(\d{2})$/.exec(timezone.trim())
  if (!match) {
    return null
  }

  const [, sign, hoursText, minutesText] = match
  const totalMinutes = Number(hoursText) * 60 + Number(minutesText)
  const direction = sign === '+' ? 1 : -1
  return direction * totalMinutes * 60 * 1000
}

function formatWeatherTimezoneLabel(timezone: string) {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(timezone.trim())
  if (!match) {
    return timezone
  }

  const [, sign, hoursText, minutesText] = match
  const hours = String(Number(hoursText))
  return minutesText === '00' ? `GMT${sign}${hours}` : `GMT${sign}${hours}:${minutesText}`
}

function formatWeatherTimestamp(
  timestamp: number,
  options: Intl.DateTimeFormatOptions,
  timezone?: string
) {
  const offsetMs = parseWeatherTimezoneOffset(timezone)

  if (offsetMs !== null) {
    return `${new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: 'UTC',
    }).format(timestamp + offsetMs)} ${formatWeatherTimezoneLabel(timezone!)}`
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: timezone,
      timeZoneName: timezone ? 'short' : undefined,
    }).format(timestamp)
  } catch {
    return new Intl.DateTimeFormat('en-US', options).format(timestamp)
  }
}

export function formatWeatherUpdatedAt(updatedAt: number, timezone?: string) {
  return formatWeatherTimestamp(
    updatedAt,
    {
      hour: 'numeric',
      minute: '2-digit',
    },
    timezone
  )
}

export function formatWeatherAlertTime(timestamp: number, timezone?: string) {
  return formatWeatherTimestamp(
    timestamp,
    {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    },
    timezone
  )
}

export function isWeatherDashboardSnapshotStale(
  snapshot: Pick<WeatherDashboardSnapshot, 'fetchedAt' | 'staleAt'>,
  options: { now?: number } = {}
) {
  const now = options.now ?? Date.now()
  return snapshot.staleAt <= now
}

function resolveWeatherFreshnessWindow(input: {
  fetchedAt?: number
  staleAt?: number
  updatedAt?: number
}) {
  const fetchedAt = input.fetchedAt ?? input.updatedAt ?? Date.now()
  const staleAt = input.staleAt ?? fetchedAt + WEATHER_DASHBOARD_FRESHNESS_MS

  return {
    fetchedAt,
    staleAt,
  }
}

function buildWeatherFreshnessLabel(
  freshness: { fetchedAt: number; staleAt: number },
  timezone?: string,
  referenceTime = Date.now()
) {
  const updatedAtLabel = formatWeatherUpdatedAt(freshness.fetchedAt, timezone)
  const staleAtLabel = formatWeatherUpdatedAt(freshness.staleAt, timezone)

  if (freshness.staleAt <= referenceTime) {
    return `Updated ${updatedAtLabel} · freshness window passed at ${staleAtLabel}`
  }

  return `Updated ${updatedAtLabel} · fresh until ${staleAtLabel}`
}

function buildReadyStatusText(cacheStatus: WeatherDashboardCacheStatus) {
  if (cacheStatus === 'hit') {
    return 'Using cached weather'
  }

  if (cacheStatus === 'refreshed') {
    return 'Weather refreshed'
  }

  return 'Live weather'
}

function buildReadyDataStateLabel(cacheStatus: WeatherDashboardCacheStatus) {
  if (cacheStatus === 'hit') {
    return 'Host cache hit'
  }

  if (cacheStatus === 'refreshed') {
    return 'Fresh upstream refresh'
  }

  return 'Fresh host snapshot'
}

function normalizeWeatherReadyCacheStatus(
  cacheStatus: WeatherDashboardCacheStatus | undefined
): Extract<WeatherDashboardCacheStatus, 'miss' | 'hit' | 'refreshed'> {
  if (cacheStatus === 'hit' || cacheStatus === 'refreshed') {
    return cacheStatus
  }

  return 'miss'
}

function getWeatherSnapshotHeadline(snapshot: Pick<WeatherDashboardSnapshot, 'current' | 'headline' | 'units'>) {
  if (snapshot.current) {
    return `${formatWeatherTemperature(snapshot.current.temperature, snapshot.units)} and ${snapshot.current.conditionLabel}`
  }

  return normalizeWhitespace(snapshot.headline)
}

type CreateWeatherDashboardReadySnapshotInput = {
  request?: string
  locationQuery?: string
  locationName: string
  timezone?: string
  units: WeatherDashboardUnits
  current: WeatherDashboardCurrentConditions
  hourly?: WeatherDashboardHourlyForecast[]
  daily?: WeatherDashboardForecastDay[]
  alerts?: WeatherDashboardAlert[]
  forecast?: WeatherDashboardForecastDay[]
  fetchedAt?: number
  staleAt?: number
  updatedAt?: number
  cacheStatus?: Extract<WeatherDashboardCacheStatus, 'miss' | 'hit' | 'refreshed'>
  referenceTime?: number
}

export function createWeatherDashboardReadySnapshot(
  input: CreateWeatherDashboardReadySnapshotInput
): WeatherDashboardSnapshot {
  const freshness = resolveWeatherFreshnessWindow(input)
  const referenceTime = input.referenceTime ?? Date.now()
  const hourly = (input.hourly ?? []).slice(0, WEATHER_DASHBOARD_HOURLY_LIMIT)
  const daily = (input.daily ?? input.forecast ?? []).slice(0, WEATHER_DASHBOARD_DAILY_LIMIT)
  const forecast = (input.forecast ?? daily).slice(0, WEATHER_DASHBOARD_FORECAST_PREVIEW_LIMIT)
  const currentLine = `${formatWeatherTemperature(input.current.temperature, input.units)} and ${input.current.conditionLabel}`
  const feelsLikeLine =
    typeof input.current.apparentTemperature === 'number'
      ? `Feels like ${formatWeatherTemperature(input.current.apparentTemperature, input.units)}.`
      : ''
  const windLine =
    typeof input.current.windSpeed === 'number'
      ? `Wind ${formatWeatherWindSpeed(input.current.windSpeed, input.units)}.`
      : ''
  const forecastLine =
    forecast.length > 0
      ? `Next ${forecast.length} days: ${forecast
          .map(
            (day) =>
              `${day.dayLabel} ${formatWeatherTemperature(day.high, input.units)}/${formatWeatherTemperature(day.low, input.units)} ${day.conditionLabel}`
          )
          .join('; ')}.`
      : 'Short forecast is not available yet.'
  const hourlyLine =
    hourly.length > 0
      ? `Next ${hourly.length} hours: ${hourly
          .map(
            (hour) =>
              `${hour.hourLabel} ${formatWeatherTemperature(hour.temperature, input.units)} ${hour.conditionLabel}`
          )
          .join('; ')}.`
      : 'Hourly outlook is not available yet.'
  const alertLine =
    (input.alerts ?? []).length > 0
      ? `Active alerts: ${(input.alerts ?? [])
          .slice(0, WEATHER_DASHBOARD_ALERT_LIMIT)
          .map((alert) => `${alert.event} from ${alert.source}`)
          .join('; ')}.`
      : 'No active weather alerts.'

  const cacheStatus = input.cacheStatus ?? 'miss'
  const stale = freshness.staleAt <= referenceTime

  return WeatherDashboardSnapshotSchema.parse({
    schemaVersion: WEATHER_DASHBOARD_SNAPSHOT_SCHEMA_VERSION,
    appId: WEATHER_DASHBOARD_APP_ID,
    request: input.request?.trim() || undefined,
    locationQuery: input.locationQuery?.trim() || undefined,
    locationName: input.locationName,
    timezone: input.timezone,
    units: input.units,
    status: 'ready',
    statusText: stale ? 'Weather may be stale' : buildReadyStatusText(cacheStatus),
    summary: `Weather Dashboard is active for ${input.locationName}. Current conditions are ${currentLine}. ${feelsLikeLine} ${windLine} ${hourlyLine} ${forecastLine} ${alertLine} ${stale ? 'This snapshot is older than the host freshness window.' : `Freshness window lasts until ${formatWeatherUpdatedAt(freshness.staleAt, input.timezone)}.`}`.replace(
      /\s+/g,
      ' '
    ).trim(),
    headline: currentLine,
    dataStateLabel: stale ? 'Host snapshot stale' : buildReadyDataStateLabel(cacheStatus),
    lastUpdatedLabel: buildWeatherFreshnessLabel(freshness, input.timezone, referenceTime),
    sourceLabel: 'Host weather boundary',
    cacheStatus,
    refreshHint: stale
      ? 'Refresh weather because this snapshot is older than the host freshness window.'
      : 'Refresh weather to recheck the host-owned upstream snapshot.',
    fetchedAt: freshness.fetchedAt,
    staleAt: freshness.staleAt,
    updatedAt: freshness.fetchedAt,
    current: input.current,
    hourly,
    daily,
    alerts: (input.alerts ?? []).slice(0, WEATHER_DASHBOARD_ALERT_LIMIT),
    forecast,
  })
}

type CreateWeatherDashboardLoadingSnapshotInput = {
  request?: string
  locationQuery?: string
  units?: WeatherDashboardUnits
  fetchedAt?: number
  staleAt?: number
  updatedAt?: number
}

export function createWeatherDashboardLoadingSnapshot(
  input: CreateWeatherDashboardLoadingSnapshotInput = {}
): WeatherDashboardSnapshot {
  const freshness = resolveWeatherFreshnessWindow(input)
  const locationName = input.locationQuery?.trim() || 'Resolving location'

  return WeatherDashboardSnapshotSchema.parse({
    schemaVersion: WEATHER_DASHBOARD_SNAPSHOT_SCHEMA_VERSION,
    appId: WEATHER_DASHBOARD_APP_ID,
    request: input.request?.trim() || undefined,
    locationQuery: input.locationQuery?.trim() || undefined,
    locationName,
    units: input.units ?? resolveWeatherUnits(input.request),
    status: 'loading',
    statusText: 'Loading weather',
    summary: `Weather Dashboard is requesting a host-owned weather snapshot for ${locationName}.`,
    headline: 'Fetching latest conditions',
    dataStateLabel: 'Host fetch in progress',
    lastUpdatedLabel: 'Waiting for upstream data',
    sourceLabel: 'Host weather boundary',
    cacheStatus: 'none',
    refreshHint: 'Weather details will appear here after the host finishes fetching them.',
    fetchedAt: freshness.fetchedAt,
    staleAt: freshness.staleAt,
    updatedAt: freshness.fetchedAt,
    hourly: [],
    daily: [],
    alerts: [],
    forecast: [],
  })
}

type CreateWeatherDashboardUnavailableSnapshotInput = {
  request?: string
  locationQuery?: string
  units?: WeatherDashboardUnits
  fetchedAt?: number
  staleAt?: number
  updatedAt?: number
  reason: Extract<WeatherDashboardDegradedReason, 'missing-location' | 'location-not-found'>
}

export function createWeatherDashboardUnavailableSnapshot(
  input: CreateWeatherDashboardUnavailableSnapshotInput
): WeatherDashboardSnapshot {
  const freshness = resolveWeatherFreshnessWindow(input)
  const locationName = input.locationQuery?.trim() || 'Weather Dashboard'
  const degraded =
    input.reason === 'missing-location'
      ? {
          reason: 'missing-location' as const,
          title: 'Location needed',
          message: 'Weather Dashboard needs a clearer city or place before the host can fetch weather safely.',
          retryable: true,
          usingStaleSnapshot: false,
        }
      : {
          reason: 'location-not-found' as const,
          title: 'Location not found',
          message: 'The host could not match that weather request to a real place. Try a clearer city, region, or country.',
          retryable: true,
          usingStaleSnapshot: false,
        }

  return WeatherDashboardSnapshotSchema.parse({
    schemaVersion: WEATHER_DASHBOARD_SNAPSHOT_SCHEMA_VERSION,
    appId: WEATHER_DASHBOARD_APP_ID,
    request: input.request?.trim() || undefined,
    locationQuery: input.locationQuery?.trim() || undefined,
    locationName,
    units: input.units ?? resolveWeatherUnits(input.request),
    status: 'unavailable',
    statusText: degraded.title,
    summary: `${WEATHER_DASHBOARD_APP_NAME} is waiting for a usable location before the host can fetch weather data.`,
    headline: degraded.title,
    dataStateLabel: 'Awaiting valid location',
    lastUpdatedLabel: 'No host snapshot available',
    sourceLabel: 'Host weather boundary',
    cacheStatus: 'none',
    refreshHint: 'Ask for weather in a clearer city or region to retry.',
    fetchedAt: freshness.fetchedAt,
    staleAt: freshness.staleAt,
    updatedAt: freshness.fetchedAt,
    hourly: [],
    daily: [],
    alerts: [],
    forecast: [],
    degraded,
  })
}

type CreateWeatherDashboardDegradedSnapshotInput = {
  request?: string
  locationQuery?: string
  locationName: string
  timezone?: string
  units: WeatherDashboardUnits
  degraded: WeatherDashboardDegradedState
  hourly?: WeatherDashboardHourlyForecast[]
  daily?: WeatherDashboardForecastDay[]
  alerts?: WeatherDashboardAlert[]
  fetchedAt?: number
  staleAt?: number
  updatedAt?: number
  current?: WeatherDashboardCurrentConditions
  forecast?: WeatherDashboardForecastDay[]
  referenceTime?: number
}

export function createWeatherDashboardDegradedSnapshot(
  input: CreateWeatherDashboardDegradedSnapshotInput
): WeatherDashboardSnapshot {
  const freshness = resolveWeatherFreshnessWindow(input)
  const referenceTime = input.referenceTime ?? Date.now()
  const hourly = (input.hourly ?? []).slice(0, WEATHER_DASHBOARD_HOURLY_LIMIT)
  const daily = (input.daily ?? input.forecast ?? []).slice(0, WEATHER_DASHBOARD_DAILY_LIMIT)
  const forecast = (input.forecast ?? daily).slice(0, WEATHER_DASHBOARD_FORECAST_PREVIEW_LIMIT)
  const alerts = (input.alerts ?? []).slice(0, WEATHER_DASHBOARD_ALERT_LIMIT)
  const staleSummary =
    input.degraded.usingStaleSnapshot && input.current
      ? `The host kept the last good snapshot for ${input.locationName}: ${formatWeatherTemperature(input.current.temperature, input.units)} and ${input.current.conditionLabel}.`
      : `The host could not load fresh weather for ${input.locationName}.`

  return WeatherDashboardSnapshotSchema.parse({
    schemaVersion: WEATHER_DASHBOARD_SNAPSHOT_SCHEMA_VERSION,
    appId: WEATHER_DASHBOARD_APP_ID,
    request: input.request?.trim() || undefined,
    locationQuery: input.locationQuery?.trim() || undefined,
    locationName: input.locationName,
    timezone: input.timezone,
    units: input.units,
    status: 'degraded',
    statusText: input.degraded.usingStaleSnapshot ? 'Showing cached snapshot' : input.degraded.title,
    summary: `${staleSummary} ${input.degraded.message}`.replace(/\s+/g, ' ').trim(),
    headline: input.degraded.usingStaleSnapshot ? 'Fresh weather unavailable' : input.degraded.title,
    dataStateLabel: input.degraded.usingStaleSnapshot ? 'Using last good host snapshot' : 'Upstream weather unavailable',
    lastUpdatedLabel:
      input.degraded.usingStaleSnapshot && input.current
        ? buildWeatherFreshnessLabel(freshness, input.timezone, referenceTime)
        : 'No fresh host snapshot available',
    sourceLabel: 'Host weather boundary',
    cacheStatus: input.degraded.usingStaleSnapshot ? 'stale-fallback' : 'none',
    refreshHint: input.degraded.retryable
      ? 'Refresh weather to ask the host for a new upstream snapshot.'
      : 'Adjust the request and try again.',
    fetchedAt: freshness.fetchedAt,
    staleAt: freshness.staleAt,
    updatedAt: freshness.fetchedAt,
    current: input.current,
    hourly,
    daily,
    alerts,
    forecast,
    degraded: input.degraded,
  })
}

function normalizeWeatherDashboardSnapshotForReferenceTime(
  snapshot: WeatherDashboardSnapshot,
  referenceTime: number
): WeatherDashboardSnapshot {
  if (snapshot.status === 'ready' && snapshot.current) {
    return createWeatherDashboardReadySnapshot({
      request: snapshot.request,
      locationQuery: snapshot.locationQuery,
      locationName: snapshot.locationName,
      timezone: snapshot.timezone,
      units: snapshot.units,
      current: snapshot.current,
      hourly: snapshot.hourly,
      daily: snapshot.daily,
      alerts: snapshot.alerts,
      forecast: snapshot.forecast,
      fetchedAt: snapshot.fetchedAt,
      staleAt: snapshot.staleAt,
      updatedAt: snapshot.updatedAt,
      cacheStatus: normalizeWeatherReadyCacheStatus(snapshot.cacheStatus),
      referenceTime,
    })
  }

  if (snapshot.status === 'degraded' && snapshot.degraded) {
    return createWeatherDashboardDegradedSnapshot({
      request: snapshot.request,
      locationQuery: snapshot.locationQuery,
      locationName: snapshot.locationName,
      timezone: snapshot.timezone,
      units: snapshot.units,
      degraded: snapshot.degraded,
      hourly: snapshot.hourly,
      daily: snapshot.daily,
      alerts: snapshot.alerts,
      fetchedAt: snapshot.fetchedAt,
      staleAt: snapshot.staleAt,
      updatedAt: snapshot.updatedAt,
      current: snapshot.current,
      forecast: snapshot.forecast,
      referenceTime,
    })
  }

  return snapshot
}

function hasMatchingWeatherLocation(snapshot: WeatherDashboardSnapshot, fallbackSnapshot: WeatherDashboardSnapshot) {
  const snapshotLocation = normalizeWhitespace(snapshot.locationQuery ?? snapshot.locationName).toLowerCase()
  const fallbackLocation = normalizeWhitespace(fallbackSnapshot.locationQuery ?? fallbackSnapshot.locationName).toLowerCase()
  return Boolean(snapshotLocation) && snapshotLocation === fallbackLocation
}

export function reconcileWeatherDashboardSnapshot(
  snapshot: WeatherDashboardSnapshot,
  options: {
    referenceTime?: number
    fallbackSnapshot?: WeatherDashboardSnapshot | null
  } = {}
): WeatherDashboardSnapshot {
  const referenceTime = options.referenceTime ?? Date.now()
  const normalizedSnapshot = normalizeWeatherDashboardSnapshotForReferenceTime(snapshot, referenceTime)
  const fallbackSnapshot = options.fallbackSnapshot
    ? normalizeWeatherDashboardSnapshotForReferenceTime(options.fallbackSnapshot, referenceTime)
    : null

  if (
    normalizedSnapshot.status !== 'degraded' ||
    !normalizedSnapshot.degraded ||
    normalizedSnapshot.degraded.usingStaleSnapshot ||
    !fallbackSnapshot?.current ||
    !hasMatchingWeatherLocation(normalizedSnapshot, fallbackSnapshot)
  ) {
    return normalizedSnapshot
  }

  return createWeatherDashboardDegradedSnapshot({
    request: normalizedSnapshot.request ?? fallbackSnapshot.request,
    locationQuery: fallbackSnapshot.locationQuery ?? normalizedSnapshot.locationQuery,
    locationName: fallbackSnapshot.locationName,
    timezone: fallbackSnapshot.timezone ?? normalizedSnapshot.timezone,
    units: fallbackSnapshot.units,
    degraded: {
      ...normalizedSnapshot.degraded,
      usingStaleSnapshot: true,
    },
    current: fallbackSnapshot.current,
    hourly: fallbackSnapshot.hourly,
    daily: fallbackSnapshot.daily,
    alerts: fallbackSnapshot.alerts,
    forecast: fallbackSnapshot.forecast,
    fetchedAt: fallbackSnapshot.fetchedAt,
    staleAt: fallbackSnapshot.staleAt,
    updatedAt: fallbackSnapshot.updatedAt,
    referenceTime,
  })
}

export function createWeatherDashboardCloseCompletion(
  snapshot: WeatherDashboardSnapshot
): ChatBridgeSuccessCompletionPayload {
  const headline = getWeatherSnapshotHeadline(snapshot) || snapshot.statusText
  const summaryText = normalizeWhitespace(
    `Weather Dashboard closed for ${snapshot.locationName}. Last visible host weather was ${headline}. Host state at close: ${snapshot.dataStateLabel}. ${snapshot.lastUpdatedLabel}. later chat should treat this as the last validated host snapshot until the dashboard is reopened or refreshed.`
  )

  return ChatBridgeSuccessCompletionPayloadSchema.parse({
    schemaVersion: 1,
    status: 'success',
    outcomeData: {
      locationName: snapshot.locationName,
      snapshotStatus: snapshot.status,
      cacheStatus: snapshot.cacheStatus,
      ...(snapshot.locationQuery ? { locationQuery: snapshot.locationQuery } : {}),
      statusText: snapshot.statusText,
    },
    suggestedSummary: {
      title: 'Weather Dashboard handoff',
      text: summaryText,
    },
  })
}
