import { CHATBRIDGE_LANGSMITH_PROJECT_NAME } from '@shared/models/tracing'
import {
  ChatBridgeWeatherDashboardResultSchema,
  WeatherDashboardSnapshotSchema,
  WEATHER_DASHBOARD_APP_NAME,
  createWeatherDashboardCloseCompletion,
  createWeatherDashboardDegradedSnapshot,
  createWeatherDashboardLoadingSnapshot,
  normalizeWeatherLocationHint,
  recordChatBridgeObservabilityEvent,
  reconcileWeatherDashboardSnapshot,
  resolveWeatherUnits,
  type ChatBridgeWeatherDashboardResult,
  type ChatBridgeReviewedAppLaunch,
  type WeatherDashboardSnapshot,
} from '@shared/chatbridge'
import { WEATHER_DASHBOARD_WEB_BRIDGE_ENDPOINTS } from '@shared/chatbridge/weather-dashboard-bridge'
import type { LangSmithRunHandle } from '@shared/utils/langsmith_adapter'
import type { MessageAppPart } from '@shared/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { langsmith } from '@/adapters/langsmith'
import {
  persistReviewedAppLaunchBootstrap,
  persistReviewedAppLaunchBridgeEvent,
  persistReviewedAppLaunchBridgeReady,
} from '@/packages/chatbridge/reviewed-app-launch'
import { WeatherDashboardPanel } from './WeatherDashboardPanel'

interface WeatherDashboardLaunchSurfaceProps {
  part: MessageAppPart
  launch: ChatBridgeReviewedAppLaunch
  sessionId?: string
  messageId?: string
}

function parsePartSnapshot(snapshot: unknown) {
  const parsed = WeatherDashboardSnapshotSchema.safeParse(snapshot)
  return parsed.success ? parsed.data : null
}

function createFallbackSnapshot(launch: ChatBridgeReviewedAppLaunch, updatedAt = Date.now()) {
  const locationQuery = normalizeWeatherLocationHint(launch.location, launch.request)
  const units = resolveWeatherUnits(launch.request)

  return createWeatherDashboardDegradedSnapshot({
    request: launch.request,
    locationQuery,
    locationName: locationQuery ?? 'Weather Dashboard',
    units,
    updatedAt,
    degraded: {
      reason: 'upstream-error',
      title: 'Desktop host required',
      message: 'Weather Dashboard requires the desktop host bridge to fetch live weather data.',
      retryable: false,
      usingStaleSnapshot: false,
    },
  })
}

function hasElectronWeatherBridge() {
  return typeof window !== 'undefined' && typeof window.electronAPI?.invoke === 'function'
}

function hasWebWeatherBridge() {
  if (typeof window === 'undefined' || hasElectronWeatherBridge() || typeof fetch !== 'function') {
    return false
  }

  const protocol = window.location?.protocol ?? ''
  return protocol === 'http:' || protocol === 'https:'
}

async function callWebWeatherBridge(payload: {
  request: string | undefined
  location: string | undefined
  units: WeatherDashboardSnapshot['units']
  refresh: boolean
  traceParentRunId: string | undefined
}) {
  try {
    const response = await fetch(WEATHER_DASHBOARD_WEB_BRIDGE_ENDPOINTS.dashboard, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as ChatBridgeWeatherDashboardResult
  } catch (error) {
    console.debug('Weather web bridge is unavailable.', error)
    return null
  }
}

export function WeatherDashboardLaunchSurface({
  part,
  launch,
  sessionId,
  messageId,
}: WeatherDashboardLaunchSurfaceProps) {
  const initialSnapshot = useMemo(() => {
    const fromPart = parsePartSnapshot(part.snapshot)
    if (fromPart) {
      return reconcileWeatherDashboardSnapshot(fromPart, {
        referenceTime: Date.now(),
      })
    }

    return createWeatherDashboardLoadingSnapshot({
      request: launch.request,
      locationQuery: normalizeWeatherLocationHint(launch.location, launch.request),
      units: resolveWeatherUnits(launch.request),
    })
  }, [launch.location, launch.request, part.snapshot])

  const [snapshot, setSnapshot] = useState<WeatherDashboardSnapshot>(initialSnapshot)
  const [locationDraft, setLocationDraft] = useState(
    initialSnapshot.locationQuery ?? normalizeWeatherLocationHint(launch.location, launch.request) ?? ''
  )
  const [busyAction, setBusyAction] = useState<'refresh' | 'location' | null>(null)
  const [closing, setClosing] = useState(false)
  const launchRunRef = useRef<LangSmithRunHandle | null>(null)
  const lastSnapshotRef = useRef<WeatherDashboardSnapshot>(initialSnapshot)
  const bridgeSessionIdRef = useRef(part.bridgeSessionId ?? `weather-dashboard:${part.appInstanceId}:${crypto.randomUUID()}`)
  const nextSequenceRef = useRef(1)
  const initializedRef = useRef(false)
  const latestRequestIdRef = useRef(0)
  const activeRequestRef = useRef<{
    key: string
    promise: Promise<WeatherDashboardSnapshot>
  } | null>(null)

  useEffect(() => {
    initializedRef.current = false
    bridgeSessionIdRef.current = part.bridgeSessionId ?? `weather-dashboard:${part.appInstanceId}:${crypto.randomUUID()}`
    nextSequenceRef.current = 1
  }, [part.appInstanceId])

  useEffect(() => {
    setSnapshot(initialSnapshot)
    lastSnapshotRef.current = initialSnapshot
    setLocationDraft(initialSnapshot.locationQuery ?? normalizeWeatherLocationHint(launch.location, launch.request) ?? '')
  }, [initialSnapshot])

  async function endLaunchRun(result?: Parameters<LangSmithRunHandle['end']>[0]) {
    const activeRun = launchRunRef.current
    launchRunRef.current = null
    if (!activeRun) {
      return
    }

    await activeRun.end(result)
  }

  async function persistReadyState() {
    if (!sessionId || !messageId) {
      return
    }

    await persistReviewedAppLaunchBootstrap({
      sessionId,
      messageId,
      part,
      bridgeSessionId: bridgeSessionIdRef.current,
    })
    await persistReviewedAppLaunchBridgeReady({
      sessionId,
      messageId,
      part,
      event: {
        kind: 'app.ready',
        bridgeSessionId: bridgeSessionIdRef.current,
        appInstanceId: part.appInstanceId,
        bridgeToken: bridgeSessionIdRef.current,
        ackNonce: bridgeSessionIdRef.current,
        sequence: nextSequenceRef.current++,
      },
    })
  }

  function recordAcceptedWeatherEvent(
    eventKind: 'app.state' | 'app.complete',
    options: {
      snapshot?: WeatherDashboardSnapshot
      fallbackSource?: 'renderer-persisted-snapshot'
    } = {}
  ) {
    const status =
      eventKind === 'app.complete'
        ? 'healthy'
        : options.snapshot?.status === 'degraded' || options.snapshot?.status === 'unavailable'
          ? 'degraded'
          : 'healthy'

    recordChatBridgeObservabilityEvent({
      eventId: crypto.randomUUID(),
      occurredAt: Date.now(),
      kind: 'app-event-accepted',
      severity: status === 'degraded' ? 'warn' : 'info',
      status,
      appId: part.appId,
      appName: part.appName ?? WEATHER_DASHBOARD_APP_NAME,
      version: launch.appVersion,
      appInstanceId: part.appInstanceId,
      bridgeSessionId: bridgeSessionIdRef.current,
      summary: `${part.appName ?? WEATHER_DASHBOARD_APP_NAME} sent ${eventKind} and the host accepted it.`,
      details: [
        `eventKind: ${eventKind}`,
        ...(options.snapshot ? [`cacheStatus: ${options.snapshot.cacheStatus}`] : []),
        ...(options.fallbackSource ? [`fallbackSource: ${options.fallbackSource}`] : []),
        ...(eventKind === 'app.complete' ? ['completion accepted'] : []),
      ],
    })
  }

  async function persistSnapshot(
    nextSnapshot: WeatherDashboardSnapshot,
    reason: 'initial' | 'refresh' | 'fallback',
    options: {
      fallbackSource?: 'renderer-persisted-snapshot'
    } = {}
  ) {
    if (sessionId && messageId) {
      await persistReviewedAppLaunchBridgeEvent({
        sessionId,
        messageId,
        part,
        event: {
          kind: 'app.state',
          bridgeSessionId: bridgeSessionIdRef.current,
          appInstanceId: part.appInstanceId,
          bridgeToken: bridgeSessionIdRef.current,
          sequence: nextSequenceRef.current++,
          idempotencyKey: `${reason}-${nextSnapshot.updatedAt}-${nextSnapshot.cacheStatus}`,
          snapshot: nextSnapshot,
        },
      })
    }

    recordAcceptedWeatherEvent('app.state', {
      snapshot: nextSnapshot,
      fallbackSource: options.fallbackSource,
    })
  }

  function resolveActiveLocation(locationOverride?: string) {
    const explicitLocation = locationOverride?.trim()
    if (explicitLocation) {
      return explicitLocation
    }

    return (
      lastSnapshotRef.current.locationQuery ??
      normalizeWeatherLocationHint(launch.location, launch.request) ??
      launch.location ??
      undefined
    )
  }

  function buildRequestText(locationOverride?: string) {
    const explicitLocation = locationOverride?.trim()
    if (explicitLocation) {
      return `Open Weather Dashboard for ${explicitLocation} and show the forecast.`
    }

    return lastSnapshotRef.current.request ?? launch.request
  }

  async function fetchSnapshot(options: { refresh: boolean; locationOverride?: string }) {
    const location = resolveActiveLocation(options.locationOverride)
    const request = buildRequestText(options.locationOverride)
    const units = lastSnapshotRef.current.units ?? resolveWeatherUnits(request)
    const requestKey = JSON.stringify({
      location: location ?? null,
      units,
      refresh: options.refresh,
    })

    if (activeRequestRef.current?.key === requestKey) {
      return await activeRequestRef.current.promise
    }

    const requestId = ++latestRequestIdRef.current

    const requestPromise = (async () => {
      let result: ChatBridgeWeatherDashboardResult | null = null

      if (hasElectronWeatherBridge()) {
        result = (await window.electronAPI.invoke('chatbridge-weather:get-dashboard', {
          request,
          location,
          units,
          refresh: options.refresh,
          traceParentRunId: launchRunRef.current?.runId,
        })) as ChatBridgeWeatherDashboardResult
      } else if (hasWebWeatherBridge()) {
        result = await callWebWeatherBridge({
          request,
          location,
          units,
          refresh: options.refresh,
          traceParentRunId: launchRunRef.current?.runId,
        })
      }

      if (!result) {
        const fallbackSnapshot = reconcileWeatherDashboardSnapshot(createFallbackSnapshot(launch), {
          referenceTime: Date.now(),
          fallbackSnapshot: lastSnapshotRef.current,
        })
        const fallbackSource =
          fallbackSnapshot.cacheStatus === 'stale-fallback' ? ('renderer-persisted-snapshot' as const) : undefined
        if (requestId === latestRequestIdRef.current) {
          setSnapshot(fallbackSnapshot)
          lastSnapshotRef.current = fallbackSnapshot
          setLocationDraft(fallbackSnapshot.locationQuery ?? location ?? '')
          await persistSnapshot(fallbackSnapshot, 'fallback', { fallbackSource })
        }
        return fallbackSnapshot
      }

      const parsed = ChatBridgeWeatherDashboardResultSchema.parse(result)
      if (requestId !== latestRequestIdRef.current) {
        return parsed.snapshot
      }

      const nextSnapshot = reconcileWeatherDashboardSnapshot(parsed.snapshot, {
        referenceTime: Date.now(),
        fallbackSnapshot: lastSnapshotRef.current,
      })
      const fallbackSource =
        parsed.snapshot.status === 'degraded' &&
        !parsed.snapshot.degraded?.usingStaleSnapshot &&
        nextSnapshot.cacheStatus === 'stale-fallback'
          ? ('renderer-persisted-snapshot' as const)
          : undefined

      setSnapshot(nextSnapshot)
      lastSnapshotRef.current = nextSnapshot
      setLocationDraft(nextSnapshot.locationQuery ?? location ?? '')
      await persistSnapshot(nextSnapshot, options.refresh ? 'refresh' : 'initial', { fallbackSource })
      return nextSnapshot
    })().finally(() => {
      if (activeRequestRef.current?.promise === requestPromise) {
        activeRequestRef.current = null
      }
    })

    activeRequestRef.current = {
      key: requestKey,
      promise: requestPromise,
    }

    return await requestPromise
  }

  useEffect(() => {
    let disposed = false

    void (async () => {
      try {
        launchRunRef.current = await langsmith.startRun({
          name: 'chatbridge.runtime.weather-dashboard',
          projectName: CHATBRIDGE_LANGSMITH_PROJECT_NAME,
          runType: 'chain',
          inputs: {
            sessionId: sessionId ?? null,
            messageId: messageId ?? null,
            appId: part.appId,
            appInstanceId: part.appInstanceId,
            request: launch.request ?? null,
            location: launch.location ?? null,
          },
          metadata: {
            operation: 'weather-dashboard-runtime',
            storyId: 'CB-510',
            uiEntry: launch.uiEntry ?? null,
          },
          tags: ['chatbridge', 'renderer', 'weather-dashboard', 'cb-510'],
        })
      } catch {
        launchRunRef.current = null
      }

      if (initializedRef.current) {
        return
      }

      initializedRef.current = true
      await persistReadyState()

      await fetchSnapshot({ refresh: false })
      if (disposed) {
        return
      }
    })()

    return () => {
      disposed = true
      void endLaunchRun({
        outputs: {
          status: lastSnapshotRef.current.status,
          cacheStatus: lastSnapshotRef.current.cacheStatus,
          locationName: lastSnapshotRef.current.locationName,
        },
      })
    }
  }, [launch.location, launch.request, launch.uiEntry, messageId, part.appId, part.appInstanceId, sessionId])

  const handleRefresh = async () => {
    if (busyAction) {
      return
    }

    setBusyAction('refresh')
    try {
      await fetchSnapshot({ refresh: true })
    } finally {
      setBusyAction(null)
    }
  }

  const handleLocationSubmit = async () => {
    const trimmedLocation = locationDraft.trim()
    if (!trimmedLocation || busyAction) {
      return
    }

    if (trimmedLocation === resolveActiveLocation()) {
      return
    }

    setBusyAction('location')
    try {
      await fetchSnapshot({
        refresh: false,
        locationOverride: trimmedLocation,
      })
    } finally {
      setBusyAction(null)
    }
  }

  const handleClose = async () => {
    if (busyAction || closing) {
      return
    }

    setClosing(true)
    try {
      const completion = createWeatherDashboardCloseCompletion(lastSnapshotRef.current)

      if (sessionId && messageId) {
        await persistReviewedAppLaunchBridgeEvent({
          sessionId,
          messageId,
          part,
          event: {
            kind: 'app.complete',
            bridgeSessionId: bridgeSessionIdRef.current,
            appInstanceId: part.appInstanceId,
            bridgeToken: bridgeSessionIdRef.current,
            sequence: nextSequenceRef.current++,
            idempotencyKey: `complete-${lastSnapshotRef.current.updatedAt}-${Date.now()}`,
            completion,
          },
        })
      }

      recordAcceptedWeatherEvent('app.complete')
      await endLaunchRun({
        outputs: {
          status: 'complete',
          cacheStatus: lastSnapshotRef.current.cacheStatus,
          locationName: lastSnapshotRef.current.locationName,
        },
      })
    } finally {
      setClosing(false)
    }
  }

  return (
    <WeatherDashboardPanel
      snapshot={snapshot}
      refreshing={busyAction === 'refresh'}
      closing={closing}
      changingLocation={busyAction === 'location'}
      locationDraft={locationDraft}
      onLocationDraftChange={setLocationDraft}
      onLocationSubmit={() => void handleLocationSubmit()}
      onClose={() => void handleClose()}
      onRefresh={() => void handleRefresh()}
    />
  )
}
