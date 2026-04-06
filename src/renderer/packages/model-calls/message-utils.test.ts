import type { Message } from '@shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDrawingKitAppSnapshot } from '@shared/chatbridge'
import { normalizeChatBridgeCompletionSummaryForModel } from '@shared/chatbridge/summary'
import { createModelDependencies } from '@/adapters'
import { convertToModelMessages } from './message-utils'

vi.mock('@/adapters', () => ({
  createModelDependencies: vi.fn(async () => ({
    storage: {
      getImage: vi.fn(),
    },
  })),
}))

describe('convertToModelMessages chatbridge normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createModelDependencies).mockResolvedValue({
      storage: {
        getImage: vi.fn(async () => ''),
      },
    } as never)
  })

  it('uses host-owned summaryForModel for assistant app parts', async () => {
    const { summaryForModel } = normalizeChatBridgeCompletionSummaryForModel({
      appId: 'story-builder',
      appName: 'Story Builder',
      payload: {
        schemaVersion: 1,
        status: 'success',
        suggestedSummary: {
          text: 'Saved the latest Story Builder draft for later writing.',
        },
        outcomeData: {
          chapterCount: 2,
        },
      },
    })

    const messages: Message[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        contentParts: [
          {
            type: 'app',
            appId: 'story-builder',
            appName: 'Story Builder',
            appInstanceId: 'instance-1',
            lifecycle: 'complete',
            summary: 'Raw partner summary that should not become model memory.',
            summaryForModel,
          },
        ],
      },
    ]

    const result = await convertToModelMessages(messages)

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [{ type: 'text', text: summaryForModel }],
      },
    ])
  })

  it('derives host-owned model memory from stored completion payloads when summaryForModel is absent', async () => {
    const completionPayload = {
      schemaVersion: 1 as const,
      status: 'success' as const,
      suggestedSummary: {
        text: 'Debate Arena completed the rubric pass and stored the winner.',
      },
      outcomeData: {
        winner: 'Team A',
        accessToken: 'secret-token',
      },
    }

    const messages: Message[] = [
      {
        id: 'msg-1b',
        role: 'assistant',
        contentParts: [
          {
            type: 'app',
            appId: 'debate-arena',
            appName: 'Debate Arena',
            appInstanceId: 'instance-1b',
            lifecycle: 'complete',
            summary: 'Raw partner completion text.',
            values: {
              chatbridgeCompletion: completionPayload,
            },
          },
        ],
      },
    ]

    const result = await convertToModelMessages(messages)

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Debate Arena completed the rubric pass and stored the winner. Approved details: winner: Team A.',
          },
        ],
      },
    ])
  })

  it('derives host-owned model memory from structured Debate Arena state when no completion payload exists yet', async () => {
    const messages: Message[] = [
      {
        id: 'msg-debate-active',
        role: 'assistant',
        contentParts: [
          {
            type: 'app',
            appId: 'debate-arena',
            appName: 'Debate Arena',
            appInstanceId: 'debate-instance-active',
            lifecycle: 'active',
            values: {
              chatbridgeDebateArena: {
                schemaVersion: 1,
                phase: 'opening',
                motion: 'Schools should allow structured AI writing support in class.',
                teams: [
                  {
                    id: 'team-affirmative',
                    name: 'Team Redwood',
                    stance: 'affirmative',
                  },
                  {
                    id: 'team-negative',
                    name: 'Team Blue',
                    stance: 'negative',
                  },
                ],
                rubricFocus: ['evidence quality', 'counterargument clarity'],
                currentSpeaker: {
                  name: 'Maya',
                  teamId: 'team-affirmative',
                  roleLabel: 'evidence reply',
                },
              },
            },
          },
        ],
      },
    ]

    const result = await convertToModelMessages(messages)

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Debate Arena is running the opening round'),
          },
        ],
      },
    ])
  })

  it('does not expose raw app summaries when host normalization has not approved them', async () => {
    const messages: Message[] = [
      {
        id: 'msg-2',
        role: 'assistant',
        contentParts: [
          {
            type: 'app',
            appId: 'story-builder',
            appName: 'Story Builder',
            appInstanceId: 'instance-2',
            lifecycle: 'complete',
            summary: 'Raw partner summary that should stay out of model context.',
          },
        ],
      },
    ]

    const result = await convertToModelMessages(messages)

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [],
      },
    ])
  })

  it('includes the Drawing Kit state digest and latest screenshot for assistant app parts', async () => {
    vi.mocked(createModelDependencies).mockResolvedValue({
      storage: {
        getImage: vi.fn(async (storageKey: string) =>
          storageKey === 'storage://drawing-shot-1' ? 'data:image/png;base64,ZmFrZQ==' : ''
        ),
      },
    } as never)

    const snapshot = createDrawingKitAppSnapshot({
      roundLabel: 'Dare 11',
      roundPrompt: 'Draw a moon pizza.',
      selectedTool: 'spray',
      status: 'checkpointed',
      caption: 'Moon pizza',
      strokeCount: 6,
      stickerCount: 2,
    })

    const messages: Message[] = [
      {
        id: 'msg-drawing-active',
        role: 'assistant',
        contentParts: [
          {
            type: 'app',
            appId: 'drawing-kit',
            appName: 'Drawing Kit',
            appInstanceId: 'drawing-instance-1',
            lifecycle: 'active',
            summaryForModel: snapshot.summary,
            snapshot,
            values: {
              chatbridgeAppMedia: {
                screenshots: [
                  {
                    kind: 'app-screenshot',
                    appId: 'drawing-kit',
                    appInstanceId: 'drawing-instance-1',
                    storageKey: 'storage://drawing-shot-1',
                    capturedAt: 2_000,
                    summary: 'A round moon pizza with orange spray shading and two small stickers near the top edge.',
                    source: 'runtime-captured',
                  },
                ],
              },
            },
          },
        ],
      },
    ]

    const result = await convertToModelMessages(messages)

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Drawing Kit checkpoint banked.'),
          },
          {
            type: 'file',
            data: 'ZmFrZQ==',
            mediaType: 'image/png',
          },
        ],
      },
    ])
    expect((result[0]?.content?.[0] as { text: string }).text).toContain('State digest')
    expect((result[0]?.content?.[0] as { text: string }).text).toContain('Prompt: Draw a moon pizza.')
    expect((result[0]?.content?.[0] as { text: string }).text).toContain(
      'Visible board: A round moon pizza with orange spray shading and two small stickers near the top edge.'
    )
  })

  it('propagates explicit image detail hints for user-side vision context images', async () => {
    vi.mocked(createModelDependencies).mockResolvedValue({
      storage: {
        getImage: vi.fn(async () => 'data:image/png;base64,ZmFrZQ=='),
      },
    } as never)

    const messages: Message[] = [
      {
        id: 'msg-user-vision-detail',
        role: 'user',
        contentParts: [
          {
            type: 'image',
            storageKey: 'storage://drawing-shot-vision',
            detail: 'high',
          },
        ],
      },
    ]

    const result = await convertToModelMessages(messages, { modelSupportVision: true })

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: 'ZmFrZQ==',
            mediaType: 'image/png',
            providerOptions: {
              openai: {
                imageDetail: 'high',
              },
            },
          },
        ],
      },
    ])
  })

  it('base64-encodes non-base64 app screenshots before adding them to assistant model context', async () => {
    const svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><text x="4" y="16">moon pizza</text></svg>'
    vi.mocked(createModelDependencies).mockResolvedValue({
      storage: {
        getImage: vi.fn(async () => `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`),
      },
    } as never)

    const snapshot = createDrawingKitAppSnapshot({
      roundLabel: 'Dare 12',
      roundPrompt: 'Draw a moon pizza.',
      selectedTool: 'brush',
      status: 'checkpointed',
      caption: 'Moon pizza svg',
      strokeCount: 3,
      stickerCount: 1,
    })

    const messages: Message[] = [
      {
        id: 'msg-drawing-svg',
        role: 'assistant',
        contentParts: [
          {
            type: 'app',
            appId: 'drawing-kit',
            appName: 'Drawing Kit',
            appInstanceId: 'drawing-instance-svg',
            lifecycle: 'active',
            summaryForModel: snapshot.summary,
            snapshot,
            values: {
              chatbridgeAppMedia: {
                screenshots: [
                  {
                    kind: 'app-screenshot',
                    appId: 'drawing-kit',
                    appInstanceId: 'drawing-instance-svg',
                    storageKey: 'storage://drawing-shot-svg',
                    capturedAt: 2_500,
                    summary: 'An SVG moon pizza sketch.',
                    source: 'runtime-captured',
                  },
                ],
              },
            },
          },
        ],
      },
    ]

    const result = await convertToModelMessages(messages)

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Drawing Kit checkpoint banked.'),
          },
          {
            type: 'file',
            data: Buffer.from(svgMarkup).toString('base64'),
            mediaType: 'image/svg+xml',
          },
        ],
      },
    ])
  })

  it('base64-encodes non-base64 user vision images before passing them to the model', async () => {
    const svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6"/></svg>'
    vi.mocked(createModelDependencies).mockResolvedValue({
      storage: {
        getImage: vi.fn(async () => `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`),
      },
    } as never)

    const messages: Message[] = [
      {
        id: 'msg-user-vision-svg',
        role: 'user',
        contentParts: [
          {
            type: 'image',
            storageKey: 'storage://drawing-shot-user-svg',
          },
        ],
      },
    ]

    const result = await convertToModelMessages(messages, { modelSupportVision: true })

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: Buffer.from(svgMarkup).toString('base64'),
            mediaType: 'image/svg+xml',
          },
        ],
      },
    ])
  })
})
