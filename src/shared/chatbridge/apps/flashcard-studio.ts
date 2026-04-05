import { z } from 'zod'

export const FLASHCARD_STUDIO_APP_ID = 'flashcard-studio' as const
export const FLASHCARD_STUDIO_APP_NAME = 'Flashcard Studio' as const
export const FLASHCARD_STUDIO_APP_SNAPSHOT_SCHEMA_VERSION = 1 as const

const MAX_FLASHCARD_STUDIO_CARDS = 32
const MAX_FLASHCARD_STUDIO_DECK_TITLE_LENGTH = 80
const MAX_FLASHCARD_STUDIO_PROMPT_LENGTH = 160
const MAX_FLASHCARD_STUDIO_ANSWER_LENGTH = 320
const MAX_FLASHCARD_STUDIO_PREVIEW_CARDS = 4

export const FlashcardStudioDeckStatusSchema = z.enum(['empty', 'editing', 'complete'])
export type FlashcardStudioDeckStatus = z.infer<typeof FlashcardStudioDeckStatusSchema>

export const FlashcardStudioAuthoringActionSchema = z.enum([
  'initialized',
  'selected-card',
  'created-card',
  'updated-card',
  'deleted-card',
  'moved-card-up',
  'moved-card-down',
  'cleared-selection',
])
export type FlashcardStudioAuthoringAction = z.infer<typeof FlashcardStudioAuthoringActionSchema>

export const FlashcardStudioCardSchema = z
  .object({
    cardId: z.string().trim().min(1),
    prompt: z.string().trim().min(1).max(MAX_FLASHCARD_STUDIO_PROMPT_LENGTH),
    answer: z.string().trim().min(1).max(MAX_FLASHCARD_STUDIO_ANSWER_LENGTH),
  })
  .strict()
export type FlashcardStudioCard = z.infer<typeof FlashcardStudioCardSchema>

export const FlashcardStudioAppSnapshotSchema = z
  .object({
    schemaVersion: z.literal(FLASHCARD_STUDIO_APP_SNAPSHOT_SCHEMA_VERSION),
    appId: z.literal(FLASHCARD_STUDIO_APP_ID),
    request: z.string().trim().min(1).optional(),
    deckTitle: z.string().trim().min(1).max(MAX_FLASHCARD_STUDIO_DECK_TITLE_LENGTH),
    status: FlashcardStudioDeckStatusSchema,
    cardCount: z.number().int().nonnegative(),
    cards: z.array(FlashcardStudioCardSchema).max(MAX_FLASHCARD_STUDIO_CARDS),
    selectedCardId: z.string().trim().min(1).optional(),
    lastAction: FlashcardStudioAuthoringActionSchema,
    statusText: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    resumeHint: z.string().trim().min(1),
    lastUpdatedAt: z.number().int(),
  })
  .superRefine((value, ctx) => {
    if (value.cardCount !== value.cards.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cardCount'],
        message: 'cardCount must match cards.length',
      })
    }

    const cardIds = new Set<string>()
    for (const card of value.cards) {
      if (cardIds.has(card.cardId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cards'],
          message: `Duplicate flashcard id "${card.cardId}" is not allowed.`,
        })
      }
      cardIds.add(card.cardId)
    }

    if (value.selectedCardId && !cardIds.has(value.selectedCardId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectedCardId'],
        message: 'selectedCardId must reference an existing card.',
      })
    }
  })
export type FlashcardStudioAppSnapshot = z.infer<typeof FlashcardStudioAppSnapshotSchema>

type CreateFlashcardStudioAppSnapshotInput = {
  request?: string
  deckTitle?: string
  status?: FlashcardStudioDeckStatus
  cards?: FlashcardStudioCard[]
  selectedCardId?: string
  lastAction?: FlashcardStudioAuthoringAction
  lastUpdatedAt?: number
}

type CreateInitialFlashcardStudioAppSnapshotInput = {
  request?: string
  deckTitle?: string
  updatedAt?: number
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeOptionalWhitespace(value?: string): string | undefined {
  const trimmed = value ? normalizeWhitespace(value) : ''
  return trimmed.length > 0 ? trimmed : undefined
}

function clampLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function summarizeCardPrompt(prompt: string) {
  return clampLabel(normalizeWhitespace(prompt), 52)
}

function normalizeDeckTitle(value?: string) {
  return clampLabel(normalizeOptionalWhitespace(value) ?? 'Study deck', MAX_FLASHCARD_STUDIO_DECK_TITLE_LENGTH)
}

function normalizeCard(card: FlashcardStudioCard): FlashcardStudioCard {
  return FlashcardStudioCardSchema.parse({
    ...card,
    prompt: normalizeWhitespace(card.prompt),
    answer: normalizeWhitespace(card.answer),
  })
}

function describeFlashcardStudioLastAction(
  action: FlashcardStudioAuthoringAction,
  selectedCard: FlashcardStudioCard | null,
  cardCount: number
) {
  const selectedLabel = selectedCard ? `"${summarizeCardPrompt(selectedCard.prompt)}"` : 'the selected card'

  switch (action) {
    case 'created-card':
      return selectedCard ? `Latest change: created ${selectedLabel}.` : 'Latest change: created a new card.'
    case 'updated-card':
      return selectedCard ? `Latest change: updated ${selectedLabel}.` : 'Latest change: updated a card.'
    case 'deleted-card':
      return cardCount > 0 ? 'Latest change: deleted a card and kept the remaining deck in order.' : 'Latest change: deleted the final card from the deck.'
    case 'moved-card-up':
      return selectedCard ? `Latest change: moved ${selectedLabel} earlier in the deck.` : 'Latest change: moved a card earlier in the deck.'
    case 'moved-card-down':
      return selectedCard ? `Latest change: moved ${selectedLabel} later in the deck.` : 'Latest change: moved a card later in the deck.'
    case 'selected-card':
      return selectedCard ? `Current selection: ${selectedLabel}.` : 'A card is selected for editing.'
    case 'cleared-selection':
      return 'Composer reset and ready for a new card.'
    case 'initialized':
    default:
      return cardCount > 0 ? 'Deck restored and ready for edits.' : 'Deck initialized and ready for the first card.'
  }
}

function buildFlashcardStudioStatusText(
  status: FlashcardStudioDeckStatus,
  action: FlashcardStudioAuthoringAction,
  cardCount: number
) {
  if (status === 'complete') {
    return cardCount > 0 ? 'Deck returned to chat' : 'Empty deck returned'
  }

  if (cardCount === 0) {
    return 'No cards yet'
  }

  switch (action) {
    case 'created-card':
      return 'Card created'
    case 'updated-card':
      return 'Card updated'
    case 'deleted-card':
      return 'Card deleted'
    case 'moved-card-up':
      return 'Card moved up'
    case 'moved-card-down':
      return 'Card moved down'
    case 'selected-card':
      return 'Editing selected card'
    case 'cleared-selection':
      return 'Ready for a new card'
    case 'initialized':
    default:
      return 'Deck ready'
  }
}

function buildFlashcardStudioSummary(snapshot: {
  deckTitle: string
  status: FlashcardStudioDeckStatus
  cards: FlashcardStudioCard[]
  cardCount: number
  lastAction: FlashcardStudioAuthoringAction
  selectedCardId?: string
}) {
  const selectedCard = snapshot.cards.find((card) => card.cardId === snapshot.selectedCardId) ?? null
  const previewCards = snapshot.cards.slice(0, MAX_FLASHCARD_STUDIO_PREVIEW_CARDS).map((card) => summarizeCardPrompt(card.prompt))
  const actionSentence = describeFlashcardStudioLastAction(snapshot.lastAction, selectedCard, snapshot.cardCount)

  if (snapshot.cardCount === 0) {
    const base =
      snapshot.status === 'complete'
        ? `Flashcard Studio returned the deck "${snapshot.deckTitle}" to chat with no cards created.`
        : `Flashcard Studio is open on the deck "${snapshot.deckTitle}" with no cards yet.`
    return normalizeWhitespace(`${base} ${actionSentence} The empty state is explicit so later chat does not imply study progress.`)
  }

  const previewSentence = `Card preview: ${previewCards.join('; ')}.`
  const selectedSentence = selectedCard
    ? `Selected card: "${summarizeCardPrompt(selectedCard.prompt)}".`
    : 'No card is currently selected.'
  const base =
    snapshot.status === 'complete'
      ? `Flashcard Studio returned the deck "${snapshot.deckTitle}" to chat with ${snapshot.cardCount} cards.`
      : `Flashcard Studio is actively authoring the deck "${snapshot.deckTitle}" with ${snapshot.cardCount} cards.`

  return normalizeWhitespace(`${base} ${previewSentence} ${selectedSentence} ${actionSentence}`)
}

function buildFlashcardStudioResumeHint(deckTitle: string, cardCount: number) {
  if (cardCount === 0) {
    return `Reopen Flashcard Studio to add the first card to "${deckTitle}".`
  }

  return `Reopen Flashcard Studio to keep editing "${deckTitle}" or start study mode later.`
}

export function getFlashcardStudioSummary(snapshot: FlashcardStudioAppSnapshot) {
  return snapshot.summary
}

export function createFlashcardStudioAppSnapshot(
  input: CreateFlashcardStudioAppSnapshotInput = {}
): FlashcardStudioAppSnapshot {
  const cards = (input.cards ?? []).map(normalizeCard)
  const deckTitle = normalizeDeckTitle(input.deckTitle)
  const lastAction = input.lastAction ?? 'initialized'
  const status = input.status ?? (cards.length === 0 ? 'empty' : 'editing')
  const selectedCardId = cards.some((card) => card.cardId === input.selectedCardId) ? input.selectedCardId : undefined

  return FlashcardStudioAppSnapshotSchema.parse({
    schemaVersion: FLASHCARD_STUDIO_APP_SNAPSHOT_SCHEMA_VERSION,
    appId: FLASHCARD_STUDIO_APP_ID,
    request: normalizeOptionalWhitespace(input.request),
    deckTitle,
    status,
    cardCount: cards.length,
    cards,
    selectedCardId,
    lastAction,
    statusText: buildFlashcardStudioStatusText(status, lastAction, cards.length),
    summary: buildFlashcardStudioSummary({
      deckTitle,
      status,
      cards,
      cardCount: cards.length,
      lastAction,
      selectedCardId,
    }),
    resumeHint: buildFlashcardStudioResumeHint(deckTitle, cards.length),
    lastUpdatedAt: input.lastUpdatedAt ?? Date.now(),
  })
}

export function createInitialFlashcardStudioAppSnapshot(
  input: CreateInitialFlashcardStudioAppSnapshotInput = {}
): FlashcardStudioAppSnapshot {
  return createFlashcardStudioAppSnapshot({
    request: input.request,
    deckTitle: input.deckTitle,
    cards: [],
    status: 'empty',
    lastAction: 'initialized',
    lastUpdatedAt: input.updatedAt ?? Date.now(),
  })
}

export function parseFlashcardStudioAppSnapshot(value: unknown): FlashcardStudioAppSnapshot | null {
  const parsed = FlashcardStudioAppSnapshotSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
