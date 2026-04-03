/**
 * @vitest-environment jsdom
 */

import { MantineProvider } from '@mantine/core'
import {
  createWeatherDashboardDegradedSnapshot,
  createWeatherDashboardLoadingSnapshot,
  createWeatherDashboardReadySnapshot,
  createWeatherDashboardUnavailableSnapshot,
  type WeatherDashboardSnapshot,
} from '@shared/chatbridge'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { WeatherDashboardPanel } from './WeatherDashboardPanel'

function renderPanel(snapshot: WeatherDashboardSnapshot) {
  const onRefresh = vi.fn()
  const onLocationDraftChange = vi.fn()
  const onLocationSubmit = vi.fn()

  render(
    <MantineProvider>
      <WeatherDashboardPanel
        snapshot={snapshot}
        refreshing={false}
        changingLocation={false}
        locationDraft={snapshot.locationQuery ?? ''}
        onLocationDraftChange={onLocationDraftChange}
        onLocationSubmit={onLocationSubmit}
        onRefresh={onRefresh}
      />
    </MantineProvider>
  )

  return { onLocationDraftChange, onLocationSubmit, onRefresh }
}

describe('WeatherDashboardPanel', () => {
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

  it('renders the loading state with explicit placeholder copy', () => {
    const snapshot = createWeatherDashboardLoadingSnapshot({
      request: 'Open Weather Dashboard for Chicago and show the forecast.',
      locationQuery: 'Chicago',
    })

    renderPanel(snapshot)

    expect(screen.getByText('Chicago')).toBeTruthy()
    expect(screen.getByText('Fetching latest conditions')).toBeTruthy()
    expect(screen.getByText('The host is fetching current conditions.')).toBeTruthy()
    expect(screen.getByText('Hourly outlook will populate after the host returns the forecast.')).toBeTruthy()
    expect(screen.getByText('Daily outlook will populate after the host returns the forecast.')).toBeTruthy()
  })

  it('renders the ready dashboard with freshness, hourly, daily, and alert sections', () => {
    const snapshot = createWeatherDashboardReadySnapshot({
      request: 'Open Weather Dashboard for Chicago and show the forecast.',
      locationQuery: 'Chicago',
      locationName: 'Chicago, Illinois, United States',
      timezone: 'America/Chicago',
      units: 'imperial',
      fetchedAt: 1_717_000_000_000,
      staleAt: 1_717_000_600_000,
      referenceTime: 1_717_000_300_000,
      current: {
        temperature: 72,
        apparentTemperature: 70,
        weatherCode: 1,
        conditionLabel: 'Mostly clear',
        windSpeed: 9,
      },
      hourly: [
        {
          timeKey: '2026-04-02T19:00:00.000Z',
          hourLabel: '2 PM',
          temperature: 72,
          weatherCode: 1,
          conditionLabel: 'Mostly clear',
          precipitationChance: 10,
        },
        {
          timeKey: '2026-04-02T20:00:00.000Z',
          hourLabel: '3 PM',
          temperature: 73,
          weatherCode: 2,
          conditionLabel: 'Partly cloudy',
          precipitationChance: 20,
        },
      ],
      daily: [
        {
          dateKey: '2026-04-02',
          dayLabel: 'Thu',
          high: 74,
          low: 58,
          weatherCode: 1,
          conditionLabel: 'Mostly clear',
          precipitationChance: 10,
        },
        {
          dateKey: '2026-04-03',
          dayLabel: 'Fri',
          high: 76,
          low: 60,
          weatherCode: 2,
          conditionLabel: 'Partly cloudy',
          precipitationChance: 20,
        },
      ],
      alerts: [
        {
          source: 'National Weather Service',
          event: 'Severe thunderstorm watch',
          startsAt: 1_717_000_000_000,
          endsAt: 1_717_003_600_000,
          description: 'Storms may produce gusty winds this evening.',
          tags: ['watch'],
        },
      ],
    })

    renderPanel(snapshot)

    expect(screen.getByText('Chicago, Illinois, United States')).toBeTruthy()
    expect(screen.getByText(snapshot.lastUpdatedLabel)).toBeTruthy()
    expect(screen.getByLabelText('Location')).toBeTruthy()
    expect(screen.getByRole('button', { name: /update location/i })).toBeTruthy()
    expect(screen.getByText('Next hours')).toBeTruthy()
    expect(screen.getByText('2 PM')).toBeTruthy()
    expect(screen.getByText('Daily outlook')).toBeTruthy()
    expect(screen.getByText('Fri')).toBeTruthy()
    expect(screen.getByText('Active alerts')).toBeTruthy()
    expect(screen.getByText('Severe thunderstorm watch')).toBeTruthy()
  })

  it('renders partial-data guidance when the host has current conditions but no forecast sections', () => {
    const snapshot = createWeatherDashboardReadySnapshot({
      request: 'Weather in Marfa, Texas',
      locationQuery: 'Marfa',
      locationName: 'Marfa, Texas, United States',
      timezone: 'America/Chicago',
      units: 'imperial',
      fetchedAt: 1_717_000_000_000,
      staleAt: 1_717_000_600_000,
      referenceTime: 1_717_000_300_000,
      current: {
        temperature: 66,
        apparentTemperature: 64,
        weatherCode: 800,
        conditionLabel: 'Clear sky',
        windSpeed: 14,
      },
    })

    renderPanel(snapshot)

    expect(screen.getByText('Marfa, Texas, United States')).toBeTruthy()
    expect(screen.getByText('Hourly outlook is not available for this snapshot.')).toBeTruthy()
    expect(screen.getByText('Daily outlook is not available for this snapshot.')).toBeTruthy()
    expect(screen.getByText('No active weather alerts for this snapshot.')).toBeTruthy()
  })

  it('renders degraded stale-snapshot messaging without dropping the existing weather context', () => {
    const snapshot = createWeatherDashboardDegradedSnapshot({
      request: 'Refresh weather in Chicago.',
      locationQuery: 'Chicago',
      locationName: 'Chicago, Illinois, United States',
      timezone: 'America/Chicago',
      units: 'imperial',
      fetchedAt: 1_717_000_000_000,
      staleAt: 1_717_000_600_000,
      referenceTime: 1_717_000_900_000,
      current: {
        temperature: 68,
        apparentTemperature: 67,
        weatherCode: 3,
        conditionLabel: 'Overcast',
        windSpeed: 10,
      },
      daily: [
        {
          dateKey: '2026-04-02',
          dayLabel: 'Thu',
          high: 70,
          low: 56,
          weatherCode: 3,
          conditionLabel: 'Overcast',
          precipitationChance: 40,
        },
      ],
      degraded: {
        reason: 'upstream-timeout',
        title: 'Upstream timed out',
        message: 'The host kept the last good weather snapshot visible while upstream data is unavailable.',
        retryable: true,
        usingStaleSnapshot: true,
      },
    })

    renderPanel(snapshot)

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Upstream timed out')).toBeTruthy()
    expect(screen.getByText(snapshot.degraded?.message ?? '')).toBeTruthy()
    expect(screen.getAllByText('Showing cached snapshot').length).toBeGreaterThan(0)
    expect(screen.getByText('Overcast')).toBeTruthy()
  })

  it('renders the unavailable state with a clear location recovery prompt', () => {
    const snapshot = createWeatherDashboardUnavailableSnapshot({
      request: 'Open Weather Dashboard',
      reason: 'missing-location',
    })

    renderPanel(snapshot)

    expect(screen.getByText('Weather Dashboard')).toBeTruthy()
    expect(screen.getAllByText('Location needed').length).toBeGreaterThan(0)
    expect(screen.getByText('Weather Dashboard needs a clearer city or place before the host can fetch weather safely.')).toBeTruthy()
    expect(screen.getByText('Ask for weather in a clearer city or region to retry.')).toBeTruthy()
  })
})
