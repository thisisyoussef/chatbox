/**
 * @vitest-environment jsdom
 */

import { createFlashcardStudioAppSnapshot } from '@shared/chatbridge'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, unknown>()

const currentPlatform = {
  getStoreValue: vi.fn(async (key: string) => store.get(key)),
  setStoreValue: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value)
  }),
  getConfig: vi.fn(async () => ({
    uuid: 'stable-user-1',
  })),
}

vi.mock('@/platform', () => ({
  get default() {
    return currentPlatform
  },
}))

vi.mock('@/variables', () => ({
  GOOGLE_CLIENT_ID: 'test-google-client-id',
}))

import {
  createFlashcardDriveErrorSnapshot,
  getFlashcardDriveFailureState,
  getFlashcardDriveErrorMessage,
  hydrateFlashcardStudioDriveSnapshot,
} from './flashcard-drive'

describe('flashcard Google Sheets helpers', () => {
  beforeEach(() => {
    store.clear()
    vi.clearAllMocks()
  })

  it('hydrates reconnect metadata from the persisted snapshot when the local Google Sheets store is empty', async () => {
    const snapshot = createFlashcardStudioAppSnapshot({
      request: 'Open Flashcard Studio and reconnect Google Sheets so I can resume my saved biology deck.',
      deckTitle: 'Biology review',
      cards: [
        {
          cardId: 'card-1',
          prompt: 'What does the mitochondria do?',
          answer: 'It helps the cell produce energy.',
        },
      ],
      selectedCardId: 'card-1',
      drive: {
        status: 'needs-auth',
        recentDecks: [
          {
            deckId: 'drive-deck-biology-review',
            deckName: 'Biology review flashcards',
            modifiedAt: 1_717_000_100_000,
            lastOpenedAt: 1_717_000_200_000,
          },
        ],
        lastSavedDeckId: 'drive-deck-biology-review',
        lastSavedDeckName: 'Biology review flashcards',
        lastSavedAt: 1_717_000_100_000,
      },
      lastAction: 'updated-card',
      lastUpdatedAt: 2_000,
    })

    const hydrated = await hydrateFlashcardStudioDriveSnapshot(snapshot)

    expect(hydrated.lastUpdatedAt).toBe(2_000)
    expect(hydrated.drive).toMatchObject({
      status: 'needs-auth',
      statusText: 'Reconnect Google Sheets to resume',
      lastSavedDeckName: 'Biology review flashcards',
      recentDecks: [
        {
          deckId: 'drive-deck-biology-review',
        },
      ],
    })
    expect(currentPlatform.setStoreValue).toHaveBeenCalledWith(
      'chatbridge:flashcard-studio:drive:stable-user-1',
      expect.objectContaining({
        userId: 'stable-user-1',
        appId: 'flashcard-studio',
        lastSavedDeckId: 'drive-deck-biology-review',
        lastSavedDeckName: 'Biology review flashcards',
        recentDecks: [
          expect.objectContaining({
            deckId: 'drive-deck-biology-review',
          }),
        ],
      })
    )
  })

  it('builds a bounded Google Sheets error snapshot without dropping deck state', () => {
    const snapshot = createFlashcardStudioAppSnapshot({
      deckTitle: 'Biology review',
      cards: [
        {
          cardId: 'card-1',
          prompt: 'What does the mitochondria do?',
          answer: 'It helps the cell produce energy.',
        },
      ],
      selectedCardId: 'card-1',
      lastAction: 'updated-card',
      lastUpdatedAt: 2_000,
    })

    const errored = createFlashcardDriveErrorSnapshot(snapshot, 'Google Sheets permission was not granted.')

    expect(errored.drive).toMatchObject({
      status: 'error',
      statusText: 'Google Sheets action blocked',
      detail: 'Google Sheets permission was not granted.',
    })
    expect(errored.cardCount).toBe(1)
    expect(getFlashcardDriveErrorMessage(new Error('Example failure'))).toBe('Example failure')
  })

  it('hydrates an expired persisted grant into an explicit reconnect-required Google Sheets state', async () => {
    store.set('chatbridge:flashcard-studio:drive:stable-user-1', {
      schemaVersion: 2,
      storageKind: 'google-sheet',
      userId: 'stable-user-1',
      appId: 'flashcard-studio',
      grant: {
        schemaVersion: 1,
        grantId: 'grant-1',
        userId: 'stable-user-1',
        appId: 'flashcard-studio',
        authMode: 'oauth',
        permissionIds: ['sheets.read', 'sheets.write'],
        credentialHandle: 'flashcard-sheet-grant:grant-1',
        status: 'expired',
        createdAt: 1_000,
        updatedAt: 2_000,
      },
      recentDecks: [
        {
          deckId: 'drive-deck-biology-review',
          deckName: 'Biology review flashcards',
          modifiedAt: 1_717_000_100_000,
        },
      ],
      lastSavedDeckId: 'drive-deck-biology-review',
      lastSavedDeckName: 'Biology review flashcards',
      lastSavedAt: 1_717_000_100_000,
      updatedAt: 2_000,
    })

    const snapshot = createFlashcardStudioAppSnapshot({
      request: 'Open Flashcard Studio and reconnect Google Sheets so I can resume my saved biology deck.',
      deckTitle: 'Biology review',
      cards: [
        {
          cardId: 'card-1',
          prompt: 'What does the mitochondria do?',
          answer: 'It helps the cell produce energy.',
        },
      ],
      selectedCardId: 'card-1',
      lastAction: 'updated-card',
      lastUpdatedAt: 2_000,
    })

    const hydrated = await hydrateFlashcardStudioDriveSnapshot(snapshot)

    expect(hydrated.drive).toMatchObject({
      status: 'expired',
      statusText: 'Reconnect Google Sheets to continue',
      lastSavedDeckName: 'Biology review flashcards',
    })
    expect(hydrated.drive.detail).toContain('Google Sheets authorization expired')
  })

  it('classifies denied and expired Google Sheets auth failures into reconnect-friendly shell states', () => {
    const snapshot = createFlashcardStudioAppSnapshot({
      request: 'Open Flashcard Studio and reconnect Google Sheets so I can resume my saved biology deck.',
      deckTitle: 'Biology review',
      cards: [
        {
          cardId: 'card-1',
          prompt: 'What does the mitochondria do?',
          answer: 'It helps the cell produce energy.',
        },
      ],
      selectedCardId: 'card-1',
      drive: {
        status: 'needs-auth',
        recentDecks: [
          {
            deckId: 'drive-deck-biology-review',
            deckName: 'Biology review flashcards',
            modifiedAt: 1_717_000_100_000,
          },
        ],
        lastSavedDeckId: 'drive-deck-biology-review',
        lastSavedDeckName: 'Biology review flashcards',
        lastSavedAt: 1_717_000_100_000,
      },
      lastAction: 'updated-card',
      lastUpdatedAt: 2_000,
    })

    expect(
      getFlashcardDriveFailureState(snapshot, {
        code: 'auth-denied',
        message: 'Google Sheets permission was not granted.',
      })
    ).toMatchObject({
      status: 'needs-auth',
      statusText: 'Reconnect Google Sheets to resume',
    })

    expect(
      getFlashcardDriveFailureState(snapshot, {
        code: 'auth-expired',
        message: 'Google Sheets authorization expired before this action completed.',
      })
    ).toMatchObject({
      status: 'expired',
      statusText: 'Reconnect Google Sheets to continue',
    })
  })
})
