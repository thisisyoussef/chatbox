import { Button, Loader, Text, TextInput } from '@mantine/core'
import {
  formatWeatherAlertTime,
  formatWeatherTemperature,
  formatWeatherWindSpeed,
  type WeatherDashboardSnapshot,
} from '@shared/chatbridge'

interface WeatherDashboardPanelProps {
  snapshot: WeatherDashboardSnapshot
  refreshing: boolean
  changingLocation: boolean
  locationDraft: string
  onLocationDraftChange: (value: string) => void
  onLocationSubmit: () => void
  onRefresh: () => void
}

function getStatusBadgeClasses(snapshot: WeatherDashboardPanelProps['snapshot']) {
  if (snapshot.status === 'ready') {
    return 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300'
  }

  if (snapshot.status === 'degraded') {
    return 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
  }

  if (snapshot.status === 'unavailable') {
    return 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
  }

  return 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-200'
}

function getHeroSurfaceClasses(snapshot: WeatherDashboardPanelProps['snapshot']) {
  if (snapshot.status === 'degraded') {
    return 'border-amber-200 bg-[linear-gradient(145deg,rgba(254,243,199,0.92),rgba(255,255,255,0.98))] dark:border-amber-800/60 dark:bg-[linear-gradient(145deg,rgba(120,53,15,0.35),rgba(15,23,42,0.92))]'
  }

  if (snapshot.status === 'unavailable') {
    return 'border-rose-200 bg-[linear-gradient(145deg,rgba(255,228,230,0.95),rgba(255,255,255,0.98))] dark:border-rose-800/60 dark:bg-[linear-gradient(145deg,rgba(136,19,55,0.35),rgba(15,23,42,0.92))]'
  }

  return 'border-sky-200 bg-[linear-gradient(145deg,rgba(224,242,254,0.95),rgba(255,255,255,0.98))] dark:border-sky-900/60 dark:bg-[linear-gradient(145deg,rgba(12,74,110,0.38),rgba(15,23,42,0.92))]'
}

function getHourlyEmptyState(snapshot: WeatherDashboardPanelProps['snapshot']) {
  if (snapshot.status === 'loading') {
    return 'Hourly outlook will populate when the forecast finishes loading.'
  }

  return 'Hourly outlook is not available for this snapshot.'
}

function getDailyEmptyState(snapshot: WeatherDashboardPanelProps['snapshot']) {
  if (snapshot.status === 'loading') {
    return 'Daily outlook will populate when the forecast finishes loading.'
  }

  return 'Daily outlook is not available for this snapshot.'
}

function getAlertEmptyState(snapshot: WeatherDashboardPanelProps['snapshot']) {
  if (snapshot.status === 'loading') {
    return 'Weather alerts will appear here when the forecast finishes loading.'
  }

  return 'No active weather alerts for this snapshot.'
}

const PANEL_SECTION_CLASSES =
  'rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50'

const DETAIL_CARD_CLASSES =
  'rounded-[18px] border border-chatbox-border-primary bg-chatbox-background-secondary px-3 py-3'

export function WeatherDashboardPanel({
  snapshot,
  refreshing,
  changingLocation,
  locationDraft,
  onLocationDraftChange,
  onLocationSubmit,
  onRefresh,
}: WeatherDashboardPanelProps) {
  const hasCurrentData = Boolean(snapshot.current)
  const hourlyItems = snapshot.hourly
  const dailyItems = snapshot.daily.length > 0 ? snapshot.daily : snapshot.forecast
  const hasHourlyData = hourlyItems.length > 0
  const hasDailyData = dailyItems.length > 0
  const hasAlerts = snapshot.alerts.length > 0
  const controlsDisabled = refreshing || changingLocation
  const requestedLocationLabel =
    snapshot.locationQuery && snapshot.locationQuery !== snapshot.locationName
      ? `Requested as ${snapshot.locationQuery}`
      : null

  return (
    <div data-testid="weather-dashboard-panel" className="w-full overflow-hidden rounded-[24px] border border-chatbox-border-primary">
      <div className="bg-chatbox-background-primary p-4">
        <div className={`overflow-hidden rounded-[24px] border p-5 ${getHeroSurfaceClasses(snapshot)}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Text size="xl" fw={800} className="text-chatbox-primary">
                {snapshot.locationName}
              </Text>
              <Text size="sm" c="dimmed" className="mt-2 max-w-[52ch] whitespace-pre-wrap">
                {snapshot.headline}
              </Text>
              {requestedLocationLabel ? (
                <Text size="xs" c="dimmed" className="mt-2 uppercase tracking-[0.08em]">
                  {requestedLocationLabel}
                </Text>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getStatusBadgeClasses(snapshot)}`}
              >
                {snapshot.statusText}
              </span>
              <Button
                variant={snapshot.status === 'degraded' || snapshot.status === 'unavailable' ? 'filled' : 'light'}
                size="compact-sm"
                loading={refreshing}
                disabled={changingLocation}
                onClick={onRefresh}
              >
                Refresh weather
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <section className={PANEL_SECTION_CLASSES}>
              <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
                Now
              </Text>
              {hasCurrentData ? (
                <>
                  <Text className="mt-2 text-[42px] font-black leading-none text-chatbox-primary">
                    {snapshot.current ? formatWeatherTemperature(snapshot.current.temperature, snapshot.units) : '--'}
                  </Text>
                  <Text size="sm" c="dimmed" className="mt-2">
                    {snapshot.current?.conditionLabel ?? 'Current conditions unavailable'}
                  </Text>
                </>
              ) : (
                <div className="mt-5 flex items-center gap-3">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">
                    {snapshot.status === 'loading'
                      ? 'Current conditions are loading.'
                      : 'Current conditions are not available for this request.'}
                  </Text>
                </div>
              )}

              {hasCurrentData ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className={DETAIL_CARD_CLASSES}>
                    <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
                      Feels like
                    </Text>
                    <Text size="sm" fw={700} className="mt-1 text-chatbox-primary">
                      {typeof snapshot.current?.apparentTemperature === 'number'
                        ? formatWeatherTemperature(snapshot.current.apparentTemperature, snapshot.units)
                        : 'Unavailable'}
                    </Text>
                  </div>
                  <div className={DETAIL_CARD_CLASSES}>
                    <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
                      Wind
                    </Text>
                    <Text size="sm" fw={700} className="mt-1 text-chatbox-primary">
                      {typeof snapshot.current?.windSpeed === 'number'
                        ? formatWeatherWindSpeed(snapshot.current.windSpeed, snapshot.units)
                        : 'Unavailable'}
                    </Text>
                  </div>
                  <div className={DETAIL_CARD_CLASSES}>
                    <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
                      Snapshot summary
                    </Text>
                    <Text size="sm" fw={700} className="mt-1 text-chatbox-primary">
                      {snapshot.statusText}
                    </Text>
                  </div>
                </div>
              ) : null}
            </section>

            <section className={PANEL_SECTION_CLASSES}>
              <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
                Location
              </Text>
              <Text size="sm" c="dimmed" className="mt-3 whitespace-pre-wrap">
                {snapshot.lastUpdatedLabel}
              </Text>
              <form
                className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault()
                  onLocationSubmit()
                }}
              >
                <TextInput
                  label="Location"
                  value={locationDraft}
                  onChange={(event) => onLocationDraftChange(event.currentTarget.value)}
                  placeholder="Change city or region"
                  disabled={controlsDisabled}
                  className="min-w-0 flex-1"
                />
                <Button
                  type="submit"
                  variant="default"
                  size="compact-sm"
                  loading={changingLocation}
                  disabled={controlsDisabled || locationDraft.trim().length === 0}
                >
                  Update location
                </Button>
              </form>
            </section>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <section className={PANEL_SECTION_CLASSES}>
            <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
              Next hours
            </Text>
            {hasHourlyData ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {hourlyItems.map((hour) => (
                  <div key={hour.timeKey} className={DETAIL_CARD_CLASSES}>
                    <Text size="sm" fw={700} className="text-chatbox-primary">
                      {hour.hourLabel}
                    </Text>
                    <Text size="lg" fw={800} className="mt-2 text-chatbox-primary">
                      {formatWeatherTemperature(hour.temperature, snapshot.units)}
                    </Text>
                    <Text size="xs" c="dimmed" className="mt-1">
                      {hour.conditionLabel}
                    </Text>
                    <Text size="xs" c="dimmed" className="mt-2">
                      {typeof hour.precipitationChance === 'number'
                        ? `${Math.round(hour.precipitationChance)}% precipitation`
                        : 'Precipitation unavailable'}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Text size="sm" c="dimmed" className="mt-3">
                {getHourlyEmptyState(snapshot)}
              </Text>
            )}
          </section>

          <section className={PANEL_SECTION_CLASSES}>
            <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
              Daily outlook
            </Text>
            {hasDailyData ? (
              <div className="mt-3 grid gap-2">
                {dailyItems.map((day) => (
                  <div
                    key={`${day.dateKey}-${day.dayLabel}`}
                    className="flex items-center justify-between gap-3 rounded-[18px] border border-chatbox-border-primary bg-chatbox-background-secondary px-3 py-3"
                  >
                    <div className="min-w-0">
                      <Text size="sm" fw={700} className="text-chatbox-primary">
                        {day.dayLabel}
                      </Text>
                      <Text size="xs" c="dimmed" className="mt-1">
                        {day.conditionLabel}
                        {typeof day.precipitationChance === 'number'
                          ? ` · ${Math.round(day.precipitationChance)}% precip`
                          : ''}
                      </Text>
                    </div>
                    <Text size="sm" fw={700} className="whitespace-nowrap text-chatbox-primary">
                      {formatWeatherTemperature(day.high, snapshot.units)} / {formatWeatherTemperature(day.low, snapshot.units)}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Text size="sm" c="dimmed" className="mt-3">
                {getDailyEmptyState(snapshot)}
              </Text>
            )}
          </section>
        </div>

        <section className={`mt-4 ${PANEL_SECTION_CLASSES}`}>
          <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
            Active alerts
          </Text>
          {hasAlerts ? (
            <div className="mt-3 grid gap-3">
              {snapshot.alerts.map((alert) => (
                <div key={`${alert.source}-${alert.event}-${alert.startsAt}`} className={DETAIL_CARD_CLASSES}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Text size="sm" fw={700} className="text-chatbox-primary">
                        {alert.event}
                      </Text>
                      <Text size="xs" c="dimmed" className="mt-1">
                        {alert.source}
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed" className="text-right">
                      {formatWeatherAlertTime(alert.startsAt, snapshot.timezone)}
                      {typeof alert.endsAt === 'number'
                        ? ` to ${formatWeatherAlertTime(alert.endsAt, snapshot.timezone)}`
                        : ''}
                    </Text>
                  </div>
                  <Text size="sm" className="mt-3 whitespace-pre-wrap text-chatbox-primary">
                    {alert.description}
                  </Text>
                  {alert.tags.length > 0 ? (
                    <Text size="xs" c="dimmed" className="mt-2 uppercase tracking-[0.08em]">
                      {alert.tags.join(' · ')}
                    </Text>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <Text size="sm" c="dimmed" className="mt-3">
              {getAlertEmptyState(snapshot)}
            </Text>
          )}
        </section>

        {snapshot.degraded ? (
          <div
            role="alert"
            className="mt-4 rounded-[20px] border border-amber-300 bg-amber-50/90 p-4 dark:border-amber-700 dark:bg-amber-950/20"
          >
            <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">
              {snapshot.degraded.title}
            </Text>
            <Text size="sm" fw={700} className="mt-2 whitespace-pre-wrap text-chatbox-primary">
              {snapshot.degraded.message}
            </Text>
          </div>
        ) : null}
      </div>
    </div>
  )
}
