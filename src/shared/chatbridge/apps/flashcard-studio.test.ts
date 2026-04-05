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
})
