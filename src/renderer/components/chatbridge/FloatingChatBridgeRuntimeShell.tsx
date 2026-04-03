import { ActionIcon, Button, Text } from '@mantine/core'
import type { MessageAppPart } from '@shared/types'
import { IconArrowDownRight, IconLayoutBottombarExpand, IconPlayerPause } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { cn } from '@/lib/utils'
import { ChatBridgeMessagePart } from './ChatBridgeMessagePart'

interface FloatingChatBridgeRuntimeShellProps {
  sessionId: string
  messageId: string
  part: MessageAppPart
  minimized: boolean
  onMinimizeChange: (nextMinimized: boolean) => void
  onJumpToSource: () => void
}

export function FloatingChatBridgeRuntimeShell({
  sessionId,
  messageId,
  part,
  minimized,
  onMinimizeChange,
  onJumpToSource,
}: FloatingChatBridgeRuntimeShellProps) {
  const isSmallScreen = useIsSmallScreen()
  const shellRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (minimized) {
      return
    }

    shellRef.current?.focus({ preventScroll: true })
  }, [minimized, part.appInstanceId])

  if (minimized) {
    return (
      <section
        ref={shellRef}
        tabIndex={-1}
        aria-label={`${part.appName || part.appId} runtime tray minimized`}
        className="border-t border-chatbox-border-primary bg-chatbox-background-primary px-3 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Text size="sm" fw={600} className="min-w-0 truncate text-chatbox-primary">
            {part.appName || part.appId}
          </Text>
          <div className="flex items-center gap-2">
            <ActionIcon variant="subtle" size="lg" aria-label="Source message" onClick={onJumpToSource}>
              <IconArrowDownRight size={18} />
            </ActionIcon>
            <Button variant="light" size="compact-sm" onClick={() => onMinimizeChange(false)}>
              Restore app
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      ref={shellRef}
      tabIndex={-1}
      data-testid="chatbridge-floating-runtime-shell"
      aria-label={`${part.appName || part.appId} runtime tray`}
      className={cn(
        'border-t border-chatbox-border-primary bg-chatbox-background-primary px-3 pb-3 pt-2 shadow-[0_-14px_34px_rgba(15,23,42,0.08)]',
        isSmallScreen && 'rounded-t-[24px]'
      )}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 flex items-center justify-end gap-2">
          <ActionIcon variant="subtle" size="lg" aria-label="Source message" onClick={onJumpToSource}>
            <IconArrowDownRight size={18} />
          </ActionIcon>
          <div className="flex shrink-0 items-center gap-2">
            <ActionIcon
              variant="subtle"
              size="lg"
              aria-label="Minimize app tray"
              onClick={() => onMinimizeChange(true)}
            >
              {isSmallScreen ? <IconPlayerPause size={18} /> : <IconLayoutBottombarExpand size={18} />}
            </ActionIcon>
          </div>
        </div>

        <div
          className={cn(
            'overflow-hidden rounded-[24px]',
            isSmallScreen ? 'max-h-[48vh] overflow-y-auto' : 'max-h-[24rem] overflow-y-auto'
          )}
        >
          <ChatBridgeMessagePart part={part} sessionId={sessionId} messageId={messageId} presentation="tray" />
        </div>
      </div>
    </section>
  )
}
