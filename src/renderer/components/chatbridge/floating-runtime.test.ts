import { createChatBridgeRouteMessagePart, writeChatBridgeReviewedAppLaunchValues } from '@shared/chatbridge'
import type { Message, MessageAppPart } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { resolveChatBridgeFloatingRuntimeTarget } from './floating-runtime'

function createPart(overrides: Partial<MessageAppPart> = {}): MessageAppPart {
  return {
    type: 'app',
    appId: 'chess',
    appName: 'Chess',
    appInstanceId: 'app-1',
    lifecycle: 'active',
    title: 'Chess runtime',
    description: 'Host-owned runtime',
    ...overrides,
  }
}

function createMessage(id: string, parts: MessageAppPart[]): Message {
  return {
    id,
    role: 'assistant',
    timestamp: Date.now(),
    contentParts: parts,
  }
}

function createClarifyRoutePart(): MessageAppPart {
  return createChatBridgeRouteMessagePart({
    schemaVersion: 2,
    hostRuntime: 'desktop-electron',
    kind: 'clarify',
    reasonCode: 'ambiguous-match',
    prompt: 'Move the black queen.',
    summary: 'This request may fit Chess, but the host wants confirmation before launching a reviewed app.',
    selectedAppId: 'chess',
    matches: [
      {
        appId: 'chess',
        appName: 'Chess',
        matchedContexts: [],
        matchedTerms: ['move', 'queen'],
        score: 6,
        exactAppMatch: false,
        exactToolMatch: false,
      },
    ],
  })
}

function createReviewedLaunchPart(overrides: Partial<MessageAppPart> = {}): MessageAppPart {
  return createPart({
    appId: 'weather-dashboard',
    appName: 'Weather Dashboard',
    lifecycle: 'ready',
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
    ...overrides,
  })
}

describe('resolveChatBridgeFloatingRuntimeTarget', () => {
  it('returns the latest eligible app instance in thread order', () => {
    const messages = [
      createMessage('msg-1', [createPart({ appInstanceId: 'app-1', lifecycle: 'active' })]),
      createMessage('msg-2', [createReviewedLaunchPart({ appInstanceId: 'app-2' })]),
    ]

    const result = resolveChatBridgeFloatingRuntimeTarget(messages)

    expect(result?.messageId).toBe('msg-2')
    expect(result?.part.appInstanceId).toBe('app-2')
  })

  it('fails closed when the latest record for an instance is no longer floatable', () => {
    const messages = [
      createMessage('msg-1', [createPart({ appInstanceId: 'app-1', lifecycle: 'active' })]),
      createMessage('msg-2', [createPart({ appInstanceId: 'app-1', lifecycle: 'stale' })]),
    ]

    const result = resolveChatBridgeFloatingRuntimeTarget(messages)

    expect(result).toBeNull()
  })

  it('keeps the active runtime pinned when a later clarify artifact is added to the thread', () => {
    const messages = [
      createMessage('msg-1', [createPart({ appInstanceId: 'app-1', lifecycle: 'active' })]),
      createMessage('msg-2', [createClarifyRoutePart()]),
    ]

    const result = resolveChatBridgeFloatingRuntimeTarget(messages)

    expect(result?.messageId).toBe('msg-1')
    expect(result?.part.appInstanceId).toBe('app-1')
  })

  it('fails closed for later app parts that have no renderable surface contract', () => {
    const messages = [
      createMessage('msg-1', [createPart({ appInstanceId: 'app-1', lifecycle: 'active' })]),
      createMessage(
        'msg-2',
        [
          createPart({
            appId: 'weather-dashboard',
            appName: 'Weather Dashboard',
            appInstanceId: 'app-2',
            lifecycle: 'active',
            title: 'Weather dashboard',
            description: 'This part does not carry a reviewed launch or runtime surface payload.',
            snapshot: undefined,
          }),
        ]
      ),
    ]

    const result = resolveChatBridgeFloatingRuntimeTarget(messages)

    expect(result?.messageId).toBe('msg-1')
    expect(result?.part.appInstanceId).toBe('app-1')
  })
})
