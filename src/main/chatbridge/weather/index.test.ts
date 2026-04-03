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

function createHourlyForecast() {
  return Array.from({ length: 9 }, (_value, index) => ({
    dt: 1_717_000_000 + index * 3_600,
    temp: 70 + index,
    pop: index === 0 ? 0.1 : 0.2,
    weather: [
      {
        id: index === 0 ? 800 : 801,
        description: index === 0 ? 'clear sky' : 'few clouds',
      },
    ],
  }))
}

function createDailyForecast() {
  return Array.from({ length: 7 }, (_value, index) => ({
    dt: 1_717_000_000 + index * 86_400,
    temp: {
      min: 55 + index,
      max: 72 + index,
    },
    pop: index === 0 ? 0.1 : 0.25,
    weather: [
      {
        id: index === 0 ? 800 : 500,
        description: index === 0 ? 'clear sky' : 'light rain',
      },
    ],
  }))
}

function createAlerts() {
  return [
    {
      sender_name: 'National Weather Service',
      event: 'Heat Advisory',
      start: 1_717_000_000,
      end: 1_717_003_600,
      description: 'Hot conditions are expected through the afternoon.',
      tags: ['Extreme temperature value'],
    },
    {
      sender_name: 'Cook County Alerts',
      event: 'Air Quality Alert',
      start: 1_717_007_200,
      end: 1_717_010_800,
      description: 'Sensitive groups should limit outdoor activity.',
      tags: ['Air quality'],
    },
    {
      sender_name: 'Illinois Emergency Management',
      event: 'Beach Hazards Statement',
      start: 1_717_014_400,
      end: 1_717_018_000,
      description: 'Dangerous currents expected along the lakefront.',
      tags: ['Marine weather statement'],
    },
    {
      sender_name: 'Overflow Alerting',
      event: 'Should Be Trimmed',
      start: 1_717_021_600,
      description: 'This alert should not appear because only three alerts are kept.',
      tags: ['Overflow'],
    },
  ]
}

describe('chatbridge weather service', () => {
  it('normalizes OpenWeather geocoding and One Call data into a ready dashboard snapshot', async () => {
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

      return jsonResponse({
        timezone: 'America/Chicago',
        current: {
          dt: 1_717_000_000,
          temp: 72.2,
          feels_like: 70.6,
          wind_speed: 9.1,
          weather: [{ id: 800, description: 'clear sky' }],
        },
        hourly: createHourlyForecast(),
        daily: createDailyForecast(),
        alerts: createAlerts(),
      })
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
      timezone: 'America/Chicago',
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
    expect(result.snapshot.alerts).toHaveLength(3)
    expect(result.snapshot.summary).toContain('Next 8 hours:')
    expect(result.snapshot.summary).toContain('Next 4 days:')
    expect(result.snapshot.summary).toContain('Active alerts:')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(events.map((event) => event.name)).toEqual([
      'chatbridge.weather.fetch.started',
      'chatbridge.weather.fetch.succeeded',
    ])
    expect(events.at(-1)?.outputs).toMatchObject({
      forecastDays: 6,
      hourlyPoints: 8,
      alertCount: 3,
      status: 'ready',
    })
    expect(requestedUrls).toHaveLength(2)
    expect(requestedUrls[0]).toContain('/geo/1.0/direct?q=Chicago&limit=1&appid=test-key')
    expect(requestedUrls[1]).toContain('/data/3.0/onecall?')
    expect(requestedUrls[1]).toContain('lat=41.8756')
    expect(requestedUrls[1]).toContain('lon=-87.6244')
    expect(requestedUrls[1]).toContain('appid=test-key')
    expect(requestedUrls[1]).toContain('units=imperial')
    expect(requestedUrls[1]).toContain('lang=en')
    expect(requestedUrls[1]).toContain('exclude=minutely')
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

      return jsonResponse({
        timezone: 'America/Chicago',
        current: {
          dt: 1_717_000_000,
          temp: 72.2,
          feels_like: 70.6,
          wind_speed: 9.1,
          weather: [{ id: 801, description: 'few clouds' }],
        },
        hourly: createHourlyForecast(),
        daily: createDailyForecast(),
      })
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
    expect(fetchMock).toHaveBeenCalledTimes(2)
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

      return jsonResponse({
        timezone: 'Asia/Tokyo',
        current: {
          dt: 1_717_000_000,
          temp: 18.4,
          feels_like: 17.9,
          weather: [{ id: 804, description: 'overcast clouds' }],
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
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () =>
        jsonResponse([
          {
            name: 'Chicago',
            lat: 41.8756,
            lon: -87.6244,
            state: 'Illinois',
            country: 'US',
          },
        ])
      )
      .mockImplementationOnce(async () =>
        jsonResponse({
          timezone: 'America/Chicago',
          current: {
            dt: 1_717_000_000,
            temp: 68,
            feels_like: 66,
            wind_speed: 12,
            weather: [{ id: 804, description: 'overcast clouds' }],
          },
          hourly: createHourlyForecast(),
          daily: createDailyForecast(),
          alerts: createAlerts().slice(0, 1),
        })
      )
      .mockImplementationOnce(async () =>
        jsonResponse([
          {
            name: 'Chicago',
            lat: 41.8756,
            lon: -87.6244,
            state: 'Illinois',
            country: 'US',
          },
        ])
      )
      .mockImplementationOnce(async () => {
        throw new Error('socket hung up')
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
    expect(degraded.snapshot.alerts).toHaveLength(1)
    expect(degraded.snapshot.summary).toContain('last good snapshot')
    expect(degraded.snapshot.lastUpdatedLabel).toContain('freshness window passed')
    expect(fetchMock).toHaveBeenCalledTimes(4)
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
