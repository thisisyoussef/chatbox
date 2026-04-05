import { z } from 'zod'
import type { MessageAppPart } from '../types/session'
import { parseChessAppSnapshot } from './apps/chess'
import { describeDrawingKitVisibleBoard, parseDrawingKitAppSnapshot } from './apps/drawing-kit'
import { parseFlashcardStudioAppSnapshot } from './apps/flashcard-studio'

export const CHATBRIDGE_APP_MEDIA_VALUES_KEY = 'chatbridgeAppMedia' as const

const MAX_APP_SCREENSHOTS = 3
const MAX_CHESS_DIGEST_MOVES = 8
const MAX_DRAWING_KIT_MARKS = 4

export const ChatBridgeAppScreenshotRefSchema = z.object({
  kind: z.literal('app-screenshot'),
  appId: z.string().trim().min(1),
  appInstanceId: z.string().trim().min(1),
  storageKey: z.string().trim().min(1),
  capturedAt: z.number().int(),
  summary: z.string().trim().min(1).optional(),
  source: z.enum(['host-rendered', 'runtime-captured']).default('host-rendered'),
})

export type ChatBridgeAppScreenshotRef = z.infer<typeof ChatBridgeAppScreenshotRefSchema>

export const ChatBridgeAppMediaSchema = z.object({
  screenshots: z.array(ChatBridgeAppScreenshotRefSchema).max(MAX_APP_SCREENSHOTS).default([]),
})

export type ChatBridgeAppMedia = z.infer<typeof ChatBridgeAppMediaSchema>

export type ChatBridgeAppStateDigest = {
  kind: 'chess' | 'drawing-kit' | 'flashcard-studio'
  title: string
  lines: string[]
}

function normalizeSummary(summary?: string) {
  const trimmed = summary?.trim()
  return trimmed ? trimmed : null
}

function describeDrawingKitMark(mark: { kind: 'line' | 'stamp'; tool?: string; stamp?: string }) {
  if (mark.kind === 'stamp') {
    return `${mark.stamp ?? 'sticker'} stamp`
  }
  return `${mark.tool ?? 'brush'} stroke`
}

function buildChessDigest(part: MessageAppPart): ChatBridgeAppStateDigest | null {
  try {
    const snapshot = parseChessAppSnapshot(part.snapshot)
    const lastMove = snapshot.moveHistory.at(-1)
    const recentMoves = snapshot.moveHistory.slice(-MAX_CHESS_DIGEST_MOVES).map((move) => move.san)

    return {
      kind: 'chess',
      title: 'State digest',
      lines: [
        `Turn: ${snapshot.turn}`,
        `Phase: ${snapshot.status.phase}`,
        `Status: ${snapshot.status.reason}`,
        `FEN: ${snapshot.fen}`,
        `Last action: ${snapshot.lastAction.message}`,
        `Move count: ${snapshot.moveHistory.length} half-moves`,
        ...(lastMove ? [`Last move: ${lastMove.san}`] : []),
        ...(recentMoves.length > 0 ? [`Recent moves: ${recentMoves.join(', ')}`] : []),
      ],
    }
  } catch {
    return null
  }
}

function buildDrawingKitDigest(part: MessageAppPart): ChatBridgeAppStateDigest | null {
  const snapshot = parseDrawingKitAppSnapshot(part.snapshot)
  if (!snapshot) {
    return null
  }

  const recentMarks = snapshot.previewMarks.slice(-MAX_DRAWING_KIT_MARKS).map(describeDrawingKitMark)
  const latestScreenshotDescription =
    normalizeSummary(getLatestChatBridgeAppScreenshot(part.values)?.summary) ??
    normalizeSummary(describeDrawingKitVisibleBoard(snapshot) ?? undefined)

  return {
    kind: 'drawing-kit',
    title: 'State digest',
    lines: [
      `Round: ${snapshot.roundLabel}`,
      `Prompt: ${snapshot.roundPrompt}`,
      `Status: ${snapshot.status}`,
      `Tool: ${snapshot.selectedTool}`,
      `Caption: ${snapshot.caption ?? 'none'}`,
      `Checkpoint: ${snapshot.checkpointSummary}`,
      `Marks: ${snapshot.strokeCount} total, ${snapshot.stickerCount} stickers`,
      ...(latestScreenshotDescription ? [`Visible board: ${latestScreenshotDescription}`] : []),
      ...(recentMarks.length > 0 ? [`Recent marks: ${recentMarks.join(', ')}`] : []),
    ],
  }
}

function buildFlashcardStudioDigest(part: MessageAppPart): ChatBridgeAppStateDigest | null {
  const snapshot = parseFlashcardStudioAppSnapshot(part.snapshot)
  if (!snapshot) {
    return null
  }

  const previewCards = snapshot.cards.slice(0, 3).map((card, index) => `${index + 1}. ${card.prompt}`)
  const reviewedCount = snapshot.studyCounts.easy + snapshot.studyCounts.medium + snapshot.studyCounts.hard
  const weakPrompts = snapshot.studyMarks
    .filter((mark) => mark.confidence === 'hard')
    .map((mark) => snapshot.cards.find((card) => card.cardId === mark.cardId)?.prompt)
    .filter((prompt): prompt is string => Boolean(prompt))
    .slice(0, 3)

  return {
    kind: 'flashcard-studio',
    title: 'State digest',
    lines: [
      `Deck: ${snapshot.deckTitle}`,
      `Status: ${snapshot.status}`,
      `Mode: ${snapshot.mode}`,
      `Cards: ${snapshot.cardCount}`,
      `Latest action: ${snapshot.statusText}`,
      ...(snapshot.mode === 'study'
        ? [
            `Study progress: ${reviewedCount} reviewed, ${Math.max(0, snapshot.cardCount - reviewedCount)} remaining`,
            `Confidence: ${snapshot.studyCounts.easy} easy, ${snapshot.studyCounts.medium} medium, ${snapshot.studyCounts.hard} hard`,
            ...(weakPrompts.length > 0 ? [`Needs review: ${weakPrompts.join(' | ')}`] : []),
          ]
        : []),
      `Drive: ${snapshot.drive.statusText}`,
      ...(snapshot.drive.lastSavedDeckName ? [`Saved deck: ${snapshot.drive.lastSavedDeckName}`] : []),
      ...(snapshot.drive.recentDecks.length > 0 ? [`Recent decks: ${snapshot.drive.recentDecks.length}`] : []),
      ...(previewCards.length > 0 ? [`Preview: ${previewCards.join(' | ')}`] : ['Preview: no cards yet']),
    ],
  }
}

export function buildChatBridgeAppStateDigest(part: MessageAppPart): ChatBridgeAppStateDigest | null {
  if (part.appId === 'chess') {
    return buildChessDigest(part)
  }

  if (part.appId === 'drawing-kit') {
    return buildDrawingKitDigest(part)
  }

  if (part.appId === 'flashcard-studio') {
    return buildFlashcardStudioDigest(part)
  }

  return null
}

export function formatChatBridgeAppStateDigest(digest: ChatBridgeAppStateDigest | null): string | null {
  if (!digest || digest.lines.length === 0) {
    return null
  }

  return [digest.title, ...digest.lines.map((line) => `- ${line}`)].join('\n')
}

export function parseChatBridgeAppMedia(value: unknown): ChatBridgeAppMedia | null {
  const parsed = ChatBridgeAppMediaSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function readChatBridgeAppMedia(values?: Record<string, unknown> | null): ChatBridgeAppMedia | null {
  if (!values) {
    return null
  }

  return parseChatBridgeAppMedia(values[CHATBRIDGE_APP_MEDIA_VALUES_KEY])
}

export function getLatestChatBridgeAppScreenshot(
  values?: Record<string, unknown> | null
): ChatBridgeAppScreenshotRef | null {
  const screenshots = readChatBridgeAppMedia(values)?.screenshots ?? []
  return screenshots.at(-1) ?? null
}

export function describeChatBridgeAppScreenshot(ref: ChatBridgeAppScreenshotRef | null): string | null {
  if (!ref) {
    return null
  }

  const summary = normalizeSummary(ref.summary)
  const timestamp = new Date(ref.capturedAt).toISOString()
  return summary ? `${summary} Captured at ${timestamp}.` : `Latest screenshot captured at ${timestamp}.`
}

export function writeChatBridgeAppMediaValues(
  values: Record<string, unknown> | undefined,
  media: ChatBridgeAppMedia
): Record<string, unknown> {
  return {
    ...(values ?? {}),
    [CHATBRIDGE_APP_MEDIA_VALUES_KEY]: ChatBridgeAppMediaSchema.parse(media),
  }
}

export function appendChatBridgeAppScreenshot(
  values: Record<string, unknown> | undefined,
  screenshot: ChatBridgeAppScreenshotRef
): Record<string, unknown> {
  const existing = readChatBridgeAppMedia(values)
  const nextScreenshots = [...(existing?.screenshots ?? []), ChatBridgeAppScreenshotRefSchema.parse(screenshot)].slice(
    -MAX_APP_SCREENSHOTS
  )

  return writeChatBridgeAppMediaValues(values, {
    screenshots: nextScreenshots,
  })
}
