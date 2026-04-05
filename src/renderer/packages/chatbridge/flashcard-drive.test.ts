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
  getFlashcardDriveErrorMessage,
  hydrateFlashcardStudioDriveSnapshot,
} from './flashcard-drive'

describe('flashcard Drive helpers', () => {
  beforeEach(() => {
    store.clear()
    vi.clearAllMocks()
  })

  it('hydrates reconnect metadata from the persisted snapshot when the local Drive store is empty', async () => {
    const snapshot = createFlashcardStudioAppSnapshot({
      request: 'Open Flashcard Studio and reconnect Drive so I can resume my saved biology deck.',
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
            deckName: 'Biology review.chatbridge-flashcards.json',
            modifiedAt: 1_717_000_100_000,
            lastOpenedAt: 1_717_000_200_000,
          },
        ],
        lastSavedDeckId: 'drive-deck-biology-review',
        lastSavedDeckName: 'Biology review.chatbridge-flashcards.json',
        lastSavedAt: 1_717_000_100_000,
      },
      lastAction: 'updated-card',
      lastUpdatedAt: 2_000,
    })

    const hydrated = await hydrateFlashcardStudioDriveSnapshot(snapshot)

    expect(hydrated.lastUpdatedAt).toBe(2_000)
    expect(hydrated.drive).toMatchObject({
      status: 'needs-auth',
      statusText: 'Reconnect Drive to resume',
      lastSavedDeckName: 'Biology review.chatbridge-flashcards.json',
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
        lastSavedDeckName: 'Biology review.chatbridge-flashcards.json',
        recentDecks: [
          expect.objectContaining({
            deckId: 'drive-deck-biology-review',
          }),
        ],
      })
    )
  })

  it('builds a bounded Drive error snapshot without dropping deck state', () => {
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

    const errored = createFlashcardDriveErrorSnapshot(snapshot, 'Google Drive permission was not granted.')

    expect(errored.drive).toMatchObject({
      status: 'error',
      statusText: 'Drive action blocked',
      detail: 'Google Drive permission was not granted.',
    })
    expect(errored.cardCount).toBe(1)
    expect(getFlashcardDriveErrorMessage(new Error('Example failure'))).toBe('Example failure')
  })
})
