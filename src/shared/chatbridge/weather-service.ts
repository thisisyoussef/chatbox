import { z } from 'zod'
import {
  WEATHER_DASHBOARD_ALERT_LIMIT,
  WEATHER_DASHBOARD_DAILY_LIMIT,
  ChatBridgeWeatherDashboardQuerySchema,
  ChatBridgeWeatherDashboardResultSchema,
  WEATHER_DASHBOARD_FRESHNESS_MS,
  WEATHER_DASHBOARD_HOURLY_LIMIT,
  createWeatherDashboardDegradedSnapshot,
  createWeatherDashboardReadySnapshot,
  createWeatherDashboardUnavailableSnapshot,
  isWeatherDashboardSnapshotStale,
  normalizeWeatherLocationHint,
  normalizeWeatherConditionLabel,
  resolveWeatherUnits,
  type ChatBridgeWeatherDashboardResult,
  type WeatherDashboardAlert,
  type WeatherDashboardCurrentConditions,
  type WeatherDashboardForecastDay,
  type WeatherDashboardHourlyForecast,
  type WeatherDashboardSnapshot,
} from './apps/weather-dashboard'
import { createNoopLangSmithAdapter, type LangSmithAdapter } from '../utils/langsmith_adapter'

type FetchLike = typeof fetch

export type CreateChatBridgeWeatherServiceOptions = {
  fetch?: FetchLike
  now?: () => number
  cacheTtlMs?: number
  freshnessMs?: number
  apiKey?: string
  traceAdapter?: LangSmithAdapter
}

type CachedWeatherSnapshot = {
  snapshot: WeatherDashboardSnapshot
  expiresAt: number
}

type OpenWeatherGeocodeResult = {
  latitude: number
  longitude: number
  name: string
  country?: string
  state?: string
}

const OPENWEATHER_GEOCODE_URL = 'https://api.openweathermap.org/geo/1.0/direct'
const OPENWEATHER_CURRENT_WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'
const OPENWEATHER_FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast'
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000
const DEFAULT_TIMEOUT_MS = 6_000

const OpenWeatherGeocodeResponseSchema = z.array(
  z
    .object({
      lat: z.number(),
      lon: z.number(),
      name: z.string().trim().min(1),
      country: z.string().trim().min(1).optional(),
      state: z.string().trim().min(1).optional(),
    })
    .passthrough()
)

const OpenWeatherConditionSchema = z
  .object({
    id: z.number().int().nonnegative(),
    description: z.string().trim().min(1).optional(),
  })
  .passthrough()

const OpenWeatherCurrentWeatherResponseSchema = z
  .object({
    timezone: z.number().int().optional(),
    main: z
      .object({
        temp: z.number(),
        feels_like: z.number().optional(),
      })
      .passthrough(),
    wind: z
      .object({
        speed: z.number().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
    weather: z.array(OpenWeatherConditionSchema).min(1),
  })
  .passthrough()

const OpenWeatherForecastListItemSchema = z
  .object({
    dt: z.number().int().nonnegative(),
    main: z
      .object({
        temp: z.number(),
        temp_min: z.number().optional(),
        temp_max: z.number().optional(),
      })
      .passthrough(),
    pop: z.number().min(0).max(1).optional(),
    weather: z.array(OpenWeatherConditionSchema).min(1),
  })
  .passthrough()

type OpenWeatherForecastListItem = z.infer<typeof OpenWeatherForecastListItemSchema>

const OpenWeatherForecastResponseSchema = z
  .object({
    list: z.array(OpenWeatherForecastListItemSchema).default([]),
    city: z
      .object({
        timezone: z.number().int().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

class WeatherGatewayError extends Error {
  public readonly code: 'upstream-timeout' | 'upstream-error' | 'invalid-response'

  constructor(code: 'upstream-timeout' | 'upstream-error' | 'invalid-response', message: string) {
    super(message)
    this.code = code
  }
}

function createCacheKey(location: string, units: ReturnType<typeof resolveWeatherUnits>) {
  return `${units}:${location.trim().toLowerCase()}`
}

function composeLocationName(location: OpenWeatherGeocodeResult) {
  return [location.name, location.state, location.country].filter(Boolean).join(', ')
}

function normalizeCountryName(country?: string) {
  if (!country) {
    return undefined
  }

  try {
    const displayName = new Intl.DisplayNames(['en'], { type: 'region' }).of(country.toUpperCase())
    return displayName ?? country
  } catch {
    return country
  }
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeoutId),
  }
}

async function fetchJson(fetchImpl: FetchLike, url: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const { signal, dispose } = createTimeoutSignal(timeoutMs)

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      signal,
    })

    if (!response.ok) {
      const details = await response.text().catch(() => '')
      throw new WeatherGatewayError(
        'upstream-error',
        `Weather provider returned ${response.status}${details ? `: ${details}` : ''}`
      )
    }

    return await response.json()
  } catch (error) {
    if (error instanceof WeatherGatewayError) {
      throw error
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new WeatherGatewayError('upstream-timeout', 'Weather provider timed out before the host received a response.')
    }

    throw new WeatherGatewayError(
      'upstream-error',
      error instanceof Error ? error.message : 'Weather provider request failed.'
    )
  } finally {
    dispose()
  }
}

function normalizeGeocodeResult(payload: unknown) {
  const parsed = OpenWeatherGeocodeResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new WeatherGatewayError('invalid-response', 'Weather location lookup returned an invalid response shape.')
  }

  const result = parsed.data[0]
  if (!result) {
    return null
  }

  return {
    latitude: result.lat,
    longitude: result.lon,
    name: result.name,
    country: normalizeCountryName(result.country),
    state: result.state,
  } satisfies OpenWeatherGeocodeResult
}

function toPercent(probability?: number) {
  return typeof probability === 'number' ? Math.round(probability * 100) : undefined
}

function toDateKey(timestampMs: number) {
  return new Date(timestampMs).toISOString().slice(0, 10)
}

function formatTimezoneOffset(timezoneOffsetSeconds: number) {
  const totalMinutes = Math.round(timezoneOffsetSeconds / 60)
  const sign = totalMinutes >= 0 ? '+' : '-'
  const absoluteMinutes = Math.abs(totalMinutes)
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0')
  const minutes = String(absoluteMinutes % 60).padStart(2, '0')
  return `${sign}${hours}:${minutes}`
}

function toOffsetDateKey(timestampMs: number, timezoneOffsetSeconds: number) {
  return toDateKey(timestampMs + timezoneOffsetSeconds * 1000)
}

function toOffsetTimestampMs(timestampMs: number, timezoneOffsetSeconds: number) {
  return timestampMs + timezoneOffsetSeconds * 1000
}

function toOffsetHour(timestampMs: number, timezoneOffsetSeconds: number) {
  return new Date(toOffsetTimestampMs(timestampMs, timezoneOffsetSeconds)).getUTCHours()
}

function toTemperatureBounds(entry: OpenWeatherForecastListItem) {
  return {
    low: entry.main.temp_min ?? entry.main.temp,
    high: entry.main.temp_max ?? entry.main.temp,
  }
}

function resolveRepresentativeForecastEntry(
  current: {
    entry: OpenWeatherForecastListItem
    localHourDistance: number
    precipitationChance?: number
  },
  candidate: {
    entry: OpenWeatherForecastListItem
    localHourDistance: number
    precipitationChance?: number
  }
) {
  if (candidate.localHourDistance < current.localHourDistance) {
    return candidate
  }

  if (candidate.localHourDistance > current.localHourDistance) {
    return current
  }

  return (candidate.precipitationChance ?? 0) > (current.precipitationChance ?? 0) ? candidate : current
}

function normalizeForecastSnapshot(
  payload: {
    current: unknown
    forecast: unknown
  }
): {
  timezone: string
  current: WeatherDashboardCurrentConditions
  hourly: WeatherDashboardHourlyForecast[]
  daily: WeatherDashboardForecastDay[]
  alerts: WeatherDashboardAlert[]
} {
  const parsedCurrent = OpenWeatherCurrentWeatherResponseSchema.safeParse(payload.current)
  if (!parsedCurrent.success) {
    throw new WeatherGatewayError('invalid-response', 'Weather current conditions response failed schema validation.')
  }

  const parsedForecast = OpenWeatherForecastResponseSchema.safeParse(payload.forecast)
  if (!parsedForecast.success) {
    throw new WeatherGatewayError('invalid-response', 'Weather forecast response failed schema validation.')
  }

  const currentWeather = parsedCurrent.data
  const forecast = parsedForecast.data
  const currentCondition = currentWeather.weather[0]
  if (!currentCondition) {
    throw new WeatherGatewayError('invalid-response', 'Weather forecast response did not include current conditions.')
  }

  const timezoneOffsetSeconds = currentWeather.timezone ?? forecast.city?.timezone ?? 0
  const timezone = formatTimezoneOffset(timezoneOffsetSeconds)

  const current: WeatherDashboardCurrentConditions = {
    temperature: currentWeather.main.temp,
    apparentTemperature: currentWeather.main.feels_like,
    weatherCode: currentCondition.id,
    conditionLabel: normalizeWeatherConditionLabel(currentCondition.id, currentCondition.description),
    windSpeed: currentWeather.wind?.speed,
  }

  const hourlyFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    timeZone: 'UTC',
  })

  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  })

  const hourlyForecast: WeatherDashboardHourlyForecast[] = forecast.list
    .slice(0, WEATHER_DASHBOARD_HOURLY_LIMIT)
    .map((hour) => {
      const condition = hour.weather[0]
      if (!condition) {
        throw new WeatherGatewayError('invalid-response', 'Hourly weather row did not include a weather condition.')
      }

      const timestampMs = hour.dt * 1000

      return {
        timeKey: new Date(timestampMs).toISOString(),
        hourLabel: hourlyFormatter.format(toOffsetTimestampMs(timestampMs, timezoneOffsetSeconds)),
        temperature: hour.main.temp,
        weatherCode: condition.id,
        conditionLabel: normalizeWeatherConditionLabel(condition.id, condition.description),
        precipitationChance: toPercent(hour.pop),
      }
    })

  const dailyBuckets = new Map<
    string,
    {
      representative: {
        entry: OpenWeatherForecastListItem
        localHourDistance: number
        precipitationChance?: number
      }
      high: number
      low: number
      precipitationChance?: number
      timestampMs: number
    }
  >()

  for (const entry of forecast.list) {
    const condition = entry.weather[0]
    if (!condition) {
      throw new WeatherGatewayError('invalid-response', 'Daily weather row did not include a weather condition.')
    }

    const timestampMs = entry.dt * 1000
    const dateKey = toOffsetDateKey(timestampMs, timezoneOffsetSeconds)
    const localHourDistance = Math.abs(toOffsetHour(timestampMs, timezoneOffsetSeconds) - 12)
    const temperatures = toTemperatureBounds(entry)
    const representative = {
      entry,
      localHourDistance,
      precipitationChance: entry.pop,
    }
    const existing = dailyBuckets.get(dateKey)

    if (!existing) {
      dailyBuckets.set(dateKey, {
        representative,
        high: temperatures.high,
        low: temperatures.low,
        precipitationChance: entry.pop,
        timestampMs,
      })
      continue
    }

    existing.representative = resolveRepresentativeForecastEntry(existing.representative, representative)
    existing.high = Math.max(existing.high, temperatures.high)
    existing.low = Math.min(existing.low, temperatures.low)
    existing.precipitationChance = Math.max(existing.precipitationChance ?? 0, entry.pop ?? 0)
  }

  const dailyForecast: WeatherDashboardForecastDay[] = Array.from(dailyBuckets.entries())
    .slice(0, WEATHER_DASHBOARD_DAILY_LIMIT)
    .map(([dateKey, bucket]) => {
      const condition = bucket.representative.entry.weather[0]
      if (!condition) {
        throw new WeatherGatewayError('invalid-response', 'Daily weather row did not include a weather condition.')
      }

      return {
        dateKey,
        dayLabel: dayFormatter.format(toOffsetTimestampMs(bucket.timestampMs, timezoneOffsetSeconds)),
        high: bucket.high,
        low: bucket.low,
        weatherCode: condition.id,
        conditionLabel: normalizeWeatherConditionLabel(condition.id, condition.description),
        precipitationChance: toPercent(bucket.precipitationChance),
      }
    })

  return {
    timezone,
    current,
    hourly: hourlyForecast,
    daily: dailyForecast,
    alerts: [],
  }
}

export function createChatBridgeWeatherService(options: CreateChatBridgeWeatherServiceOptions = {}) {
  const now = () => options.now?.() ?? Date.now()
  const resolveFetch = () => options.fetch ?? fetch
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  const freshnessMs = options.freshnessMs ?? WEATHER_DASHBOARD_FRESHNESS_MS
  const resolveApiKey = () => options.apiKey ?? process.env.OPENWEATHER_API_KEY
  const traceAdapter = options.traceAdapter ?? createNoopLangSmithAdapter()
  const cache = new Map<string, CachedWeatherSnapshot>()

  async function trace(
    name: string,
    input: {
      parentRunId?: string
      inputs?: Record<string, unknown>
      outputs?: Record<string, unknown>
      metadata?: Record<string, unknown>
    }
  ) {
    await traceAdapter.recordEvent({
      name,
      runType: 'tool',
      parentRunId: input.parentRunId,
      inputs: input.inputs,
      outputs: input.outputs,
      metadata: {
        storyId: 'CB-510',
        operation: 'weather-dashboard-fetch',
        ...input.metadata,
      },
      tags: ['chatbridge', 'weather-dashboard', 'cb-510'],
    })
  }

  function readCachedReadySnapshot(cacheKey: string) {
    const cached = cache.get(cacheKey)
    if (!cached) {
      return null
    }

    if (cached.expiresAt <= now()) {
      return cached.snapshot
    }

    return cached.snapshot
  }

  function buildCacheHitSnapshot(snapshot: WeatherDashboardSnapshot) {
    if (!snapshot.current || snapshot.status !== 'ready') {
      return snapshot
    }

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
      referenceTime: now(),
      cacheStatus: 'hit',
    })
  }

  async function fetchDashboard(queryInput: unknown): Promise<ChatBridgeWeatherDashboardResult> {
    const query = ChatBridgeWeatherDashboardQuerySchema.parse(queryInput)
    const fetchImpl = resolveFetch()
    const apiKey = resolveApiKey()
    const units = resolveWeatherUnits(query.request, query.units)
    const locationHint = normalizeWeatherLocationHint(query.location, query.request)

    if (!locationHint) {
      const snapshot = createWeatherDashboardUnavailableSnapshot({
        request: query.request,
        locationQuery: query.location,
        units,
        updatedAt: now(),
        reason: 'missing-location',
      })
      await trace('chatbridge.weather.fetch.location_missing', {
        parentRunId: query.traceParentRunId,
        inputs: {
          request: query.request ?? null,
          location: query.location ?? null,
        },
        outputs: {
          status: snapshot.status,
        },
      })
      return ChatBridgeWeatherDashboardResultSchema.parse({ snapshot })
    }

    if (!apiKey) {
      const snapshot = createWeatherDashboardDegradedSnapshot({
        request: query.request,
        locationQuery: locationHint,
        locationName: locationHint,
        units,
        fetchedAt: now(),
        staleAt: now() + freshnessMs,
        degraded: {
          reason: 'upstream-error',
          title: 'Weather provider unavailable',
          message: 'OPENWEATHER_API_KEY is not configured for the host, so live weather data is unavailable.',
          retryable: false,
          usingStaleSnapshot: false,
        },
      })
      await trace('chatbridge.weather.fetch.config_missing', {
        parentRunId: query.traceParentRunId,
        inputs: {
          location: locationHint,
          units,
        },
        outputs: {
          status: snapshot.status,
          reason: snapshot.degraded?.reason ?? 'upstream-error',
        },
      })
      return ChatBridgeWeatherDashboardResultSchema.parse({ snapshot })
    }

    const cacheKey = createCacheKey(locationHint, units)
    const cachedSnapshot = readCachedReadySnapshot(cacheKey)
    const cachedEntry = cache.get(cacheKey)

    if (
      !query.refresh &&
      cachedEntry &&
      cachedEntry.expiresAt > now() &&
      !isWeatherDashboardSnapshotStale(cachedEntry.snapshot, { now: now() })
    ) {
      const snapshot = buildCacheHitSnapshot(cachedEntry.snapshot)
      await trace('chatbridge.weather.fetch.cache_hit', {
        parentRunId: query.traceParentRunId,
        inputs: {
          location: locationHint,
          units,
        },
        outputs: {
          cacheStatus: snapshot.cacheStatus,
          locationName: snapshot.locationName,
        },
      })
      return ChatBridgeWeatherDashboardResultSchema.parse({ snapshot })
    }

    try {
      const geocodeSearch = new URL(OPENWEATHER_GEOCODE_URL)
      geocodeSearch.searchParams.set('q', locationHint)
      geocodeSearch.searchParams.set('limit', '1')
      geocodeSearch.searchParams.set('appid', apiKey)

      await trace('chatbridge.weather.fetch.started', {
        parentRunId: query.traceParentRunId,
        inputs: {
          location: locationHint,
          units,
          refresh: query.refresh,
        },
      })

      const geocodePayload = await fetchJson(fetchImpl, geocodeSearch.toString())
      const resolvedLocation = normalizeGeocodeResult(geocodePayload)

      if (!resolvedLocation) {
        const snapshot = createWeatherDashboardUnavailableSnapshot({
          request: query.request,
          locationQuery: locationHint,
          units,
          updatedAt: now(),
          reason: 'location-not-found',
        })
        await trace('chatbridge.weather.fetch.location_not_found', {
          parentRunId: query.traceParentRunId,
          outputs: {
            status: snapshot.status,
            location: locationHint,
          },
        })
        return ChatBridgeWeatherDashboardResultSchema.parse({ snapshot })
      }

      const currentSearch = new URL(OPENWEATHER_CURRENT_WEATHER_URL)
      currentSearch.searchParams.set('lat', String(resolvedLocation.latitude))
      currentSearch.searchParams.set('lon', String(resolvedLocation.longitude))
      currentSearch.searchParams.set('appid', apiKey)
      currentSearch.searchParams.set('units', units)
      currentSearch.searchParams.set('lang', 'en')

      const forecastSearch = new URL(OPENWEATHER_FORECAST_URL)
      forecastSearch.searchParams.set('lat', String(resolvedLocation.latitude))
      forecastSearch.searchParams.set('lon', String(resolvedLocation.longitude))
      forecastSearch.searchParams.set('appid', apiKey)
      forecastSearch.searchParams.set('units', units)
      forecastSearch.searchParams.set('lang', 'en')

      const [currentPayload, forecastPayload] = await Promise.all([
        fetchJson(fetchImpl, currentSearch.toString()),
        fetchJson(fetchImpl, forecastSearch.toString()),
      ])
      const normalizedWeather = normalizeForecastSnapshot({
        current: currentPayload,
        forecast: forecastPayload,
      })
      const fetchedAt = now()

      const snapshot = createWeatherDashboardReadySnapshot({
        request: query.request,
        locationQuery: locationHint,
        locationName: composeLocationName(resolvedLocation),
        timezone: normalizedWeather.timezone,
        units,
        current: normalizedWeather.current,
        hourly: normalizedWeather.hourly,
        daily: normalizedWeather.daily,
        alerts: normalizedWeather.alerts,
        fetchedAt,
        staleAt: fetchedAt + freshnessMs,
        cacheStatus: query.refresh ? 'refreshed' : 'miss',
      })

      cache.set(cacheKey, {
        snapshot,
        expiresAt: now() + cacheTtlMs,
      })

      await trace('chatbridge.weather.fetch.succeeded', {
        parentRunId: query.traceParentRunId,
        outputs: {
          locationName: snapshot.locationName,
          cacheStatus: snapshot.cacheStatus,
          forecastDays: snapshot.daily.length,
          hourlyPoints: snapshot.hourly.length,
          alertCount: snapshot.alerts.length,
          status: snapshot.status,
        },
      })

      return ChatBridgeWeatherDashboardResultSchema.parse({ snapshot })
    } catch (error) {
      const normalizedError =
        error instanceof WeatherGatewayError
          ? error
          : new WeatherGatewayError(
              'upstream-error',
              error instanceof Error ? error.message : 'Weather provider request failed.'
            )

      const staleSnapshot =
        cachedSnapshot && cachedSnapshot.current
          ? createWeatherDashboardDegradedSnapshot({
              request: query.request,
              locationQuery: locationHint,
              locationName: cachedSnapshot.locationName,
              timezone: cachedSnapshot.timezone,
              units,
              current: cachedSnapshot.current,
              hourly: cachedSnapshot.hourly,
              daily: cachedSnapshot.daily,
              alerts: cachedSnapshot.alerts,
              forecast: cachedSnapshot.forecast,
              fetchedAt: cachedSnapshot.fetchedAt,
              staleAt: cachedSnapshot.staleAt,
              referenceTime: now(),
              degraded: {
                reason: normalizedError.code,
                title: normalizedError.code === 'upstream-timeout' ? 'Upstream timed out' : 'Fresh weather unavailable',
                message: 'The host kept the last good weather snapshot visible while upstream data is unavailable.',
                retryable: true,
                usingStaleSnapshot: true,
              },
            })
          : null

      const snapshot =
        staleSnapshot ??
        createWeatherDashboardDegradedSnapshot({
          request: query.request,
          locationQuery: locationHint,
          locationName: locationHint,
          units,
          fetchedAt: now(),
          staleAt: now() + freshnessMs,
          degraded: {
            reason: normalizedError.code,
            title:
              normalizedError.code === 'upstream-timeout'
                ? 'Upstream timed out'
                : normalizedError.code === 'invalid-response'
                  ? 'Weather response invalid'
                  : 'Fresh weather unavailable',
            message: normalizedError.message,
            retryable: true,
            usingStaleSnapshot: false,
          },
        })

      await trace('chatbridge.weather.fetch.degraded', {
        parentRunId: query.traceParentRunId,
        outputs: {
          status: snapshot.status,
          reason: snapshot.degraded?.reason ?? normalizedError.code,
          usingStaleSnapshot: snapshot.degraded?.usingStaleSnapshot ?? false,
        },
        metadata: {
          error: normalizedError.message,
        },
      })

      return ChatBridgeWeatherDashboardResultSchema.parse({ snapshot })
    }
  }

  return {
    fetchDashboard,
  }
}
