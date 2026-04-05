import { z } from 'zod'

export const FLASHCARD_STUDIO_APP_ID = 'flashcard-studio' as const
export const FLASHCARD_STUDIO_APP_NAME = 'Flashcard Studio' as const
export const FLASHCARD_STUDIO_APP_SNAPSHOT_SCHEMA_VERSION = 1 as const

const MAX_FLASHCARD_STUDIO_CARDS = 32
const MAX_FLASHCARD_STUDIO_DECK_TITLE_LENGTH = 80
const MAX_FLASHCARD_STUDIO_PROMPT_LENGTH = 160
const MAX_FLASHCARD_STUDIO_ANSWER_LENGTH = 320
const MAX_FLASHCARD_STUDIO_PREVIEW_CARDS = 4
const MAX_FLASHCARD_STUDIO_WEAK_PREVIEW_CARDS = 3
const MAX_FLASHCARD_STUDIO_RECENT_DECKS = 5
const MAX_FLASHCARD_STUDIO_DRIVE_DECK_NAME_LENGTH = 120

export const FlashcardStudioDeckStatusSchema = z.enum(['empty', 'editing', 'complete'])
export type FlashcardStudioDeckStatus = z.infer<typeof FlashcardStudioDeckStatusSchema>

export const FlashcardStudioModeSchema = z.enum(['authoring', 'study'])
export type FlashcardStudioMode = z.infer<typeof FlashcardStudioModeSchema>

export const FlashcardStudioStudyStatusSchema = z.enum(['idle', 'studying', 'complete'])
export type FlashcardStudioStudyStatus = z.infer<typeof FlashcardStudioStudyStatusSchema>

export const FlashcardStudioStudyConfidenceSchema = z.enum(['easy', 'medium', 'hard'])
export type FlashcardStudioStudyConfidence = z.infer<typeof FlashcardStudioStudyConfidenceSchema>

export const FlashcardStudioAuthoringActionSchema = z.enum([
  'initialized',
  'selected-card',
  'created-card',
  'updated-card',
  'deleted-card',
  'moved-card-up',
  'moved-card-down',
  'cleared-selection',
  'entered-study-mode',
  'returned-to-authoring',
  'revealed-card',
  'marked-easy',
  'marked-medium',
  'marked-hard',
  'completed-study-round',
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

export const FlashcardStudioStudyMarkSchema = z
  .object({
    cardId: z.string().trim().min(1),
    confidence: FlashcardStudioStudyConfidenceSchema,
  })
  .strict()
export type FlashcardStudioStudyMark = z.infer<typeof FlashcardStudioStudyMarkSchema>

export const FlashcardStudioStudyCountsSchema = z
  .object({
    easy: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    hard: z.number().int().nonnegative(),
  })
  .strict()
export type FlashcardStudioStudyCounts = z.infer<typeof FlashcardStudioStudyCountsSchema>

export const FlashcardStudioDriveStatusSchema = z.enum([
  'needs-auth',
  'connecting',
  'connected',
  'saving',
  'loading',
  'error',
])
export type FlashcardStudioDriveStatus = z.infer<typeof FlashcardStudioDriveStatusSchema>

export const FlashcardStudioDriveRecentDeckSchema = z
  .object({
    deckId: z.string().trim().min(1),
    deckName: z.string().trim().min(1).max(MAX_FLASHCARD_STUDIO_DRIVE_DECK_NAME_LENGTH),
    modifiedAt: z.number().int().nonnegative(),
    lastOpenedAt: z.number().int().nonnegative().optional(),
  })
  .strict()
export type FlashcardStudioDriveRecentDeck = z.infer<typeof FlashcardStudioDriveRecentDeckSchema>

export const FlashcardStudioDriveStateSchema = z
  .object({
    provider: z.literal('google-drive').default('google-drive'),
    status: FlashcardStudioDriveStatusSchema.default('needs-auth'),
    statusText: z.string().trim().min(1),
    detail: z.string().trim().min(1),
    connectedAs: z.string().trim().min(1).optional(),
    recentDecks: z.array(FlashcardStudioDriveRecentDeckSchema).max(MAX_FLASHCARD_STUDIO_RECENT_DECKS).default([]),
    lastSavedDeckId: z.string().trim().min(1).optional(),
    lastSavedDeckName: z.string().trim().min(1).max(MAX_FLASHCARD_STUDIO_DRIVE_DECK_NAME_LENGTH).optional(),
    lastSavedAt: z.number().int().nonnegative().optional(),
  })
  .strict()
export type FlashcardStudioDriveState = z.infer<typeof FlashcardStudioDriveStateSchema>

export const FlashcardStudioAppSnapshotSchema = z
  .object({
    schemaVersion: z.literal(FLASHCARD_STUDIO_APP_SNAPSHOT_SCHEMA_VERSION),
    appId: z.literal(FLASHCARD_STUDIO_APP_ID),
    request: z.string().trim().min(1).optional(),
    deckTitle: z.string().trim().min(1).max(MAX_FLASHCARD_STUDIO_DECK_TITLE_LENGTH),
    status: FlashcardStudioDeckStatusSchema,
    mode: FlashcardStudioModeSchema.default('authoring'),
    studyStatus: FlashcardStudioStudyStatusSchema.default('idle'),
    cardCount: z.number().int().nonnegative(),
    cards: z.array(FlashcardStudioCardSchema).max(MAX_FLASHCARD_STUDIO_CARDS),
    selectedCardId: z.string().trim().min(1).optional(),
    studyPosition: z.number().int().nonnegative().default(0),
    revealedCardId: z.string().trim().min(1).optional(),
    studyMarks: z.array(FlashcardStudioStudyMarkSchema).max(MAX_FLASHCARD_STUDIO_CARDS).default([]),
    studyCounts: FlashcardStudioStudyCountsSchema.default({
      easy: 0,
      medium: 0,
      hard: 0,
    }),
    drive: FlashcardStudioDriveStateSchema.default({
      provider: 'google-drive',
      status: 'needs-auth',
      statusText: 'Drive not connected',
      detail: 'Connect Drive to save this deck or reopen a recent one.',
      recentDecks: [],
    }),
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

    if (value.cards.length === 0) {
      if (value.mode !== 'authoring') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mode'],
          message: 'mode must remain authoring when there are no cards.',
        })
      }

      if (value.studyStatus !== 'idle') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['studyStatus'],
          message: 'studyStatus must remain idle when there are no cards.',
        })
      }
    }

    const studyMarkIds = new Set<string>()
    for (const mark of value.studyMarks) {
      if (!cardIds.has(mark.cardId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['studyMarks'],
          message: `Study mark card "${mark.cardId}" must reference an existing card.`,
        })
      }

      if (studyMarkIds.has(mark.cardId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['studyMarks'],
          message: `Duplicate study mark "${mark.cardId}" is not allowed.`,
        })
      }

      studyMarkIds.add(mark.cardId)
    }

    const derivedCounts = value.studyMarks.reduce<FlashcardStudioStudyCounts>(
      (counts, mark) => ({
        ...counts,
        [mark.confidence]: counts[mark.confidence] + 1,
      }),
      { easy: 0, medium: 0, hard: 0 }
    )

    if (
      value.studyCounts.easy !== derivedCounts.easy ||
      value.studyCounts.medium !== derivedCounts.medium ||
      value.studyCounts.hard !== derivedCounts.hard
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studyCounts'],
        message: 'studyCounts must match studyMarks.',
      })
    }

    if (value.studyPosition > value.cardCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studyPosition'],
        message: 'studyPosition cannot exceed cardCount.',
      })
    }

    const activeStudyCard =
      value.studyPosition >= 0 && value.studyPosition < value.cards.length ? value.cards[value.studyPosition] : null

    if (value.mode === 'study' && value.studyStatus === 'studying' && !activeStudyCard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studyPosition'],
        message: 'studyPosition must reference an active card while studying.',
      })
    }

    if (value.mode === 'study' && value.studyStatus === 'idle' && value.cardCount > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studyStatus'],
        message: 'studyStatus cannot remain idle while mode is study.',
      })
    }

    if (value.mode === 'authoring' && value.studyStatus === 'complete' && value.status !== 'complete') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studyStatus'],
        message: 'completed study results must stay in study mode until completion is returned to chat.',
      })
    }

    if (value.revealedCardId) {
      if (!activeStudyCard || value.revealedCardId !== activeStudyCard.cardId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['revealedCardId'],
          message: 'revealedCardId must reference the active study card.',
        })
      }
    }

    if (value.studyStatus === 'complete' && value.studyPosition !== value.cardCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studyPosition'],
        message: 'studyPosition must advance to cardCount when studyStatus is complete.',
      })
    }

    const seenDeckIds = new Set<string>()
    for (const recentDeck of value.drive.recentDecks) {
      if (seenDeckIds.has(recentDeck.deckId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['drive', 'recentDecks'],
          message: `Duplicate recent deck "${recentDeck.deckId}" is not allowed.`,
        })
      }
      seenDeckIds.add(recentDeck.deckId)
    }
  })
export type FlashcardStudioAppSnapshot = z.infer<typeof FlashcardStudioAppSnapshotSchema>

type CreateFlashcardStudioAppSnapshotInput = {
  request?: string
  deckTitle?: string
  status?: FlashcardStudioDeckStatus
  mode?: FlashcardStudioMode
  studyStatus?: FlashcardStudioStudyStatus
  cards?: FlashcardStudioCard[]
  selectedCardId?: string
  studyPosition?: number
  revealedCardId?: string
  studyMarks?: FlashcardStudioStudyMark[]
  drive?: Partial<FlashcardStudioDriveState>
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

function normalizeDriveDeckName(value?: string) {
  return clampLabel(normalizeOptionalWhitespace(value) ?? 'Saved flashcard deck', MAX_FLASHCARD_STUDIO_DRIVE_DECK_NAME_LENGTH)
}

function normalizeCard(card: FlashcardStudioCard): FlashcardStudioCard {
  return FlashcardStudioCardSchema.parse({
    ...card,
    prompt: normalizeWhitespace(card.prompt),
    answer: normalizeWhitespace(card.answer),
  })
}

function normalizeStudyMarks(cards: FlashcardStudioCard[], marks: FlashcardStudioStudyMark[] | undefined) {
  const availableCardIds = new Set(cards.map((card) => card.cardId))
  const seenCardIds = new Set<string>()
  const normalizedMarks: FlashcardStudioStudyMark[] = []

  for (const mark of marks ?? []) {
    if (!availableCardIds.has(mark.cardId) || seenCardIds.has(mark.cardId)) {
      continue
    }

    normalizedMarks.push(
      FlashcardStudioStudyMarkSchema.parse({
        cardId: normalizeWhitespace(mark.cardId),
        confidence: mark.confidence,
      })
    )
    seenCardIds.add(mark.cardId)
  }

  return normalizedMarks
}

function buildStudyCounts(studyMarks: FlashcardStudioStudyMark[]): FlashcardStudioStudyCounts {
  return studyMarks.reduce<FlashcardStudioStudyCounts>(
    (counts, mark) => ({
      ...counts,
      [mark.confidence]: counts[mark.confidence] + 1,
    }),
    { easy: 0, medium: 0, hard: 0 }
  )
}

function normalizeDriveRecentDecks(recentDecks: FlashcardStudioDriveRecentDeck[] | undefined) {
  const deduped: FlashcardStudioDriveRecentDeck[] = []
  const seenDeckIds = new Set<string>()

  for (const recentDeck of recentDecks ?? []) {
    const normalizedDeck = FlashcardStudioDriveRecentDeckSchema.parse({
      deckId: normalizeWhitespace(recentDeck.deckId),
      deckName: normalizeDriveDeckName(recentDeck.deckName),
      modifiedAt: recentDeck.modifiedAt,
      lastOpenedAt: recentDeck.lastOpenedAt,
    })

    if (seenDeckIds.has(normalizedDeck.deckId)) {
      continue
    }

    seenDeckIds.add(normalizedDeck.deckId)
    deduped.push(normalizedDeck)
  }

  return deduped
    .sort((left, right) => {
      const rightSort = right.lastOpenedAt ?? right.modifiedAt
      const leftSort = left.lastOpenedAt ?? left.modifiedAt
      return rightSort - leftSort
    })
    .slice(0, MAX_FLASHCARD_STUDIO_RECENT_DECKS)
}

function buildFlashcardStudioDriveStatusText(input: {
  status: FlashcardStudioDriveStatus
  recentDecks: FlashcardStudioDriveRecentDeck[]
}) {
  switch (input.status) {
    case 'connecting':
      return 'Connecting Drive'
    case 'connected':
      return 'Drive connected'
    case 'saving':
      return 'Saving to Drive'
    case 'loading':
      return 'Loading from Drive'
    case 'error':
      return 'Drive action blocked'
    case 'needs-auth':
    default:
      return input.recentDecks.length > 0 ? 'Reconnect Drive to resume' : 'Drive not connected'
  }
}

function buildFlashcardStudioDriveDetail(input: {
  status: FlashcardStudioDriveStatus
  recentDecks: FlashcardStudioDriveRecentDeck[]
  lastSavedDeckName?: string
  lastSavedAt?: number
  connectedAs?: string
}) {
  const latestDeckName = input.lastSavedDeckName ?? input.recentDecks[0]?.deckName

  switch (input.status) {
    case 'connecting':
      return 'Waiting for Google Drive permission so the host can save and reopen this deck.'
    case 'connected':
      return latestDeckName
        ? `Drive is ready for "${latestDeckName}" and future save or resume actions stay host-owned.`
        : input.connectedAs
          ? `Drive is connected for ${input.connectedAs} and ready to save this deck.`
          : 'Drive is connected and ready to save or reopen a deck.'
    case 'saving':
      return latestDeckName
        ? `Saving "${latestDeckName}" to Drive through the host-managed connector.`
        : 'Saving the current deck to Drive through the host-managed connector.'
    case 'loading':
      return latestDeckName
        ? `Loading "${latestDeckName}" from the saved Drive deck list.`
        : 'Loading the selected deck from Drive.'
    case 'error':
      return latestDeckName
        ? `Drive needs attention before the host can keep "${latestDeckName}" in sync.`
        : 'Drive needs attention before save or resume can continue.'
    case 'needs-auth':
    default:
      return latestDeckName
        ? `Reconnect Drive to reopen "${latestDeckName}" or save new progress from this deck.`
        : 'Connect Drive to save this deck or reopen a recent one.'
  }
}

function normalizeDriveState(input: Partial<FlashcardStudioDriveState> | undefined): FlashcardStudioDriveState {
  const recentDecks = normalizeDriveRecentDecks(input?.recentDecks)
  const status = input?.status ?? 'needs-auth'
  const lastSavedDeckName = input?.lastSavedDeckName ? normalizeDriveDeckName(input.lastSavedDeckName) : undefined

  return FlashcardStudioDriveStateSchema.parse({
    provider: 'google-drive',
    status,
    statusText:
      normalizeOptionalWhitespace(input?.statusText) ??
      buildFlashcardStudioDriveStatusText({
        status,
        recentDecks,
      }),
    detail:
      normalizeOptionalWhitespace(input?.detail) ??
      buildFlashcardStudioDriveDetail({
        status,
        recentDecks,
        lastSavedDeckName,
        lastSavedAt: input?.lastSavedAt,
        connectedAs: normalizeOptionalWhitespace(input?.connectedAs),
      }),
    connectedAs: normalizeOptionalWhitespace(input?.connectedAs),
    recentDecks,
    lastSavedDeckId: normalizeOptionalWhitespace(input?.lastSavedDeckId),
    lastSavedDeckName,
    lastSavedAt: typeof input?.lastSavedAt === 'number' ? input.lastSavedAt : undefined,
  })
}

function getWeakStudyPrompts(cards: FlashcardStudioCard[], studyMarks: FlashcardStudioStudyMark[]) {
  const cardById = new Map(cards.map((card) => [card.cardId, card] as const))
  const hardPrompts = studyMarks
    .filter((mark) => mark.confidence === 'hard')
    .map((mark) => cardById.get(mark.cardId))
    .filter((card): card is FlashcardStudioCard => Boolean(card))
    .map((card) => summarizeCardPrompt(card.prompt))

  if (hardPrompts.length > 0) {
    return hardPrompts.slice(0, MAX_FLASHCARD_STUDIO_WEAK_PREVIEW_CARDS)
  }

  return studyMarks
    .filter((mark) => mark.confidence === 'medium')
    .map((mark) => cardById.get(mark.cardId))
    .filter((card): card is FlashcardStudioCard => Boolean(card))
    .map((card) => summarizeCardPrompt(card.prompt))
    .slice(0, MAX_FLASHCARD_STUDIO_WEAK_PREVIEW_CARDS)
}

function deriveStudyState(input: {
  cards: FlashcardStudioCard[]
  mode?: FlashcardStudioMode
  studyStatus?: FlashcardStudioStudyStatus
  studyPosition?: number
  revealedCardId?: string
  studyMarks?: FlashcardStudioStudyMark[]
}) {
  if (input.cards.length === 0) {
    return {
      mode: 'authoring' as const,
      studyStatus: 'idle' as const,
      studyPosition: 0,
      revealedCardId: undefined,
      studyMarks: [] as FlashcardStudioStudyMark[],
      studyCounts: { easy: 0, medium: 0, hard: 0 },
    }
  }

  const normalizedStudyMarks = normalizeStudyMarks(input.cards, input.studyMarks)
  const normalizedStudyCounts = buildStudyCounts(normalizedStudyMarks)

  const requestedMode = input.mode ?? 'authoring'
  const requestedStudyStatus =
    input.studyStatus ?? (requestedMode === 'study' ? 'studying' : normalizedStudyMarks.length > 0 ? 'studying' : 'idle')

  let mode: FlashcardStudioMode = requestedMode
  let studyStatus: FlashcardStudioStudyStatus = requestedStudyStatus

  if (requestedMode === 'authoring') {
    studyStatus = normalizedStudyMarks.length > 0 ? 'studying' : 'idle'
  }

  if (requestedMode === 'study' && requestedStudyStatus === 'idle') {
    studyStatus = 'studying'
  }

  const defaultStudyPosition =
    studyStatus === 'complete'
      ? input.cards.length
      : Math.min(normalizedStudyMarks.length, Math.max(0, input.cards.length - 1))

  let studyPosition = input.studyPosition ?? defaultStudyPosition
  studyPosition = Math.max(0, Math.min(studyPosition, input.cards.length))

  if (studyStatus === 'complete') {
    studyPosition = input.cards.length
  }

  if (mode === 'authoring' && studyStatus === 'complete') {
    mode = 'study'
  }

  const activeStudyCard =
    studyPosition >= 0 && studyPosition < input.cards.length ? input.cards[studyPosition] : undefined
  const revealedCardId =
    activeStudyCard && input.revealedCardId === activeStudyCard.cardId ? input.revealedCardId : undefined

  return {
    mode,
    studyStatus,
    studyPosition,
    revealedCardId,
    studyMarks: normalizedStudyMarks,
    studyCounts: normalizedStudyCounts,
  }
}

function describeFlashcardStudioLastAction(
  action: FlashcardStudioAuthoringAction,
  selectedCard: FlashcardStudioCard | null,
  currentStudyCard: FlashcardStudioCard | null,
  studyCounts: FlashcardStudioStudyCounts,
  cardCount: number
) {
  const selectedLabel = selectedCard ? `"${summarizeCardPrompt(selectedCard.prompt)}"` : 'the selected card'
  const studyLabel = currentStudyCard ? `"${summarizeCardPrompt(currentStudyCard.prompt)}"` : 'the current study card'

  switch (action) {
    case 'created-card':
      return selectedCard ? `Latest change: created ${selectedLabel}.` : 'Latest change: created a new card.'
    case 'updated-card':
      return selectedCard ? `Latest change: updated ${selectedLabel}.` : 'Latest change: updated a card.'
    case 'deleted-card':
      return cardCount > 0
        ? 'Latest change: deleted a card and kept the remaining deck in order.'
        : 'Latest change: deleted the final card from the deck.'
    case 'moved-card-up':
      return selectedCard
        ? `Latest change: moved ${selectedLabel} earlier in the deck.`
        : 'Latest change: moved a card earlier in the deck.'
    case 'moved-card-down':
      return selectedCard
        ? `Latest change: moved ${selectedLabel} later in the deck.`
        : 'Latest change: moved a card later in the deck.'
    case 'selected-card':
      return selectedCard ? `Current selection: ${selectedLabel}.` : 'A card is selected for editing.'
    case 'cleared-selection':
      return 'Composer reset and ready for a new card.'
    case 'entered-study-mode':
      return 'Study mode started from the current deck order.'
    case 'returned-to-authoring':
      return 'Returned to editing so the deck can be revised before more studying.'
    case 'revealed-card':
      return currentStudyCard
        ? `Latest change: revealed the answer for ${studyLabel}.`
        : 'Latest change: revealed the answer for the current card.'
    case 'marked-easy':
      return `Latest change: marked ${studyLabel} as easy.`
    case 'marked-medium':
      return `Latest change: marked ${studyLabel} as medium.`
    case 'marked-hard':
      return `Latest change: marked ${studyLabel} as hard.`
    case 'completed-study-round':
      return `Study round finished with ${studyCounts.easy} easy, ${studyCounts.medium} medium, and ${studyCounts.hard} hard cards.`
    case 'initialized':
    default:
      return cardCount > 0 ? 'Deck restored and ready for edits.' : 'Deck initialized and ready for the first card.'
  }
}

function buildFlashcardStudioStatusText(snapshot: {
  status: FlashcardStudioDeckStatus
  mode: FlashcardStudioMode
  studyStatus: FlashcardStudioStudyStatus
  lastAction: FlashcardStudioAuthoringAction
  cardCount: number
  studyPosition: number
  studyCounts: FlashcardStudioStudyCounts
}) {
  if (snapshot.status === 'complete') {
    if (snapshot.mode === 'study') {
      return 'Study results returned to chat'
    }

    return snapshot.cardCount > 0 ? 'Deck returned to chat' : 'Empty deck returned'
  }

  if (snapshot.cardCount === 0) {
    return 'No cards yet'
  }

  if (snapshot.mode === 'study') {
    if (snapshot.studyStatus === 'complete') {
      return 'Study round complete'
    }

    switch (snapshot.lastAction) {
      case 'entered-study-mode':
        return 'Study mode ready'
      case 'revealed-card':
        return 'Answer revealed'
      case 'marked-easy':
        return 'Marked easy'
      case 'marked-medium':
        return 'Marked medium'
      case 'marked-hard':
        return 'Marked hard'
      case 'returned-to-authoring':
        return 'Back to editing'
      default:
        return `Studying card ${Math.min(snapshot.studyPosition + 1, snapshot.cardCount)} of ${snapshot.cardCount}`
    }
  }

  switch (snapshot.lastAction) {
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
    default:
      return 'Deck ready'
  }
}

function buildFlashcardStudioSummary(snapshot: {
  deckTitle: string
  status: FlashcardStudioDeckStatus
  mode: FlashcardStudioMode
  studyStatus: FlashcardStudioStudyStatus
  cards: FlashcardStudioCard[]
  cardCount: number
  selectedCardId?: string
  studyPosition: number
  studyMarks: FlashcardStudioStudyMark[]
  studyCounts: FlashcardStudioStudyCounts
  drive: FlashcardStudioDriveState
  lastAction: FlashcardStudioAuthoringAction
}) {
  const selectedCard = snapshot.cards.find((card) => card.cardId === snapshot.selectedCardId) ?? null
  const currentStudyCard =
    snapshot.studyPosition >= 0 && snapshot.studyPosition < snapshot.cards.length
      ? snapshot.cards[snapshot.studyPosition]
      : null
  const actionSentence = describeFlashcardStudioLastAction(
    snapshot.lastAction,
    selectedCard,
    currentStudyCard,
    snapshot.studyCounts,
    snapshot.cardCount
  )
  const driveSentence =
    snapshot.drive.status === 'connected'
      ? snapshot.drive.lastSavedDeckName
        ? `Drive is connected for "${snapshot.drive.lastSavedDeckName}".`
        : 'Drive is connected for save and resume.'
      : snapshot.drive.status === 'needs-auth' && snapshot.drive.recentDecks.length > 0
        ? `Drive resume is available for ${snapshot.drive.recentDecks.length} saved deck${snapshot.drive.recentDecks.length === 1 ? '' : 's'} after reconnect.`
        : snapshot.drive.status === 'error'
          ? `Drive needs attention: ${snapshot.drive.detail}`
          : null

  if (snapshot.cardCount === 0) {
    const base =
      snapshot.status === 'complete'
        ? `Flashcard Studio returned the deck "${snapshot.deckTitle}" to chat with no cards created.`
        : `Flashcard Studio is open on the deck "${snapshot.deckTitle}" with no cards yet.`
    return normalizeWhitespace(
      `${base} ${actionSentence} ${driveSentence ?? ''} The empty state is explicit so later chat does not imply study progress.`
    )
  }

  if (snapshot.mode === 'study') {
    const reviewedCount = snapshot.studyMarks.length
    const remainingCount = Math.max(0, snapshot.cardCount - reviewedCount)
    const weakPrompts = getWeakStudyPrompts(snapshot.cards, snapshot.studyMarks)
    const base =
      snapshot.status === 'complete'
        ? `Flashcard Studio returned study results for "${snapshot.deckTitle}" after reviewing ${reviewedCount} of ${snapshot.cardCount} cards.`
        : snapshot.studyStatus === 'complete'
          ? `Flashcard Studio finished studying "${snapshot.deckTitle}" and is holding the results in the thread.`
          : `Flashcard Studio is actively studying "${snapshot.deckTitle}" with ${reviewedCount} of ${snapshot.cardCount} cards reviewed.`
    const progressSentence = `Confidence totals: ${snapshot.studyCounts.easy} easy, ${snapshot.studyCounts.medium} medium, ${snapshot.studyCounts.hard} hard. ${remainingCount} cards remaining.`
    const currentCardSentence =
      currentStudyCard && snapshot.studyStatus !== 'complete'
        ? `Current card: "${summarizeCardPrompt(currentStudyCard.prompt)}".`
        : 'No current study card is waiting.'
    const weakSentence =
      weakPrompts.length > 0
        ? `Needs review: ${weakPrompts.join('; ')}.`
        : reviewedCount > 0
          ? 'No hard review cards are currently flagged.'
          : 'No confidence marks recorded yet.'

    return normalizeWhitespace(
      `${base} ${progressSentence} ${currentCardSentence} ${weakSentence} ${actionSentence} ${driveSentence ?? ''}`
    )
  }

  const previewCards = snapshot.cards.slice(0, MAX_FLASHCARD_STUDIO_PREVIEW_CARDS).map((card) => summarizeCardPrompt(card.prompt))
  const previewSentence = `Card preview: ${previewCards.join('; ')}.`
  const selectedSentence = selectedCard
    ? `Selected card: "${summarizeCardPrompt(selectedCard.prompt)}".`
    : 'No card is currently selected.'
  const base =
    snapshot.status === 'complete'
      ? `Flashcard Studio returned the deck "${snapshot.deckTitle}" to chat with ${snapshot.cardCount} cards.`
      : `Flashcard Studio is actively authoring the deck "${snapshot.deckTitle}" with ${snapshot.cardCount} cards.`

  return normalizeWhitespace(`${base} ${previewSentence} ${selectedSentence} ${actionSentence} ${driveSentence ?? ''}`)
}

function buildFlashcardStudioResumeHint(snapshot: {
  deckTitle: string
  cardCount: number
  mode: FlashcardStudioMode
  studyStatus: FlashcardStudioStudyStatus
  studyPosition: number
  studyMarks: FlashcardStudioStudyMark[]
  drive: FlashcardStudioDriveState
}) {
  const reconnectHint =
    snapshot.drive.status === 'needs-auth' && snapshot.drive.recentDecks.length > 0
      ? ` Reconnect Drive to reopen "${snapshot.drive.recentDecks[0]?.deckName}".`
      : ''

  if (snapshot.cardCount === 0) {
    return `Reopen Flashcard Studio to add the first card to "${snapshot.deckTitle}".${reconnectHint}`
  }

  if (snapshot.mode === 'study') {
    if (snapshot.studyStatus === 'complete') {
      return `Reopen Flashcard Studio to review the hard cards in "${snapshot.deckTitle}" or keep editing the deck.${reconnectHint}`
    }

    const currentLabel = Math.min(snapshot.studyPosition + 1, snapshot.cardCount)
    return `Reopen Flashcard Studio to continue studying "${snapshot.deckTitle}" at card ${currentLabel} of ${snapshot.cardCount}.${reconnectHint}`
  }

  if (snapshot.studyMarks.length > 0) {
    return `Reopen Flashcard Studio to keep editing "${snapshot.deckTitle}" or resume the current study round later.${reconnectHint}`
  }

  return `Reopen Flashcard Studio to keep editing "${snapshot.deckTitle}" or start study mode later.${reconnectHint}`
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
  const drive = normalizeDriveState(input.drive)
  const studyState = deriveStudyState({
    cards,
    mode: input.mode,
    studyStatus: input.studyStatus,
    studyPosition: input.studyPosition,
    revealedCardId: input.revealedCardId,
    studyMarks: input.studyMarks,
  })

  return FlashcardStudioAppSnapshotSchema.parse({
    schemaVersion: FLASHCARD_STUDIO_APP_SNAPSHOT_SCHEMA_VERSION,
    appId: FLASHCARD_STUDIO_APP_ID,
    request: normalizeOptionalWhitespace(input.request),
    deckTitle,
    status,
    mode: studyState.mode,
    studyStatus: studyState.studyStatus,
    cardCount: cards.length,
    cards,
    selectedCardId,
    studyPosition: studyState.studyPosition,
    revealedCardId: studyState.revealedCardId,
    studyMarks: studyState.studyMarks,
    studyCounts: studyState.studyCounts,
    drive,
    lastAction,
    statusText: buildFlashcardStudioStatusText({
      status,
      mode: studyState.mode,
      studyStatus: studyState.studyStatus,
      lastAction,
      cardCount: cards.length,
      studyPosition: studyState.studyPosition,
      studyCounts: studyState.studyCounts,
    }),
    summary: buildFlashcardStudioSummary({
      deckTitle,
      status,
      mode: studyState.mode,
      studyStatus: studyState.studyStatus,
      cards,
      cardCount: cards.length,
      selectedCardId,
      studyPosition: studyState.studyPosition,
      studyMarks: studyState.studyMarks,
      studyCounts: studyState.studyCounts,
      drive,
      lastAction,
    }),
    resumeHint: buildFlashcardStudioResumeHint({
      deckTitle,
      cardCount: cards.length,
      mode: studyState.mode,
      studyStatus: studyState.studyStatus,
      studyPosition: studyState.studyPosition,
      studyMarks: studyState.studyMarks,
      drive,
    }),
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
    mode: 'authoring',
    studyStatus: 'idle',
    lastAction: 'initialized',
    lastUpdatedAt: input.updatedAt ?? Date.now(),
  })
}

export function updateFlashcardStudioAppSnapshot(
  snapshot: FlashcardStudioAppSnapshot,
  input: Partial<CreateFlashcardStudioAppSnapshotInput>
): FlashcardStudioAppSnapshot {
  return createFlashcardStudioAppSnapshot({
    request: snapshot.request,
    deckTitle: snapshot.deckTitle,
    status: snapshot.status,
    mode: snapshot.mode,
    studyStatus: snapshot.studyStatus,
    cards: snapshot.cards,
    selectedCardId: snapshot.selectedCardId,
    studyPosition: snapshot.studyPosition,
    revealedCardId: snapshot.revealedCardId,
    studyMarks: snapshot.studyMarks,
    drive: snapshot.drive,
    lastAction: snapshot.lastAction,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    ...input,
  })
}

export function parseFlashcardStudioAppSnapshot(value: unknown): FlashcardStudioAppSnapshot | null {
  const parsed = FlashcardStudioAppSnapshotSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
