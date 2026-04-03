import { describe, expect, it } from 'vitest'
import {
  clampDrawingKitPreviewMarks,
  createDrawingKitVisionCompositeDataUrl,
  createDrawingKitScreenshotDataUrl,
  createDrawingKitAppSnapshot,
  createInitialDrawingKitAppSnapshot,
  getDrawingKitFallbackText,
} from './drawing-kit'

describe('shared drawing kit helpers', () => {
  it('creates a blank host-owned doodle checkpoint from the launch request', () => {
    const snapshot = createInitialDrawingKitAppSnapshot({
      request: 'Open Drawing Kit and let me doodle something weird.',
      updatedAt: 1_000,
    })

    expect(snapshot.appId).toBe('drawing-kit')
    expect(snapshot.status).toBe('blank')
    expect(snapshot.strokeCount).toBe(0)
    expect(snapshot.previewMarks).toEqual([])
    expect(snapshot.statusText).toBe('Ready for doodle dare')
    expect(snapshot.summary).toContain('blank canvas checkpoint')
  })

  it('clamps preview marks and builds a bounded checkpoint summary', () => {
    const previewMarks = Array.from({ length: 30 }, (_, index) => ({
      kind: 'line' as const,
      tool: index % 2 === 0 ? ('brush' as const) : ('spray' as const),
      color: '#ff8a4c',
      width: 4,
      points: Array.from({ length: 20 }, (__unused, pointIndex) => ({
        x: pointIndex / 19,
        y: (index + pointIndex) / 30,
      })),
    }))

    const snapshot = createDrawingKitAppSnapshot({
      request: 'Open Drawing Kit and start a sticky-note doodle dare.',
      roundLabel: 'Dare 05',
      roundPrompt: 'Draw the weirdest sandwich.',
      rewardLabel: 'Llama sticker',
      caption: 'Triple pickle sandwich',
      selectedTool: 'spray',
      status: 'checkpointed',
      strokeCount: 41,
      stickerCount: 3,
      checkpointId: 'drawing-kit-4242',
      lastUpdatedAt: 4_242,
      previewMarks: clampDrawingKitPreviewMarks(previewMarks),
    })

    expect(snapshot.previewMarks).toHaveLength(24)
    const firstLine = snapshot.previewMarks[0]
    if (firstLine?.kind !== 'line') {
      throw new Error('Expected the preview mark to stay a line.')
    }
    expect(firstLine.points).toHaveLength(12)
    expect(snapshot.statusText).toBe('3 stickers banked')
    expect(snapshot.checkpointSummary).toContain('Triple pickle sandwich')
    expect(snapshot.summary).toContain('Later chat can use the checkpoint instead of raw stroke history.')
    expect(getDrawingKitFallbackText(snapshot)).toContain('drawing-kit-4242')
  })

  it('renders a bounded screenshot data URL from the trusted snapshot', () => {
    const screenshot = createDrawingKitScreenshotDataUrl(
      createDrawingKitAppSnapshot({
        roundLabel: 'Dare 11',
        roundPrompt: 'Draw a moon pizza.',
        selectedTool: 'spray',
        status: 'drawing',
        caption: 'Moon pizza',
        previewMarks: [
          {
            kind: 'line',
            tool: 'spray',
            color: '#ff8a4c',
            width: 3,
            points: [
              { x: 0.1, y: 0.2 },
              { x: 0.6, y: 0.7 },
            ],
          },
        ],
      })
    )

    expect(screenshot.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(decodeURIComponent(screenshot.split(',')[1] ?? '')).toContain('Moon pizza')
    expect(decodeURIComponent(screenshot.split(',')[1] ?? '')).toContain('Drawing Kit')
  })

  it('builds a board-vision composite that keeps the full board and a zoomed focus crop together', () => {
    const snapshot = createDrawingKitAppSnapshot({
      roundLabel: 'Dare 11',
      roundPrompt: 'Draw a moon pizza.',
      selectedTool: 'spray',
      status: 'drawing',
      caption: 'Moon pizza',
      previewMarks: [
        {
          kind: 'line',
          tool: 'spray',
          color: '#ff8a4c',
          width: 3,
          points: [
            { x: 0.08, y: 0.18 },
            { x: 0.18, y: 0.22 },
            { x: 0.26, y: 0.3 },
          ],
        },
      ],
    })

    const screenshot = createDrawingKitVisionCompositeDataUrl(snapshot, 'data:image/png;base64,ZmFrZQ==')

    expect(screenshot.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    const decoded = decodeURIComponent(screenshot.split(',')[1] ?? '')
    expect(decoded).toContain('data:image/png;base64,ZmFrZQ==')
    expect(decoded).toContain('Moon pizza')
    expect(decoded).toContain('View the exact board on the left and the zoomed focus crop on the right.')
  })
})
