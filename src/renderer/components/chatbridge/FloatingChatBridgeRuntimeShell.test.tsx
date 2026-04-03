/**
 * @vitest-environment jsdom
 */

import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { createChatBridgeChessRuntimeSnapshot } from '@shared/chatbridge'
import type { MessageAppPart } from '@shared/types'
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

function createPart(): MessageAppPart {
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
})
