/**
 * @vitest-environment jsdom
 */

import { MantineProvider } from '@mantine/core'
import {
  createFlashcardStudioAppSnapshot,
  updateFlashcardStudioAppSnapshot,
  type ChatBridgeReviewedAppLaunch,
} from '@shared/chatbridge'
import type { MessageAppPart } from '@shared/types'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  hydrateFlashcardStudioDriveSnapshot: vi.fn(),
  connectFlashcardStudioDrive: vi.fn(),
  saveFlashcardStudioDriveSnapshot: vi.fn(),
  loadFlashcardStudioDriveSnapshot: vi.fn(),
  createFlashcardDriveErrorSnapshot: vi.fn(
    (
      snapshot: ReturnType<typeof createFlashcardStudioAppSnapshot>,
      input: string | { status: 'needs-auth' | 'expired' | 'error'; statusText: string; detail: string }
    ) =>
      updateFlashcardStudioAppSnapshot(snapshot, {
        drive: {
          ...snapshot.drive,
          status: typeof input === 'string' ? 'error' : input.status,
          statusText: typeof input === 'string' ? 'Drive action blocked' : input.statusText,
          detail: typeof input === 'string' ? input : input.detail,
        },
        lastUpdatedAt: snapshot.lastUpdatedAt + 1,
      })
  ),
  getFlashcardDriveFailureState: vi.fn(
    (
      snapshot: ReturnType<typeof createFlashcardStudioAppSnapshot>,
      error: unknown
    ): { status: 'needs-auth' | 'expired' | 'error'; statusText: string; detail: string } => ({
      status: 'error',
      statusText: 'Drive action blocked',
      detail: error instanceof Error ? error.message : 'Drive failed.',
    })
  ),
  getFlashcardDriveErrorMessage: vi.fn((error: unknown) => (error instanceof Error ? error.message : 'Drive failed.')),
  persistReviewedAppLaunchHostSnapshot: vi.fn(async () => undefined),
}))

vi.mock('@/packages/chatbridge/flashcard-drive', () => ({
  hydrateFlashcardStudioDriveSnapshot: mocks.hydrateFlashcardStudioDriveSnapshot,
  connectFlashcardStudioDrive: mocks.connectFlashcardStudioDrive,
  saveFlashcardStudioDriveSnapshot: mocks.saveFlashcardStudioDriveSnapshot,
  loadFlashcardStudioDriveSnapshot: mocks.loadFlashcardStudioDriveSnapshot,
  createFlashcardDriveErrorSnapshot: mocks.createFlashcardDriveErrorSnapshot,
  getFlashcardDriveFailureState: mocks.getFlashcardDriveFailureState,
  getFlashcardDriveErrorMessage: mocks.getFlashcardDriveErrorMessage,
}))

vi.mock('@/packages/chatbridge/reviewed-app-launch', () => ({
  persistReviewedAppLaunchHostSnapshot: mocks.persistReviewedAppLaunchHostSnapshot,
}))

vi.mock('../ReviewedAppRuntimeFrame', () => ({
  ReviewedAppRuntimeFrame: ({ part }: { part: MessageAppPart }) => (
    <div data-testid="reviewed-runtime-frame">{JSON.stringify(part.snapshot)}</div>
  ),
}))

import { FlashcardStudioLaunchSurface } from './FlashcardStudioLaunchSurface'

function createLaunch(): ChatBridgeReviewedAppLaunch {
  return {
    schemaVersion: 1,
    appId: 'flashcard-studio',
    appName: 'Flashcard Studio',
    appVersion: '0.1.0',
    toolName: 'flashcard_studio_open',
    capability: 'open',
    summary: 'Prepared the reviewed Flashcard Studio request for the host-owned launch path.',
    request: 'Open Flashcard Studio and reconnect Drive so I can resume my saved biology deck.',
    uiEntry: 'https://apps.example.com/flashcard-studio',
    origin: 'https://apps.example.com',
  }
}

function createBaseSnapshot() {
  return createFlashcardStudioAppSnapshot({
    request: 'Open Flashcard Studio and reconnect Drive so I can resume my saved biology deck.',
    deckTitle: 'Biology review',
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
    lastUpdatedAt: 2_000,
  })
}

function createPart(snapshot = createBaseSnapshot()): MessageAppPart {
  return {
    type: 'app',
    appId: 'flashcard-studio',
    appName: 'Flashcard Studio',
    appInstanceId: 'reviewed-launch:tool-reviewed-launch-flashcard-drive-1',
    lifecycle: 'ready',
    toolCallId: 'tool-reviewed-launch-flashcard-drive-1',
    bridgeSessionId: 'bridge-session-reviewed-flashcard-drive-1',
    summary: snapshot.summary,
    summaryForModel: snapshot.summary,
    title: 'Flashcard Studio',
    description: 'The host is launching Flashcard Studio through the reviewed runtime.',
    statusText: snapshot.statusText,
    fallbackTitle: 'Flashcard Studio fallback',
    fallbackText: 'The host keeps Flashcard Studio continuity in the thread if the runtime cannot continue.',
    snapshot,
    values: {
      chatbridgeReviewedAppLaunch: createLaunch(),
    },
  }
}

describe('FlashcardStudioLaunchSurface', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the host-owned Drive rail with hydrated reconnect metadata and keeps load gated until Drive is connected', async () => {
    const baseSnapshot = createBaseSnapshot()
    const hydratedSnapshot = updateFlashcardStudioAppSnapshot(baseSnapshot, {
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
      lastUpdatedAt: baseSnapshot.lastUpdatedAt,
    })
    mocks.hydrateFlashcardStudioDriveSnapshot.mockResolvedValue(hydratedSnapshot)

    const { findByText, getByRole, getByTestId } = render(
      <MantineProvider>
        <FlashcardStudioLaunchSurface
          part={createPart(baseSnapshot)}
          launch={createLaunch()}
          sessionId="session-reviewed-launch-flashcard-drive-1"
          messageId="assistant-reviewed-launch-flashcard-drive-1"
        />
      </MantineProvider>
    )

    await findByText('Host-owned Drive rail')
    await findByText('Reconnect Drive to resume')
    expect(getByRole('button', { name: 'Open recent' }).hasAttribute('disabled')).toBe(true)
    expect(getByRole('button', { name: 'Save deck' }).hasAttribute('disabled')).toBe(true)
    expect(getByTestId('reviewed-runtime-frame').textContent).toContain('"deckTitle":"Biology review"')

    await waitFor(() => {
      expect(mocks.persistReviewedAppLaunchHostSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            action: 'drive.hydrate',
          },
        })
      )
    })
  })

  it('connects Drive through the host rail, enables save or reopen actions, and persists host snapshots for connect, save, and load', async () => {
    const baseSnapshot = createBaseSnapshot()
    const hydratedSnapshot = updateFlashcardStudioAppSnapshot(baseSnapshot, {
      drive: {
        status: 'needs-auth',
        recentDecks: [
          {
            deckId: 'drive-deck-biology-review',
            deckName: 'Biology review.chatbridge-flashcards.json',
            modifiedAt: 1_717_000_100_000,
          },
        ],
      },
      lastUpdatedAt: baseSnapshot.lastUpdatedAt,
    })
    const connectedSnapshot = updateFlashcardStudioAppSnapshot(hydratedSnapshot, {
      drive: {
        ...hydratedSnapshot.drive,
        status: 'connected',
        statusText: 'Drive connected',
        detail: 'Drive is connected and ready to save this deck.',
        connectedAs: 'student@example.com',
      },
      lastUpdatedAt: hydratedSnapshot.lastUpdatedAt + 1,
    })
    const savedSnapshot = updateFlashcardStudioAppSnapshot(connectedSnapshot, {
      drive: {
        ...connectedSnapshot.drive,
        status: 'connected',
        statusText: 'Drive connected',
        detail: 'Saved "Biology review.chatbridge-flashcards.json" to Drive through the host-managed connector.',
        lastSavedDeckId: 'drive-deck-biology-review',
        lastSavedDeckName: 'Biology review.chatbridge-flashcards.json',
        lastSavedAt: 1_717_000_300_000,
      },
      lastUpdatedAt: connectedSnapshot.lastUpdatedAt + 1,
    })
    const loadedSnapshot = updateFlashcardStudioAppSnapshot(savedSnapshot, {
      mode: 'study',
      studyStatus: 'studying',
      studyPosition: 1,
      revealedCardId: 'card-2',
      drive: {
        ...savedSnapshot.drive,
        detail: 'Loaded "Biology review.chatbridge-flashcards.json" from the saved Drive deck list.',
      },
      lastUpdatedAt: savedSnapshot.lastUpdatedAt + 1,
    })

    mocks.hydrateFlashcardStudioDriveSnapshot.mockResolvedValue(hydratedSnapshot)
    mocks.connectFlashcardStudioDrive.mockResolvedValue(connectedSnapshot)
    mocks.saveFlashcardStudioDriveSnapshot.mockResolvedValue(savedSnapshot)
    mocks.loadFlashcardStudioDriveSnapshot.mockResolvedValue(loadedSnapshot)

    const { findByText, getByRole } = render(
      <MantineProvider>
        <FlashcardStudioLaunchSurface
          part={createPart(baseSnapshot)}
          launch={createLaunch()}
          sessionId="session-reviewed-launch-flashcard-drive-1"
          messageId="assistant-reviewed-launch-flashcard-drive-1"
        />
      </MantineProvider>
    )

    await findByText('Reconnect Drive to resume')
    fireEvent.click(getByRole('button', { name: 'Connect Drive' }))

    await waitFor(() => {
      expect(mocks.connectFlashcardStudioDrive).toHaveBeenCalled()
    })

    await findByText('Drive connected')
    await waitFor(() => {
      expect(getByRole('button', { name: 'Save deck' }).hasAttribute('disabled')).toBe(false)
      expect(getByRole('button', { name: 'Open recent' }).hasAttribute('disabled')).toBe(false)
    })

    fireEvent.click(getByRole('button', { name: 'Save deck' }))
    await waitFor(() => {
      expect(mocks.saveFlashcardStudioDriveSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          deckTitle: 'Biology review',
        })
      )
    })

    fireEvent.click(getByRole('button', { name: 'Open recent' }))
    await waitFor(() => {
      expect(mocks.loadFlashcardStudioDriveSnapshot).toHaveBeenCalledWith(
        'drive-deck-biology-review',
        expect.objectContaining({
          deckTitle: 'Biology review',
        })
      )
    })

    const persistedKinds = (
      mocks.persistReviewedAppLaunchHostSnapshot.mock.calls as unknown as Array<[{ eventKind?: string }]>
    ).map(([input]) => input.eventKind ?? 'state.updated')
    expect(persistedKinds).toContain('auth.requested')
    expect(persistedKinds).toContain('auth.linked')
    expect(persistedKinds.filter((kind) => kind === 'state.updated').length).toBeGreaterThanOrEqual(3)
  })

  it('keeps expired Drive auth explicit when a save fails after a prior connection', async () => {
    const baseSnapshot = createBaseSnapshot()
    const hydratedSnapshot = updateFlashcardStudioAppSnapshot(baseSnapshot, {
      drive: {
        status: 'connected',
        statusText: 'Drive connected',
        detail: 'Drive is connected and ready to save this deck.',
        connectedAs: 'student@example.com',
        recentDecks: [
          {
            deckId: 'drive-deck-biology-review',
            deckName: 'Biology review.chatbridge-flashcards.json',
            modifiedAt: 1_717_000_100_000,
          },
        ],
        lastSavedDeckId: 'drive-deck-biology-review',
        lastSavedDeckName: 'Biology review.chatbridge-flashcards.json',
        lastSavedAt: 1_717_000_100_000,
      },
      lastUpdatedAt: baseSnapshot.lastUpdatedAt,
    })

    mocks.hydrateFlashcardStudioDriveSnapshot.mockResolvedValue(hydratedSnapshot)
    mocks.saveFlashcardStudioDriveSnapshot.mockRejectedValue(
      Object.assign(new Error('Drive authorization expired before the host could finish this action.'), {
        code: 'auth-expired',
      })
    )
    mocks.getFlashcardDriveFailureState.mockReturnValue({
      status: 'expired',
      statusText: 'Reconnect Drive to continue',
      detail:
        'Drive authorization expired before the host could reopen "Biology review.chatbridge-flashcards.json" or keep it in sync. Reconnect and try again; your current deck is still open locally.',
    })

    const { findByText, getByRole } = render(
      <MantineProvider>
        <FlashcardStudioLaunchSurface
          part={createPart(baseSnapshot)}
          launch={createLaunch()}
          sessionId="session-reviewed-launch-flashcard-drive-1"
          messageId="assistant-reviewed-launch-flashcard-drive-1"
        />
      </MantineProvider>
    )

    await findByText('Drive connected')
    fireEvent.click(getByRole('button', { name: 'Save deck' }))

    await findByText('Reconnect Drive to continue')
    expect(mocks.getFlashcardDriveFailureState).toHaveBeenCalledWith(
      expect.objectContaining({
        deckTitle: 'Biology review',
      }),
      expect.objectContaining({
        code: 'auth-expired',
      })
    )
    await waitFor(() => {
      expect(mocks.persistReviewedAppLaunchHostSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            action: 'drive.save',
            outcome: 'expired',
            detail: 'Drive authorization expired before the host could finish this action.',
          }),
        })
      )
    })
  })
})
