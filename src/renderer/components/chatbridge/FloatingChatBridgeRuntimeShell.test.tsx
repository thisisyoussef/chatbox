/**
 * @vitest-environment jsdom
 */

import { MantineProvider } from '@mantine/core'
import { createChatBridgeChessRuntimeSnapshot } from '@shared/chatbridge'
import { createInitialDrawingKitAppSnapshot } from '@shared/chatbridge/apps/drawing-kit'
import type { MessageAppPart } from '@shared/types'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FloatingChatBridgeRuntimeShell } from './FloatingChatBridgeRuntimeShell'

const isSmallScreenMock = vi.fn(() => false)

vi.mock('@/hooks/useScreenChange', () => ({
  useIsSmallScreen: () => isSmallScreenMock(),
}))

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

beforeEach(() => {
  isSmallScreenMock.mockReturnValue(false)
  document.body.innerHTML = ''
})

function createPart(appId: 'chess' | 'drawing-kit' = 'chess'): MessageAppPart {
  if (appId === 'drawing-kit') {
    const snapshot = createInitialDrawingKitAppSnapshot({
      snapshot: {
        ...createInitialDrawingKitAppSnapshot(),
        status: 'drawing',
        statusText: 'Round in progress',
        strokeCount: 3,
        previewMarks: [
          {
            kind: 'line',
            tool: 'brush',
            color: '#267df0',
            width: 5,
            points: [
              { x: 0.2, y: 0.3 },
              { x: 0.5, y: 0.55 },
            ],
          },
        ],
      },
    })

    return {
      type: 'app',
      appId: 'drawing-kit',
      appName: 'Drawing Kit',
      appInstanceId: 'drawing-kit-instance-1',
      lifecycle: 'active',
      title: 'Drawing Kit runtime',
      description: 'Sticky-note doodle board.',
      summary: snapshot.summary,
      statusText: snapshot.statusText,
      snapshot,
    }
  }

  const snapshot = createChatBridgeChessRuntimeSnapshot()

  return {
    type: 'app',
    appId: 'chess',
    appName: 'Chess',
    appInstanceId: 'chess-instance-1',
    lifecycle: 'active',
    title: 'Chess runtime',
    description: 'Moves validate inside the board first.',
    summary: snapshot.boardContext.summary,
    statusText: 'White to move',
    snapshot,
  }
}

function createPortalElements() {
  const viewportElement = document.createElement('div')
  const portalTarget = document.createElement('div')

  Object.defineProperty(viewportElement, 'clientWidth', {
    configurable: true,
    value: 960,
  })
  Object.defineProperty(viewportElement, 'clientHeight', {
    configurable: true,
    value: 720,
  })

  viewportElement.appendChild(portalTarget)
  document.body.appendChild(viewportElement)

  return {
    viewportElement,
    portalTarget,
  }
}

describe('FloatingChatBridgeRuntimeShell', () => {
  it('renders the active runtime through a portal-based overlay shell', () => {
    const { viewportElement, portalTarget } = createPortalElements()

    render(
      <MantineProvider>
        <FloatingChatBridgeRuntimeShell
          sessionId="session-1"
          messageId="message-1"
          part={createPart()}
          minimized={false}
          expanded={false}
          portalTarget={portalTarget}
          viewportElement={viewportElement}
          onMinimizeChange={vi.fn()}
          onExpandedChange={vi.fn()}
          onFrameChange={vi.fn()}
          onJumpToSource={vi.fn()}
        />
      </MantineProvider>
    )

    expect(screen.getByTestId('chatbridge-floating-runtime-shell')).toBeTruthy()
    expect(screen.getByText('Floating app')).toBeTruthy()
    expect(screen.getByRole('button', { name: /move app overlay/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /resize app overlay/i })).toBeTruthy()
  })

  it('renders a compact restore mini-player when minimized', () => {
    const { viewportElement, portalTarget } = createPortalElements()
    const onMinimizeChange = vi.fn()

    render(
      <MantineProvider>
        <FloatingChatBridgeRuntimeShell
          sessionId="session-1"
          messageId="message-1"
          part={createPart()}
          minimized
          expanded={false}
          portalTarget={portalTarget}
          viewportElement={viewportElement}
          onMinimizeChange={onMinimizeChange}
          onExpandedChange={vi.fn()}
          onFrameChange={vi.fn()}
          onJumpToSource={vi.fn()}
        />
      </MantineProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /restore app/i }))
    expect(onMinimizeChange).toHaveBeenCalledWith(false)
  })

  it('falls back to a bottom sheet on small screens', () => {
    const { viewportElement, portalTarget } = createPortalElements()
    isSmallScreenMock.mockReturnValue(true)

    render(
      <MantineProvider>
        <FloatingChatBridgeRuntimeShell
          sessionId="session-1"
          messageId="message-1"
          part={createPart()}
          minimized={false}
          expanded={false}
          portalTarget={portalTarget}
          viewportElement={viewportElement}
          onMinimizeChange={vi.fn()}
          onExpandedChange={vi.fn()}
          onFrameChange={vi.fn()}
          onJumpToSource={vi.fn()}
        />
      </MantineProvider>
    )

    expect(screen.getByText('App sheet')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /move app overlay/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /resize app overlay/i })).toBeNull()
  })

  it('expands persisted Drawing Kit frames back to a usable size', () => {
    const { viewportElement, portalTarget } = createPortalElements()
    const onFrameChange = vi.fn()

    render(
      <MantineProvider>
        <FloatingChatBridgeRuntimeShell
          sessionId="session-1"
          messageId="message-1"
          part={createPart('drawing-kit')}
          minimized={false}
          expanded={false}
          frame={{
            x: 520,
            y: 320,
            width: 420,
            height: 320,
          }}
          portalTarget={portalTarget}
          viewportElement={viewportElement}
          onMinimizeChange={vi.fn()}
          onExpandedChange={vi.fn()}
          onFrameChange={onFrameChange}
          onJumpToSource={vi.fn()}
        />
      </MantineProvider>
    )

    expect(onFrameChange).toHaveBeenCalledWith({
      x: 176,
      y: 56,
      width: 760,
      height: 640,
    })
  })

  it('renders Drawing Kit with a compact board-first overlay header', () => {
    const { viewportElement, portalTarget } = createPortalElements()

    render(
      <MantineProvider>
        <FloatingChatBridgeRuntimeShell
          sessionId="session-1"
          messageId="message-1"
          part={createPart('drawing-kit')}
          minimized={false}
          expanded={false}
          portalTarget={portalTarget}
          viewportElement={viewportElement}
          onMinimizeChange={vi.fn()}
          onExpandedChange={vi.fn()}
          onFrameChange={vi.fn()}
          onJumpToSource={vi.fn()}
        />
      </MantineProvider>
    )

    expect(screen.getByText('Drawing Kit')).toBeTruthy()
    expect(screen.queryByText('Floating app')).toBeNull()
  })
})
