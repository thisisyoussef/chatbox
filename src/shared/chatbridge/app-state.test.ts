import { describe, expect, it } from 'vitest'
import type { MessageAppPart } from '../types/session'
import {
  CHATBRIDGE_APP_MEDIA_VALUES_KEY,
  appendChatBridgeAppScreenshot,
  buildChatBridgeAppStateDigest,
  formatChatBridgeAppStateDigest,
  getLatestChatBridgeAppScreenshot,
} from './app-state'
import { createInitialChessAppSnapshot } from './apps/chess'
import { createDrawingKitAppSnapshot } from './apps/drawing-kit'
import { createFlashcardStudioAppSnapshot } from './apps/flashcard-studio'

function createPart(overrides: Partial<MessageAppPart> = {}): MessageAppPart {
  return {
    type: 'app',
    appId: overrides.appId ?? 'chess',
    appName: overrides.appName ?? 'Chess',
    appInstanceId: overrides.appInstanceId ?? 'instance-1',
    lifecycle: overrides.lifecycle ?? 'active',
    snapshot: overrides.snapshot,
    values: overrides.values,
  }
}

describe('chatbridge app state helpers', () => {
  it('builds a bounded digest for chess app snapshots', () => {
    const digest = buildChatBridgeAppStateDigest(
      createPart({
        appId: 'chess',
        snapshot: createInitialChessAppSnapshot(1_000),
      })
    )

    expect(digest).toMatchObject({
      kind: 'chess',
    })
    expect(formatChatBridgeAppStateDigest(digest)).toContain('Turn: white')
    expect(formatChatBridgeAppStateDigest(digest)).toContain('FEN:')
  })

  it('builds a bounded digest for drawing kit snapshots', () => {
    const digest = buildChatBridgeAppStateDigest(
      createPart({
        appId: 'drawing-kit',
        appName: 'Drawing Kit',
        snapshot: createDrawingKitAppSnapshot({
          roundLabel: 'Dare 11',
          roundPrompt: 'Draw a moon pizza.',
          selectedTool: 'spray',
          status: 'checkpointed',
          caption: 'Moon pizza',
        }),
        values: {
          chatbridgeAppMedia: {
            screenshots: [
              {
                kind: 'app-screenshot',
                appId: 'drawing-kit',
                appInstanceId: 'instance-1',
                storageKey: 'shot-1',
                capturedAt: 1,
                summary: 'A round moon pizza with uneven slices and two star stickers near the crust.',
                source: 'runtime-captured',
              },
            ],
          },
        },
      })
    )

    expect(digest).toMatchObject({
      kind: 'drawing-kit',
    })
    expect(formatChatBridgeAppStateDigest(digest)).toContain('Prompt: Draw a moon pizza.')
    expect(formatChatBridgeAppStateDigest(digest)).toContain('Tool: spray')
    expect(formatChatBridgeAppStateDigest(digest)).toContain(
      'Visible board: A round moon pizza with uneven slices and two star stickers near the crust.'
    )
  })

  it('falls back to a bounded board description when a drawing screenshot summary is unavailable', () => {
    const digest = buildChatBridgeAppStateDigest(
      createPart({
        appId: 'drawing-kit',
        appName: 'Drawing Kit',
        snapshot: createDrawingKitAppSnapshot({
          roundLabel: 'Dare 09',
          roundPrompt: 'Draw the flappiest mascot with one noodle line.',
          selectedTool: 'brush',
          status: 'drawing',
          strokeCount: 3,
          stickerCount: 1,
          previewMarks: [
            {
              kind: 'line',
              tool: 'brush',
              color: '#267df0',
              width: 5,
              points: [
                { x: 0.18, y: 0.22 },
                { x: 0.52, y: 0.48 },
              ],
            },
            {
              kind: 'stamp',
              stamp: 'star',
              color: '#f2b61b',
              size: 18,
              x: 0.82,
              y: 0.18,
            },
          ],
        }),
      })
    )

    expect(formatChatBridgeAppStateDigest(digest)).toContain('Visible board: Visible drawing:')
    expect(formatChatBridgeAppStateDigest(digest)).toContain('blue brush stroke')
    expect(formatChatBridgeAppStateDigest(digest)).toContain('star stamp')
  })

  it('builds a bounded digest for flashcard studio snapshots', () => {
    const digest = buildChatBridgeAppStateDigest(
      createPart({
        appId: 'flashcard-studio',
        appName: 'Flashcard Studio',
        snapshot: createFlashcardStudioAppSnapshot({
          deckTitle: 'Science review',
          cards: [
            {
              cardId: 'card-1',
              prompt: 'What does the mitochondria do?',
              answer: 'It helps the cell produce energy.',
            },
            {
              cardId: 'card-2',
              prompt: 'What is photosynthesis?',
              answer: 'Plants use sunlight to make food.',
            },
          ],
          selectedCardId: 'card-2',
          lastAction: 'updated-card',
          lastUpdatedAt: 3_000,
        }),
      })
    )

    expect(digest).toMatchObject({
      kind: 'flashcard-studio',
    })
    expect(formatChatBridgeAppStateDigest(digest)).toContain('Deck: Science review')
    expect(formatChatBridgeAppStateDigest(digest)).toContain('Cards: 2')
    expect(formatChatBridgeAppStateDigest(digest)).toContain('What does the mitochondria do?')
    expect(formatChatBridgeAppStateDigest(digest)).toContain('What is photosynthesis?')
    expect(formatChatBridgeAppStateDigest(digest)).not.toContain('Plants use sunlight to make food.')
  })

  it('stores only the latest bounded set of app-linked screenshots', () => {
    const first = appendChatBridgeAppScreenshot(undefined, {
      kind: 'app-screenshot',
      appId: 'drawing-kit',
      appInstanceId: 'instance-1',
      storageKey: 'shot-1',
      capturedAt: 1,
      source: 'host-rendered',
    })
    const second = appendChatBridgeAppScreenshot(first, {
      kind: 'app-screenshot',
      appId: 'drawing-kit',
      appInstanceId: 'instance-1',
      storageKey: 'shot-2',
      capturedAt: 2,
      source: 'host-rendered',
    })
    const third = appendChatBridgeAppScreenshot(second, {
      kind: 'app-screenshot',
      appId: 'drawing-kit',
      appInstanceId: 'instance-1',
      storageKey: 'shot-3',
      capturedAt: 3,
      source: 'host-rendered',
    })
    const fourth = appendChatBridgeAppScreenshot(third, {
      kind: 'app-screenshot',
      appId: 'drawing-kit',
      appInstanceId: 'instance-1',
      storageKey: 'shot-4',
      capturedAt: 4,
      source: 'host-rendered',
    })

    expect(
      (fourth[CHATBRIDGE_APP_MEDIA_VALUES_KEY] as { screenshots: Array<{ storageKey: string }> }).screenshots
    ).toEqual([
      {
        kind: 'app-screenshot',
        appId: 'drawing-kit',
        appInstanceId: 'instance-1',
        storageKey: 'shot-2',
        capturedAt: 2,
        source: 'host-rendered',
      },
      {
        kind: 'app-screenshot',
        appId: 'drawing-kit',
        appInstanceId: 'instance-1',
        storageKey: 'shot-3',
        capturedAt: 3,
        source: 'host-rendered',
      },
      {
        kind: 'app-screenshot',
        appId: 'drawing-kit',
        appInstanceId: 'instance-1',
        storageKey: 'shot-4',
        capturedAt: 4,
        source: 'host-rendered',
      },
    ])
    expect(getLatestChatBridgeAppScreenshot(fourth)?.storageKey).toBe('shot-4')
  })
})
