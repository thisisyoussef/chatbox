import { Button, Text } from '@mantine/core'
import type { MessageAppPart, MessageContentParts } from '@shared/types'
import { applyChatBridgeRecoveryAction, getChatBridgeRouteDecision, isChatBridgeChessAppId } from '@shared/chatbridge'
import { cn } from '@/lib/utils'
import { ChatBridgeShell } from './ChatBridgeShell'
import { ChatBridgeRouteArtifact } from './ChatBridgeRouteArtifact'
import { getChatBridgeSurfaceContent } from './apps/surface'
import { getChatBridgeSurfaceKind, isChatBridgeTrayEligiblePart } from './apps/surface-contract'
import { getMessageAppPartViewModel, shouldRenderChatBridgeSurfaceOnly } from './chatbridge'
import { ChessRuntime } from './apps/chess/ChessRuntime'

interface ChatBridgeMessagePartProps {
  part: MessageAppPart
  onUpdatePart?: (nextPart: MessageAppPart) => void
  onUpdateMessageContentParts?: (
    updater: (current: MessageContentParts) => Promise<MessageContentParts> | MessageContentParts
  ) => Promise<void>
  sessionId?: string
  messageId?: string
  presentation?: 'inline' | 'anchor' | 'tray'
  floatingTrayMinimized?: boolean
  onOpenFloatingShell?: () => void
}

function getAnchorBadgeClasses(state: ReturnType<typeof getMessageAppPartViewModel>['state']) {
  if (state === 'loading') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
  }
  if (state === 'ready') {
    return 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
  }
  if (state === 'active') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
  }
  if (state === 'complete') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
  }
  if (state === 'degraded') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
  }

  return 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
}

export function ChatBridgeMessagePart({
  part,
  onUpdatePart,
  onUpdateMessageContentParts,
  sessionId,
  messageId,
  presentation = 'inline',
  floatingTrayMinimized = false,
  onOpenFloatingShell,
}: ChatBridgeMessagePartProps) {
  const viewModel = getMessageAppPartViewModel(part)
  const surfaceKind = getChatBridgeSurfaceKind(part)
  const trayEligible = isChatBridgeTrayEligiblePart(part)
  const routeDecision = surfaceKind === 'inline-route-artifact' ? getChatBridgeRouteDecision(part) : null
  const runtime =
    surfaceKind === 'chess-runtime' && part.lifecycle === 'active' && isChatBridgeChessAppId(part.appId) ? (
      <ChessRuntime part={part} onUpdatePart={onUpdatePart} sessionId={sessionId} messageId={messageId} />
    ) : undefined
  const inlineSurface =
    runtime ??
    (routeDecision ? (
      <ChatBridgeRouteArtifact
        part={part}
        decision={routeDecision}
        sessionId={sessionId}
        messageId={messageId}
        onUpdateMessageContentParts={onUpdateMessageContentParts}
      />
    ) : (
      getChatBridgeSurfaceContent({ part, sessionId, messageId })
    ))
  const primaryAction = viewModel.recoveryActions?.find((action) => action.variant !== 'secondary')
  const secondaryAction = viewModel.recoveryActions?.find((action) => action.variant === 'secondary')
  const surfaceOnlyPresentation = shouldRenderChatBridgeSurfaceOnly({
    part,
    state: viewModel.state,
    hasSurface: inlineSurface !== null && inlineSurface !== undefined,
  })

  function buildShellAction(action?: typeof primaryAction) {
    if (!action) {
      return undefined
    }

    if (typeof onUpdatePart !== 'function') {
      return {
        ...action,
        disabled: true,
      }
    }

    return {
      ...action,
      onClick: () => {
        if (!action.id || action.disabled) {
          return
        }

        onUpdatePart(applyChatBridgeRecoveryAction(part, action.id))
      },
    }
  }

  if (presentation === 'anchor' && trayEligible) {
    return (
      <div
        data-testid="chatbridge-anchor"
        className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-chatbox-border-primary bg-chatbox-background-primary px-3 py-2"
      >
        <div className="min-w-0">
          <Text size="sm" fw={700} className="truncate text-chatbox-primary">
            {viewModel.title}
          </Text>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'inline-flex h-7 shrink-0 items-center rounded-full px-3 text-[11px] font-semibold tracking-[0.01em]',
              getAnchorBadgeClasses(viewModel.state)
            )}
          >
            {viewModel.statusLabel}
          </span>
          {onOpenFloatingShell ? (
            <Button variant={floatingTrayMinimized ? 'light' : 'subtle'} size="compact-sm" onClick={onOpenFloatingShell}>
              {floatingTrayMinimized ? 'Restore app' : 'Open app'}
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (surfaceOnlyPresentation) {
    return (
      <div data-testid="chatbridge-app-surface" className={presentation === 'tray' ? undefined : 'my-3'}>
        {inlineSurface}
      </div>
    )
  }

  return (
    <ChatBridgeShell
      state={viewModel.state}
      title={viewModel.title}
      description={viewModel.description}
      surfaceTitle={viewModel.surfaceTitle}
      surfaceDescription={viewModel.surfaceDescription}
      statusLabel={viewModel.statusLabel}
      fallbackTitle={viewModel.fallbackTitle}
      fallbackText={viewModel.fallbackText}
      supportPanel={viewModel.supportPanel}
      primaryAction={buildShellAction(primaryAction)}
      secondaryAction={buildShellAction(secondaryAction)}
      className={presentation === 'tray' && trayEligible ? 'my-0' : undefined}
    >
      {inlineSurface}
    </ChatBridgeShell>
  )
}
