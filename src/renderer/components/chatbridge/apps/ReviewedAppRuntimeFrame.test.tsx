/**
 * @vitest-environment jsdom
 */

process.env.CHATBOX_BUILD_PLATFORM = 'web'

import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/packages/chatbridge/partner-submissions', () => ({
  getApprovedPartnerRuntimeMarkup: vi.fn((appId: string) =>
    appId === 'checkpoint-coach'
      ? '<!doctype html><html><body><main id="uploaded-runtime">Checkpoint Coach uploaded runtime</main></body></html>'
      : null
  ),
}))

import type { MessageAppPart } from '@shared/types'
import type { ChatBridgeReviewedAppLaunch } from '@shared/chatbridge'
import { ReviewedAppRuntimeFrame } from './ReviewedAppRuntimeFrame'

function createPart(): MessageAppPart {
  return {
    type: 'app',
    appId: 'checkpoint-coach',
    appName: 'Checkpoint Coach',
    appInstanceId: 'reviewed-launch:tool-checkpoint-coach-1',
    lifecycle: 'launching',
    toolCallId: 'tool-checkpoint-coach-1',
    summary: 'Prepared the reviewed Checkpoint Coach request for the host-owned launch path.',
    summaryForModel: 'Prepared the reviewed Checkpoint Coach request for the host-owned launch path.',
    title: 'Checkpoint Coach',
    description: 'The host is launching Checkpoint Coach through the reviewed bridge runtime.',
    statusText: 'Launching',
    fallbackTitle: 'Checkpoint Coach fallback',
    fallbackText:
      'The host will keep Checkpoint Coach launch and recovery in this thread if the runtime cannot finish starting.',
    values: {
      chatbridgeReviewedAppLaunch: {
        schemaVersion: 1,
        appId: 'checkpoint-coach',
        appName: 'Checkpoint Coach',
        appVersion: '0.1.0',
        toolName: 'checkpoint_coach_open',
        capability: 'open',
        summary: 'Prepared the reviewed Checkpoint Coach request for the host-owned launch path.',
        request: 'Open Checkpoint Coach for the science exit ticket.',
      },
    },
  }
}

function createLaunch(): ChatBridgeReviewedAppLaunch {
  return {
    schemaVersion: 1,
    appId: 'checkpoint-coach',
    appName: 'Checkpoint Coach',
    appVersion: '0.1.0',
    toolName: 'checkpoint_coach_open',
    capability: 'open',
    summary: 'Prepared the reviewed Checkpoint Coach request for the host-owned launch path.',
    request: 'Open Checkpoint Coach for the science exit ticket.',
    uiEntry: 'https://apps.example.com/checkpoint-coach',
    origin: 'https://apps.example.com',
  }
}

describe('ReviewedAppRuntimeFrame', () => {
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

  it('uses approved uploaded runtime markup when a partner runtime package exists', () => {
    const { container } = render(
      <MantineProvider>
        <ReviewedAppRuntimeFrame part={createPart()} launch={createLaunch()} minHeight={320} />
      </MantineProvider>
    )

    const iframe = container.querySelector('iframe')
    expect(iframe?.getAttribute('srcdoc')).toContain('uploaded-runtime')
    expect(iframe?.getAttribute('srcdoc')).toContain('Checkpoint Coach uploaded runtime')
  })
})
