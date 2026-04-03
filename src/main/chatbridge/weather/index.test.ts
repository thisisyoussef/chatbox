import { describe, expect, it, vi } from 'vitest'

vi.mock('../../adapters/langsmith', () => ({
  langsmith: {
    enabled: false,
    startRun: async () => ({
      runId: 'langsmith-test-run',
      end: async () => {},
    }),
    recordEvent: async () => {},
  },
}))

import { createChatBridgeWeatherService } from './index'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function createTraceAdapter() {
  const events: Array<{ name: string; outputs?: Record<string, unknown> }> = []

  return {
    events,
    adapter: {
      enabled: true,
      startRun: async () => ({
        runId: 'trace-run',
        end: async () => {},
      }),
      recordEvent: async (event: { name: string; outputs?: Record<string, unknown> }) => {
        events.push(event)
      },
    },
  }
}

function createCurrentWeather(overrides: Record<string, unknown> = {}) {
  return {
    timezone: -18_000,
    main: {
      temp: 72.2,
      feels_like: 70.6,
    },
    wind: {
      speed: 9.1,
    },
    weather: [{ id: 800, description: 'clear sky' }],
    ...overrides,
  }
}

function createForecastList(
  options: {
    count?: number
    timezoneOffsetSeconds?: number
  } = {}
) {
  const count = options.count ?? 48
  const timezoneOffsetSeconds = options.timezoneOffsetSeconds ?? -18_000
  const startsAt = Date.parse('2024-06-01T00:00:00Z') / 1000

  return Array.from({ length: count }, (_value, index) => {
    const temperature = 68 + index * 0.5
    const rainyPoint = index % 8 === 0

    return {
      dt: startsAt + index * 10_800,
      main: {
        temp: temperature,
        temp_min: temperature - 2,
        temp_max: temperature + 2,
      },
      pop: rainyPoint ? 0.35 : 0.1,
      weather: [
        {
          id: rainyPoint ? 500 : 801,
          description: rainyPoint ? 'light rain' : 'few clouds',
        },
      ],
      timezoneOffsetSeconds,
    }
  })
}

function createForecastResponse(
  options: {
    count?: number
    timezoneOffsetSeconds?: number
  } = {}
) {
  return {
    list: createForecastList(options),
    city: {
      timezone: options.timezoneOffsetSeconds ?? -18_000,
    },
  }
}

describe('chatbridge weather service', () => {
  it('normalizes OpenWeather geocoding, current weather, and forecast data into a ready dashboard snapshot', async () => {
    const { adapter, events } = createTraceAdapter()
    const requestedUrls: string[] = []
    const fetchMock = vi.fn(async (url: string) => {
      requestedUrls.push(url)
      const requestUrl = new URL(url)

      if (requestUrl.pathname === '/geo/1.0/direct') {
        return jsonResponse([
          {
            name: 'Chicago',
            lat: 41.8756,
            lon: -87.6244,
            state: 'Illinois',
            country: 'US',
          },
        ])
      }

      if (requestUrl.pathname === '/data/2.5/weather') {
        return jsonResponse(createCurrentWeather())
      }

      return jsonResponse(createForecastResponse())
    })

    const service = createChatBridgeWeatherService({
      fetch: fetchMock as typeof fetch,
      now: () => 1_717_000_000_000,
      apiKey: 'test-key',
      traceAdapter: adapter,
    })

    const result = await service.fetchDashboard({
      request: 'Open Weather Dashboard for Chicago and show the forecast.',
    })

    expect(result.snapshot).toMatchObject({
      status: 'ready',
      locationName: 'Chicago, Illinois, United States',
      timezone: '-05:00',
      cacheStatus: 'miss',
      fetchedAt: 1_717_000_000_000,
      staleAt: 1_717_000_600_000,
      current: {
        conditionLabel: 'Clear Sky',
      },
    })
    expect(result.snapshot.hourly).toHaveLength(8)
    expect(result.snapshot.daily).toHaveLength(6)
    expect(result.snapshot.forecast).toHaveLength(4)
    expect(result.snapshot.alerts).toHaveLength(0)
    expect(result.snapshot.summary).toContain('Next 8 hours:')
    expect(result.snapshot.summary).toContain('Next 4 days:')
    expect(result.snapshot.summary).toContain('No active weather alerts.')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(events.map((event) => event.name)).toEqual([
      'chatbridge.weather.fetch.started',
      'chatbridge.weather.fetch.succeeded',
    ])
    expect(events.at(-1)?.outputs).toMatchObject({
      forecastDays: 6,
      hourlyPoints: 8,
      alertCount: 0,
      status: 'ready',
    })
    expect(requestedUrls).toHaveLength(3)
    expect(requestedUrls[0]).toContain('/geo/1.0/direct?q=Chicago&limit=1&appid=test-key')
    expect(requestedUrls[1]).toContain('/data/2.5/weather?')
    expect(requestedUrls[1]).toContain('lat=41.8756')
    expect(requestedUrls[1]).toContain('lon=-87.6244')
    expect(requestedUrls[1]).toContain('appid=test-key')
    expect(requestedUrls[1]).toContain('units=imperial')
    expect(requestedUrls[1]).toContain('lang=en')
    expect(requestedUrls[2]).toContain('/data/2.5/forecast?')
    expect(requestedUrls[2]).toContain('lat=41.8756')
    expect(requestedUrls[2]).toContain('lon=-87.6244')
    expect(requestedUrls[2]).toContain('appid=test-key')
    expect(requestedUrls[2]).toContain('units=imperial')
    expect(requestedUrls[2]).toContain('lang=en')
  })

  it('recovers a free-form US city and state query with a state-aware geocode fallback', async () => {
    const geocodeQueries: string[] = []
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = new URL(url)

      if (requestUrl.pathname === '/geo/1.0/direct') {
        const geocodeQuery = requestUrl.searchParams.get('q') ?? ''
        geocodeQueries.push(geocodeQuery)

        if (geocodeQuery.toLowerCase() === 'detroit') {
          return jsonResponse([
            {
              name: 'Detroit',
              lat: 42.3314,
              lon: -83.0458,
              state: 'Michigan',
              country: 'US',
            },
          ])
        }

        return jsonResponse([])
      }

      if (requestUrl.pathname === '/data/2.5/weather') {
        return jsonResponse(
          createCurrentWeather({
            timezone: -14_400,
            weather: [{ id: 803, description: 'broken clouds' }],
          })
        )
      }

      return jsonResponse(createForecastResponse({ timezoneOffsetSeconds: -14_400 }))
    })

    const service = createChatBridgeWeatherService({
      fetch: fetchMock as typeof fetch,
      now: () => 1_717_000_000_000,
      apiKey: 'test-key',
    })

    const result = await service.fetchDashboard({
      request: 'Open Weather Dashboard for detroit michigan and show the forecast.',
      location: 'detroit michigan',
      refresh: true,
    })

    expect(result.snapshot).toMatchObject({
      status: 'ready',
      locationQuery: 'detroit michigan',
      locationName: 'Detroit, Michigan, United States',
      timezone: '-04:00',
      cacheStatus: 'refreshed',
    })
    expect(geocodeQueries.map((query) => query.toLowerCase())).toEqual([
      'detroit michigan',
      'detroit, mi',
      'detroit, michigan',
      'detroit',
    ])
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('recovers a comma-delimited US state abbreviation with the same state-aware geocode fallback', async () => {
    const geocodeQueries: string[] = []
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = new URL(url)

      if (requestUrl.pathname === '/geo/1.0/direct') {
        const geocodeQuery = requestUrl.searchParams.get('q') ?? ''
        geocodeQueries.push(geocodeQuery)

        if (geocodeQuery.toLowerCase() === 'detroit') {
          return jsonResponse([
            {
              name: 'Detroit',
              lat: 42.3314,
              lon: -83.0458,
              state: 'Michigan',
              country: 'US',
            },
          ])
        }

        return jsonResponse([])
      }

      if (requestUrl.pathname === '/data/2.5/weather') {
        return jsonResponse(
          createCurrentWeather({
            timezone: -14_400,
            weather: [{ id: 803, description: 'broken clouds' }],
          })
        )
      }

      return jsonResponse(createForecastResponse({ timezoneOffsetSeconds: -14_400 }))
    })

    const service = createChatBridgeWeatherService({
      fetch: fetchMock as typeof fetch,
      now: () => 1_717_000_000_000,
      apiKey: 'test-key',
    })

    const result = await service.fetchDashboard({
      request: 'Open Weather Dashboard for Detroit, MI and show the forecast.',
      location: 'Detroit, MI',
      refresh: true,
    })

    expect(result.snapshot).toMatchObject({
      status: 'ready',
      locationQuery: 'Detroit, MI',
      locationName: 'Detroit, Michigan, United States',
      timezone: '-04:00',
      cacheStatus: 'refreshed',
    })
    expect(geocodeQueries.map((query) => query.toLowerCase())).toContain('detroit')
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('returns a cache hit on repeated requests without a second upstream fetch', async () => {
    const { adapter, events } = createTraceAdapter()
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = new URL(url)

      if (requestUrl.pathname === '/geo/1.0/direct') {
        return jsonResponse([
          {
            name: 'Chicago',
            lat: 41.8756,
            lon: -87.6244,
            state: 'Illinois',
            country: 'US',
          },
        ])
      }

      if (requestUrl.pathname === '/data/2.5/weather') {
        return jsonResponse(
          createCurrentWeather({
            weather: [{ id: 801, description: 'few clouds' }],
          })
        )
      }

      return jsonResponse(createForecastResponse())
    })

    const service = createChatBridgeWeatherService({
      fetch: fetchMock as typeof fetch,
      now: () => 1_717_000_000_000,
      cacheTtlMs: 60_000,
      apiKey: 'test-key',
      traceAdapter: adapter,
    })

    await service.fetchDashboard({
      request: 'Show me weather in Chicago.',
    })
    const cached = await service.fetchDashboard({
      request: 'Show me weather in Chicago.',
    })

    expect(cached.snapshot.cacheStatus).toBe('hit')
    expect(cached.snapshot.statusText).toBe('Using cached weather')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(events.map((event) => event.name)).toEqual([
      'chatbridge.weather.fetch.started',
      'chatbridge.weather.fetch.succeeded',
      'chatbridge.weather.fetch.cache_hit',
    ])
  })

  it('tolerates provider responses that omit optional hourly, daily, and alert sections', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = new URL(url)

      if (requestUrl.pathname === '/geo/1.0/direct') {
        return jsonResponse([
          {
            name: 'Tokyo',
            lat: 35.6764,
            lon: 139.65,
            country: 'JP',
          },
        ])
      }

      if (requestUrl.pathname === '/data/2.5/weather') {
        return jsonResponse(
          createCurrentWeather({
            timezone: 32_400,
            main: {
              temp: 18.4,
              feels_like: 17.9,
            },
            weather: [{ id: 804, description: 'overcast clouds' }],
            wind: undefined,
          })
        )
      }

      return jsonResponse({
        list: [],
        city: {
          timezone: 32_400,
        },
      })
    })

    const service = createChatBridgeWeatherService({
      fetch: fetchMock as typeof fetch,
      now: () => 1_717_000_000_000,
      apiKey: 'test-key',
    })

    const result = await service.fetchDashboard({
      request: 'What is the weather in Tokyo right now?',
      units: 'metric',
    })

    expect(result.snapshot).toMatchObject({
      status: 'ready',
      locationName: 'Tokyo, Japan',
      timezone: '+09:00',
      units: 'metric',
      hourly: [],
      daily: [],
      alerts: [],
      forecast: [],
    })
    expect(result.snapshot.summary).toContain('Hourly outlook is not available yet.')
    expect(result.snapshot.summary).toContain('Short forecast is not available yet.')
    expect(result.snapshot.summary).toContain('No active weather alerts.')
  })

  it('falls back to the last good snapshot when a refresh fails upstream', async () => {
    let currentNow = 1_717_000_000_000
    let weatherRequestCount = 0
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = new URL(url)

      if (requestUrl.pathname === '/geo/1.0/direct') {
        return jsonResponse([
          {
            name: 'Chicago',
            lat: 41.8756,
            lon: -87.6244,
            state: 'Illinois',
            country: 'US',
          },
        ])
      }

      if (requestUrl.pathname === '/data/2.5/weather') {
        weatherRequestCount += 1

        if (weatherRequestCount === 1) {
          return jsonResponse(
            createCurrentWeather({
              main: {
                temp: 68,
                feels_like: 66,
              },
              wind: {
                speed: 12,
              },
              weather: [{ id: 804, description: 'overcast clouds' }],
            })
          )
        }

        throw new Error('socket hung up')
      }

      return jsonResponse(createForecastResponse())
    })

    const service = createChatBridgeWeatherService({
      fetch: fetchMock as typeof fetch,
      now: () => currentNow,
      cacheTtlMs: 60_000,
      apiKey: 'test-key',
    })

    await service.fetchDashboard({
      request: 'Refresh weather in Chicago.',
    })

    currentNow += 11 * 60 * 1000

    const degraded = await service.fetchDashboard({
      request: 'Refresh weather in Chicago.',
      refresh: true,
    })

    expect(degraded.snapshot).toMatchObject({
      status: 'degraded',
      cacheStatus: 'stale-fallback',
      statusText: 'Showing cached snapshot',
      locationName: 'Chicago, Illinois, United States',
      current: {
        conditionLabel: 'Overcast Clouds',
      },
      degraded: {
        reason: 'upstream-error',
        usingStaleSnapshot: true,
      },
    })
    expect(degraded.snapshot.hourly).toHaveLength(8)
    expect(degraded.snapshot.daily).toHaveLength(6)
    expect(degraded.snapshot.alerts).toHaveLength(0)
    expect(degraded.snapshot.summary).toContain('last good snapshot')
    expect(degraded.snapshot.lastUpdatedLabel).toContain('freshness window passed')
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('returns an unavailable snapshot when the request has no usable location', async () => {
    const service = createChatBridgeWeatherService({
      fetch: vi.fn() as typeof fetch,
      now: () => 1_717_000_000_000,
      apiKey: 'test-key',
    })

    const result = await service.fetchDashboard({
      request: 'Open Weather Dashboard.',
    })

    expect(result.snapshot).toMatchObject({
      status: 'unavailable',
      degraded: {
        reason: 'missing-location',
      },
    })
  })

  it('returns a degraded snapshot when the OpenWeather API key is not configured', async () => {
    const { adapter, events } = createTraceAdapter()
    const fetchMock = vi.fn()
    const service = createChatBridgeWeatherService({
      fetch: fetchMock as typeof fetch,
      now: () => 1_717_000_000_000,
      apiKey: '',
      traceAdapter: adapter,
    })

    const result = await service.fetchDashboard({
      request: 'Open Weather Dashboard for Chicago and show the forecast.',
    })

    expect(result.snapshot).toMatchObject({
      status: 'degraded',
      locationName: 'Chicago',
      cacheStatus: 'none',
      degraded: {
        reason: 'upstream-error',
        retryable: false,
        usingStaleSnapshot: false,
      },
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(events.map((event) => event.name)).toEqual(['chatbridge.weather.fetch.config_missing'])
  })
})
