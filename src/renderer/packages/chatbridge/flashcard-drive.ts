import { z } from 'zod'
import {
  ChatBridgeAppAuthGrantSchema,
  FLASHCARD_STUDIO_APP_ID,
  FlashcardStudioAuthoringActionSchema,
  FlashcardStudioDeckStatusSchema,
  FlashcardStudioDriveRecentDeckSchema,
  FlashcardStudioModeSchema,
  FlashcardStudioStudyConfidenceSchema,
  FlashcardStudioStudyStatusSchema,
  createFlashcardStudioAppSnapshot,
  updateFlashcardStudioAppSnapshot,
  type ChatBridgeAppAuthGrant,
  type FlashcardStudioAppSnapshot,
  type FlashcardStudioDriveRecentDeck,
  type FlashcardStudioDriveStatus,
} from '@shared/chatbridge'
import platform from '@/platform'
import { GOOGLE_CLIENT_ID } from '@/variables'

const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const FLASHCARD_STUDIO_DRIVE_STORE_SCHEMA_VERSION = 2 as const
const FLASHCARD_STUDIO_SHEET_LAYOUT_VERSION = 1 as const
const MAX_RECENT_DECKS = 5
const GOOGLE_SHEETS_CARDS_TAB = 'Cards'
const GOOGLE_SHEETS_STATE_TAB = 'Session State'

type GoogleAccountsTokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

type GoogleTokenClientConfig = {
  client_id: string
  scope: string
  callback: (response: GoogleAccountsTokenResponse) => void
  error_callback?: (error: { type?: string }) => void
}

type GoogleTokenClient = {
  requestAccessToken: (overrides?: {
    prompt?: '' | 'consent'
    hint?: string
  }) => void
}

type GoogleIdentityWindow = Window & {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient
      }
    }
  }
}

const FlashcardStudioDriveLocalStateSchema = z
  .object({
    schemaVersion: z.literal(FLASHCARD_STUDIO_DRIVE_STORE_SCHEMA_VERSION),
    storageKind: z.literal('google-sheet').default('google-sheet'),
    userId: z.string().trim().min(1),
    appId: z.literal(FLASHCARD_STUDIO_APP_ID),
    grant: ChatBridgeAppAuthGrantSchema.nullable().default(null),
    connectedAs: z.string().trim().min(1).optional(),
    recentDecks: z.array(FlashcardStudioDriveRecentDeckSchema).max(MAX_RECENT_DECKS).default([]),
    lastSavedDeckId: z.string().trim().min(1).optional(),
    lastSavedDeckName: z.string().trim().min(1).optional(),
    lastSavedAt: z.number().int().nonnegative().optional(),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict()
type FlashcardStudioDriveLocalState = z.infer<typeof FlashcardStudioDriveLocalStateSchema>

type GoogleDriveFileMetadata = {
  id: string
  name: string
  modifiedTime?: string
}

type GoogleSheetsSpreadsheet = {
  spreadsheetId: string
  properties?: {
    title?: string
  }
}

type GoogleSheetsBatchGetResponse = {
  valueRanges?: Array<{
    range?: string
    values?: string[][]
  }>
}

class FlashcardDriveError extends Error {
  code:
    | 'missing-client-id'
    | 'auth-denied'
    | 'auth-expired'
    | 'drive-error'
    | 'invalid-file'
    | 'missing-deck'
    | 'needs-auth'

  constructor(
    code: FlashcardDriveError['code'],
    message: string
  ) {
    super(message)
    this.code = code
  }
}

let googleIdentityScriptPromise: Promise<void> | null = null
let activeDriveToken: {
  userId: string
  accessToken: string
  expiresAt: number
} | null = null

function getGoogleIdentityWindow() {
  return window as GoogleIdentityWindow
}

function createLocalStateKey(userId: string) {
  return `chatbridge:flashcard-studio:drive:${userId}`
}

function createDefaultLocalState(userId: string): FlashcardStudioDriveLocalState {
  return FlashcardStudioDriveLocalStateSchema.parse({
    schemaVersion: FLASHCARD_STUDIO_DRIVE_STORE_SCHEMA_VERSION,
    storageKind: 'google-sheet',
    userId,
    appId: FLASHCARD_STUDIO_APP_ID,
    grant: null,
    recentDecks: [],
    updatedAt: Date.now(),
  })
}

function isLegacyDriveDeckName(deckName: string) {
  return deckName.trim().endsWith('.chatbridge-flashcards.json')
}

function normalizeRecentDecks(recentDecks: FlashcardStudioDriveRecentDeck[]) {
  const seenDeckIds = new Set<string>()
  const deduped: FlashcardStudioDriveRecentDeck[] = []

  for (const recentDeck of recentDecks) {
    const parsed = FlashcardStudioDriveRecentDeckSchema.parse(recentDeck)
    if (isLegacyDriveDeckName(parsed.deckName) || seenDeckIds.has(parsed.deckId)) {
      continue
    }

    seenDeckIds.add(parsed.deckId)
    deduped.push(parsed)
  }

  return deduped
    .sort((left, right) => {
      const leftSort = left.lastOpenedAt ?? left.modifiedAt
      const rightSort = right.lastOpenedAt ?? right.modifiedAt
      return rightSort - leftSort
    })
    .slice(0, MAX_RECENT_DECKS)
}

function mergeRecentDeckSources(...sources: Array<FlashcardStudioDriveRecentDeck[] | undefined>) {
  const byDeckId = new Map<string, FlashcardStudioDriveRecentDeck>()

  for (const source of sources) {
    for (const recentDeck of source ?? []) {
      const parsed = FlashcardStudioDriveRecentDeckSchema.parse(recentDeck)
      if (isLegacyDriveDeckName(parsed.deckName)) {
        continue
      }

      const existing = byDeckId.get(parsed.deckId)
      if (!existing) {
        byDeckId.set(parsed.deckId, parsed)
        continue
      }

      const existingSort = existing.lastOpenedAt ?? existing.modifiedAt
      const parsedSort = parsed.lastOpenedAt ?? parsed.modifiedAt
      byDeckId.set(parsed.deckId, parsedSort >= existingSort ? parsed : existing)
    }
  }

  return normalizeRecentDecks([...byDeckId.values()])
}

async function readLocalState(userId: string) {
  const stored = await platform.getStoreValue(createLocalStateKey(userId))
  if (!stored) {
    return createDefaultLocalState(userId)
  }

  const parsed = FlashcardStudioDriveLocalStateSchema.safeParse(stored)
  return parsed.success ? parsed.data : createDefaultLocalState(userId)
}

async function writeLocalState(localState: FlashcardStudioDriveLocalState) {
  const normalized = FlashcardStudioDriveLocalStateSchema.parse({
    ...localState,
    recentDecks: normalizeRecentDecks(localState.recentDecks),
    updatedAt: Date.now(),
  })
  await platform.setStoreValue(createLocalStateKey(normalized.userId), normalized)
  return normalized
}

function mergeLocalStateWithSnapshot(
  localState: FlashcardStudioDriveLocalState,
  snapshot: FlashcardStudioAppSnapshot
): FlashcardStudioDriveLocalState {
  return FlashcardStudioDriveLocalStateSchema.parse({
    ...localState,
    connectedAs: localState.connectedAs ?? snapshot.drive.connectedAs,
    recentDecks: mergeRecentDeckSources(localState.recentDecks, snapshot.drive.recentDecks),
    lastSavedDeckId: localState.lastSavedDeckId ?? snapshot.drive.lastSavedDeckId,
    lastSavedDeckName: localState.lastSavedDeckName ?? snapshot.drive.lastSavedDeckName,
    lastSavedAt: localState.lastSavedAt ?? snapshot.drive.lastSavedAt,
  })
}

async function getStableUserId() {
  const config = await platform.getConfig()
  return config.uuid
}

function hasActiveToken(userId: string) {
  return Boolean(activeDriveToken && activeDriveToken.userId === userId && activeDriveToken.expiresAt > Date.now())
}

function getActiveToken(userId: string) {
  return hasActiveToken(userId) ? activeDriveToken?.accessToken ?? null : null
}

function clearActiveToken(userId: string) {
  if (activeDriveToken?.userId === userId) {
    activeDriveToken = null
  }
}

function getPersistedGrantStatus(localState: FlashcardStudioDriveLocalState) {
  if (!localState.grant) {
    return null
  }

  if (localState.grant.status === 'expired' || localState.grant.status === 'revoked') {
    return 'expired' as const
  }

  return null
}

function createGrant(localState: FlashcardStudioDriveLocalState): ChatBridgeAppAuthGrant {
  const now = Date.now()
  return ChatBridgeAppAuthGrantSchema.parse({
    schemaVersion: 1,
    grantId: localState.grant?.grantId ?? crypto.randomUUID(),
    userId: localState.userId,
    appId: FLASHCARD_STUDIO_APP_ID,
    authMode: 'oauth',
    permissionIds: ['sheets.read', 'sheets.write'],
    credentialHandle: localState.grant?.credentialHandle ?? `flashcard-sheet-grant:${crypto.randomUUID()}`,
    status: 'granted',
    createdAt: localState.grant?.createdAt ?? now,
    updatedAt: now,
  })
}

function createSpreadsheetTitle(snapshot: FlashcardStudioAppSnapshot) {
  const baseTitle = snapshot.deckTitle.trim() || 'Flashcard deck'
  const titledDeck = /flashcards/i.test(baseTitle) ? baseTitle : `${baseTitle} flashcards`
  return titledDeck.slice(0, 120)
}

function createDriveStateFromLocalState(
  localState: FlashcardStudioDriveLocalState,
  options?: {
    status?: FlashcardStudioDriveStatus
    statusText?: string
    detail?: string
  }
) {
  const status =
    options?.status ?? (hasActiveToken(localState.userId) ? 'connected' : getPersistedGrantStatus(localState) ?? 'needs-auth')
  const latestDeckName = localState.lastSavedDeckName ?? localState.recentDecks[0]?.deckName

  return {
    provider: 'google-drive' as const,
    status,
    statusText:
      options?.statusText ??
      (status === 'expired'
        ? 'Reconnect Google Sheets to continue'
        : status === 'connected'
          ? 'Google Sheets connected'
          : localState.recentDecks.length > 0
            ? 'Reconnect Google Sheets to resume'
            : 'Google Sheets not connected'),
    detail:
      options?.detail ??
      (status === 'expired'
        ? latestDeckName
          ? `Google Sheets authorization expired before the host could reopen "${latestDeckName}" or keep it in sync. Reconnect and try again; your current deck is still open locally.`
          : 'Google Sheets authorization expired before save or resume could continue. Reconnect and try again; your current deck is still open locally.'
        : status === 'connected'
          ? localState.lastSavedDeckName
            ? `Google Sheets is ready for "${localState.lastSavedDeckName}" and future save or resume actions stay host-owned.`
            : 'Google Sheets is connected and ready to open or save flashcards.'
          : localState.recentDecks[0]?.deckName
            ? `Reconnect Google Sheets to reopen "${localState.recentDecks[0].deckName}" or save new progress from this deck.`
            : 'Connect Google Sheets to continue with Flashcard Studio or reopen a saved sheet.'),
    connectedAs: localState.connectedAs,
    recentDecks: localState.recentDecks,
    lastSavedDeckId: localState.lastSavedDeckId,
    lastSavedDeckName: localState.lastSavedDeckName,
    lastSavedAt: localState.lastSavedAt,
  }
}

async function loadGoogleIdentityScript() {
  if (googleIdentityScriptPromise) {
    return await googleIdentityScriptPromise
  }

  googleIdentityScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-chatbridge-google-identity="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new FlashcardDriveError('drive-error', 'Google Sheets auth failed to load.')),
        {
          once: true,
        }
      )
      if (getGoogleIdentityWindow().google?.accounts?.oauth2) {
        resolve()
      }
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.chatbridgeGoogleIdentity = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new FlashcardDriveError('drive-error', 'Google Sheets auth failed to load.'))
    document.head.appendChild(script)
  })

  return await googleIdentityScriptPromise
}

async function requestAccessToken(prompt: '' | 'consent') {
  if (!GOOGLE_CLIENT_ID) {
    throw new FlashcardDriveError('missing-client-id', 'Google Sheets client ID is not configured for this build.')
  }

  await loadGoogleIdentityScript()
  const google = getGoogleIdentityWindow().google?.accounts?.oauth2
  if (!google) {
    throw new FlashcardDriveError('drive-error', 'Google Sheets auth is unavailable in this runtime.')
  }

  return await new Promise<{ accessToken: string; expiresAt: number }>((resolve, reject) => {
    const client = google.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token || !response.expires_in) {
          reject(
            new FlashcardDriveError(
              'auth-denied',
              response.error_description || response.error || 'Google Sheets permission was not granted.'
            )
          )
          return
        }

        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + Math.max(1, response.expires_in - 30) * 1000,
        })
      },
      error_callback: () => {
        reject(new FlashcardDriveError('auth-denied', 'Google Sheets permission was not granted.'))
      },
    })

    client.requestAccessToken({ prompt })
  })
}

async function ensureAccessToken(userId: string, localState: FlashcardStudioDriveLocalState) {
  const cachedToken = getActiveToken(userId)
  if (cachedToken) {
    return cachedToken
  }

  try {
    const token = await requestAccessToken(localState.grant ? '' : 'consent')
    activeDriveToken = {
      userId,
      accessToken: token.accessToken,
      expiresAt: token.expiresAt,
    }
    return token.accessToken
  } catch (error) {
    if (localState.grant) {
      const token = await requestAccessToken('consent')
      activeDriveToken = {
        userId,
        accessToken: token.accessToken,
        expiresAt: token.expiresAt,
      }
      return token.accessToken
    }

    throw error
  }
}

async function fetchGoogleJson<T>(
  accessToken: string,
  input: {
    url: string
    method?: 'GET' | 'POST' | 'PATCH'
    body?: BodyInit
    contentType?: string
  }
) {
  const response = await fetch(input.url, {
    method: input.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(input.contentType ? { 'Content-Type': input.contentType } : {}),
    },
    ...(input.body ? { body: input.body } : {}),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    if (response.status === 401 || response.status === 403) {
      throw new FlashcardDriveError(
        'auth-expired',
        'Google Sheets authorization expired before the host could finish this action.'
      )
    }
    throw new FlashcardDriveError('drive-error', message || 'Google request failed.')
  }

  return (await response.json()) as T
}

async function fetchConnectedAccount(accessToken: string) {
  try {
    const about = await fetchGoogleJson<{
      user?: {
        displayName?: string
        emailAddress?: string
      }
    }>(accessToken, {
      url: 'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',
    })

    return about.user?.emailAddress?.trim() || about.user?.displayName?.trim() || undefined
  } catch {
    return undefined
  }
}

function mergeRecentDeck(localState: FlashcardStudioDriveLocalState, deck: FlashcardStudioDriveRecentDeck) {
  return normalizeRecentDecks([deck, ...localState.recentDecks.filter((entry) => entry.deckId !== deck.deckId)])
}

function buildCardsSheetRows(snapshot: FlashcardStudioAppSnapshot) {
  const confidenceByCardId = new Map(snapshot.studyMarks.map((mark) => [mark.cardId, mark.confidence] as const))

  return [
    ['Card ID', 'Prompt', 'Answer', 'Confidence'],
    ...snapshot.cards.map((card) => [card.cardId, card.prompt, card.answer, confidenceByCardId.get(card.cardId) ?? '']),
  ]
}

function buildStateSheetRows(snapshot: FlashcardStudioAppSnapshot) {
  return [
    ['Field', 'Value'],
    ['layoutVersion', String(FLASHCARD_STUDIO_SHEET_LAYOUT_VERSION)],
    ['request', snapshot.request ?? ''],
    ['deckTitle', snapshot.deckTitle],
    ['status', snapshot.status],
    ['mode', snapshot.mode],
    ['studyStatus', snapshot.studyStatus],
    ['selectedCardId', snapshot.selectedCardId ?? ''],
    ['studyPosition', String(snapshot.studyPosition)],
    ['revealedCardId', snapshot.revealedCardId ?? ''],
    ['lastAction', snapshot.lastAction],
    ['lastUpdatedAt', String(snapshot.lastUpdatedAt)],
  ]
}

async function createSpreadsheet(accessToken: string, title: string) {
  const response = await fetchGoogleJson<GoogleSheetsSpreadsheet>(accessToken, {
    url: 'https://sheets.googleapis.com/v4/spreadsheets',
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: GOOGLE_SHEETS_CARDS_TAB,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            title: GOOGLE_SHEETS_STATE_TAB,
          },
        },
      ],
    }),
    contentType: 'application/json',
  })

  return {
    spreadsheetId: response.spreadsheetId,
    title: response.properties?.title?.trim() || title,
  }
}

async function renameSpreadsheet(accessToken: string, spreadsheetId: string, title: string) {
  return await fetchGoogleJson<GoogleDriveFileMetadata>(accessToken, {
    url: `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=id,name,modifiedTime`,
    method: 'PATCH',
    body: JSON.stringify({
      name: title,
    }),
    contentType: 'application/json',
  })
}

async function clearSpreadsheetValues(accessToken: string, spreadsheetId: string) {
  await fetchGoogleJson<{ spreadsheetId: string }>(accessToken, {
    url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
    method: 'POST',
    body: JSON.stringify({
      ranges: [`${GOOGLE_SHEETS_CARDS_TAB}!A:D`, `${GOOGLE_SHEETS_STATE_TAB}!A:B`],
    }),
    contentType: 'application/json',
  })
}

async function writeSpreadsheetValues(accessToken: string, spreadsheetId: string, snapshot: FlashcardStudioAppSnapshot) {
  await fetchGoogleJson<{ spreadsheetId: string }>(accessToken, {
    url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: [
        {
          range: `${GOOGLE_SHEETS_CARDS_TAB}!A1:D${Math.max(1, snapshot.cards.length + 1)}`,
          majorDimension: 'ROWS',
          values: buildCardsSheetRows(snapshot),
        },
        {
          range: `${GOOGLE_SHEETS_STATE_TAB}!A1:B12`,
          majorDimension: 'ROWS',
          values: buildStateSheetRows(snapshot),
        },
      ],
    }),
    contentType: 'application/json',
  })
}

function getBatchGetRangeValues(response: GoogleSheetsBatchGetResponse, sheetTitle: string) {
  return (
    response.valueRanges?.find((valueRange) => valueRange.range?.startsWith(`${sheetTitle}!`))?.values?.map((row) =>
      row.map((cell) => String(cell))
    ) ?? []
  )
}

function parseStateRows(rows: string[][]) {
  const byField = new Map<string, string>()

  for (const row of rows.slice(1)) {
    const field = row[0]?.trim()
    if (!field) {
      continue
    }

    byField.set(field, row[1]?.trim() ?? '')
  }

  return byField
}

function parseWithFallback<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  fallback: z.infer<TSchema>
): z.infer<TSchema> {
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : fallback
}

function parseSpreadsheetSnapshot(
  response: GoogleSheetsBatchGetResponse,
  currentSnapshot: FlashcardStudioAppSnapshot,
  selectedDeck: FlashcardStudioDriveRecentDeck
) {
  const cardRows = getBatchGetRangeValues(response, GOOGLE_SHEETS_CARDS_TAB)
  const stateRows = getBatchGetRangeValues(response, GOOGLE_SHEETS_STATE_TAB)

  if (cardRows.length === 0 || stateRows.length === 0) {
    throw new FlashcardDriveError(
      'invalid-file',
      'The selected Google Sheet does not match the Flashcard Studio workbook format.'
    )
  }

  const cards = cardRows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) => {
      const cardId = row[0]?.trim()
      const prompt = row[1]?.trim()
      const answer = row[2]?.trim()

      if (!cardId || !prompt || !answer) {
        throw new FlashcardDriveError(
          'invalid-file',
          'The selected Google Sheet contains an incomplete flashcard row.'
        )
      }

      return {
        cardId,
        prompt,
        answer,
      }
    })

  if (cards.length === 0) {
    throw new FlashcardDriveError('invalid-file', 'The selected Google Sheet does not contain any saved flashcards.')
  }

  const studyMarks = cardRows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .flatMap((row) => {
      const cardId = row[0]?.trim()
      const confidence = row[3]?.trim().toLowerCase()
      if (!cardId || !confidence) {
        return []
      }

      const parsedConfidence = FlashcardStudioStudyConfidenceSchema.safeParse(confidence)
      if (!parsedConfidence.success) {
        throw new FlashcardDriveError(
          'invalid-file',
          'The selected Google Sheet contains an invalid flashcard confidence value.'
        )
      }

      return [
        {
          cardId,
          confidence: parsedConfidence.data,
        },
      ]
    })

  const stateByField = parseStateRows(stateRows)
  const parseNumber = (value?: string) => {
    const parsed = Number.parseInt(value ?? '', 10)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const safeRequest = stateByField.get('request') || currentSnapshot.request
  const safeDeckTitle = stateByField.get('deckTitle') || selectedDeck.deckName || currentSnapshot.deckTitle
  const safeStatus = parseWithFallback(
    FlashcardStudioDeckStatusSchema,
    stateByField.get('status'),
    cards.length === 0 ? 'empty' : 'editing'
  )
  const safeMode = parseWithFallback(FlashcardStudioModeSchema, stateByField.get('mode'), 'authoring')
  const safeStudyStatus = parseWithFallback(FlashcardStudioStudyStatusSchema, stateByField.get('studyStatus'), 'idle')
  const safeLastAction = parseWithFallback(
    FlashcardStudioAuthoringActionSchema,
    stateByField.get('lastAction'),
    'updated-card'
  )

  try {
    return createFlashcardStudioAppSnapshot({
      request: safeRequest,
      deckTitle: safeDeckTitle,
      status: safeStatus,
      mode: safeMode,
      studyStatus: safeStudyStatus,
      cards,
      selectedCardId: stateByField.get('selectedCardId') || undefined,
      studyPosition: parseNumber(stateByField.get('studyPosition')),
      revealedCardId: stateByField.get('revealedCardId') || undefined,
      studyMarks,
      lastAction: safeLastAction,
      lastUpdatedAt: parseNumber(stateByField.get('lastUpdatedAt')) ?? Date.now(),
    })
  } catch {
    throw new FlashcardDriveError(
      'invalid-file',
      'The selected Google Sheet does not match the Flashcard Studio workbook format.'
    )
  }
}

function getDriveFailureCode(error: unknown): FlashcardDriveError['code'] | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    const code = (error as { code: string }).code
    if (
      code === 'missing-client-id' ||
      code === 'auth-denied' ||
      code === 'auth-expired' ||
      code === 'drive-error' ||
      code === 'invalid-file' ||
      code === 'missing-deck' ||
      code === 'needs-auth'
    ) {
      return code
    }
  }

  return null
}

async function persistExpiredGrantState(userId: string, localState: FlashcardStudioDriveLocalState) {
  clearActiveToken(userId)

  if (!localState.grant) {
    return await writeLocalState(localState)
  }

  return await writeLocalState({
    ...localState,
    grant: ChatBridgeAppAuthGrantSchema.parse({
      ...localState.grant,
      status: 'expired',
      updatedAt: Date.now(),
    }),
  })
}

export async function hydrateFlashcardStudioDriveSnapshot(snapshot: FlashcardStudioAppSnapshot) {
  const userId = await getStableUserId()
  const localState = await readLocalState(userId)
  const mergedLocalState = mergeLocalStateWithSnapshot(localState, snapshot)

  const mergedStateChanged =
    mergedLocalState.connectedAs !== localState.connectedAs ||
    mergedLocalState.lastSavedDeckId !== localState.lastSavedDeckId ||
    mergedLocalState.lastSavedDeckName !== localState.lastSavedDeckName ||
    mergedLocalState.lastSavedAt !== localState.lastSavedAt ||
    JSON.stringify(mergedLocalState.recentDecks) !== JSON.stringify(localState.recentDecks)

  const effectiveLocalState = mergedStateChanged ? await writeLocalState(mergedLocalState) : mergedLocalState

  return updateFlashcardStudioAppSnapshot(snapshot, {
    drive: createDriveStateFromLocalState(effectiveLocalState),
    lastUpdatedAt: snapshot.lastUpdatedAt,
  })
}

export async function connectFlashcardStudioDrive(snapshot: FlashcardStudioAppSnapshot) {
  const userId = await getStableUserId()
  const localState = mergeLocalStateWithSnapshot(await readLocalState(userId), snapshot)
  const accessToken = await ensureAccessToken(userId, localState)
  const connectedAs = await fetchConnectedAccount(accessToken)
  const nextLocalState = await writeLocalState({
    ...localState,
    grant: createGrant(localState),
    connectedAs: connectedAs ?? localState.connectedAs,
  })

  return updateFlashcardStudioAppSnapshot(snapshot, {
    drive: createDriveStateFromLocalState(nextLocalState, {
      status: 'connected',
      statusText: 'Google Sheets connected',
    }),
    lastUpdatedAt: Date.now(),
  })
}

export async function saveFlashcardStudioDriveSnapshot(snapshot: FlashcardStudioAppSnapshot) {
  if (snapshot.cardCount === 0) {
    throw new FlashcardDriveError('missing-deck', 'Add at least one card before saving to Google Sheets.')
  }

  const userId = await getStableUserId()
  const localState = mergeLocalStateWithSnapshot(await readLocalState(userId), snapshot)
  const accessToken = await ensureAccessToken(userId, localState)
  const spreadsheetTitle = createSpreadsheetTitle(snapshot)
  const existingDeckId = snapshot.drive.lastSavedDeckId ?? localState.lastSavedDeckId

  let spreadsheetId: string
  let spreadsheetName: string
  let modifiedAt = Date.now()

  try {
    if (existingDeckId) {
      const renamedSheet = await renameSpreadsheet(accessToken, existingDeckId, spreadsheetTitle)
      spreadsheetId = renamedSheet.id
      spreadsheetName = renamedSheet.name
      modifiedAt = renamedSheet.modifiedTime ? Date.parse(renamedSheet.modifiedTime) || Date.now() : Date.now()
    } else {
      const createdSpreadsheet = await createSpreadsheet(accessToken, spreadsheetTitle)
      spreadsheetId = createdSpreadsheet.spreadsheetId
      spreadsheetName = createdSpreadsheet.title
    }

    await clearSpreadsheetValues(accessToken, spreadsheetId)
    await writeSpreadsheetValues(accessToken, spreadsheetId, snapshot)
  } catch (error) {
    if (getDriveFailureCode(error) === 'auth-expired') {
      await persistExpiredGrantState(userId, localState)
    }
    throw error
  }

  const connectedAs = await fetchConnectedAccount(accessToken)
  const nextLocalState = await writeLocalState({
    ...localState,
    grant: createGrant(localState),
    connectedAs: connectedAs ?? localState.connectedAs,
    recentDecks: mergeRecentDeck(localState, {
      deckId: spreadsheetId,
      deckName: spreadsheetName,
      modifiedAt,
      lastOpenedAt: Date.now(),
    }),
    lastSavedDeckId: spreadsheetId,
    lastSavedDeckName: spreadsheetName,
    lastSavedAt: modifiedAt,
  })

  return updateFlashcardStudioAppSnapshot(snapshot, {
    drive: createDriveStateFromLocalState(nextLocalState, {
      status: 'connected',
      statusText: 'Google Sheets connected',
      detail: `Saved "${spreadsheetName}" to Google Sheets through the host-managed connector.`,
    }),
    lastUpdatedAt: Date.now(),
  })
}

export async function loadFlashcardStudioDriveSnapshot(deckId: string, currentSnapshot: FlashcardStudioAppSnapshot) {
  const userId = await getStableUserId()
  const localState = mergeLocalStateWithSnapshot(await readLocalState(userId), currentSnapshot)
  const selectedDeck = localState.recentDecks.find((deck) => deck.deckId === deckId)
  if (!selectedDeck) {
    throw new FlashcardDriveError('missing-deck', 'That saved sheet is not available in the local resume list.')
  }

  const accessToken = await ensureAccessToken(userId, localState)
  let response: GoogleSheetsBatchGetResponse

  try {
    const cardsRange = encodeURIComponent(`${GOOGLE_SHEETS_CARDS_TAB}!A:D`)
    const stateRange = encodeURIComponent(`${GOOGLE_SHEETS_STATE_TAB}!A:B`)
    response = await fetchGoogleJson<GoogleSheetsBatchGetResponse>(accessToken, {
      url: `https://sheets.googleapis.com/v4/spreadsheets/${deckId}/values:batchGet?ranges=${cardsRange}&ranges=${stateRange}`,
    })
  } catch (error) {
    if (getDriveFailureCode(error) === 'auth-expired') {
      await persistExpiredGrantState(userId, localState)
    }
    throw error
  }

  const loadedSnapshot = parseSpreadsheetSnapshot(response, currentSnapshot, selectedDeck)
  const nextLocalState = await writeLocalState({
    ...localState,
    recentDecks: mergeRecentDeck(localState, {
      ...selectedDeck,
      lastOpenedAt: Date.now(),
      modifiedAt: selectedDeck.modifiedAt,
    }),
    lastSavedDeckId: selectedDeck.deckId,
    lastSavedDeckName: selectedDeck.deckName,
    lastSavedAt: Date.now(),
  })

  return updateFlashcardStudioAppSnapshot(loadedSnapshot, {
    request: currentSnapshot.request ?? loadedSnapshot.request,
    drive: createDriveStateFromLocalState(nextLocalState, {
      status: 'connected',
      statusText: 'Google Sheets connected',
      detail: `Loaded "${selectedDeck.deckName}" from the saved Google Sheets list.`,
    }),
    lastUpdatedAt: Date.now(),
  })
}

export function getFlashcardDriveErrorMessage(error: unknown) {
  if (error instanceof FlashcardDriveError) {
    return error.message
  }

  return error instanceof Error ? error.message : 'Flashcard Google Sheets action failed.'
}

export function getFlashcardDriveFailureState(snapshot: FlashcardStudioAppSnapshot, error: unknown) {
  const code = getDriveFailureCode(error)
  const latestDeckName = snapshot.drive.lastSavedDeckName ?? snapshot.drive.recentDecks[0]?.deckName
  const detail = getFlashcardDriveErrorMessage(error)

  if (code === 'auth-expired') {
    return {
      status: 'expired' as const,
      statusText: 'Reconnect Google Sheets to continue',
      detail: latestDeckName
        ? `Google Sheets authorization expired before the host could reopen "${latestDeckName}" or keep it in sync. Reconnect and try again; your current deck is still open locally.`
        : 'Google Sheets authorization expired before the host could finish this action. Reconnect and try again; your current deck is still open locally.',
    }
  }

  if (code === 'auth-denied' || code === 'needs-auth') {
    return {
      status: 'needs-auth' as const,
      statusText: snapshot.drive.recentDecks.length > 0 ? 'Reconnect Google Sheets to resume' : 'Google Sheets not connected',
      detail:
        detail === 'Google Sheets permission was not granted.'
          ? 'Google Sheets permission was not granted. Connect Google Sheets when you want to save or reopen flashcards.'
          : detail,
    }
  }

  if (code === 'missing-client-id') {
    return {
      status: 'error' as const,
      statusText: 'Google Sheets unavailable',
      detail,
    }
  }

  return {
    status: 'error' as const,
    statusText: 'Google Sheets action blocked',
    detail,
  }
}

export function createFlashcardDriveErrorSnapshot(
  snapshot: FlashcardStudioAppSnapshot,
  input:
    | string
    | {
        status: 'needs-auth' | 'expired' | 'error'
        statusText: string
        detail: string
      }
) {
  const nextDriveState =
    typeof input === 'string'
      ? {
          status: 'error' as const,
          statusText: 'Google Sheets action blocked',
          detail: input,
        }
      : input

  return updateFlashcardStudioAppSnapshot(snapshot, {
    drive: {
      ...snapshot.drive,
      status: nextDriveState.status,
      statusText: nextDriveState.statusText,
      detail: nextDriveState.detail,
    },
    lastUpdatedAt: Date.now(),
  })
}
