import { createDrawingKitAppSnapshot } from '@shared/chatbridge/apps/drawing-kit'
import type { Message } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { applyChatBridgeAppVisionContext, CHATBRIDGE_APP_VISION_CONTEXT_MESSAGE_PREFIX } from './context'

function createDrawingKitMessages(): Message[] {
  const snapshot = createDrawingKitAppSnapshot({
    roundLabel: 'Dare 11',
    roundPrompt: 'Draw a moon pizza.',
    selectedTool: 'spray',
    status: 'checkpointed',
    caption: 'Moon pizza',
    strokeCount: 6,
    stickerCount: 2,
    checkpointId: 'drawing-kit-4200',
    lastUpdatedAt: 4_200,
  })

  return [
    {
      id: 'system-1',
      role: 'system',
      timestamp: 1,
      contentParts: [{ type: 'text', text: 'Stay grounded in host-owned app context.' }],
    },
    {
      id: 'assistant-drawing-1',
      role: 'assistant',
      timestamp: 2,
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
                  capturedAt: 4_200,
                  summary: 'Moon pizza on the sticky-note canvas.',
                  source: 'runtime-captured',
                },
              ],
            },
          },
        },
      ],
    },
  ]
}

describe('chatbridge visual continuity context', () => {
  it('injects a host-approved user image context for the primary active app screenshot', () => {
    const result = applyChatBridgeAppVisionContext(createDrawingKitMessages(), createDrawingKitMessages())

    expect(result[1]?.id).toBe(`${CHATBRIDGE_APP_VISION_CONTEXT_MESSAGE_PREFIX}assistant-drawing-1:drawing-instance-1`)
    expect(result[1]).toMatchObject({
      role: 'user',
      contentParts: [
        {
          type: 'text',
        },
        {
          type: 'image',
          storageKey: 'storage://drawing-shot-1',
        },
      ],
    })
    expect((result[1]?.contentParts[0] as { text: string }).text).toContain('ChatBridge visual continuity context')
    expect((result[1]?.contentParts[0] as { text: string }).text).toContain('Primary active app screenshot')
  })

  it('does not duplicate an injected visual context message', () => {
    const once = applyChatBridgeAppVisionContext(createDrawingKitMessages(), createDrawingKitMessages())
    const twice = applyChatBridgeAppVisionContext(once, createDrawingKitMessages())

    expect(twice.filter((message) => message.id.startsWith(CHATBRIDGE_APP_VISION_CONTEXT_MESSAGE_PREFIX))).toHaveLength(
      1
    )
  })
})
