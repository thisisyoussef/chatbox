import { ActionIcon, Button, Text } from '@mantine/core'
import { DRAWING_KIT_APP_ID } from '@shared/chatbridge/apps/drawing-kit'
import type { MessageAppPart } from '@shared/types'
import {
  IconArrowDownRight,
  IconArrowsDiagonal,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconGripHorizontal,
  IconPictureInPictureOn,
} from '@tabler/icons-react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { cn } from '@/lib/utils'
import { useOverlayFocusHandoff } from '../common/overlay-focus'
import { ChatBridgeMessagePart } from './ChatBridgeMessagePart'
import {
  areFloatingShellFramesEqual,
  clampFloatingShellFrame,
  type FloatingShellFrame,
  getDefaultFloatingShellFrame,
  getExpandedFloatingShellFrame,
  getMinimizedFloatingShellFrame,
  moveFloatingShellFrame,
  resizeFloatingShellFrame,
} from './floating-shell-layout'

interface FloatingChatBridgeRuntimeShellProps {
  sessionId: string
  messageId: string
  part: MessageAppPart
  minimized: boolean
  expanded: boolean
  frame?: FloatingShellFrame
  portalTarget: HTMLElement | null
  viewportElement: HTMLElement | null
  onMinimizeChange: (nextMinimized: boolean) => void
  onExpandedChange: (nextExpanded: boolean) => void
  onFrameChange: (nextFrame: FloatingShellFrame) => void
  onJumpToSource: () => void
}

interface OverlayViewport {
  width: number
  height: number
}

type OverlayInteraction = {
  type: 'move' | 'resize'
  startFrame: FloatingShellFrame
  startX: number
  startY: number
} | null

function getViewportSize(viewportElement: HTMLElement | null): OverlayViewport {
  if (viewportElement) {
    return {
      width: viewportElement.clientWidth,
      height: viewportElement.clientHeight,
    }
  }

  if (typeof window !== 'undefined') {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    }
  }

  return {
    width: 0,
    height: 0,
  }
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, input, textarea, select'))
}

export function FloatingChatBridgeRuntimeShell({
  sessionId,
  messageId,
  part,
  minimized,
  expanded,
  frame,
  portalTarget,
  viewportElement,
  onMinimizeChange,
  onExpandedChange,
  onFrameChange,
  onJumpToSource,
}: FloatingChatBridgeRuntimeShellProps) {
  const isSmallScreen = useIsSmallScreen()
  const shellRef = useRef<HTMLElement | null>(null)
  const interactionRef = useRef<OverlayInteraction>(null)
  const baseFrameRef = useRef<FloatingShellFrame | null>(null)
  const [viewport, setViewport] = useState<OverlayViewport>(() => getViewportSize(viewportElement))

  useOverlayFocusHandoff(Boolean(!minimized && portalTarget), shellRef)

  useEffect(() => {
    const updateViewport = () => {
      setViewport(getViewportSize(viewportElement))
    }

    updateViewport()

    if (!viewportElement) {
      return
    }

    let resizeObserver: ResizeObserver | undefined

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateViewport)
      resizeObserver.observe(viewportElement)
    }

    window.addEventListener('resize', updateViewport)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateViewport)
    }
  }, [viewportElement])

  const baseFrame = useMemo(() => {
    if (viewport.width <= 0 || viewport.height <= 0) {
      return null
    }

    return clampFloatingShellFrame(frame ?? getDefaultFloatingShellFrame(viewport, part.appId), viewport, part.appId)
  }, [frame, part.appId, viewport])

  const expandedFrame = useMemo(() => {
    if (viewport.width <= 0 || viewport.height <= 0) {
      return null
    }

    return getExpandedFloatingShellFrame(viewport, part.appId)
  }, [part.appId, viewport])

  const minimizedFrame = useMemo(() => {
    const currentDesktopFrame = expanded ? expandedFrame : baseFrame

    if (!currentDesktopFrame || viewport.width <= 0 || viewport.height <= 0) {
      return null
    }

    return getMinimizedFloatingShellFrame(currentDesktopFrame, viewport, part.appId)
  }, [baseFrame, expanded, expandedFrame, part.appId, viewport])

  useEffect(() => {
    baseFrameRef.current = baseFrame
  }, [baseFrame])

  useEffect(() => {
    if (isSmallScreen || expanded || !baseFrame) {
      return
    }

    if (!frame || !areFloatingShellFramesEqual(frame, baseFrame)) {
      onFrameChange(baseFrame)
    }
  }, [baseFrame, expanded, frame, isSmallScreen, onFrameChange])

  const stopInteraction = useCallback(() => {
    interactionRef.current = null
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const currentInteraction = interactionRef.current
      const currentFrame = baseFrameRef.current
      if (!currentInteraction || !currentFrame || isSmallScreen || expanded) {
        return
      }

      event.preventDefault()

      const deltaX = event.clientX - currentInteraction.startX
      const deltaY = event.clientY - currentInteraction.startY
      const nextFrame =
        currentInteraction.type === 'move'
          ? moveFloatingShellFrame(currentInteraction.startFrame, viewport, deltaX, deltaY, part.appId)
          : resizeFloatingShellFrame(currentInteraction.startFrame, viewport, deltaX, deltaY, part.appId)

      if (!areFloatingShellFramesEqual(currentFrame, nextFrame)) {
        onFrameChange(nextFrame)
      }
    }

    const handlePointerUp = () => {
      stopInteraction()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [expanded, isSmallScreen, onFrameChange, part.appId, stopInteraction, viewport])

  useEffect(() => {
    return () => {
      stopInteraction()
    }
  }, [stopInteraction])

  const handleMoveStart = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!baseFrameRef.current || isSmallScreen || expanded) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      interactionRef.current = {
        type: 'move',
        startFrame: baseFrameRef.current,
        startX: event.clientX,
        startY: event.clientY,
      }

      document.body.style.userSelect = 'none'
    },
    [expanded, isSmallScreen]
  )

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!baseFrameRef.current || isSmallScreen || expanded) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      interactionRef.current = {
        type: 'resize',
        startFrame: baseFrameRef.current,
        startX: event.clientX,
        startY: event.clientY,
      }

      document.body.style.userSelect = 'none'
    },
    [expanded, isSmallScreen]
  )

  const handleMoveKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (!baseFrame || isSmallScreen || expanded) {
        return
      }

      const step = event.shiftKey ? 48 : 24

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onFrameChange(moveFloatingShellFrame(baseFrame, viewport, -step, 0, part.appId))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onFrameChange(moveFloatingShellFrame(baseFrame, viewport, step, 0, part.appId))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        onFrameChange(moveFloatingShellFrame(baseFrame, viewport, 0, -step, part.appId))
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        onFrameChange(moveFloatingShellFrame(baseFrame, viewport, 0, step, part.appId))
      }
    },
    [baseFrame, expanded, isSmallScreen, onFrameChange, part.appId, viewport]
  )

  const handleResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (!baseFrame || isSmallScreen || expanded) {
        return
      }

      const step = event.shiftKey ? 64 : 32

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onFrameChange(resizeFloatingShellFrame(baseFrame, viewport, -step, 0, part.appId))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onFrameChange(resizeFloatingShellFrame(baseFrame, viewport, step, 0, part.appId))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        onFrameChange(resizeFloatingShellFrame(baseFrame, viewport, 0, -step, part.appId))
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        onFrameChange(resizeFloatingShellFrame(baseFrame, viewport, 0, step, part.appId))
      }
    },
    [baseFrame, expanded, isSmallScreen, onFrameChange, part.appId, viewport]
  )

  const handleHeaderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isInteractiveTarget(event.target)) {
        return
      }

      handleMoveStart(event as unknown as ReactPointerEvent<HTMLButtonElement>)
    },
    [handleMoveStart]
  )

  if (!portalTarget || !viewportElement) {
    return null
  }

  const appTitle = part.appName || part.appId
  const isDrawingKit = part.appId === DRAWING_KIT_APP_ID

  if (isSmallScreen) {
    return createPortal(
      minimized ? (
        <section
          ref={shellRef}
          tabIndex={-1}
          aria-label={`${appTitle} mini-player`}
          className="pointer-events-auto absolute inset-x-3 bottom-3 rounded-[22px] border border-chatbox-border-primary bg-chatbox-background-primary px-4 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.22)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
                App mini-player
              </Text>
              <Text size="sm" fw={700} className="truncate text-chatbox-primary">
                {appTitle}
              </Text>
            </div>
            <Button variant="light" size="compact-sm" onClick={() => onMinimizeChange(false)}>
              Restore app
            </Button>
          </div>
        </section>
      ) : (
        <section
          ref={shellRef}
          tabIndex={-1}
          data-testid="chatbridge-floating-runtime-shell"
          aria-label={`${appTitle} app sheet`}
          className="pointer-events-auto absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-chatbox-border-primary bg-chatbox-background-primary px-3 pb-3 pt-2 shadow-[0_-18px_48px_rgba(15,23,42,0.24)]"
        >
          <div className="mx-auto max-w-5xl">
            <div className={cn('mb-3 flex justify-between gap-3', isDrawingKit ? 'items-center' : 'items-start')}>
              <div className="min-w-0">
                {isDrawingKit ? (
                  <Text size="sm" fw={700} className="text-chatbox-primary">
                    {appTitle}
                  </Text>
                ) : (
                  <>
                    <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
                      App sheet
                    </Text>
                    <Text size="sm" fw={700} className="mt-1 text-chatbox-primary">
                      {appTitle}
                    </Text>
                    <Text size="xs" c="dimmed" className="mt-1 whitespace-pre-wrap">
                      The active runtime stays lifted above the thread on small screens, without desktop drag controls.
                    </Text>
                  </>
                )}
                {isDrawingKit ? (
                  <Text size="xs" c="dimmed" className="mt-1">
                    Keep the board visible while chat stays available below.
                  </Text>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconArrowDownRight size={14} />}
                  onClick={onJumpToSource}
                >
                  Source
                </Button>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  aria-label="Minimize overlay"
                  onClick={() => onMinimizeChange(true)}
                >
                  <IconPictureInPictureOn size={18} />
                </ActionIcon>
              </div>
            </div>

            <div
              className={cn(
                isDrawingKit ? 'max-h-[72vh] overflow-y-auto' : 'max-h-[48vh] overflow-y-auto rounded-[24px]'
              )}
            >
              <ChatBridgeMessagePart part={part} sessionId={sessionId} messageId={messageId} presentation="tray" />
            </div>
          </div>
        </section>
      ),
      portalTarget
    )
  }

  if (!baseFrame || !expandedFrame || !minimizedFrame) {
    return null
  }

  const desktopFrame = expanded ? expandedFrame : baseFrame

  return createPortal(
    minimized ? (
      <section
        ref={shellRef}
        tabIndex={-1}
        aria-label={`${appTitle} mini-player`}
        className="pointer-events-auto absolute rounded-[22px] border border-chatbox-border-primary bg-chatbox-background-primary px-4 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.22)]"
        style={{
          left: minimizedFrame.x,
          top: minimizedFrame.y,
          width: minimizedFrame.width,
          minHeight: minimizedFrame.height,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
              App mini-player
            </Text>
            <Text size="sm" fw={700} className="truncate text-chatbox-primary">
              {appTitle}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="subtle" size="compact-sm" onClick={onJumpToSource}>
              Source
            </Button>
            <Button variant="light" size="compact-sm" onClick={() => onMinimizeChange(false)}>
              Restore app
            </Button>
          </div>
        </div>
      </section>
    ) : (
      <section
        ref={shellRef}
        tabIndex={-1}
        data-testid="chatbridge-floating-runtime-shell"
        aria-label={`${appTitle} app overlay`}
        className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-[26px] border border-chatbox-border-primary bg-chatbox-background-primary shadow-[0_24px_56px_rgba(15,23,42,0.24)]"
        style={{
          left: desktopFrame.x,
          top: desktopFrame.y,
          width: desktopFrame.width,
          height: desktopFrame.height,
        }}
      >
        <div
          className={cn(
            'border-b border-chatbox-border-primary bg-chatbox-background-secondary/90 backdrop-blur-sm',
            isDrawingKit ? 'flex items-center gap-3 px-3 py-2.5' : 'flex items-start gap-3 px-4 py-3'
          )}
          onPointerDown={handleHeaderPointerDown}
        >
          {isDrawingKit ? (
            <>
              <div className="min-w-0 flex-1">
                <Text size="sm" fw={700} className="truncate text-chatbox-primary">
                  {appTitle}
                </Text>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!expanded ? (
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    leftSection={<IconGripHorizontal size={14} />}
                    aria-label="Move app overlay"
                    onPointerDown={handleMoveStart}
                    onKeyDown={handleMoveKeyDown}
                    onClick={(event) => event.preventDefault()}
                  >
                    Move
                  </Button>
                ) : null}
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconArrowDownRight size={14} />}
                  onClick={onJumpToSource}
                >
                  Source
                </Button>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  aria-label={expanded ? 'Restore overlay size' : 'Expand overlay'}
                  onClick={() => onExpandedChange(!expanded)}
                >
                  {expanded ? <IconArrowsMinimize size={18} /> : <IconArrowsMaximize size={18} />}
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  aria-label="Minimize overlay"
                  onClick={() => onMinimizeChange(true)}
                >
                  <IconPictureInPictureOn size={18} />
                </ActionIcon>
              </div>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <Text size="xs" fw={700} className="uppercase tracking-[0.08em] text-chatbox-tertiary">
                  Floating app
                </Text>
                <Text size="sm" fw={700} className="mt-1 text-chatbox-primary">
                  {appTitle}
                </Text>
                <Text size="xs" c="dimmed" className="mt-1 whitespace-pre-wrap">
                  Drag, resize, or return to the source message without changing the thread layout.
                </Text>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {!expanded ? (
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    leftSection={<IconGripHorizontal size={14} />}
                    aria-label="Move app overlay"
                    onPointerDown={handleMoveStart}
                    onKeyDown={handleMoveKeyDown}
                    onClick={(event) => event.preventDefault()}
                  >
                    Move
                  </Button>
                ) : null}
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconArrowDownRight size={14} />}
                  onClick={onJumpToSource}
                >
                  Source
                </Button>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  aria-label={expanded ? 'Restore overlay size' : 'Expand overlay'}
                  onClick={() => onExpandedChange(!expanded)}
                >
                  {expanded ? <IconArrowsMinimize size={18} /> : <IconArrowsMaximize size={18} />}
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  aria-label="Minimize overlay"
                  onClick={() => onMinimizeChange(true)}
                >
                  <IconPictureInPictureOn size={18} />
                </ActionIcon>
              </div>
            </>
          )}
        </div>

        <div className={cn('min-h-0 flex-1 overflow-hidden', isDrawingKit ? 'bg-[#fffdf4] p-0' : 'p-3')}>
          <div className={cn('h-full overflow-y-auto', isDrawingKit ? '' : 'rounded-[22px]')}>
            <ChatBridgeMessagePart part={part} sessionId={sessionId} messageId={messageId} presentation="tray" />
          </div>
        </div>

        {!expanded ? (
          <button
            type="button"
            aria-label="Resize app overlay"
            className={cn(
              'absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-chatbox-border-primary',
              'bg-chatbox-background-primary text-chatbox-tertiary shadow-sm transition-colors hover:text-chatbox-primary'
            )}
            onPointerDown={handleResizeStart}
            onKeyDown={handleResizeKeyDown}
          >
            <IconArrowsDiagonal size={16} />
          </button>
        ) : null}
      </section>
    ),
    portalTarget
  )
}
