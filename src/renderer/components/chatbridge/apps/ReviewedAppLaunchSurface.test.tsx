/**
 * @vitest-environment jsdom
 */

import { MantineProvider } from '@mantine/core'
import { fireEvent, render, waitFor } from '@testing-library/react'
import type { BridgeReadyEvent } from '@shared/chatbridge/bridge-session'
import {
  clearChatBridgeObservabilityState,
  createWeatherDashboardDegradedSnapshot,
  listChatBridgeObservabilityEvents,
} from '@shared/chatbridge'
import type { MessageAppPart, Session } from '@shared/types'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyReviewedAppLaunchBootstrapToSession,
  applyReviewedAppLaunchBridgeEventToSession,
  applyReviewedAppLaunchBridgeReadyToSession,
} from '@/packages/chatbridge/reviewed-app-launch'

const mocks = vi.hoisted(() => {
  const controller = {
    attach: vi.fn(),
    waitForReady: vi.fn(async () => undefined),
    renderHtml: vi.fn(),
    getSession: vi.fn(() => ({
      envelope: {
        bridgeSessionId: 'bridge-session-reviewed-1',
      },
    })),
    dispose: vi.fn(),
  }

  return {
    controller,
    createBridgeHostController: vi.fn(() => controller),
    startRun: vi.fn(async () => ({
      runId: 'launch-trace-reviewed-1',
      end: vi.fn(async () => undefined),
    })),
    updateSessionWithMessages: vi.fn(async () => {
      const baseSession: Session = {
        id: 'session-reviewed-launch-1',
        name: 'Reviewed launch session',
        messages: [],
        settings: {},
      }

      return baseSession
    }),
    invoke: vi.fn(),
  }
})

vi.mock('@/packages/chatbridge/bridge/host-controller', () => ({
  createBridgeHostController: mocks.createBridgeHostController,
}))

vi.mock('@/adapters/langsmith', () => ({
  langsmith: {
    startRun: mocks.startRun,
    enabled: true,
  },
}))

vi.mock('@/stores/chatStore', () => ({
  updateSessionWithMessages: mocks.updateSessionWithMessages,
}))

import { ReviewedAppLaunchSurface } from './ReviewedAppLaunchSurface'

function createWeatherSnapshot(options: {
  request?: string
  locationQuery: string
  locationName: string
  headline: string
  conditionLabel: string
  temperature: number
  cacheStatus?: 'miss' | 'refreshed'
  statusText?: string
}) {
  const cacheStatus = options.cacheStatus ?? 'miss'

  return {
    schemaVersion: 1,
    appId: 'weather-dashboard',
    request: options.request ?? `Open Weather Dashboard for ${options.locationQuery} and show the forecast.`,
    locationQuery: options.locationQuery,
    locationName: options.locationName,
    timezone: options.locationQuery === 'Denver' ? 'America/Denver' : 'America/Chicago',
    units: 'imperial' as const,
    status: 'ready' as const,
    statusText: options.statusText ?? (cacheStatus === 'refreshed' ? 'Weather refreshed' : 'Live weather'),
    summary: `Weather Dashboard is active for ${options.locationName}. Current conditions are ${options.headline}.`,
    headline: options.headline,
    dataStateLabel: cacheStatus === 'refreshed' ? 'Fresh upstream refresh' : 'Fresh host snapshot',
    lastUpdatedLabel: cacheStatus === 'refreshed' ? 'Updated 2:20 PM MDT' : 'Updated 2:15 PM CDT',
    sourceLabel: 'Host weather boundary',
    cacheStatus,
    refreshHint: 'Refresh weather to recheck the host-owned upstream snapshot.',
    fetchedAt: cacheStatus === 'refreshed' ? 1717000300000 : 1717000000000,
    staleAt: cacheStatus === 'refreshed' ? 1717000900000 : 1717000600000,
    updatedAt: cacheStatus === 'refreshed' ? 1717000300000 : 1717000000000,
    current: {
      temperature: options.temperature,
      apparentTemperature: options.temperature - 2,
      weatherCode: 1,
      conditionLabel: options.conditionLabel,
      windSpeed: 9,
    },
    hourly: [
      {
        timeKey: '2026-04-02T19:00:00.000Z',
        hourLabel: '2 PM',
        temperature: options.temperature,
        weatherCode: 1,
        conditionLabel: options.conditionLabel,
        precipitationChance: 10,
      },
    ],
    daily: [
      {
        dateKey: '2026-04-02',
        dayLabel: 'Thu',
        high: options.temperature + 2,
        low: options.temperature - 14,
        weatherCode: 1,
        conditionLabel: options.conditionLabel,
        precipitationChance: 10,
      },
    ],
    alerts: [],
    forecast: [
      {
        dateKey: '2026-04-02',
        dayLabel: 'Thu',
        high: options.temperature + 2,
        low: options.temperature - 14,
        weatherCode: 1,
        conditionLabel: options.conditionLabel,
        precipitationChance: 10,
      },
    ],
  }
}

function createReviewedLaunchPart(): MessageAppPart {
  return {
    type: 'app',
    appId: 'chess',
    appName: 'Chess',
    appInstanceId: 'reviewed-launch:tool-reviewed-launch-1',
    lifecycle: 'launching',
    toolCallId: 'tool-reviewed-launch-1',
    summary: 'Prepared the reviewed Chess session request for the host-owned launch path.',
    summaryForModel: 'Prepared the reviewed Chess session request for the host-owned launch path.',
    title: 'Chess launch',
    description: 'The host is launching Chess through the reviewed bridge runtime.',
    statusText: 'Launching',
    fallbackTitle: 'Chess fallback',
    fallbackText: 'The host will keep Chess launch and recovery in this thread if the runtime cannot finish starting.',
    values: {
      chatbridgeReviewedAppLaunch: {
        schemaVersion: 1,
        appId: 'chess',
        appName: 'Chess',
        appVersion: '0.1.0',
        toolName: 'chess_prepare_session',
        capability: 'prepare-session',
        summary: 'Prepared the reviewed Chess session request for the host-owned launch path.',
        request: 'Open Chess and analyze this FEN.',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      },
    },
  }
}

function createWeatherReviewedLaunchPart(): MessageAppPart {
  return {
    type: 'app',
    appId: 'weather-dashboard',
    appName: 'Weather Dashboard',
    appInstanceId: 'reviewed-launch:tool-reviewed-launch-weather-1',
    lifecycle: 'launching',
    toolCallId: 'tool-reviewed-launch-weather-1',
    summary: 'Prepared the reviewed Weather Dashboard request for the host-owned launch path.',
    summaryForModel: 'Prepared the reviewed Weather Dashboard request for the host-owned launch path.',
    title: 'Weather Dashboard launch',
    description: 'The host is launching Weather Dashboard through the reviewed runtime.',
    statusText: 'Launching',
    fallbackTitle: 'Weather Dashboard fallback',
    fallbackText: 'The host will keep Weather Dashboard launch and recovery in this thread if live weather cannot load.',
    values: {
      chatbridgeReviewedAppLaunch: {
        schemaVersion: 1,
        appId: 'weather-dashboard',
        appName: 'Weather Dashboard',
        appVersion: '0.1.0',
        toolName: 'weather_dashboard_open',
        capability: 'open',
        summary: 'Prepared the reviewed Weather Dashboard request for the host-owned launch path.',
        request: 'Open Weather Dashboard for Chicago and show the forecast.',
        location: 'Chicago',
      },
    },
  }
}

function createWeatherLaunchMessage(part: MessageAppPart) {
  return {
    id: 'assistant-reviewed-launch-weather-1',
    role: 'assistant' as const,
    contentParts: [part],
  }
}

function getWeatherLaunchPart(session: Session): MessageAppPart {
  const message = session.messages.find((candidate) => candidate.id === 'assistant-reviewed-launch-weather-1')
  const launchPart = message?.contentParts.find((part): part is MessageAppPart => part.type === 'app')

  if (!launchPart) {
    throw new Error('Expected a reviewed Weather Dashboard launch part.')
  }

  return launchPart
}

function createActiveWeatherSession(snapshot = createWeatherSnapshot({
  locationQuery: 'Chicago',
  locationName: 'Chicago, Illinois, United States',
  headline: '72°F and Mostly clear',
  conditionLabel: 'Mostly clear',
  temperature: 72,
})) {
  const part = createWeatherReviewedLaunchPart()
  const baseSession: Session = {
    id: 'session-reviewed-launch-weather-1',
    name: 'Reviewed Weather launch session',
    messages: [createWeatherLaunchMessage(part)],
    settings: {},
  }

  const bootstrapped = applyReviewedAppLaunchBootstrapToSession(baseSession, {
    messageId: 'assistant-reviewed-launch-weather-1',
    part,
    bridgeSessionId: 'bridge-session-reviewed-weather-active',
    now: () => 10_000,
    createId: () => 'event-reviewed-weather-created-active',
  })

  const readied = applyReviewedAppLaunchBridgeReadyToSession(bootstrapped, {
    messageId: 'assistant-reviewed-launch-weather-1',
    part: getWeatherLaunchPart(bootstrapped),
    event: {
      kind: 'app.ready',
      bridgeSessionId: 'bridge-session-reviewed-weather-active',
      appInstanceId: part.appInstanceId,
      bridgeToken: 'bridge-token-reviewed-weather-active',
      ackNonce: 'bridge-nonce-reviewed-weather-active',
      sequence: 1,
    },
    now: () => 11_000,
    createId: () => 'event-reviewed-weather-ready-active',
  })

  return applyReviewedAppLaunchBridgeEventToSession(readied, {
    messageId: 'assistant-reviewed-launch-weather-1',
    part: getWeatherLaunchPart(readied),
    event: {
      kind: 'app.state',
      bridgeSessionId: 'bridge-session-reviewed-weather-active',
      appInstanceId: part.appInstanceId,
      bridgeToken: 'bridge-token-reviewed-weather-active',
      sequence: 2,
      idempotencyKey: 'state-reviewed-weather-active',
      snapshot,
    },
    now: () => 12_000,
    createId: () => 'event-reviewed-weather-state-active',
  })
}

describe('ReviewedAppLaunchSurface', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    clearChatBridgeObservabilityState()
    mocks.invoke.mockImplementation(async (channel: string, query?: { location?: string; refresh?: boolean }) => {
      if (channel !== 'chatbridge-weather:get-dashboard') {
        throw new Error(`Unexpected channel: ${channel}`)
      }

      const location = query?.location?.trim() || 'Chicago'
      const cacheStatus = query?.refresh ? 'refreshed' : 'miss'

      if (location.toLowerCase() === 'denver') {
        return {
          snapshot: createWeatherSnapshot({
            locationQuery: 'Denver',
            locationName: 'Denver, Colorado, United States',
            headline: '61°F and Partly cloudy',
            conditionLabel: 'Partly cloudy',
            temperature: 61,
            cacheStatus,
          }),
        }
      }

      return {
        snapshot: createWeatherSnapshot({
          locationQuery: 'Chicago',
          locationName: 'Chicago, Illinois, United States',
          headline: '72°F and Mostly clear',
          conditionLabel: 'Mostly clear',
          temperature: 72,
          cacheStatus,
        }),
      }
    })
    Object.defineProperty(window, 'electronAPI', {
      value: {
        invoke: mocks.invoke,
      },
      configurable: true,
      writable: true,
    })
  })

  it('boots a reviewed app launch through the bridge controller instead of the seeded chess runtime', async () => {
    const { container, queryByRole } = render(
      <MantineProvider>
        <ReviewedAppLaunchSurface
          part={createReviewedLaunchPart()}
          sessionId="session-reviewed-launch-1"
          messageId="assistant-reviewed-launch-1"
        />
      </MantineProvider>
    )

    expect(queryByRole('button', { name: /g1, white knight/i })).toBeNull()

    const iframe = container.querySelector('iframe')
    expect(iframe).toBeTruthy()
    if (!iframe) {
      return
    }
    expect(iframe.getAttribute('srcdoc')).toContain('Reviewed app bridge launch')

    Object.defineProperty(iframe, 'contentWindow', {
      value: window,
      configurable: true,
    })

    fireEvent.load(iframe)

    await waitFor(() => {
      expect(mocks.createBridgeHostController).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: 'chess',
          appName: 'Chess',
          appInstanceId: 'reviewed-launch:tool-reviewed-launch-1',
          bootstrapTargetOrigin: '*',
          capabilities: ['launch-reviewed-app'],
          traceParentRunId: 'launch-trace-reviewed-1',
        })
      )
    })

    const firstControllerCall = mocks.createBridgeHostController.mock.calls[0] as unknown as [unknown] | undefined
    expect(firstControllerCall).toBeTruthy()
    if (!firstControllerCall) {
      return
    }
    const controllerOptions = firstControllerCall[0] as {
      onReady?: (event: BridgeReadyEvent) => void
      onAcceptedAppEvent?: (event: unknown) => void
    }

    await waitFor(() => {
      expect(mocks.controller.attach).toHaveBeenCalledTimes(1)
      expect(mocks.updateSessionWithMessages).toHaveBeenCalledTimes(1)
    })

    controllerOptions.onReady?.({
      kind: 'app.ready',
      bridgeSessionId: 'bridge-session-reviewed-1',
      appInstanceId: 'reviewed-launch:tool-reviewed-launch-1',
      bridgeToken: 'bridge-token-reviewed-1',
      ackNonce: 'bridge-nonce-reviewed-1',
      sequence: 1,
    })
    controllerOptions.onAcceptedAppEvent?.({
      kind: 'app.state',
      bridgeSessionId: 'bridge-session-reviewed-1',
      appInstanceId: 'reviewed-launch:tool-reviewed-launch-1',
      bridgeToken: 'bridge-token-reviewed-1',
      sequence: 2,
      idempotencyKey: 'state-reviewed-launch-2',
      snapshot: {
        kind: 'reviewed-app-launch',
        schemaVersion: 1,
        summary: 'Chess bridge runtime is live inside the host-owned shell.',
        statusText: 'Bridge active',
      },
    })

    await waitFor(() => {
      expect(mocks.updateSessionWithMessages).toHaveBeenCalledTimes(2)
    })
  })

  it('renders Weather Dashboard through the dedicated host-owned weather surface', async () => {
    const { container, getByRole, findByText } = render(
      <MantineProvider>
        <ReviewedAppLaunchSurface
          part={createWeatherReviewedLaunchPart()}
          sessionId="session-reviewed-launch-weather-1"
          messageId="assistant-reviewed-launch-weather-1"
        />
      </MantineProvider>
    )

    expect(container.querySelector('iframe')).toBeNull()
    expect(getByRole('button', { name: /refresh weather/i })).toBeTruthy()
    await findByText('Chicago, Illinois, United States')

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith(
        'chatbridge-weather:get-dashboard',
        expect.objectContaining({
          request: 'Open Weather Dashboard for Chicago and show the forecast.',
          location: 'Chicago',
          refresh: false,
        })
      )
    })
    expect(mocks.createBridgeHostController).not.toHaveBeenCalled()
  })

  it('keeps the latest selected location active for later refreshes', async () => {
    const { getByLabelText, getByRole, findByText } = render(
      <MantineProvider>
        <ReviewedAppLaunchSurface
          part={createWeatherReviewedLaunchPart()}
          sessionId="session-reviewed-launch-weather-1"
          messageId="assistant-reviewed-launch-weather-1"
        />
      </MantineProvider>
    )

    await findByText('Chicago, Illinois, United States')

    fireEvent.change(getByLabelText(/location/i), {
      target: {
        value: 'Denver',
      },
    })
    fireEvent.click(getByRole('button', { name: /update location/i }))

    await findByText('Denver, Colorado, United States')

    fireEvent.click(getByRole('button', { name: /refresh weather/i }))

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenLastCalledWith(
        'chatbridge-weather:get-dashboard',
        expect.objectContaining({
          location: 'Denver',
          refresh: true,
        })
      )
    })
  })

  it('resumes the weather surface from the latest persisted snapshot location', async () => {
    const part = createWeatherReviewedLaunchPart()
    part.snapshot = createWeatherSnapshot({
      locationQuery: 'Denver',
      locationName: 'Denver, Colorado, United States',
      headline: '61°F and Partly cloudy',
      conditionLabel: 'Partly cloudy',
      temperature: 61,
    })

    render(
      <MantineProvider>
        <ReviewedAppLaunchSurface
          part={part}
          sessionId="session-reviewed-launch-weather-1"
          messageId="assistant-reviewed-launch-weather-1"
        />
      </MantineProvider>
    )

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith(
        'chatbridge-weather:get-dashboard',
        expect.objectContaining({
          location: 'Denver',
          refresh: false,
        })
      )
    })
  })

  it('keeps a stale persisted weather snapshot visible when reopen refresh degrades and the host cache is cold', async () => {
    const part = createWeatherReviewedLaunchPart()
    part.snapshot = createWeatherSnapshot({
      locationQuery: 'Chicago',
      locationName: 'Chicago, Illinois, United States',
      headline: '72°F and Mostly clear',
      conditionLabel: 'Mostly clear',
      temperature: 72,
      statusText: 'Live weather',
    })

    mocks.invoke.mockResolvedValueOnce({
      snapshot: createWeatherDashboardDegradedSnapshot({
        request: 'Open Weather Dashboard for Chicago and show the forecast.',
        locationQuery: 'Chicago',
        locationName: 'Chicago',
        units: 'imperial',
        fetchedAt: 1717000900000,
        staleAt: 1717001500000,
        referenceTime: 1717000900000,
        degraded: {
          reason: 'upstream-timeout',
          title: 'Upstream timed out',
          message: 'The host kept the last good weather snapshot visible while upstream data is unavailable.',
          retryable: true,
          usingStaleSnapshot: false,
        },
      }),
    })

    const { findByText, getByRole } = render(
      <MantineProvider>
        <ReviewedAppLaunchSurface
          part={part}
          sessionId="session-reviewed-launch-weather-1"
          messageId="assistant-reviewed-launch-weather-1"
        />
      </MantineProvider>
    )

    await findByText('Chicago, Illinois, United States')
    await waitFor(() => {
      expect(getByRole('alert').textContent).toContain('Upstream timed out')
    })

    expect(getByRole('alert')).toBeTruthy()
    expect(getByRole('button', { name: /refresh weather/i })).toBeTruthy()
    expect(listChatBridgeObservabilityEvents({ appId: 'weather-dashboard' }).at(-1)).toMatchObject({
      kind: 'app-event-accepted',
      status: 'degraded',
      details: expect.arrayContaining(['cacheStatus: stale-fallback', 'fallbackSource: renderer-persisted-snapshot']),
    })
  })

  it('records an explicit completion summary when the user closes Weather Dashboard', async () => {
    const { getByRole, findByText } = render(
      <MantineProvider>
        <ReviewedAppLaunchSurface
          part={createWeatherReviewedLaunchPart()}
          sessionId="session-reviewed-launch-weather-1"
          messageId="assistant-reviewed-launch-weather-1"
        />
      </MantineProvider>
    )

    await findByText('Chicago, Illinois, United States')
    fireEvent.click(getByRole('button', { name: /close dashboard/i }))

    await waitFor(() => {
      expect(mocks.updateSessionWithMessages).toHaveBeenCalledTimes(4)
    })

    const lastCall = mocks.updateSessionWithMessages.mock.calls.at(-1)
    expect(lastCall).toBeTruthy()
    if (!lastCall) {
      return
    }

    const [persistedSessionId, updater] = lastCall as unknown as [string, (session: Session) => Promise<Session> | Session]
    expect(persistedSessionId).toBe('session-reviewed-launch-weather-1')
    expect(typeof updater).toBe('function')

    const nextSession = await updater(createActiveWeatherSession())
    expect(getWeatherLaunchPart(nextSession)).toMatchObject({
      lifecycle: 'complete',
      summaryForModel: expect.stringContaining('Weather Dashboard closed for Chicago, Illinois, United States.'),
    })
    expect(listChatBridgeObservabilityEvents({ appId: 'weather-dashboard' }).at(-1)).toMatchObject({
      kind: 'app-event-accepted',
      status: 'healthy',
      details: expect.arrayContaining(['eventKind: app.complete']),
    })
  })
})
