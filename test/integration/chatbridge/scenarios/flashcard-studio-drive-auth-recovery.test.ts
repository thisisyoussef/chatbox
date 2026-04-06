import '../setup'

import { createFlashcardStudioAppSnapshot } from '@shared/chatbridge'
import { CHATBRIDGE_HOST_TOOL_SCHEMA_VERSION } from '@shared/chatbridge/tools'
import type { MessageAppPart, MessageToolCallPart, Session } from '@shared/types'
import { createMessage } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  applyReviewedAppLaunchBootstrapToSession,
  applyReviewedAppLaunchHostSnapshotToSession,
  upsertReviewedAppLaunchParts,
} from '@/packages/chatbridge/reviewed-app-launch'
import { runChatBridgeScenarioTrace } from './scenario-tracing'

function createFlashcardStudioLaunchToolCallPart(): MessageToolCallPart {
  return {
    type: 'tool-call',
    state: 'result',
    toolCallId: 'tool-reviewed-launch-flashcard-drive-recovery-1',
    toolName: 'flashcard_studio_open',
    args: {
      request: 'Open Flashcard Studio and reconnect Drive so I can resume my saved biology deck.',
    },
    result: {
      kind: 'chatbridge.host.tool.record.v1',
      toolName: 'flashcard_studio_open',
      appId: 'flashcard-studio',
      sessionId: 'session-reviewed-launch-flashcard-drive-recovery-1',
      schemaVersion: CHATBRIDGE_HOST_TOOL_SCHEMA_VERSION,
      executionAuthority: 'host',
      effect: 'read',
      retryClassification: 'safe',
      invocation: {
        args: {
          request: 'Open Flashcard Studio and reconnect Drive so I can resume my saved biology deck.',
        },
      },
      outcome: {
        status: 'success',
        result: {
          appId: 'flashcard-studio',
          appName: 'Flashcard Studio',
          capability: 'open',
          launchReady: true,
          summary: 'Prepared the reviewed Flashcard Studio Drive recovery request for the host-owned launch path.',
          request: 'Open Flashcard Studio and reconnect Drive so I can resume my saved biology deck.',
        },
      },
    },
  }
}

function createSessionWithLaunchPart(): { session: Session; launchPart: MessageAppPart } {
  const assistantMessage = createMessage('assistant')
  assistantMessage.id = 'assistant-reviewed-flashcard-drive-recovery-1'
  assistantMessage.contentParts = upsertReviewedAppLaunchParts([createFlashcardStudioLaunchToolCallPart()])

  const launchPart = assistantMessage.contentParts.find((part): part is MessageAppPart => part.type === 'app')
  if (!launchPart) {
    throw new Error('Expected a reviewed Flashcard Studio launch part.')
  }

  return {
    session: {
      id: 'session-reviewed-launch-flashcard-drive-recovery-1',
      name: 'Reviewed Flashcard Studio Drive recovery scenario',
      messages: [assistantMessage],
      settings: {},
    },
    launchPart,
  }
}

function getLaunchPart(session: Session): MessageAppPart {
  const message = session.messages.find((candidate) => candidate.id === 'assistant-reviewed-flashcard-drive-recovery-1')
  const launchPart = message?.contentParts.find((part): part is MessageAppPart => part.type === 'app')

  if (!launchPart) {
    throw new Error('Expected the Flashcard Studio Drive recovery scenario to keep the launch part.')
  }

  return launchPart
}

function traceScenario<T>(testCase: string, execute: () => Promise<T> | T) {
  return runChatBridgeScenarioTrace(
    {
      slug: 'chatbridge-flashcard-studio-drive-auth-recovery',
      primaryFamily: 'reviewed-app-launch',
      evidenceFamilies: ['auth-resource', 'persistence', 'recovery'],
      storyId: 'SC-007B',
    },
    testCase,
    execute
  )
}

function createDeckSnapshot(
  overrides: Partial<NonNullable<Parameters<typeof createFlashcardStudioAppSnapshot>[0]>> = {}
) {
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
    lastUpdatedAt: 22_000,
    ...overrides,
  })
}

describe('ChatBridge Flashcard Studio Drive auth recovery lifecycle', () => {
  it('returns denied consent to reconnect guidance without dropping the deck', () =>
    traceScenario('returns denied consent to reconnect guidance without dropping the deck', () => {
      const { session, launchPart } = createSessionWithLaunchPart()

      const bootstrapped = applyReviewedAppLaunchBootstrapToSession(session, {
        messageId: 'assistant-reviewed-flashcard-drive-recovery-1',
        part: launchPart,
        bridgeSessionId: 'bridge-session-reviewed-flashcard-drive-recovery-1',
        now: () => 30_000,
        createId: () => 'event-reviewed-flashcard-drive-recovery-created-1',
      })

      const deniedSnapshot = createDeckSnapshot({
        drive: {
          status: 'needs-auth',
          statusText: 'Reconnect Drive to resume',
          detail:
            'Google Drive permission was not granted. Connect Drive when you want to save or reopen decks.',
          recentDecks: [
            {
              deckId: 'drive-deck-biology-review',
              deckName: 'Biology review.chatbridge-flashcards.json',
              modifiedAt: 1_717_000_100_000,
            },
          ],
        },
        lastUpdatedAt: 31_000,
      })

      const denied = applyReviewedAppLaunchHostSnapshotToSession(bootstrapped, {
        messageId: 'assistant-reviewed-flashcard-drive-recovery-1',
        part: getLaunchPart(bootstrapped),
        snapshot: deniedSnapshot,
        payload: {
          action: 'drive.connect',
          outcome: 'error',
          detail: 'Google Drive permission was not granted.',
        },
        summaryForModel: deniedSnapshot.summary,
        now: () => 31_000,
      })

      const deniedPart = getLaunchPart(denied)
      expect(deniedPart.snapshot).toMatchObject({
        cardCount: 2,
        drive: {
          status: 'needs-auth',
          statusText: 'Reconnect Drive to resume',
        },
      })
      expect(deniedPart.summaryForModel).toContain('Drive resume is available for 1 saved deck after reconnect.')
      expect((deniedPart.snapshot as { resumeHint?: string }).resumeHint).toContain(
        'Reconnect Drive to reopen "Biology review.chatbridge-flashcards.json".'
      )
    }))

  it('keeps expired auth explicit when save or load fails after a prior Drive connection', () =>
    traceScenario('keeps expired auth explicit when save or load fails after a prior Drive connection', () => {
      const { session, launchPart } = createSessionWithLaunchPart()

      const bootstrapped = applyReviewedAppLaunchBootstrapToSession(session, {
        messageId: 'assistant-reviewed-flashcard-drive-recovery-1',
        part: launchPart,
        bridgeSessionId: 'bridge-session-reviewed-flashcard-drive-recovery-1',
        now: () => 35_000,
        createId: () => 'event-reviewed-flashcard-drive-recovery-created-2',
      })

      const expiredSnapshot = createDeckSnapshot({
        drive: {
          status: 'expired',
          statusText: 'Reconnect Drive to continue',
          detail:
            'Drive authorization expired before the host could finish this action. Reconnect and try again; your current deck is still open locally.',
          recentDecks: [
            {
              deckId: 'drive-deck-biology-review',
              deckName: 'Biology review.chatbridge-flashcards.json',
              modifiedAt: 1_717_000_100_000,
            },
          ],
          lastSavedDeckId: 'drive-deck-biology-review',
          lastSavedDeckName: 'Biology review.chatbridge-flashcards.json',
          lastSavedAt: 1_717_000_300_000,
        },
        lastUpdatedAt: 36_000,
      })

      const degraded = applyReviewedAppLaunchHostSnapshotToSession(bootstrapped, {
        messageId: 'assistant-reviewed-flashcard-drive-recovery-1',
        part: getLaunchPart(bootstrapped),
        snapshot: expiredSnapshot,
        payload: {
          action: 'drive.save',
          outcome: 'expired',
        },
        summaryForModel: expiredSnapshot.summary,
        now: () => 36_000,
      })

      const degradedPart = getLaunchPart(degraded)
      expect(degradedPart.snapshot).toMatchObject({
        cardCount: 2,
        drive: {
          status: 'expired',
          statusText: 'Reconnect Drive to continue',
          lastSavedDeckName: 'Biology review.chatbridge-flashcards.json',
        },
      })
      expect(degradedPart.summaryForModel).toContain('Drive auth expired')
      expect((degradedPart.snapshot as { resumeHint?: string }).resumeHint).toContain(
        'Reconnect Drive to restore saved deck access.'
      )
    }))
})
