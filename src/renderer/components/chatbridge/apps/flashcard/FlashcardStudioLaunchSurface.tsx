import { Button, Loader, Text } from '@mantine/core'
import {
  createInitialFlashcardStudioAppSnapshot,
  parseFlashcardStudioAppSnapshot,
  updateFlashcardStudioAppSnapshot,
  type ChatBridgeReviewedAppLaunch,
} from '@shared/chatbridge'
import type { MessageAppPart } from '@shared/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  connectFlashcardStudioDrive,
  createFlashcardDriveErrorSnapshot,
  getFlashcardDriveErrorMessage,
  getFlashcardDriveFailureState,
  hydrateFlashcardStudioDriveSnapshot,
  loadFlashcardStudioDriveSnapshot,
  saveFlashcardStudioDriveSnapshot,
} from '@/packages/chatbridge/flashcard-drive'
import { persistReviewedAppLaunchHostSnapshot } from '@/packages/chatbridge/reviewed-app-launch'
import { ReviewedAppRuntimeFrame } from '../ReviewedAppRuntimeFrame'

interface FlashcardStudioLaunchSurfaceProps {
  part: MessageAppPart
  launch: ChatBridgeReviewedAppLaunch
  sessionId?: string
  messageId?: string
}

function formatDeckTimestamp(timestamp?: number) {
  if (typeof timestamp !== 'number') {
    return 'Saved recently'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function parseSnapshot(part: MessageAppPart, launch: ChatBridgeReviewedAppLaunch) {
  const parsed = parseFlashcardStudioAppSnapshot(part.snapshot)
  if (parsed) {
    return parsed
  }

  return createInitialFlashcardStudioAppSnapshot({
    request: launch.request,
    deckTitle: 'Study deck',
  })
}

export function FlashcardStudioLaunchSurface({
  part,
  launch,
  sessionId,
  messageId,
}: FlashcardStudioLaunchSurfaceProps) {
  const parsedSnapshot = useMemo(() => parseSnapshot(part, launch), [launch, part])
  const [snapshot, setSnapshot] = useState(parsedSnapshot)
  const [busyAction, setBusyAction] = useState<'connect' | 'save' | 'load' | null>(null)
  const snapshotRef = useRef(snapshot)
  const runtimePart = useMemo(
    () => ({
      ...part,
      snapshot,
      summary: snapshot.summary,
      summaryForModel: snapshot.summary,
      statusText: snapshot.statusText,
    }),
    [part, snapshot]
  )

  useEffect(() => {
    setSnapshot(parsedSnapshot)
  }, [parsedSnapshot])

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  async function persistHostSnapshot(
    nextSnapshot: typeof snapshot,
    options: {
      eventKind?: 'state.updated' | 'auth.requested' | 'auth.linked'
      payload?: Record<string, unknown>
    } = {}
  ) {
    if (!sessionId || !messageId || !part.bridgeSessionId) {
      return
    }

    await persistReviewedAppLaunchHostSnapshot({
      sessionId,
      messageId,
      part,
      snapshot: nextSnapshot,
      eventKind: options.eventKind,
      payload: options.payload,
      summaryForModel: nextSnapshot.summary,
    })
  }

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const hydratedSnapshot = await hydrateFlashcardStudioDriveSnapshot(parsedSnapshot)
        if (!active) {
          return
        }

        setSnapshot(hydratedSnapshot)
        if (part.bridgeSessionId && JSON.stringify(hydratedSnapshot.drive) !== JSON.stringify(parsedSnapshot.drive)) {
          await persistHostSnapshot(hydratedSnapshot, {
            payload: {
              action: 'sheets.hydrate',
            },
          })
        }
      } catch (error) {
        if (!active) {
          return
        }

        const failureState = getFlashcardDriveFailureState(parsedSnapshot, error)
        const errorSnapshot = createFlashcardDriveErrorSnapshot(parsedSnapshot, failureState)
        setSnapshot(errorSnapshot)
      }
    })()

    return () => {
      active = false
    }
  }, [parsedSnapshot, part.bridgeSessionId])

  async function runAction(action: 'connect' | 'save' | 'load', execute: () => Promise<typeof snapshot>) {
    const baseSnapshot = snapshotRef.current
    const pendingSnapshot =
      action === 'connect'
        ? updateFlashcardStudioAppSnapshot(baseSnapshot, {
            drive: {
              ...baseSnapshot.drive,
              status: 'connecting',
              statusText: 'Connecting Google Sheets',
              detail: 'Waiting for Google Sheets permission so the host can open or save this workbook.',
            },
            lastUpdatedAt: Date.now(),
          })
        : action === 'save'
          ? updateFlashcardStudioAppSnapshot(baseSnapshot, {
              drive: {
                ...baseSnapshot.drive,
              status: 'saving',
              statusText: 'Saving to Google Sheets',
              detail: baseSnapshot.drive.lastSavedDeckName
                  ? `Saving "${baseSnapshot.drive.lastSavedDeckName}" to Google Sheets through the host-managed connector.`
                  : 'Saving the current deck to Google Sheets through the host-managed connector.',
              },
              lastUpdatedAt: Date.now(),
            })
          : updateFlashcardStudioAppSnapshot(baseSnapshot, {
              drive: {
                ...baseSnapshot.drive,
                status: 'loading',
                statusText: 'Loading from Google Sheets',
                detail: 'Loading the selected sheet from Google Sheets.',
              },
              lastUpdatedAt: Date.now(),
            })

    setBusyAction(action)
    setSnapshot(pendingSnapshot)
      await persistHostSnapshot(pendingSnapshot, {
        eventKind: action === 'connect' ? 'auth.requested' : 'state.updated',
        payload: {
          action: `sheets.${action}`,
        },
      }).catch(() => undefined)

    try {
      const nextSnapshot = await execute()
      setSnapshot(nextSnapshot)
      await persistHostSnapshot(nextSnapshot, {
        eventKind: action === 'connect' ? 'auth.linked' : 'state.updated',
        payload: {
          action: `sheets.${action}`,
          outcome: 'success',
        },
      }).catch(() => undefined)
    } catch (error) {
      const detail = getFlashcardDriveErrorMessage(error)
      const failureState = getFlashcardDriveFailureState(baseSnapshot, error)
      const errorSnapshot = createFlashcardDriveErrorSnapshot(baseSnapshot, failureState)
      setSnapshot(errorSnapshot)
      await persistHostSnapshot(errorSnapshot, {
        payload: {
          action: `sheets.${action}`,
          outcome:
            failureState.status === 'expired'
              ? 'expired'
              : failureState.status === 'needs-auth' &&
                  detail === 'Google Sheets permission was not granted.'
                ? 'denied'
                : 'error',
          detail,
        },
      }).catch(() => undefined)
    } finally {
      setBusyAction(null)
    }
  }

  const hasRecentDecks = snapshot.drive.recentDecks.length > 0
  const canSave = busyAction === null && snapshot.cardCount > 0 && snapshot.drive.status === 'connected'
  const canLoad = busyAction === null && hasRecentDecks && snapshot.drive.status === 'connected'
  const connectLabel =
    snapshot.drive.status === 'connected' || snapshot.drive.status === 'expired' || hasRecentDecks
      ? 'Reconnect Google Sheets'
      : 'Connect Google Sheets'
  const isRuntimeUnlocked =
    snapshot.drive.status === 'connected' || snapshot.drive.status === 'saving' || snapshot.drive.status === 'loading'
  const authGateTitle =
    snapshot.drive.status === 'connecting'
      ? 'Connecting Google Sheets...'
      : snapshot.drive.status === 'expired'
        ? 'Reconnect Google Sheets to continue'
        : snapshot.drive.status === 'error'
          ? 'Google Sheets needs attention'
          : 'Connect Google Sheets to continue'

  return (
    <div
      data-testid="flashcard-studio-launch-surface"
      className="w-full overflow-hidden rounded-[24px] border border-chatbox-border-primary bg-chatbox-background-primary"
    >
      <div className="border-b border-chatbox-border-primary bg-[linear-gradient(180deg,rgba(255,248,233,0.95),rgba(255,255,255,0.98))] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Text size="xs" fw={700} className="uppercase tracking-[0.1em] text-chatbox-tertiary">
              Host-owned Google Sheets rail
            </Text>
            <Text size="lg" fw={800} className="mt-1 text-chatbox-primary">
              {snapshot.drive.statusText}
            </Text>
            <Text size="sm" c="dimmed" className="mt-2 max-w-[70ch] whitespace-pre-wrap">
              {snapshot.drive.detail}
            </Text>
            {snapshot.drive.connectedAs ? (
              <Text size="xs" c="dimmed" className="mt-2 uppercase tracking-[0.06em]">
                Connected as {snapshot.drive.connectedAs}
              </Text>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={snapshot.drive.status === 'connected' ? 'default' : 'filled'}
              size="compact-sm"
              loading={busyAction === 'connect'}
              disabled={busyAction !== null}
              onClick={() =>
                void runAction('connect', async () => {
                  return await connectFlashcardStudioDrive(snapshotRef.current)
                })
              }
            >
              {connectLabel}
            </Button>
            <Button
              variant="light"
              size="compact-sm"
              loading={busyAction === 'save'}
              disabled={!canSave}
              onClick={() =>
                void runAction('save', async () => {
                  return await saveFlashcardStudioDriveSnapshot(snapshotRef.current)
                })
              }
            >
              Save to Sheets
            </Button>
          </div>
        </div>

        {hasRecentDecks ? (
          <div className="mt-4 rounded-[18px] border border-chatbox-border-primary bg-chatbox-background-secondary px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
                Recent Google Sheets
              </Text>
              {busyAction === 'load' ? <Loader size="xs" /> : null}
            </div>
            <div className="mt-3 grid gap-2">
              {snapshot.drive.recentDecks.map((recentDeck) => (
                <div
                  key={recentDeck.deckId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-chatbox-border-primary bg-chatbox-background-primary px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <Text size="sm" fw={700} className="truncate text-chatbox-primary">
                      {recentDeck.deckName}
                    </Text>
                    <Text size="xs" c="dimmed" className="mt-1">
                      {recentDeck.lastOpenedAt ? 'Opened ' : 'Saved '}
                      {formatDeckTimestamp(recentDeck.lastOpenedAt ?? recentDeck.modifiedAt)}
                    </Text>
                  </div>
                  <Button
                    variant="default"
                    size="compact-sm"
                    disabled={!canLoad}
                    onClick={() =>
                      void runAction('load', async () => {
                        return await loadFlashcardStudioDriveSnapshot(recentDeck.deckId, snapshotRef.current)
                      })
                    }
                  >
                    Open sheet
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {isRuntimeUnlocked ? (
        <div className="bg-chatbox-background-primary p-0">
          <ReviewedAppRuntimeFrame
            part={runtimePart}
            launch={launch}
            sessionId={sessionId}
            messageId={messageId}
            minHeight={620}
          />
        </div>
      ) : (
        <div className="bg-chatbox-background-primary p-6">
          <div className="flex min-h-[420px] items-center justify-center rounded-[22px] border border-dashed border-chatbox-border-primary bg-chatbox-background-secondary/60 px-6 py-8 text-center">
            <div className="max-w-[32rem]">
              <Text size="sm" fw={700} className="uppercase tracking-[0.1em] text-chatbox-tertiary">
                Flashcard Studio access
              </Text>
              <Text size="xl" fw={800} className="mt-3 text-chatbox-primary">
                {authGateTitle}
              </Text>
              <Text size="sm" c="dimmed" className="mt-3 whitespace-pre-wrap">
                Flashcard Studio stays gated until the host-owned Google Sheets step succeeds. After that, the same
                thread unlocks the editor, study mode, and sheet-backed save or resume controls.
              </Text>
              {snapshot.drive.connectedAs ? (
                <Text size="xs" c="dimmed" className="mt-4 uppercase tracking-[0.06em]">
                  Ready to continue as {snapshot.drive.connectedAs}
                </Text>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
