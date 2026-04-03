import { describe, expect, it } from 'vitest'
import {
  createWeatherDashboardCloseCompletion,
  createWeatherDashboardDegradedSnapshot,
  createWeatherDashboardReadySnapshot,
  isWeatherDashboardSnapshotStale,
  normalizeWeatherLocationHint,
  reconcileWeatherDashboardSnapshot,
  resolveWeatherUnits,
} from './weather-dashboard'

describe('weather dashboard snapshot helpers', () => {
  it('extracts a usable location hint from common weather phrasing', () => {
    expect(normalizeWeatherLocationHint(undefined, 'Open Weather Dashboard for Chicago and show the forecast.')).toBe(
      'Chicago'
    )
    expect(normalizeWeatherLocationHint(undefined, 'What is the weather in San Francisco today?')).toBe('San Francisco')
    expect(normalizeWeatherLocationHint('Austin', 'Ignore the prompt and use Austin.')).toBe('Austin')
  })

  it('defaults units from the request text when explicit units are missing', () => {
    expect(resolveWeatherUnits('Show me the Tokyo forecast in celsius.')).toBe('metric')
    expect(resolveWeatherUnits('Weather in Dallas right now')).toBe('imperial')
  })

  it('builds a ready snapshot with host-owned summary text', () => {
    const snapshot = createWeatherDashboardReadySnapshot({
      request: 'Show me the weather in Chicago.',
      locationQuery: 'Chicago',
      locationName: 'Chicago, Illinois, United States',
      timezone: 'America/Chicago',
      units: 'imperial',
      fetchedAt: 1_717_000_000_000,
      staleAt: 1_717_000_600_000,
      referenceTime: 1_717_000_300_000,
      cacheStatus: 'miss',
      current: {
        temperature: 71.8,
        apparentTemperature: 70.2,
        weatherCode: 1,
        conditionLabel: 'Mostly clear',
        windSpeed: 8.4,
      },
      hourly: [
        {
          timeKey: '2026-04-02T18:00:00-05:00',
          hourLabel: '1 PM',
          temperature: 72,
          weatherCode: 1,
          conditionLabel: 'Mostly clear',
          precipitationChance: 10,
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
      ],
    })

    expect(snapshot).toMatchObject({
      status: 'ready',
      cacheStatus: 'miss',
      locationName: 'Chicago, Illinois, United States',
      statusText: 'Live weather',
      headline: '72°F and Mostly clear',
      fetchedAt: 1_717_000_000_000,
      staleAt: 1_717_000_600_000,
    })
    expect(snapshot.summary).toContain('Weather Dashboard is active for Chicago, Illinois, United States.')
    expect(snapshot.summary).toContain('Next 1 hours: 1 PM 72°F Mostly clear.')
    expect(snapshot.summary).toContain('Next 1 days: Thu 74°F/58°F Mostly clear.')
    expect(snapshot.summary).toContain('Freshness window lasts until')
    expect(snapshot.daily).toHaveLength(1)
    expect(snapshot.forecast).toHaveLength(1)
  })

  it('builds a degraded snapshot that preserves stale data when needed', () => {
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
      forecast: [],
      degraded: {
        reason: 'upstream-timeout',
        title: 'Upstream timed out',
        message: 'The host kept the last good weather snapshot visible while upstream data is unavailable.',
        retryable: true,
        usingStaleSnapshot: true,
      },
    })

    expect(snapshot).toMatchObject({
      status: 'degraded',
      cacheStatus: 'stale-fallback',
      statusText: 'Showing cached snapshot',
      fetchedAt: 1_717_000_000_000,
      staleAt: 1_717_000_600_000,
    })
    expect(snapshot.summary).toContain('last good snapshot')
    expect(snapshot.summary).toContain('upstream data is unavailable')
    expect(snapshot.lastUpdatedLabel).toContain('freshness window passed')
  })

  it('reconciles a persisted ready snapshot into explicit stale reopen messaging', () => {
    const snapshot = createWeatherDashboardReadySnapshot({
      request: 'Open Weather Dashboard for Chicago and show the forecast.',
      locationQuery: 'Chicago',
      locationName: 'Chicago, Illinois, United States',
      timezone: 'America/Chicago',
      units: 'imperial',
      fetchedAt: 1_717_000_000_000,
      staleAt: 1_717_000_600_000,
      referenceTime: 1_717_000_300_000,
      cacheStatus: 'miss',
      current: {
        temperature: 71.8,
        apparentTemperature: 70.2,
        weatherCode: 1,
        conditionLabel: 'Mostly clear',
        windSpeed: 8.4,
      },
    })

    const reconciled = reconcileWeatherDashboardSnapshot(snapshot, {
      referenceTime: 1_717_000_900_000,
    })

    expect(reconciled).toMatchObject({
      status: 'ready',
      statusText: 'Weather may be stale',
      dataStateLabel: 'Host snapshot stale',
    })
    expect(reconciled.summary).toContain('older than the host freshness window')
    expect(reconciled.lastUpdatedLabel).toContain('freshness window passed')
  })

  it('creates an explicit close completion summary for later turns', () => {
    const snapshot = createWeatherDashboardReadySnapshot({
      request: 'Open Weather Dashboard for Chicago and show the forecast.',
      locationQuery: 'Chicago',
      locationName: 'Chicago, Illinois, United States',
      timezone: 'America/Chicago',
      units: 'imperial',
      fetchedAt: 1_717_000_000_000,
      staleAt: 1_717_000_600_000,
      referenceTime: 1_717_000_300_000,
      cacheStatus: 'miss',
      current: {
        temperature: 72,
        apparentTemperature: 70,
        weatherCode: 1,
        conditionLabel: 'Mostly clear',
        windSpeed: 9,
      },
    })

    const completion = createWeatherDashboardCloseCompletion(snapshot)

    expect(completion).toMatchObject({
      schemaVersion: 1,
      status: 'success',
      outcomeData: {
        locationName: 'Chicago, Illinois, United States',
        snapshotStatus: 'ready',
        cacheStatus: 'miss',
      },
      suggestedSummary: {
        text: expect.stringContaining('Weather Dashboard closed for Chicago, Illinois, United States.'),
      },
    })
    expect(completion.suggestedSummary?.text).toContain('72°F and Mostly clear')
    expect(completion.suggestedSummary?.text).toContain('later chat should treat this as the last validated host snapshot')
  })

  it('detects when a snapshot is past its freshness window', () => {
    const snapshot = createWeatherDashboardReadySnapshot({
      locationName: 'Chicago, Illinois, United States',
      timezone: 'America/Chicago',
      units: 'imperial',
      fetchedAt: 1_717_000_000_000,
      staleAt: 1_717_000_600_000,
      referenceTime: 1_717_000_900_000,
      current: {
        temperature: 71,
        weatherCode: 800,
        conditionLabel: 'Clear sky',
      },
    })

    expect(isWeatherDashboardSnapshotStale(snapshot, { now: 1_717_000_900_000 })).toBe(true)
  })
})
