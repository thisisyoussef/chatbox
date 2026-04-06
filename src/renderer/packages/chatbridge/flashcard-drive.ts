import { z } from 'zod'
import {
  ChatBridgeAppAuthGrantSchema,
  FLASHCARD_STUDIO_APP_ID,
  FlashcardStudioAppSnapshotSchema,
  FlashcardStudioDriveRecentDeckSchema,
  updateFlashcardStudioAppSnapshot,
  type ChatBridgeAppAuthGrant,
  type FlashcardStudioAppSnapshot,
  type FlashcardStudioDriveStatus,
  type FlashcardStudioDriveRecentDeck,
} from '@shared/chatbridge'
import platform from '@/platform'
import { GOOGLE_CLIENT_ID } from '@/variables'

const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const FLASHCARD_STUDIO_DRIVE_STORE_SCHEMA_VERSION = 1 as const
const FLASHCARD_STUDIO_DRIVE_FILE_SCHEMA_VERSION = 1 as const
const MAX_RECENT_DECKS = 5

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

const FlashcardStudioDriveFileEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(FLASHCARD_STUDIO_DRIVE_FILE_SCHEMA_VERSION),
    appId: z.literal(FLASHCARD_STUDIO_APP_ID),
    savedAt: z.number().int().nonnegative(),
    deckId: z.string().trim().min(1),
    deckName: z.string().trim().min(1),
    snapshot: FlashcardStudioAppSnapshotSchema,
  })
  .strict()
type FlashcardStudioDriveFileEnvelope = z.infer<typeof FlashcardStudioDriveFileEnvelopeSchema>

type GoogleDriveFileMetadata = {
  id: string
  name: string
  modifiedTime: string
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
    userId,
    appId: FLASHCARD_STUDIO_APP_ID,
    grant: null,
    recentDecks: [],
    updatedAt: Date.now(),
  })
}

function normalizeRecentDecks(recentDecks: FlashcardStudioDriveRecentDeck[]) {
  const seenDeckIds = new Set<string>()
  const deduped: FlashcardStudioDriveRecentDeck[] = []

  for (const recentDeck of recentDecks) {
    const parsed = FlashcardStudioDriveRecentDeckSchema.parse(recentDeck)
    if (seenDeckIds.has(parsed.deckId)) {
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
    permissionIds: ['drive.read', 'drive.write'],
    credentialHandle: localState.grant?.credentialHandle ?? `flashcard-drive-grant:${crypto.randomUUID()}`,
    status: 'granted',
    createdAt: localState.grant?.createdAt ?? now,
    updatedAt: now,
  })
}

function createDeckName(snapshot: FlashcardStudioAppSnapshot) {
  const base = snapshot.deckTitle.trim().replace(/[\\/:*?"<>|]+/g, '-')
  return `${base || 'flashcard-deck'}.chatbridge-flashcards.json`
}

function createDriveStateFromLocalState(localState: FlashcardStudioDriveLocalState, options?: {
  status?: FlashcardStudioDriveStatus
  statusText?: string
  detail?: string
}) {
  const status =
    options?.status ?? (hasActiveToken(localState.userId) ? 'connected' : getPersistedGrantStatus(localState) ?? 'needs-auth')
  const latestDeckName = localState.lastSavedDeckName ?? localState.recentDecks[0]?.deckName

  return {
    provider: 'google-drive' as const,
    status,
    statusText:
      options?.statusText ??
      (status === 'expired'
        ? 'Reconnect Drive to continue'
        : status === 'connected'
        ? 'Drive connected'
        : localState.recentDecks.length > 0
          ? 'Reconnect Drive to resume'
          : 'Drive not connected'),
    detail:
      options?.detail ??
      (status === 'expired'
        ? latestDeckName
          ? `Drive authorization expired before the host could reopen "${latestDeckName}" or keep it in sync. Reconnect and try again; your current deck is still open locally.`
          : 'Drive authorization expired before save or resume could continue. Reconnect and try again; your current deck is still open locally.'
        : status === 'connected'
          ? localState.lastSavedDeckName
            ? `Drive is ready for "${localState.lastSavedDeckName}" and future save or resume actions stay host-owned.`
            : 'Drive is connected and ready to save this deck.'
          : localState.recentDecks[0]?.deckName
            ? `Reconnect Drive to reopen "${localState.recentDecks[0].deckName}" or save new progress from this deck.`
            : 'Connect Drive to save this deck or reopen a recent one.'),
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
      existing.addEventListener('error', () => reject(new FlashcardDriveError('drive-error', 'Google Drive auth failed to load.')), {
        once: true,
      })
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
    script.onerror = () => reject(new FlashcardDriveError('drive-error', 'Google Drive auth failed to load.'))
    document.head.appendChild(script)
  })

  return await googleIdentityScriptPromise
}

async function requestAccessToken(prompt: '' | 'consent') {
  if (!GOOGLE_CLIENT_ID) {
    throw new FlashcardDriveError('missing-client-id', 'Google Drive client ID is not configured for this build.')
  }

  await loadGoogleIdentityScript()
  const google = getGoogleIdentityWindow().google?.accounts?.oauth2
  if (!google) {
    throw new FlashcardDriveError('drive-error', 'Google Drive auth is unavailable in this runtime.')
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
              response.error_description || response.error || 'Google Drive permission was not granted.'
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
        reject(new FlashcardDriveError('auth-denied', 'Google Drive permission was not granted.'))
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

async function fetchDriveJson<T>(accessToken: string, input: {
  url: string
  method?: 'GET' | 'POST' | 'PATCH'
  body?: BodyInit
  contentType?: string
}) {
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
        'Drive authorization expired before the host could finish this action.'
      )
    }
    throw new FlashcardDriveError('drive-error', message || 'Google Drive request failed.')
  }

  return (await response.json()) as T
}

async function fetchDriveText(accessToken: string, url: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    if (response.status === 401 || response.status === 403) {
      throw new FlashcardDriveError(
        'auth-expired',
        'Drive authorization expired before the host could finish this action.'
      )
    }
    throw new FlashcardDriveError('drive-error', message || 'Google Drive request failed.')
  }

  return await response.text()
}

async function fetchConnectedAccount(accessToken: string) {
  try {
    const about = await fetchDriveJson<{
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

function createMultipartBody(metadata: Record<string, unknown>, content: string) {
  const boundary = `chatbridge-flashcard-${crypto.randomUUID()}`
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n')

  return {
    body,
    contentType: `multipart/related; boundary=${boundary}`,
  }
}

function mergeRecentDeck(localState: FlashcardStudioDriveLocalState, deck: FlashcardStudioDriveRecentDeck) {
  return normalizeRecentDecks([deck, ...localState.recentDecks.filter((entry) => entry.deckId !== deck.deckId)])
}

function buildSavedEnvelope(snapshot: FlashcardStudioAppSnapshot, deckId: string, deckName: string): FlashcardStudioDriveFileEnvelope {
  return FlashcardStudioDriveFileEnvelopeSchema.parse({
    schemaVersion: FLASHCARD_STUDIO_DRIVE_FILE_SCHEMA_VERSION,
    appId: FLASHCARD_STUDIO_APP_ID,
    savedAt: Date.now(),
    deckId,
    deckName,
    snapshot: updateFlashcardStudioAppSnapshot(snapshot, {
      drive: {
        ...snapshot.drive,
        status: 'connected',
        statusText: 'Drive connected',
      },
    }),
  })
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
      statusText: 'Drive connected',
    }),
    lastUpdatedAt: Date.now(),
  })
}

export async function saveFlashcardStudioDriveSnapshot(snapshot: FlashcardStudioAppSnapshot) {
  if (snapshot.cardCount === 0) {
    throw new FlashcardDriveError('missing-deck', 'Add at least one card before saving a Drive deck.')
  }

  const userId = await getStableUserId()
  const localState = mergeLocalStateWithSnapshot(await readLocalState(userId), snapshot)
  const accessToken = await ensureAccessToken(userId, localState)
  const deckName = createDeckName(snapshot)
  const existingDeckId = snapshot.drive.lastSavedDeckId ?? localState.lastSavedDeckId
  const deckId = existingDeckId ?? crypto.randomUUID()
  const envelope = buildSavedEnvelope(snapshot, deckId, deckName)
  const metadata = {
    name: deckName,
    mimeType: 'application/json',
    appProperties: {
      chatbridgeApp: FLASHCARD_STUDIO_APP_ID,
      chatbridgeSchemaVersion: String(FLASHCARD_STUDIO_DRIVE_FILE_SCHEMA_VERSION),
    },
  }
  const multipart = createMultipartBody(metadata, JSON.stringify(envelope))

  let response: GoogleDriveFileMetadata

  try {
    response = await fetchDriveJson<GoogleDriveFileMetadata>(accessToken, {
      url: existingDeckId
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingDeckId}?uploadType=multipart&fields=id,name,modifiedTime`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime',
      method: existingDeckId ? 'PATCH' : 'POST',
      body: multipart.body,
      contentType: multipart.contentType,
    })
  } catch (error) {
    if (getDriveFailureCode(error) === 'auth-expired') {
      await persistExpiredGrantState(userId, localState)
    }
    throw error
  }

  const modifiedAt = Date.parse(response.modifiedTime) || Date.now()
  const connectedAs = await fetchConnectedAccount(accessToken)
  const nextLocalState = await writeLocalState({
    ...localState,
    grant: createGrant(localState),
    connectedAs: connectedAs ?? localState.connectedAs,
    recentDecks: mergeRecentDeck(localState, {
      deckId: response.id,
      deckName: response.name,
      modifiedAt,
      lastOpenedAt: Date.now(),
    }),
    lastSavedDeckId: response.id,
    lastSavedDeckName: response.name,
    lastSavedAt: modifiedAt,
  })

  return updateFlashcardStudioAppSnapshot(snapshot, {
    drive: createDriveStateFromLocalState(nextLocalState, {
      status: 'connected',
      statusText: 'Drive connected',
      detail: `Saved "${response.name}" to Drive through the host-managed connector.`,
    }),
    lastUpdatedAt: Date.now(),
  })
}

export async function loadFlashcardStudioDriveSnapshot(deckId: string, currentSnapshot: FlashcardStudioAppSnapshot) {
  const userId = await getStableUserId()
  const localState = mergeLocalStateWithSnapshot(await readLocalState(userId), currentSnapshot)
  const selectedDeck = localState.recentDecks.find((deck) => deck.deckId === deckId)
  if (!selectedDeck) {
    throw new FlashcardDriveError('missing-deck', 'That saved deck is not available in the local resume list.')
  }

  const accessToken = await ensureAccessToken(userId, localState)
  let rawContent: string

  try {
    rawContent = await fetchDriveText(accessToken, `https://www.googleapis.com/drive/v3/files/${deckId}?alt=media`)
  } catch (error) {
    if (getDriveFailureCode(error) === 'auth-expired') {
      await persistExpiredGrantState(userId, localState)
    }
    throw error
  }
  let parsedContent: unknown

  try {
    parsedContent = JSON.parse(rawContent)
  } catch {
    throw new FlashcardDriveError('invalid-file', 'The selected Drive deck is not valid JSON.')
  }

  const parsedEnvelope = FlashcardStudioDriveFileEnvelopeSchema.safeParse(parsedContent)
  if (!parsedEnvelope.success) {
    throw new FlashcardDriveError('invalid-file', 'The selected Drive deck does not match the saved Flashcard schema.')
  }

  const loadedSnapshot = FlashcardStudioAppSnapshotSchema.parse(parsedEnvelope.data.snapshot)
  const nextLocalState = await writeLocalState({
    ...localState,
    recentDecks: mergeRecentDeck(localState, {
      ...selectedDeck,
      lastOpenedAt: Date.now(),
      modifiedAt: selectedDeck.modifiedAt,
    }),
    lastSavedDeckId: parsedEnvelope.data.deckId,
    lastSavedDeckName: parsedEnvelope.data.deckName,
    lastSavedAt: parsedEnvelope.data.savedAt,
  })

  return updateFlashcardStudioAppSnapshot(loadedSnapshot, {
    request: currentSnapshot.request ?? loadedSnapshot.request,
    drive: createDriveStateFromLocalState(nextLocalState, {
      status: 'connected',
      statusText: 'Drive connected',
      detail: `Loaded "${parsedEnvelope.data.deckName}" from the saved Drive deck list.`,
    }),
    lastUpdatedAt: Date.now(),
  })
}

export function getFlashcardDriveErrorMessage(error: unknown) {
  if (error instanceof FlashcardDriveError) {
    return error.message
  }

  return error instanceof Error ? error.message : 'Flashcard Drive action failed.'
}

export function getFlashcardDriveFailureState(snapshot: FlashcardStudioAppSnapshot, error: unknown) {
  const code = getDriveFailureCode(error)
  const latestDeckName = snapshot.drive.lastSavedDeckName ?? snapshot.drive.recentDecks[0]?.deckName
  const detail = getFlashcardDriveErrorMessage(error)

  if (code === 'auth-expired') {
    return {
      status: 'expired' as const,
      statusText: 'Reconnect Drive to continue',
      detail: latestDeckName
        ? `Drive authorization expired before the host could reopen "${latestDeckName}" or keep it in sync. Reconnect and try again; your current deck is still open locally.`
        : 'Drive authorization expired before the host could finish this action. Reconnect and try again; your current deck is still open locally.',
    }
  }

  if (code === 'auth-denied' || code === 'needs-auth') {
    return {
      status: 'needs-auth' as const,
      statusText: snapshot.drive.recentDecks.length > 0 ? 'Reconnect Drive to resume' : 'Drive not connected',
      detail:
        detail === 'Google Drive permission was not granted.'
          ? 'Google Drive permission was not granted. Connect Drive when you want to save or reopen decks.'
          : detail,
    }
  }

  if (code === 'missing-client-id') {
    return {
      status: 'error' as const,
      statusText: 'Drive unavailable',
      detail,
    }
  }

  return {
    status: 'error' as const,
    statusText: 'Drive action blocked',
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
          statusText: 'Drive action blocked',
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
