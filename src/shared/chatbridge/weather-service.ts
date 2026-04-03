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
const OPENWEATHER_ONE_CALL_URL = 'https://api.openweathermap.org/data/3.0/onecall'
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

const OpenWeatherOneCallResponseSchema = z
  .object({
    timezone: z.string().trim().min(1),
    current: z
      .object({
        dt: z.number().int().nonnegative(),
        temp: z.number(),
        feels_like: z.number().optional(),
        wind_speed: z.number().nonnegative().optional(),
        weather: z.array(OpenWeatherConditionSchema).min(1),
      })
      .passthrough(),
    hourly: z
      .array(
        z
          .object({
            dt: z.number().int().nonnegative(),
            temp: z.number(),
            pop: z.number().min(0).max(1).optional(),
            weather: z.array(OpenWeatherConditionSchema).min(1),
          })
          .passthrough()
      )
      .optional(),
    daily: z
      .array(
        z
          .object({
            dt: z.number().int().nonnegative(),
            temp: z
              .object({
                min: z.number(),
                max: z.number(),
              })
              .passthrough(),
            pop: z.number().min(0).max(1).optional(),
            weather: z.array(OpenWeatherConditionSchema).min(1),
          })
          .passthrough()
      )
      .optional(),
    alerts: z
      .array(
        z
          .object({
            sender_name: z.string().trim().min(1),
            event: z.string().trim().min(1),
            start: z.number().int().nonnegative(),
            end: z.number().int().nonnegative().optional(),
            description: z.string().trim().min(1),
            tags: z.array(z.string().trim().min(1)).optional(),
          })
          .passthrough()
      )
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

function normalizeForecastSnapshot(
  payload: unknown
): {
  timezone: string
  current: WeatherDashboardCurrentConditions
  hourly: WeatherDashboardHourlyForecast[]
  daily: WeatherDashboardForecastDay[]
  alerts: WeatherDashboardAlert[]
} {
  const parsed = OpenWeatherOneCallResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new WeatherGatewayError('invalid-response', 'Weather forecast response failed schema validation.')
  }

  const forecast = parsed.data
  const currentCondition = forecast.current.weather[0]
  if (!currentCondition) {
    throw new WeatherGatewayError('invalid-response', 'Weather forecast response did not include current conditions.')
  }

  const current: WeatherDashboardCurrentConditions = {
    temperature: forecast.current.temp,
    apparentTemperature: forecast.current.feels_like,
    weatherCode: currentCondition.id,
    conditionLabel: normalizeWeatherConditionLabel(currentCondition.id, currentCondition.description),
    windSpeed: forecast.current.wind_speed,
  }

  const hourlyFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    timeZone: forecast.timezone,
  })

  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: forecast.timezone,
  })

  const hourlyForecast: WeatherDashboardHourlyForecast[] = (forecast.hourly ?? [])
    .slice(0, WEATHER_DASHBOARD_HOURLY_LIMIT)
    .map((hour) => {
      const condition = hour.weather[0]
      if (!condition) {
        throw new WeatherGatewayError('invalid-response', 'Hourly weather row did not include a weather condition.')
      }

      const timestampMs = hour.dt * 1000

      return {
        timeKey: new Date(timestampMs).toISOString(),
        hourLabel: hourlyFormatter.format(timestampMs),
        temperature: hour.temp,
        weatherCode: condition.id,
        conditionLabel: normalizeWeatherConditionLabel(condition.id, condition.description),
        precipitationChance: toPercent(hour.pop),
      }
    })

  const dailyForecast: WeatherDashboardForecastDay[] = (forecast.daily ?? [])
    .slice(0, WEATHER_DASHBOARD_DAILY_LIMIT)
    .map((day) => {
      const condition = day.weather[0]
      if (!condition) {
        throw new WeatherGatewayError('invalid-response', 'Daily weather row did not include a weather condition.')
      }

      const timestampMs = day.dt * 1000
      const parsedDate = new Date(timestampMs)
      const dateKey = Number.isNaN(parsedDate.valueOf()) ? String(day.dt) : toDateKey(timestampMs)
      const dayLabel = Number.isNaN(parsedDate.valueOf()) ? dateKey : dayFormatter.format(parsedDate)

      return {
        dateKey,
        dayLabel,
        high: day.temp.max,
        low: day.temp.min,
        weatherCode: condition.id,
        conditionLabel: normalizeWeatherConditionLabel(condition.id, condition.description),
        precipitationChance: toPercent(day.pop),
      }
    })

  const alerts: WeatherDashboardAlert[] = (forecast.alerts ?? [])
    .slice(0, WEATHER_DASHBOARD_ALERT_LIMIT)
    .map((alert) => ({
      source: alert.sender_name,
      event: alert.event,
      startsAt: alert.start * 1000,
      endsAt: typeof alert.end === 'number' ? alert.end * 1000 : undefined,
      description: alert.description,
      tags: alert.tags ?? [],
    }))

  return {
    timezone: forecast.timezone,
    current,
    hourly: hourlyForecast,
    daily: dailyForecast,
    alerts,
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

      const forecastSearch = new URL(OPENWEATHER_ONE_CALL_URL)
      forecastSearch.searchParams.set('lat', String(resolvedLocation.latitude))
      forecastSearch.searchParams.set('lon', String(resolvedLocation.longitude))
      forecastSearch.searchParams.set('appid', apiKey)
      forecastSearch.searchParams.set('units', units)
      forecastSearch.searchParams.set('lang', 'en')
      forecastSearch.searchParams.set('exclude', 'minutely')

      const forecastPayload = await fetchJson(fetchImpl, forecastSearch.toString())
      const normalizedWeather = normalizeForecastSnapshot(forecastPayload)
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
