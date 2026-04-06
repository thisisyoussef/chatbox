import { describe, expect, it } from 'vitest'
import {
  createFlashcardStudioAppSnapshot,
  createInitialFlashcardStudioAppSnapshot,
  getFlashcardStudioSummary,
  parseFlashcardStudioAppSnapshot,
} from './flashcard-studio'

describe('shared flashcard studio helpers', () => {
  it('creates an explicit empty deck checkpoint for the first authoring turn', () => {
    const snapshot = createInitialFlashcardStudioAppSnapshot({
      request: 'Help me make biology flashcards.',
      deckTitle: 'Biology review',
      updatedAt: 1_000,
    })

    expect(snapshot).toMatchObject({
      appId: 'flashcard-studio',
      deckTitle: 'Biology review',
      status: 'empty',
      cardCount: 0,
      statusText: 'No cards yet',
      lastAction: 'initialized',
    })
    expect(snapshot.summary).toContain('with no cards yet')
    expect(snapshot.summary).toContain('does not imply study progress')
  })

  it('builds a bounded deck summary from authored cards', () => {
    const snapshot = createFlashcardStudioAppSnapshot({
      request: 'Make science flashcards.',
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
      lastUpdatedAt: 2_000,
    })

    expect(snapshot.status).toBe('editing')
    expect(snapshot.statusText).toBe('Card updated')
    expect(getFlashcardStudioSummary(snapshot)).toContain('Science review')
    expect(getFlashcardStudioSummary(snapshot)).toContain('2 cards')
    expect(getFlashcardStudioSummary(snapshot)).toContain('What does the mitochondria do?')
    expect(getFlashcardStudioSummary(snapshot)).toContain('What is photosynthesis?')
    expect(getFlashcardStudioSummary(snapshot)).not.toContain('Plants use sunlight to make food.')
  })

  it('builds a bounded study summary with confidence totals and weak-card prompts', () => {
    const snapshot = createFlashcardStudioAppSnapshot({
      request: 'Quiz me on science.',
      deckTitle: 'Science review',
      mode: 'study',
      studyStatus: 'studying',
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
        {
          cardId: 'card-3',
          prompt: 'What is cellular respiration?',
          answer: 'Cells convert glucose and oxygen into usable energy.',
        },
      ],
      studyPosition: 2,
      revealedCardId: 'card-3',
      studyMarks: [
        { cardId: 'card-1', confidence: 'easy' },
        { cardId: 'card-2', confidence: 'hard' },
      ],
      lastAction: 'revealed-card',
      lastUpdatedAt: 4_000,
    })

    expect(snapshot.mode).toBe('study')
    expect(snapshot.studyCounts).toEqual({
      easy: 1,
      medium: 0,
      hard: 1,
    })
    expect(snapshot.statusText).toBe('Answer revealed')
    expect(getFlashcardStudioSummary(snapshot)).toContain('with 2 of 3 cards reviewed')
    expect(getFlashcardStudioSummary(snapshot)).toContain('1 easy, 0 medium, 1 hard')
    expect(getFlashcardStudioSummary(snapshot)).toContain('Needs review: What is photosynthesis?')
    expect(getFlashcardStudioSummary(snapshot)).not.toContain('Plants use sunlight to make food.')
  })

  it('keeps Google Sheets reconnect metadata bounded inside the summary and resume hint', () => {
    const snapshot = createFlashcardStudioAppSnapshot({
      request: 'Reconnect Google Sheets so I can resume my science deck.',
      deckTitle: 'Science review',
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
            deckId: 'drive-deck-science-review',
            deckName: 'Science review flashcards',
            modifiedAt: 1_717_000_100_000,
          },
        ],
        lastSavedDeckId: 'drive-deck-science-review',
        lastSavedDeckName: 'Science review flashcards',
        lastSavedAt: 1_717_000_100_000,
      },
      lastAction: 'updated-card',
      lastUpdatedAt: 5_000,
    })

    expect(snapshot.summary).toContain('Google Sheets resume is available for 1 saved sheet after reconnect.')
    expect(snapshot.resumeHint).toContain('Reconnect Google Sheets to reopen "Science review flashcards".')
    expect(snapshot.summary).not.toContain('It helps the cell produce energy.')
  })

  it('surfaces expired Drive auth as reconnect-required without dropping bounded deck context', () => {
    const snapshot = createFlashcardStudioAppSnapshot({
      request: 'Reconnect Google Sheets so I can keep saving my science deck.',
      deckTitle: 'Science review',
      cards: [
        {
          cardId: 'card-1',
          prompt: 'What does the mitochondria do?',
          answer: 'It helps the cell produce energy.',
        },
      ],
      selectedCardId: 'card-1',
      drive: {
        status: 'expired',
        recentDecks: [
          {
            deckId: 'drive-deck-science-review',
            deckName: 'Science review flashcards',
            modifiedAt: 1_717_000_100_000,
          },
        ],
        lastSavedDeckId: 'drive-deck-science-review',
        lastSavedDeckName: 'Science review flashcards',
        lastSavedAt: 1_717_000_100_000,
      },
      lastAction: 'updated-card',
      lastUpdatedAt: 6_000,
    })

    expect(snapshot.drive.statusText).toBe('Reconnect Google Sheets to continue')
    expect(snapshot.drive.detail).toContain('Google Sheets authorization expired')
    expect(snapshot.summary).toContain('Google Sheets auth expired')
    expect(snapshot.resumeHint).toContain('Reconnect Google Sheets to restore saved sheet access.')
    expect(snapshot.summary).not.toContain('It helps the cell produce energy.')
  })

  it('fails closed when the selected card is missing or ids are duplicated', () => {
    expect(
      parseFlashcardStudioAppSnapshot({
        schemaVersion: 1,
        appId: 'flashcard-studio',
        deckTitle: 'Broken deck',
        status: 'editing',
        cardCount: 2,
        cards: [
          { cardId: 'dup-1', prompt: 'Q1', answer: 'A1' },
          { cardId: 'dup-1', prompt: 'Q2', answer: 'A2' },
        ],
        selectedCardId: 'missing-card',
        lastAction: 'selected-card',
        statusText: 'Editing selected card',
        summary: 'Broken summary',
        resumeHint: 'Broken hint',
        lastUpdatedAt: 3_000,
      })
    ).toBeNull()
  })

  it('fails closed on invalid study progress that does not match the deck', () => {
    expect(
      parseFlashcardStudioAppSnapshot({
        schemaVersion: 1,
        appId: 'flashcard-studio',
        deckTitle: 'Broken deck',
        status: 'editing',
        mode: 'study',
        studyStatus: 'studying',
        cardCount: 1,
        cards: [{ cardId: 'card-1', prompt: 'Q1', answer: 'A1' }],
        studyPosition: 4,
        revealedCardId: 'card-1',
        studyMarks: [{ cardId: 'missing-card', confidence: 'hard' }],
        studyCounts: { easy: 0, medium: 0, hard: 1 },
        lastAction: 'marked-hard',
        statusText: 'Marked hard',
        summary: 'Broken summary',
        resumeHint: 'Broken hint',
        lastUpdatedAt: 4_000,
      })
    ).toBeNull()
  })
})
