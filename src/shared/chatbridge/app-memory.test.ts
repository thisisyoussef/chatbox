import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import type { Message, MessageAppPart } from '../types/session'
import {
  buildChatBridgeSelectedAppContextPrompt,
  selectChatBridgeAppContext,
  selectChatBridgeAppContexts,
} from './app-memory'
import { createChessAppSnapshotFromGame } from './apps/chess'
import { createDrawingKitAppSnapshot } from './apps/drawing-kit'

function createAppPart(overrides: Partial<MessageAppPart> = {}): MessageAppPart {
  return {
    type: 'app',
    appId: overrides.appId ?? 'story-builder',
    appName: overrides.appName ?? 'Story Builder',
    appInstanceId: overrides.appInstanceId ?? 'story-builder-instance-1',
    lifecycle: overrides.lifecycle ?? 'complete',
    summary: overrides.summary ?? 'Raw app summary.',
    summaryForModel: overrides.summaryForModel ?? 'Host-approved app summary.',
    snapshot: overrides.snapshot,
    values: overrides.values,
  }
}

function createAppMessage(id: string, part: MessageAppPart): Message {
  return {
    id,
    role: 'assistant',
    contentParts: [part],
  }
}

describe('selectChatBridgeAppContexts', () => {
  it('prefers the most recent active instance and keeps one recent completed context alongside it', () => {
    const contexts = selectChatBridgeAppContexts([
      createAppMessage(
        'debate-complete',
        createAppPart({
          appId: 'debate-arena',
          appName: 'Debate Arena',
          appInstanceId: 'debate-complete-instance',
          lifecycle: 'complete',
          summaryForModel: 'Debate Arena kept the completed round outcome.',
        })
      ),
      createAppMessage(
        'story-active',
        createAppPart({
          appInstanceId: 'story-active-instance',
          lifecycle: 'active',
          summaryForModel: 'Story Builder has the active draft open.',
        })
      ),
    ])

    expect(contexts).toHaveLength(2)
    expect(contexts[0]).toMatchObject({
      messageId: 'story-active',
      lifecycle: 'active',
      appInstanceId: 'story-active-instance',
    })
    expect(contexts[1]).toMatchObject({
      messageId: 'debate-complete',
      lifecycle: 'complete',
      appInstanceId: 'debate-complete-instance',
    })
  })

  it('keeps up to two recent completed contexts when no app remains active', () => {
    const contexts = selectChatBridgeAppContexts([
      createAppMessage(
        'story-complete',
        createAppPart({
          appInstanceId: 'story-complete-instance',
          lifecycle: 'complete',
          summaryForModel: 'Story Builder kept the saved draft summary.',
        })
      ),
      createAppMessage(
        'debate-complete',
        createAppPart({
          appId: 'debate-arena',
          appName: 'Debate Arena',
          appInstanceId: 'debate-complete-instance',
          lifecycle: 'complete',
          summaryForModel: 'Debate Arena kept the completed round outcome.',
        })
      ),
      createAppMessage(
        'chess-complete',
        createAppPart({
          appId: 'chess',
          appName: 'Chess',
          appInstanceId: 'chess-complete-instance',
          lifecycle: 'complete',
          summaryForModel: 'Chess kept the final board summary.',
        })
      ),
    ])

    expect(contexts).toHaveLength(2)
    expect(contexts.map((context) => context.messageId)).toEqual(['chess-complete', 'debate-complete'])
  })

  it('fails closed per instance instead of blocking every session for the same app id', () => {
    const contexts = selectChatBridgeAppContexts([
      createAppMessage(
        'story-old-active',
        createAppPart({
          appInstanceId: 'story-instance-1',
          lifecycle: 'active',
          summaryForModel: 'This older Story Builder draft should be ignored.',
        })
      ),
      createAppMessage(
        'story-old-stale',
        createAppPart({
          appInstanceId: 'story-instance-1',
          lifecycle: 'stale',
          summaryForModel: undefined,
        })
      ),
      createAppMessage(
        'story-new-active',
        createAppPart({
          appInstanceId: 'story-instance-2',
          lifecycle: 'active',
          summaryForModel: 'The new Story Builder draft should still be selectable.',
        })
      ),
    ])

    expect(contexts).toHaveLength(1)
    expect(contexts[0]).toMatchObject({
      messageId: 'story-new-active',
      appInstanceId: 'story-instance-2',
    })
    expect(
      selectChatBridgeAppContext([
        createAppMessage(
          'story-new-active',
          createAppPart({
            appInstanceId: 'story-instance-2',
            lifecycle: 'active',
            summaryForModel: 'The new Story Builder draft should still be selectable.',
          })
        ),
      ])
    ).toMatchObject({
      messageId: 'story-new-active',
      appInstanceId: 'story-instance-2',
    })
  })

  it('keeps bounded state digests and screenshot refs for the selected Drawing Kit context', () => {
    const drawingSnapshot = createDrawingKitAppSnapshot({
      roundLabel: 'Dare 09',
      roundPrompt: 'Draw a comet sandwich.',
      selectedTool: 'spray',
      status: 'checkpointed',
      caption: 'Comet sandwich',
      strokeCount: 5,
      stickerCount: 2,
      checkpointId: 'drawing-kit-5000',
      lastUpdatedAt: 5_000,
    })

    const contexts = selectChatBridgeAppContexts([
      createAppMessage(
        'drawing-active',
        createAppPart({
          appId: 'drawing-kit',
          appName: 'Drawing Kit',
          appInstanceId: 'drawing-instance-1',
          lifecycle: 'active',
          summaryForModel: drawingSnapshot.summary,
          snapshot: drawingSnapshot,
          values: {
            chatbridgeAppMedia: {
              screenshots: [
                {
                  kind: 'app-screenshot',
                  appId: 'drawing-kit',
                  appInstanceId: 'drawing-instance-1',
                  storageKey: 'storage://drawing-shot-1',
                  capturedAt: 5_000,
                  summary: 'Comet sandwich on the sticky-note canvas.',
                  source: 'runtime-captured',
                },
              ],
            },
          },
        })
      ),
    ])

    expect(contexts).toHaveLength(1)
    expect(contexts[0]).toMatchObject({
      appId: 'drawing-kit',
      latestScreenshot: {
        storageKey: 'storage://drawing-shot-1',
      },
      stateDigest: {
        kind: 'drawing-kit',
      },
    })

    const prompt = buildChatBridgeSelectedAppContextPrompt([
      createAppMessage(
        'drawing-active',
        createAppPart({
          appId: 'drawing-kit',
          appName: 'Drawing Kit',
          appInstanceId: 'drawing-instance-1',
          lifecycle: 'active',
          summaryForModel: drawingSnapshot.summary,
          snapshot: drawingSnapshot,
          values: {
            chatbridgeAppMedia: {
              screenshots: [
                {
                  kind: 'app-screenshot',
                  appId: 'drawing-kit',
                  appInstanceId: 'drawing-instance-1',
                  storageKey: 'storage://drawing-shot-1',
                  capturedAt: 5_000,
                  summary: 'Comet sandwich on the sticky-note canvas.',
                  source: 'runtime-captured',
                },
              ],
            },
          },
        })
      ),
    ])

    expect(prompt).toContain('Drawing Kit')
    expect(prompt).toContain('Prompt: Draw a comet sandwich.')
    expect(prompt).toContain('Screenshot: Comet sandwich on the sticky-note canvas.')
  })

  it('derives host-approved chess continuity from a validated snapshot when summaryForModel is missing', () => {
    const game = new Chess()
    game.move('e4')
    game.move('e5')
    game.move('Qh5')
    game.move('Qe7')
    const snapshot = createChessAppSnapshotFromGame(game)

    const messages: Message[] = [
      {
        id: 'chess-active',
        role: 'assistant',
        contentParts: [
          {
            type: 'app',
            appId: 'chess',
            appName: 'Chess',
            appInstanceId: 'chess-instance-1',
            lifecycle: 'active',
            summary: 'Raw chess summary should not be the only continuity source.',
            snapshot,
          },
        ],
      },
    ]

    const contexts = selectChatBridgeAppContexts(messages)

    expect(contexts).toHaveLength(1)
    expect(contexts[0]).toMatchObject({
      appId: 'chess',
      appInstanceId: 'chess-instance-1',
      lifecycle: 'active',
      summaryForModel: 'Chess board ready after Qe7. White to move.',
      stateDigest: {
        kind: 'chess',
      },
    })

    const prompt = buildChatBridgeSelectedAppContextPrompt(messages)

    expect(prompt).toContain('ChatBridge primary app continuity context')
    expect(prompt).toContain('Summary: Chess board ready after Qe7. White to move.')
    expect(prompt).toContain('Recent moves: e4, e5, Qh5, Qe7')
  })
})
