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
    toolCallId: 'tool-reviewed-launch-flashcard-scenario-1',
    toolName: 'flashcard_studio_open',
    args: {
      request: 'Open Flashcard Studio and help me make biology flashcards.',
    },
    result: {
      kind: 'chatbridge.host.tool.record.v1',
      toolName: 'flashcard_studio_open',
      appId: 'flashcard-studio',
      sessionId: 'session-reviewed-launch-flashcard-scenario-1',
      schemaVersion: CHATBRIDGE_HOST_TOOL_SCHEMA_VERSION,
      executionAuthority: 'host',
      effect: 'read',
      retryClassification: 'safe',
      invocation: {
        args: {
          request: 'Open Flashcard Studio and help me make biology flashcards.',
        },
      },
      outcome: {
        status: 'success',
        result: {
          appId: 'flashcard-studio',
          appName: 'Flashcard Studio',
          capability: 'open',
          launchReady: true,
          summary: 'Prepared the reviewed Flashcard Studio deck-authoring request for the host-owned launch path.',
          request: 'Open Flashcard Studio and help me make biology flashcards.',
        },
      },
    },
  }
}

function createSessionWithLaunchPart(): { session: Session; launchPart: MessageAppPart } {
  const assistantMessage = createMessage('assistant')
  assistantMessage.id = 'assistant-reviewed-flashcard-scenario-1'
  assistantMessage.contentParts = upsertReviewedAppLaunchParts([createFlashcardStudioLaunchToolCallPart()])

  const launchPart = assistantMessage.contentParts.find((part): part is MessageAppPart => part.type === 'app')

  if (!launchPart) {
    throw new Error('Expected a reviewed Flashcard Studio launch part.')
  }

  return {
    session: {
      id: 'session-reviewed-launch-flashcard-scenario-1',
      name: 'Reviewed Flashcard Studio launch scenario',
      messages: [assistantMessage],
      settings: {},
    },
    launchPart,
  }
}

function getLaunchPart(session: Session): MessageAppPart {
  const message = session.messages.find((candidate) => candidate.id === 'assistant-reviewed-flashcard-scenario-1')
  const launchPart = message?.contentParts.find((part): part is MessageAppPart => part.type === 'app')

  if (!launchPart) {
    throw new Error('Expected the Flashcard Studio scenario to keep the launch part.')
  }

  return launchPart
}

function traceScenario<T>(testCase: string, execute: () => Promise<T> | T) {
  return runChatBridgeScenarioTrace(
    {
      slug: 'chatbridge-flashcard-studio-deck-authoring',
      primaryFamily: 'reviewed-app-launch',
      evidenceFamilies: ['persistence', 'continuity'],
      storyId: 'SC-006A',
    },
    testCase,
    execute
  )
}

describe('ChatBridge Flashcard Studio deck authoring lifecycle', () => {
  it('keeps a bounded deck summary for later chat after authoring completes', () =>
    traceScenario('keeps a bounded deck summary for later chat after authoring completes', () => {
      const { session, launchPart } = createSessionWithLaunchPart()

      const bootstrapped = applyReviewedAppLaunchBootstrapToSession(session, {
        messageId: 'assistant-reviewed-flashcard-scenario-1',
        part: launchPart,
        bridgeSessionId: 'bridge-session-reviewed-flashcard-scenario-1',
        now: () => 10_000,
        createId: () => 'event-reviewed-flashcard-created-1',
      })

      const readied = applyReviewedAppLaunchBridgeReadyToSession(bootstrapped, {
        messageId: 'assistant-reviewed-flashcard-scenario-1',
        part: getLaunchPart(bootstrapped),
        event: {
          kind: 'app.ready',
          bridgeSessionId: 'bridge-session-reviewed-flashcard-scenario-1',
          appInstanceId: launchPart.appInstanceId,
          bridgeToken: 'bridge-token-reviewed-flashcard-scenario-1',
          ackNonce: 'bridge-nonce-reviewed-flashcard-scenario-1',
          sequence: 1,
        },
        now: () => 11_000,
        createId: () => 'event-reviewed-flashcard-ready-1',
      })

      const authoredSnapshot = createFlashcardStudioAppSnapshot({
        request: 'Open Flashcard Studio and help me make biology flashcards.',
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
        selectedCardId: 'card-2',
        lastAction: 'created-card',
        lastUpdatedAt: 12_000,
      })

      const authored = applyReviewedAppLaunchBridgeEventToSession(readied, {
        messageId: 'assistant-reviewed-flashcard-scenario-1',
        part: getLaunchPart(readied),
        event: {
          kind: 'app.state',
          bridgeSessionId: 'bridge-session-reviewed-flashcard-scenario-1',
          appInstanceId: launchPart.appInstanceId,
          bridgeToken: 'bridge-token-reviewed-flashcard-scenario-1',
          sequence: 2,
          idempotencyKey: 'state-reviewed-flashcard-scenario-2',
          snapshot: authoredSnapshot,
        },
        now: () => 12_000,
        createId: () => 'event-reviewed-flashcard-state-1',
      })

      const reorderedSnapshot = createFlashcardStudioAppSnapshot({
        request: 'Open Flashcard Studio and help me make biology flashcards.',
        deckTitle: 'Biology review',
        cards: [
          {
            cardId: 'card-2',
            prompt: 'What is photosynthesis?',
            answer: 'Plants use sunlight to make food.',
          },
          {
            cardId: 'card-1',
            prompt: 'What does the mitochondria do?',
            answer: 'It helps the cell produce energy.',
          },
        ],
        selectedCardId: 'card-2',
        lastAction: 'moved-card-up',
        lastUpdatedAt: 13_000,
      })

      const activated = applyReviewedAppLaunchBridgeEventToSession(authored, {
        messageId: 'assistant-reviewed-flashcard-scenario-1',
        part: getLaunchPart(authored),
        event: {
          kind: 'app.state',
          bridgeSessionId: 'bridge-session-reviewed-flashcard-scenario-1',
          appInstanceId: launchPart.appInstanceId,
          bridgeToken: 'bridge-token-reviewed-flashcard-scenario-1',
          sequence: 3,
          idempotencyKey: 'state-reviewed-flashcard-scenario-3',
          snapshot: reorderedSnapshot,
        },
        now: () => 13_000,
        createId: () => 'event-reviewed-flashcard-state-2',
      })

      const completed = applyReviewedAppLaunchBridgeEventToSession(activated, {
        messageId: 'assistant-reviewed-flashcard-scenario-1',
        part: getLaunchPart(activated),
        event: {
          kind: 'app.complete',
          bridgeSessionId: 'bridge-session-reviewed-flashcard-scenario-1',
          appInstanceId: launchPart.appInstanceId,
          bridgeToken: 'bridge-token-reviewed-flashcard-scenario-1',
          sequence: 4,
          idempotencyKey: 'complete-reviewed-flashcard-scenario-4',
          completion: {
            schemaVersion: 1,
            status: 'success',
            suggestedSummary: {
              text: reorderedSnapshot.summary,
            },
            resumability: {
              resumable: true,
              checkpointId: 'flashcard-studio-13000',
              resumeHint: reorderedSnapshot.resumeHint,
            },
          },
        },
        now: () => 14_000,
        createId: () => 'event-reviewed-flashcard-complete-1',
      })

      const compactedSummary: Message = {
        id: 'summary-reviewed-flashcard-scenario-1',
        role: 'assistant',
        timestamp: 15_000,
        isSummary: true,
        contentParts: [{ type: 'text', text: 'Compacted summary of earlier Flashcard Studio activity.' }],
      }
      const followUp = createMessage('flashcard-follow-up-user', 'user', 'What cards did I just make?')
      const compactionPoints: CompactionPoint[] = [
        {
          summaryMessageId: compactedSummary.id,
          boundaryMessageId: 'assistant-reviewed-flashcard-scenario-1',
          createdAt: 15_000,
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
        'What is photosynthesis?'
      )
      expect((injectedContext?.contentParts[0] as { text?: string } | undefined)?.text).toContain(
        'What does the mitochondria do?'
      )
      expect((injectedContext?.contentParts[0] as { text?: string } | undefined)?.text).not.toContain(
        'Plants use sunlight to make food.'
      )
      expect(getLaunchPart(completed)).toMatchObject({
        lifecycle: 'complete',
        summaryForModel: reorderedSnapshot.summary,
        snapshot: {
          deckTitle: 'Biology review',
          cardCount: 2,
        },
      })
    }))
})
