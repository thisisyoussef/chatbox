import {
  type BridgeAppEvent,
  type BridgeReadyEvent,
  createChatBridgeRuntimeCrashRecoveryContract,
  DRAWING_KIT_APP_ID,
  WEATHER_DASHBOARD_APP_ID,
} from '@shared/chatbridge'
import { CHATBRIDGE_LANGSMITH_PROJECT_NAME } from '@shared/models/tracing'
import type { MessageAppPart } from '@shared/types'
import type { LangSmithRunHandle } from '@shared/utils/langsmith_adapter'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { langsmith } from '@/adapters/langsmith'
import { createBridgeHostController } from '@/packages/chatbridge/bridge/host-controller'
import { createReviewedAppLaunchRuntimeMarkup } from '@/packages/chatbridge/bridge/reviewed-app-runtime'
import {
  persistReviewedAppLaunchBootstrap,
  persistReviewedAppLaunchBridgeEvent,
  persistReviewedAppLaunchBridgeReady,
  persistReviewedAppLaunchRecovery,
  readChatBridgeReviewedAppLaunch,
} from '@/packages/chatbridge/reviewed-app-launch'
import { WeatherDashboardLaunchSurface } from './weather/WeatherDashboardLaunchSurface'

interface ReviewedAppLaunchSurfaceProps {
  part: MessageAppPart
  sessionId?: string
  messageId?: string
}

function readSnapshotRecord(snapshot: unknown) {
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? (snapshot as Record<string, unknown>)
    : null
}

export function ReviewedAppLaunchSurface({ part, sessionId, messageId }: ReviewedAppLaunchSurfaceProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const controllerRef = useRef<ReturnType<typeof createBridgeHostController> | null>(null)
  const launchRunRef = useRef<LangSmithRunHandle | null>(null)
  const launchRunFinishedRef = useRef(false)
  const persistenceQueueRef = useRef(Promise.resolve())
  const runtimeMarkupRef = useRef<{ appInstanceId: string; markup: string | null } | null>(null)
  const launch = readChatBridgeReviewedAppLaunch(part.values)
  const snapshot = readSnapshotRecord(part.snapshot)
  const isDrawingKit = part.appId === DRAWING_KIT_APP_ID
  const isWeatherDashboard = part.appId === WEATHER_DASHBOARD_APP_ID

  if (!runtimeMarkupRef.current || runtimeMarkupRef.current.appInstanceId !== part.appInstanceId) {
    runtimeMarkupRef.current = {
      appInstanceId: part.appInstanceId,
      markup: !launch || isWeatherDashboard ? null : createReviewedAppLaunchRuntimeMarkup(launch, part.snapshot),
    }
  }

  const runtimeMarkup = runtimeMarkupRef.current?.markup ?? null

  const expectedOrigin = useMemo(() => window.location.origin || 'null', [])
  const bootstrapTargetOrigin = '*'

  function enqueuePersistence(task: () => Promise<void>) {
    persistenceQueueRef.current = persistenceQueueRef.current
      .catch(() => undefined)
      .then(task)
      .catch((error) => {
        console.error('Failed to persist reviewed app launch lifecycle event:', error)
      })

    return persistenceQueueRef.current
  }

  const finishLaunchRun = useCallback(async (result?: Parameters<LangSmithRunHandle['end']>[0]) => {
    if (!launchRunRef.current || launchRunFinishedRef.current) {
      return
    }

    launchRunFinishedRef.current = true
    const activeRun = launchRunRef.current
    launchRunRef.current = null
    await activeRun.end(result)
  }, [])

  useEffect(() => {
    return () => {
      controllerRef.current?.dispose()
      controllerRef.current = null
      void finishLaunchRun({
        outputs: {
          status: 'disposed',
          appInstanceId: part.appInstanceId,
        },
      })
    }
  }, [finishLaunchRun, part.appInstanceId])

  useEffect(() => {
    if (!isDrawingKit || !snapshot) {
      return
    }

    controllerRef.current?.syncContext(snapshot)
  }, [isDrawingKit, snapshot])

  if (!launch || part.lifecycle === 'error' || part.lifecycle === 'stale' || part.lifecycle === 'complete') {
    return null
  }

  if (isWeatherDashboard) {
    return <WeatherDashboardLaunchSurface part={part} launch={launch} sessionId={sessionId} messageId={messageId} />
  }

  if (!runtimeMarkup) {
    return null
  }

  const persistBootstrap = async (bridgeSessionId: string) => {
    if (!sessionId || !messageId) {
      return
    }

    await persistReviewedAppLaunchBootstrap({
      sessionId,
      messageId,
      part,
      bridgeSessionId,
    })
  }

  const persistReady = async (event: BridgeReadyEvent) => {
    if (!sessionId || !messageId) {
      return
    }

    await persistReviewedAppLaunchBridgeReady({
      sessionId,
      messageId,
      part,
      event,
    })
  }

  const persistAcceptedEvent = async (event: Exclude<BridgeAppEvent, BridgeReadyEvent>) => {
    if (!sessionId || !messageId) {
      return
    }

    await persistReviewedAppLaunchBridgeEvent({
      sessionId,
      messageId,
      part,
      event,
    })
  }

  const persistRecovery = async (contract: Parameters<typeof persistReviewedAppLaunchRecovery>[0]['contract']) => {
    if (!sessionId || !messageId) {
      return
    }

    await persistReviewedAppLaunchRecovery({
      sessionId,
      messageId,
      part,
      contract,
    })
  }

  const handleLoad = () => {
    const targetWindow = iframeRef.current?.contentWindow
    if (!targetWindow) {
      void persistRecovery(
        createChatBridgeRuntimeCrashRecoveryContract({
          appId: part.appId,
          appName: part.appName,
          appInstanceId: part.appInstanceId,
          bridgeSessionId: part.bridgeSessionId,
          error: 'The reviewed app launch iframe never exposed a runtime window.',
        })
      )
      return
    }

    void (async () => {
      controllerRef.current?.dispose()
      controllerRef.current = null

      let traceParentRunId: string | undefined
      try {
        const run = await langsmith.startRun({
          name: 'chatbridge.runtime.reviewed-app-launch',
          projectName: CHATBRIDGE_LANGSMITH_PROJECT_NAME,
          runType: 'chain',
          inputs: {
            sessionId: sessionId ?? null,
            messageId: messageId ?? null,
            appId: part.appId,
            appName: part.appName ?? launch.appName,
            appInstanceId: part.appInstanceId,
            toolName: launch.toolName,
            request: launch.request ?? null,
            capability: launch.capability ?? null,
          },
          metadata: {
            operation: 'reviewed-app-bridge-launch',
            storyId: part.appId === DRAWING_KIT_APP_ID ? 'CB-509' : 'CB-305',
            uiEntry: launch.uiEntry ?? null,
          },
          tags: [
            'chatbridge',
            'renderer',
            'bridge',
            'reviewed-app-launch',
            part.appId === DRAWING_KIT_APP_ID ? 'cb-509' : 'cb-305',
          ],
        })
        launchRunRef.current = run
        launchRunFinishedRef.current = false
        traceParentRunId = run.runId
      } catch {
        traceParentRunId = undefined
      }

      const controller = createBridgeHostController({
        appId: part.appId,
        appName: part.appName ?? launch.appName,
        appVersion: launch.appVersion,
        appInstanceId: part.appInstanceId,
        expectedOrigin,
        bootstrapTargetOrigin,
        capabilities: ['launch-reviewed-app'],
        traceAdapter: langsmith,
        traceParentRunId,
        onReady: (event) => {
          void enqueuePersistence(() => persistReady(event))
        },
        onAcceptedAppEvent: (event) => {
          void enqueuePersistence(async () => {
            await persistAcceptedEvent(event)
            if (event.kind === 'app.state') {
              await finishLaunchRun({
                outputs: {
                  status: 'active',
                  appId: part.appId,
                  appInstanceId: part.appInstanceId,
                  bridgeSessionId: event.bridgeSessionId,
                },
              })
            }
          })
        },
        onRecoveryDecision: (contract) => {
          void enqueuePersistence(async () => {
            await persistRecovery(contract)
            await finishLaunchRun({
              error: contract.summary,
              metadata: {
                traceCode: contract.observability.traceCode,
              },
            })
          })
        },
      })

      if (snapshot) {
        controller.syncContext(snapshot)
      }

      await persistBootstrap(controller.getSession().envelope.bridgeSessionId)
      controller.attach(targetWindow as unknown as Parameters<typeof controller.attach>[0])
      controllerRef.current = controller

      void controller.waitForReady().catch((error) => {
        void finishLaunchRun({
          error: error instanceof Error ? error.message : String(error),
        })
      })
    })()
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={runtimeMarkup}
      title={`${launch.appName} reviewed app runtime`}
      sandbox="allow-scripts allow-forms"
      className="w-full border-none"
      style={{
        height: '100%',
        minHeight: isDrawingKit ? 560 : 260,
      }}
      onLoad={handleLoad}
    />
  )
}
