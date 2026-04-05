import '../setup'

import { createFlashcardStudioAppSnapshot } from '@shared/chatbridge'
import { CHATBRIDGE_HOST_TOOL_SCHEMA_VERSION } from '@shared/chatbridge/tools'
import type { CompactionPoint, Message, MessageAppPart, MessageToolCallPart, Session } from '@shared/types'
import { createMessage } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { buildContextForAI } from '@/packages/context-management/context-builder'
import { CHATBRIDGE_APP_CONTEXT_MESSAGE_PREFIX } from '@/packages/chatbridge/context'
import {
  applyReviewedAppLaunchBootstrapToSession,
  applyReviewedAppLaunchBridgeEventToSession,
  applyReviewedAppLaunchBridgeReadyToSession,
  upsertReviewedAppLaunchParts,
} from '@/packages/chatbridge/reviewed-app-launch'
import { runChatBridgeScenarioTrace } from './scenario-tracing'

function createFlashcardStudioLaunchToolCallPart(): MessageToolCallPart {
  return {
    type: 'tool-call',
    state: 'result',
    toolCallId: 'tool-reviewed-launch-flashcard-study-1',
    toolName: 'flashcard_studio_open',
    args: {
      request: 'Open Flashcard Studio and help me study biology flashcards.',
    },
    result: {
      kind: 'chatbridge.host.tool.record.v1',
      toolName: 'flashcard_studio_open',
      appId: 'flashcard-studio',
      sessionId: 'session-reviewed-launch-flashcard-study-1',
      schemaVersion: CHATBRIDGE_HOST_TOOL_SCHEMA_VERSION,
      executionAuthority: 'host',
      effect: 'read',
      retryClassification: 'safe',
      invocation: {
        args: {
          request: 'Open Flashcard Studio and help me study biology flashcards.',
        },
      },
      outcome: {
        status: 'success',
        result: {
          appId: 'flashcard-studio',
          appName: 'Flashcard Studio',
          capability: 'open',
          launchReady: true,
          summary: 'Prepared the reviewed Flashcard Studio study request for the host-owned launch path.',
          request: 'Open Flashcard Studio and help me study biology flashcards.',
        },
      },
    },
  }
}

function createSessionWithLaunchPart(): { session: Session; launchPart: MessageAppPart } {
  const assistantMessage = createMessage('assistant')
  assistantMessage.id = 'assistant-reviewed-flashcard-study-1'
  assistantMessage.contentParts = upsertReviewedAppLaunchParts([createFlashcardStudioLaunchToolCallPart()])

  const launchPart = assistantMessage.contentParts.find((part): part is MessageAppPart => part.type === 'app')

  if (!launchPart) {
    throw new Error('Expected a reviewed Flashcard Studio launch part.')
  }

  return {
    session: {
      id: 'session-reviewed-launch-flashcard-study-1',
      name: 'Reviewed Flashcard Studio study scenario',
      messages: [assistantMessage],
      settings: {},
    },
    launchPart,
  }
}

function getLaunchPart(session: Session): MessageAppPart {
  const message = session.messages.find((candidate) => candidate.id === 'assistant-reviewed-flashcard-study-1')
  const launchPart = message?.contentParts.find((part): part is MessageAppPart => part.type === 'app')

  if (!launchPart) {
    throw new Error('Expected the Flashcard Studio study scenario to keep the launch part.')
  }

  return launchPart
}

function traceScenario<T>(testCase: string, execute: () => Promise<T> | T) {
  return runChatBridgeScenarioTrace(
    {
      slug: 'chatbridge-flashcard-studio-study-mode',
      primaryFamily: 'reviewed-app-launch',
      evidenceFamilies: ['persistence', 'continuity'],
      storyId: 'SC-006B',
    },
    testCase,
    execute
  )
}

describe('ChatBridge Flashcard Studio study mode lifecycle', () => {
  it('keeps bounded weak-area continuity after a study round completes', () =>
    traceScenario('keeps bounded weak-area continuity after a study round completes', () => {
      const { session, launchPart } = createSessionWithLaunchPart()

      const bootstrapped = applyReviewedAppLaunchBootstrapToSession(session, {
        messageId: 'assistant-reviewed-flashcard-study-1',
        part: launchPart,
        bridgeSessionId: 'bridge-session-reviewed-flashcard-study-1',
        now: () => 20_000,
        createId: () => 'event-reviewed-flashcard-study-created-1',
      })

      const readied = applyReviewedAppLaunchBridgeReadyToSession(bootstrapped, {
        messageId: 'assistant-reviewed-flashcard-study-1',
        part: getLaunchPart(bootstrapped),
        event: {
          kind: 'app.ready',
          bridgeSessionId: 'bridge-session-reviewed-flashcard-study-1',
          appInstanceId: launchPart.appInstanceId,
          bridgeToken: 'bridge-token-reviewed-flashcard-study-1',
          ackNonce: 'bridge-nonce-reviewed-flashcard-study-1',
          sequence: 1,
        },
        now: () => 21_000,
        createId: () => 'event-reviewed-flashcard-study-ready-1',
      })

      const authoringSnapshot = createFlashcardStudioAppSnapshot({
        request: 'Open Flashcard Studio and help me study biology flashcards.',
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
          {
            cardId: 'card-3',
            prompt: 'What is cellular respiration?',
            answer: 'Cells convert glucose and oxygen into usable energy.',
          },
        ],
        selectedCardId: 'card-1',
        lastAction: 'created-card',
        lastUpdatedAt: 22_000,
      })

      const authored = applyReviewedAppLaunchBridgeEventToSession(readied, {
        messageId: 'assistant-reviewed-flashcard-study-1',
        part: getLaunchPart(readied),
        event: {
          kind: 'app.state',
          bridgeSessionId: 'bridge-session-reviewed-flashcard-study-1',
          appInstanceId: launchPart.appInstanceId,
          bridgeToken: 'bridge-token-reviewed-flashcard-study-1',
          sequence: 2,
          idempotencyKey: 'state-reviewed-flashcard-study-2',
          snapshot: authoringSnapshot,
        },
        now: () => 22_000,
        createId: () => 'event-reviewed-flashcard-study-state-1',
      })

      const activeStudySnapshot = createFlashcardStudioAppSnapshot({
        request: 'Open Flashcard Studio and help me study biology flashcards.',
        deckTitle: 'Biology review',
        mode: 'study',
        studyStatus: 'studying',
        cards: authoringSnapshot.cards,
        selectedCardId: 'card-1',
        studyPosition: 2,
        revealedCardId: 'card-3',
        studyMarks: [
          { cardId: 'card-1', confidence: 'easy' },
          { cardId: 'card-2', confidence: 'hard' },
        ],
        lastAction: 'revealed-card',
        lastUpdatedAt: 23_000,
      })

      const studying = applyReviewedAppLaunchBridgeEventToSession(authored, {
        messageId: 'assistant-reviewed-flashcard-study-1',
        part: getLaunchPart(authored),
        event: {
          kind: 'app.state',
          bridgeSessionId: 'bridge-session-reviewed-flashcard-study-1',
          appInstanceId: launchPart.appInstanceId,
          bridgeToken: 'bridge-token-reviewed-flashcard-study-1',
          sequence: 3,
          idempotencyKey: 'state-reviewed-flashcard-study-3',
          snapshot: activeStudySnapshot,
        },
        now: () => 23_000,
        createId: () => 'event-reviewed-flashcard-study-state-2',
      })

      const completedStudySnapshot = createFlashcardStudioAppSnapshot({
        request: 'Open Flashcard Studio and help me study biology flashcards.',
        deckTitle: 'Biology review',
        status: 'complete',
        mode: 'study',
        studyStatus: 'complete',
        cards: authoringSnapshot.cards,
        selectedCardId: 'card-1',
        studyPosition: 3,
        studyMarks: [
          { cardId: 'card-1', confidence: 'easy' },
          { cardId: 'card-2', confidence: 'hard' },
          { cardId: 'card-3', confidence: 'medium' },
        ],
        lastAction: 'completed-study-round',
        lastUpdatedAt: 24_000,
      })

      const studyRoundFinished = applyReviewedAppLaunchBridgeEventToSession(studying, {
        messageId: 'assistant-reviewed-flashcard-study-1',
        part: getLaunchPart(studying),
        event: {
          kind: 'app.state',
          bridgeSessionId: 'bridge-session-reviewed-flashcard-study-1',
          appInstanceId: launchPart.appInstanceId,
          bridgeToken: 'bridge-token-reviewed-flashcard-study-1',
          sequence: 4,
          idempotencyKey: 'state-reviewed-flashcard-study-4',
          snapshot: completedStudySnapshot,
        },
        now: () => 24_000,
        createId: () => 'event-reviewed-flashcard-study-state-3',
      })

      const completed = applyReviewedAppLaunchBridgeEventToSession(studyRoundFinished, {
        messageId: 'assistant-reviewed-flashcard-study-1',
        part: getLaunchPart(studyRoundFinished),
        event: {
          kind: 'app.complete',
          bridgeSessionId: 'bridge-session-reviewed-flashcard-study-1',
          appInstanceId: launchPart.appInstanceId,
          bridgeToken: 'bridge-token-reviewed-flashcard-study-1',
          sequence: 5,
          idempotencyKey: 'complete-reviewed-flashcard-study-5',
          completion: {
            schemaVersion: 1,
            status: 'success',
            suggestedSummary: {
              text: completedStudySnapshot.summary,
            },
            resumability: {
              resumable: true,
              checkpointId: 'flashcard-studio-24000',
              resumeHint: completedStudySnapshot.resumeHint,
            },
          },
        },
        now: () => 24_000,
        createId: () => 'event-reviewed-flashcard-study-complete-1',
      })

      const compactedSummary: Message = {
        id: 'summary-reviewed-flashcard-study-1',
        role: 'assistant',
        timestamp: 25_000,
        isSummary: true,
        contentParts: [{ type: 'text', text: 'Compacted summary of earlier Flashcard Studio study activity.' }],
      }
      const followUp = createMessage('flashcard-study-follow-up-user', 'user', 'Which card should I review again?')
      const compactionPoints: CompactionPoint[] = [
        {
          summaryMessageId: compactedSummary.id,
          boundaryMessageId: 'assistant-reviewed-flashcard-study-1',
          createdAt: 25_000,
        },
      ]

      const context = buildContextForAI({
        messages: [...completed.messages, followUp, compactedSummary],
        compactionPoints,
      })

      const injectedContext = context.find((message) => message.id.startsWith(CHATBRIDGE_APP_CONTEXT_MESSAGE_PREFIX))
      expect(injectedContext?.contentParts[0]).toMatchObject({
        type: 'text',
        text: expect.stringContaining('Biology review'),
      })
      expect((injectedContext?.contentParts[0] as { text?: string } | undefined)?.text).toContain(
        'Needs review: What is photosynthesis?'
      )
      expect((injectedContext?.contentParts[0] as { text?: string } | undefined)?.text).toContain(
        'Confidence: 1 easy, 1 medium, 1 hard'
      )
      expect((injectedContext?.contentParts[0] as { text?: string } | undefined)?.text).not.toContain(
        'Plants use sunlight to make food.'
      )
    }))
})
