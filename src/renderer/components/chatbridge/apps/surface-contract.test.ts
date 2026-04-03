import { createChatBridgeRouteMessagePart, writeChatBridgeReviewedAppLaunchValues } from '@shared/chatbridge'
import type { MessageAppPart } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { getChatBridgeSurfaceKind, isChatBridgeTrayEligiblePart } from './surface-contract'

function createPart(overrides: Partial<MessageAppPart> = {}): MessageAppPart {
  return {
    type: 'app',
    appId: 'weather-dashboard',
    appName: 'Weather Dashboard',
    appInstanceId: 'part-1',
    lifecycle: 'ready',
    title: 'Weather Dashboard',
    description: 'A generic app part.',
    ...overrides,
  }
}

function createStoryBuilderPart(lifecycle: MessageAppPart['lifecycle']): MessageAppPart {
  return createPart({
    appId: 'story-builder',
    appName: 'Story Builder',
    lifecycle,
    values: {
      chatbridgeStoryBuilder: {
        schemaVersion: 1,
        mode: lifecycle === 'complete' ? 'complete' : 'active',
        drive: {
          provider: 'google-drive',
          status: 'connected',
          statusLabel: 'Drive connected',
          detail: 'Host-issued Drive access is active for the classroom writing folder.',
        },
        draft: {
          title: 'Storm Lantern',
          chapterLabel: 'Chapter 4',
          summary: 'Mara hides the storm lantern before the flood siren starts and the library doors lock.',
          excerpt: 'Mara tucked the lantern beneath the library desk and counted the sirens again before she dared to breathe.',
          wordCount: 1048,
          saveState: 'saved',
          saveLabel: 'Saved to Drive',
        },
        checkpoints: [],
        callout: {
          title: 'Host guidance',
          description: 'The host keeps the latest draft and next step visible in the shell.',
        },
        ...(lifecycle === 'complete'
          ? {
              completion: {
                title: 'Draft returned to chat',
                description: 'The host preserved the completed chapter, Drive save, and revision cue for the next conversation turn.',
              },
            }
          : {}),
      },
    },
  })
}

describe('getChatBridgeSurfaceKind', () => {
  it('marks reviewed launches as tray-eligible surfaces', () => {
    const part = createPart({
      values: writeChatBridgeReviewedAppLaunchValues(undefined, {
        schemaVersion: 1,
        appId: 'weather-dashboard',
        appName: 'Weather Dashboard',
        appVersion: '0.1.0',
        toolName: 'weather_dashboard_open',
        capability: 'open',
        summary: 'Prepared the reviewed Weather Dashboard request for the host-owned launch path.',
        request: 'Open Weather Dashboard for Chicago and show the forecast.',
        location: 'Chicago',
        uiEntry: 'https://apps.example.com/weather-dashboard',
        origin: 'https://apps.example.com',
      }),
    })

    expect(getChatBridgeSurfaceKind(part)).toBe('reviewed-launch')
    expect(isChatBridgeTrayEligiblePart(part)).toBe(true)
  })

  it('keeps inline route artifacts out of the tray contract', () => {
    const part = createChatBridgeRouteMessagePart({
      schemaVersion: 2,
      hostRuntime: 'desktop-electron',
      kind: 'refuse',
      reasonCode: 'no-confident-match',
      prompt: 'What should I cook for dinner tonight?',
      summary: 'No reviewed app is a confident fit for this request, so the host will keep helping in chat instead of forcing a launch.',
      matches: [],
    })

    expect(getChatBridgeSurfaceKind(part)).toBe('inline-route-artifact')
    expect(isChatBridgeTrayEligiblePart(part)).toBe(false)
  })

  it('marks the active legacy chess runtime as tray-eligible', () => {
    const part = createPart({
      appId: 'chess',
      appName: 'Chess',
      lifecycle: 'active',
    })

    expect(getChatBridgeSurfaceKind(part)).toBe('chess-runtime')
    expect(isChatBridgeTrayEligiblePart(part)).toBe(true)
  })

  it('fails closed for app parts that have no renderable surface state', () => {
    const part = createPart({
      lifecycle: 'active',
      summary: 'This part looks recent but has no reviewed launch payload or host runtime state.',
    })

    expect(getChatBridgeSurfaceKind(part)).toBeNull()
    expect(isChatBridgeTrayEligiblePart(part)).toBe(false)
  })

  it('keeps completed Story Builder surfaces inline without making them tray-eligible', () => {
    const part = createStoryBuilderPart('complete')

    expect(getChatBridgeSurfaceKind(part)).toBe('story-builder')
    expect(isChatBridgeTrayEligiblePart(part)).toBe(false)
  })
})
