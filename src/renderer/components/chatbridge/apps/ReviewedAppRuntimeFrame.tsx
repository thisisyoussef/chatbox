import {
  type BridgeAppEvent,
  type BridgeReadyEvent,
  createChatBridgeRuntimeCrashRecoveryContract,
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
  type ChatBridgeReviewedAppLaunch,
} from '@/packages/chatbridge/reviewed-app-launch'

interface ReviewedAppRuntimeFrameProps {
  part: MessageAppPart
  launch: ChatBridgeReviewedAppLaunch
  sessionId?: string
  messageId?: string
  minHeight: number
}

function readSnapshotRecord(snapshot: unknown) {
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? (snapshot as Record<string, unknown>)
    : null
}

export function ReviewedAppRuntimeFrame({
  part,
  launch,
  sessionId,
  messageId,
  minHeight,
}: ReviewedAppRuntimeFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const controllerRef = useRef<ReturnType<typeof createBridgeHostController> | null>(null)
  const activeWindowRef = useRef<Window | null>(null)
  const attachingWindowRef = useRef<Window | null>(null)
  const launchRunRef = useRef<LangSmithRunHandle | null>(null)
  const launchRunFinishedRef = useRef(false)
  const persistenceQueueRef = useRef(Promise.resolve())
  const runtimeMarkupRef = useRef<{ appInstanceId: string; markup: string | null } | null>(null)
  const snapshot = readSnapshotRecord(part.snapshot)

  if (!runtimeMarkupRef.current || runtimeMarkupRef.current.appInstanceId !== part.appInstanceId) {
    runtimeMarkupRef.current = {
      appInstanceId: part.appInstanceId,
      markup: createReviewedAppLaunchRuntimeMarkup(launch, part.snapshot),
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
      activeWindowRef.current = null
      attachingWindowRef.current = null
      void finishLaunchRun({
        outputs: {
          status: 'disposed',
          appInstanceId: part.appInstanceId,
        },
      })
    }
  }, [finishLaunchRun, part.appInstanceId])

  useEffect(() => {
    if (!snapshot) {
      return
    }

    controllerRef.current?.syncContext(snapshot)
  }, [snapshot])

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

    if (controllerRef.current && activeWindowRef.current === targetWindow) {
      return
    }

    if (attachingWindowRef.current === targetWindow) {
      return
    }

    attachingWindowRef.current = targetWindow

    const attachPromise = (async () => {
      controllerRef.current?.dispose()
      controllerRef.current = null
      activeWindowRef.current = null

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
            storyId: part.appId === 'drawing-kit' ? 'CB-509' : 'CB-305',
            uiEntry: launch.uiEntry ?? null,
          },
          tags: [
            'chatbridge',
            'renderer',
            'bridge',
            'reviewed-app-launch',
            part.appId === 'drawing-kit' ? 'cb-509' : 'cb-305',
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
      activeWindowRef.current = targetWindow
      attachingWindowRef.current = null

      void controller.waitForReady().catch((error) => {
        void finishLaunchRun({
          error: error instanceof Error ? error.message : String(error),
        })
      })
    })()

    void attachPromise.catch(() => {
      if (attachingWindowRef.current === targetWindow) {
        attachingWindowRef.current = null
      }
    })
  }

  if (!runtimeMarkup) {
    return null
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
        minHeight,
      }}
      onLoad={handleLoad}
    />
  )
}
