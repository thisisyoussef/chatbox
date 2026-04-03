import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readChatBridgeReviewedAppLaunch } from '@shared/chatbridge'
import { createMessage, type MessageAppPart, type Session } from '@shared/types'
import { interceptWeatherDashboardTurn } from '@/packages/weather-dashboard/host-routing'
import { submitNewUserMessage } from './messages'

const { getSessionMock, getSessionSettingsMock, insertMessageMock, generateMock, runCompactionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getSessionSettingsMock: vi.fn(),
  insertMessageMock: vi.fn(),
  generateMock: vi.fn(),
  runCompactionMock: vi.fn(),
}))

vi.hoisted(() => {
  const storage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  }

  ;(globalThis as unknown as { window: Record<string, unknown>; localStorage: typeof storage }).window = {
    localStorage: storage,
  }
  ;(globalThis as unknown as { localStorage: typeof storage }).localStorage = storage
})

vi.mock('./generation', () => ({
  generate: generateMock,
}))

vi.mock('../chatStore', () => ({
  getSession: getSessionMock,
  getSessionSettings: getSessionSettingsMock,
  insertMessage: insertMessageMock,
  updateMessage: vi.fn(),
  updateMessageCache: vi.fn(),
}))

vi.mock('@/packages/context-management', () => ({
  runCompactionWithUIState: runCompactionMock,
}))

vi.mock('@/stores/settingsStore', () => ({
  settingsStore: {
    getState: () => ({
      getSettings: () => ({}),
    }),
  },
}))

vi.mock('@/stores/settingActions', () => ({
  isPro: () => false,
  getRemoteConfig: () => ({
    setting_chatboxai_first: false,
  }),
}))

vi.mock('@/stores/uiStore', () => ({
  uiStore: {
    getState: () => ({
      sessionWebBrowsingMap: {},
    }),
  },
}))

vi.mock('@/packages/token', () => ({
  estimateTokensFromMessages: () => 0,
}))

vi.mock('@/platform', () => ({
  default: {
    type: 'desktop',
    getConfig: async () => ({}),
  },
}))

vi.mock('@/adapters', () => ({
  createModelDependencies: async () => ({}),
}))

vi.mock('@shared/models', () => ({
  getModel: vi.fn(() => ({
    isSupportToolUse: () => true,
  })),
}))

vi.mock('@/packages/model-setting-utils', () => ({
  getModelDisplayName: async () => 'mock-model',
}))

describe('submitNewUserMessage weather interception', () => {
  function getLaunchPart(message: { contentParts: Session['messages'][number]['contentParts'] }): MessageAppPart {
    const launchPart = message.contentParts.find((part): part is MessageAppPart => part.type === 'app')
    if (!launchPart) {
      throw new Error('Expected a reviewed Weather Dashboard launch part.')
    }
    return launchPart
  }

  beforeEach(() => {
    getSessionMock.mockReset()
    getSessionSettingsMock.mockReset()
    insertMessageMock.mockReset()
    generateMock.mockReset()
    runCompactionMock.mockReset()

    runCompactionMock.mockResolvedValue({ success: true })
    getSessionSettingsMock.mockResolvedValue({
      provider: 'openai',
      modelId: 'gpt-4o-mini',
    })
  })

  it('launches the reviewed Weather Dashboard immediately when the prompt includes a specific location', async () => {
    const session: Session = {
      id: 'session-1',
      name: 'Weather',
      type: 'chat',
      messages: [],
    }
    getSessionMock.mockResolvedValue(session)

    await submitNewUserMessage(session.id, {
      newUserMsg: createMessage('user', 'weather in Chicago, IL'),
      needGenerating: true,
    })

    expect(insertMessageMock).toHaveBeenCalledTimes(2)
    expect(generateMock).not.toHaveBeenCalled()

    const assistantMessage = insertMessageMock.mock.calls[1][1]
    expect(assistantMessage.role).toBe('assistant')
    expect(readChatBridgeReviewedAppLaunch(getLaunchPart(assistantMessage).values)).toMatchObject({
      appId: 'weather-dashboard',
      toolName: 'weather_dashboard_open',
      request: 'weather in Chicago, IL',
      location: 'Chicago, IL',
    })
  })

  it('launches the reviewed Weather Dashboard after a location clarification reply', async () => {
    const clarification = createMessage('assistant')
    clarification.contentParts = [
      {
        type: 'info',
        text: 'Weather Dashboard needs a location. Reply with a city, optionally with state or country, like Chicago or Springfield, IL.',
        values: {
          hostFlow: 'weather-dashboard',
          status: 'awaiting-location',
          originalRequest: 'open the weather app',
          reason: 'missing-location',
        },
      },
    ]

    const session: Session = {
      id: 'session-2',
      name: 'Weather',
      type: 'chat',
      messages: [clarification],
    }
    getSessionMock.mockResolvedValue(session)

    await submitNewUserMessage(session.id, {
      newUserMsg: createMessage('user', 'Detroit, Michigan'),
      needGenerating: true,
    })

    expect(insertMessageMock).toHaveBeenCalledTimes(2)
    expect(generateMock).not.toHaveBeenCalled()

    const assistantMessage = insertMessageMock.mock.calls[1][1]
    expect(readChatBridgeReviewedAppLaunch(getLaunchPart(assistantMessage).values)).toMatchObject({
      appId: 'weather-dashboard',
      toolName: 'weather_dashboard_open',
      request: 'open the weather app',
      location: 'Detroit, Michigan',
    })
  })

  it('keeps contextual follow-up advice questions in normal chat generation after a weather launch', async () => {
    const priorWeatherLaunch = await interceptWeatherDashboardTurn(
      [],
      createMessage('user', 'whats the weather in Austin, Texas?'),
      { sessionId: 'session-3' }
    )

    const session: Session = {
      id: 'session-3',
      name: 'Austin Weather',
      type: 'chat',
      messages: priorWeatherLaunch ? [priorWeatherLaunch] : [],
    }
    getSessionMock.mockResolvedValue(session)

    await submitNewUserMessage(session.id, {
      newUserMsg: createMessage('user', 'What should I wear for this kind of weather?'),
      needGenerating: true,
    })

    expect(insertMessageMock).toHaveBeenCalledTimes(2)
    expect(generateMock).toHaveBeenCalledTimes(1)

    const assistantMessage = insertMessageMock.mock.calls[1][1]
    expect(assistantMessage.generating).toBe(true)
    expect(assistantMessage.contentParts).toEqual([])
  })
})
