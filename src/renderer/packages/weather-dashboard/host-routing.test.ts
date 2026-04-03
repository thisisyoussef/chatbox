import { createMessage, type Message, type MessageAppPart } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import { readChatBridgeReviewedAppLaunch } from '@shared/chatbridge'
import {
  getLatestWeatherDashboardHostState,
  WEATHER_DASHBOARD_HOST_FLOW,
} from '@shared/weather-dashboard/intent'
import { interceptWeatherDashboardTurn } from './host-routing'

vi.hoisted(() => {
  const storage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  }

  ;(globalThis as unknown as { window: Record<string, unknown>; localStorage: typeof storage }).window = {
    localStorage: storage,
  }
  ;(globalThis as unknown as { localStorage: typeof storage }).localStorage = storage
})

function makeUserMessage(text: string): Message {
  return createMessage('user', text)
}

function getLaunchPart(message: Message): MessageAppPart {
  const launchPart = message.contentParts.find((part): part is MessageAppPart => part.type === 'app')
  if (!launchPart) {
    throw new Error('Expected Weather Dashboard to create a reviewed launch part.')
  }
  return launchPart
}

describe('interceptWeatherDashboardTurn', () => {
  it('returns null for non-weather prompts', async () => {
    const result = await interceptWeatherDashboardTurn([], makeUserMessage('Tell me a joke about pigeons.'))

    expect(result).toBeNull()
  })

  it('asks for a location when the prompt does not include one', async () => {
    const result = await interceptWeatherDashboardTurn([], makeUserMessage("What's the weather like today?"))

    expect(result?.role).toBe('assistant')
    const state = getLatestWeatherDashboardHostState([result!])
    expect(state).toMatchObject({
      hostFlow: WEATHER_DASHBOARD_HOST_FLOW,
      status: 'awaiting-location',
      reason: 'missing-location',
      originalRequest: "What's the weather like today?",
    })
    expect(result?.contentParts[0]).toMatchObject({
      type: 'info',
    })
  })

  it('asks for a more specific location when the city is ambiguous', async () => {
    const result = await interceptWeatherDashboardTurn([], makeUserMessage('weather in Springfield'))

    const state = getLatestWeatherDashboardHostState([result!])
    expect(state).toMatchObject({
      status: 'awaiting-location',
      reason: 'ambiguous-location',
      locationQuery: 'Springfield',
    })
    expect(result?.contentParts[0]).toMatchObject({
      type: 'info',
      text: expect.stringContaining('multiple possible matches'),
    })
  })

  it('launches the reviewed Weather Dashboard when the prompt includes a specific location', async () => {
    const result = await interceptWeatherDashboardTurn([], makeUserMessage('Will it rain tonight in Chicago, IL?'))

    const launchPart = getLaunchPart(result!)
    expect(launchPart).toMatchObject({
      appId: 'weather-dashboard',
      appName: 'Weather Dashboard',
      lifecycle: 'launching',
      statusText: 'Launching',
    })
    expect(readChatBridgeReviewedAppLaunch(launchPart.values)).toMatchObject({
      appId: 'weather-dashboard',
      toolName: 'weather_dashboard_open',
      request: 'Will it rain tonight in Chicago, IL?',
      location: 'Chicago, IL',
    })
  })

  it('continues a pending clarification by opening the dashboard once the user replies with a location', async () => {
    const clarification = (await interceptWeatherDashboardTurn([], makeUserMessage('weather')))!

    const result = await interceptWeatherDashboardTurn([clarification], makeUserMessage('Portland, OR'))

    const launchPart = getLaunchPart(result!)
    expect(readChatBridgeReviewedAppLaunch(launchPart.values)).toMatchObject({
      appId: 'weather-dashboard',
      toolName: 'weather_dashboard_open',
      request: 'weather',
      location: 'Portland, OR',
    })
  })

  it('honors an explicit launch confirmation for a legacy route-ready receipt', async () => {
    const legacyRouteReady = createMessage('assistant')
    legacyRouteReady.contentParts = [
      {
        type: 'info',
        text: 'Weather Dashboard route ready for Detroit, Michigan.',
        values: {
          hostFlow: WEATHER_DASHBOARD_HOST_FLOW,
          status: 'route-ready',
          originalRequest: 'open the weather app',
          locationQuery: 'Detroit, Michigan',
        },
      },
    ]

    const result = await interceptWeatherDashboardTurn([legacyRouteReady], makeUserMessage('ok open it'))

    expect(readChatBridgeReviewedAppLaunch(getLaunchPart(result!).values)).toMatchObject({
      appId: 'weather-dashboard',
      request: 'open the weather app',
      location: 'Detroit, Michigan',
    })
  })
})
