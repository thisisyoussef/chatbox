import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }
const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function createMockResponse() {
  const state = {
    statusCode: 200,
    payload: null as unknown,
  }

  const response = {
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      state.statusCode = code
      return response
    }),
    json: vi.fn((payload: unknown) => {
      state.payload = payload
      return response
    }),
  }

  return {
    state,
    response,
  }
}

describe('weather web bridge server', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.LANGSMITH_TRACING = 'false'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    if (originalFetch) {
      vi.stubGlobal('fetch', originalFetch)
    } else {
      vi.unstubAllGlobals()
    }
    vi.restoreAllMocks()
  })

  it('returns a ready snapshot from the Vercel weather bridge', async () => {
    process.env.OPENWEATHER_API_KEY = 'test-key'

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
            local_names: {
              en: 'Chicago',
            },
          },
        ])
      }

      if (requestUrl.pathname === '/data/2.5/weather') {
        return jsonResponse({
          timezone: -18_000,
          main: {
            temp: 72.2,
            feels_like: 70.6,
          },
          wind: {
            speed: 9.1,
          },
          weather: [{ id: 800, description: 'clear sky' }],
        })
      }

      return jsonResponse({
        list: [
          {
            dt: 1_717_003_600,
            main: {
              temp: 73.1,
              temp_min: 70.5,
              temp_max: 74.2,
            },
            pop: 0.1,
            weather: [{ id: 801, description: 'few clouds' }],
          },
          {
            dt: 1_717_014_400,
            main: {
              temp: 75.2,
              temp_min: 61.2,
              temp_max: 78.4,
            },
            pop: 0.2,
            weather: [{ id: 500, description: 'light rain' }],
          },
        ],
        city: {
          timezone: -18_000,
        },
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    const { default: handler } = await import('../../../api/weather/dashboard')
    const { state, response } = createMockResponse()

    await handler(
      {
        method: 'POST',
        body: JSON.stringify({
          request: 'Open Weather Dashboard for Chicago and show the forecast.',
          location: 'Chicago',
          refresh: false,
        }),
      },
      response
    )

    expect(state.statusCode).toBe(200)
    expect(state.payload).toMatchObject({
      snapshot: {
        status: 'ready',
        locationName: 'Chicago, Illinois, United States',
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('rejects non-POST requests', async () => {
    const { default: handler } = await import('../../../api/weather/dashboard')
    const { state, response } = createMockResponse()

    await handler(
      {
        method: 'GET',
      },
      response
    )

    expect(state.statusCode).toBe(405)
    expect(state.payload).toEqual({
      error: 'Method Not Allowed',
    })
  })
})
