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
  applyReviewedAppLaunchHostSnapshotToSession,
  upsertReviewedAppLaunchParts,
} from '@/packages/chatbridge/reviewed-app-launch'
import { runChatBridgeScenarioTrace } from './scenario-tracing'

function createFlashcardStudioLaunchToolCallPart(): MessageToolCallPart {
  return {
    type: 'tool-call',
    state: 'result',
    toolCallId: 'tool-reviewed-launch-flashcard-drive-1',
    toolName: 'flashcard_studio_open',
    args: {
      request: 'Open Flashcard Studio and reconnect Drive so I can resume my saved biology deck.',
    },
    result: {
      kind: 'chatbridge.host.tool.record.v1',
      toolName: 'flashcard_studio_open',
      appId: 'flashcard-studio',
      sessionId: 'session-reviewed-launch-flashcard-drive-1',
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
          summary: 'Prepared the reviewed Flashcard Studio Drive resume request for the host-owned launch path.',
          request: 'Open Flashcard Studio and reconnect Drive so I can resume my saved biology deck.',
        },
      },
    },
  }
}

function createSessionWithLaunchPart(): { session: Session; launchPart: MessageAppPart } {
  const assistantMessage = createMessage('assistant')
  assistantMessage.id = 'assistant-reviewed-flashcard-drive-1'
  assistantMessage.contentParts = upsertReviewedAppLaunchParts([createFlashcardStudioLaunchToolCallPart()])

  const launchPart = assistantMessage.contentParts.find((part): part is MessageAppPart => part.type === 'app')

  if (!launchPart) {
    throw new Error('Expected a reviewed Flashcard Studio launch part.')
  }

  return {
    session: {
      id: 'session-reviewed-launch-flashcard-drive-1',
      name: 'Reviewed Flashcard Studio Drive scenario',
      messages: [assistantMessage],
      settings: {},
    },
    launchPart,
  }
}

function getLaunchPart(session: Session): MessageAppPart {
  const message = session.messages.find((candidate) => candidate.id === 'assistant-reviewed-flashcard-drive-1')
  const launchPart = message?.contentParts.find((part): part is MessageAppPart => part.type === 'app')

  if (!launchPart) {
    throw new Error('Expected the Flashcard Studio Drive scenario to keep the launch part.')
  }

  return launchPart
}

function traceScenario<T>(testCase: string, execute: () => Promise<T> | T) {
  return runChatBridgeScenarioTrace(
    {
      slug: 'chatbridge-flashcard-studio-drive-connect-save-load',
      primaryFamily: 'reviewed-app-launch',
      evidenceFamilies: ['auth', 'persistence', 'continuity'],
      storyId: 'SC-007A',
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
      {
        cardId: 'card-3',
        prompt: 'What is cellular respiration?',
        answer: 'Cells convert glucose and oxygen into usable energy.',
      },
    ],
    selectedCardId: 'card-1',
    lastAction: 'updated-card',
    lastUpdatedAt: 22_000,
    ...overrides,
  })
}

describe('ChatBridge Flashcard Studio Drive connect, save, load, and resume lifecycle', () => {
  it('keeps bounded resume continuity after the host connects Drive, saves a deck, and reloads study progress', () =>
    traceScenario('keeps bounded resume continuity after the host connects Drive, saves a deck, and reloads study progress', () => {
      const { session, launchPart } = createSessionWithLaunchPart()

      const bootstrapped = applyReviewedAppLaunchBootstrapToSession(session, {
        messageId: 'assistant-reviewed-flashcard-drive-1',
        part: launchPart,
        bridgeSessionId: 'bridge-session-reviewed-flashcard-drive-1',
        now: () => 20_000,
        createId: () => 'event-reviewed-flashcard-drive-created-1',
      })

      const readied = applyReviewedAppLaunchBridgeReadyToSession(bootstrapped, {
        messageId: 'assistant-reviewed-flashcard-drive-1',
        part: getLaunchPart(bootstrapped),
        event: {
          kind: 'app.ready',
          bridgeSessionId: 'bridge-session-reviewed-flashcard-drive-1',
          appInstanceId: launchPart.appInstanceId,
          bridgeToken: 'bridge-token-reviewed-flashcard-drive-1',
          ackNonce: 'bridge-nonce-reviewed-flashcard-drive-1',
          sequence: 1,
        },
        now: () => 21_000,
        createId: () => 'event-reviewed-flashcard-drive-ready-1',
      })

      const authored = applyReviewedAppLaunchBridgeEventToSession(readied, {
        messageId: 'assistant-reviewed-flashcard-drive-1',
        part: getLaunchPart(readied),
        event: {
          kind: 'app.state',
          bridgeSessionId: 'bridge-session-reviewed-flashcard-drive-1',
          appInstanceId: launchPart.appInstanceId,
          bridgeToken: 'bridge-token-reviewed-flashcard-drive-1',
          sequence: 2,
          idempotencyKey: 'state-reviewed-flashcard-drive-2',
          snapshot: createDeckSnapshot(),
        },
        now: () => 22_000,
        createId: () => 'event-reviewed-flashcard-drive-state-1',
      })

      const authRequestedSnapshot = createDeckSnapshot({
        drive: {
          status: 'connecting',
          statusText: 'Connecting Drive',
          detail: 'Waiting for Google Drive permission so the host can save and reopen this deck.',
          recentDecks: [
            {
              deckId: 'drive-deck-biology-review',
              deckName: 'Biology review.chatbridge-flashcards.json',
              modifiedAt: 1_717_000_100_000,
            },
          ],
        },
        lastUpdatedAt: 23_000,
      })

      const authRequested = applyReviewedAppLaunchHostSnapshotToSession(authored, {
        messageId: 'assistant-reviewed-flashcard-drive-1',
        part: getLaunchPart(authored),
        snapshot: authRequestedSnapshot,
        eventKind: 'auth.requested',
        payload: {
          action: 'drive.connect',
        },
        summaryForModel: authRequestedSnapshot.summary,
        now: () => 23_000,
      })

      const connectedSnapshot = createDeckSnapshot({
        drive: {
          status: 'connected',
          statusText: 'Drive connected',
          detail: 'Drive is connected and ready to save this deck.',
          connectedAs: 'student@example.com',
          recentDecks: authRequestedSnapshot.drive.recentDecks,
        },
        lastUpdatedAt: 24_000,
      })

      const connected = applyReviewedAppLaunchHostSnapshotToSession(authRequested, {
        messageId: 'assistant-reviewed-flashcard-drive-1',
        part: getLaunchPart(authRequested),
        snapshot: connectedSnapshot,
        eventKind: 'auth.linked',
        payload: {
          action: 'drive.connect',
          outcome: 'success',
        },
        summaryForModel: connectedSnapshot.summary,
        now: () => 24_000,
      })

      const savedSnapshot = createDeckSnapshot({
        drive: {
          ...connectedSnapshot.drive,
          status: 'connected',
          statusText: 'Drive connected',
          detail: 'Saved "Biology review.chatbridge-flashcards.json" to Drive through the host-managed connector.',
          lastSavedDeckId: 'drive-deck-biology-review',
          lastSavedDeckName: 'Biology review.chatbridge-flashcards.json',
          lastSavedAt: 1_717_000_300_000,
        },
        lastUpdatedAt: 25_000,
      })

      const saved = applyReviewedAppLaunchHostSnapshotToSession(connected, {
        messageId: 'assistant-reviewed-flashcard-drive-1',
        part: getLaunchPart(connected),
        snapshot: savedSnapshot,
        payload: {
          action: 'drive.save',
          outcome: 'success',
        },
        summaryForModel: savedSnapshot.summary,
        now: () => 25_000,
      })

      const resumedSnapshot = createDeckSnapshot({
        mode: 'study',
        studyStatus: 'studying',
        studyPosition: 2,
        revealedCardId: 'card-3',
        studyMarks: [
          { cardId: 'card-1', confidence: 'easy' },
          { cardId: 'card-2', confidence: 'hard' },
        ],
        drive: {
          ...savedSnapshot.drive,
          detail: 'Loaded "Biology review.chatbridge-flashcards.json" from the saved Drive deck list.',
        },
        lastAction: 'revealed-card',
        lastUpdatedAt: 26_000,
      })

      const resumed = applyReviewedAppLaunchHostSnapshotToSession(saved, {
        messageId: 'assistant-reviewed-flashcard-drive-1',
        part: getLaunchPart(saved),
        snapshot: resumedSnapshot,
        payload: {
          action: 'drive.load',
          outcome: 'success',
        },
        summaryForModel: resumedSnapshot.summary,
        now: () => 26_000,
      })

      const compactedSummary: Message = {
        id: 'summary-reviewed-flashcard-drive-1',
        role: 'assistant',
        timestamp: 27_000,
        isSummary: true,
        contentParts: [{ type: 'text', text: 'Compacted summary of earlier Flashcard Studio Drive activity.' }],
      }
      const followUp = createMessage('flashcard-drive-follow-up-user', 'user', 'Which card should I review again after resuming?')
      const compactionPoints: CompactionPoint[] = [
        {
          summaryMessageId: compactedSummary.id,
          boundaryMessageId: 'assistant-reviewed-flashcard-drive-1',
          createdAt: 27_000,
        },
      ]

      const context = buildContextForAI({
        messages: [...resumed.messages, followUp, compactedSummary],
        compactionPoints,
      })

      const injectedContext = context.find((message) => message.id.startsWith(CHATBRIDGE_APP_CONTEXT_MESSAGE_PREFIX))
      expect(injectedContext?.contentParts[0]).toMatchObject({
        type: 'text',
        text: expect.stringContaining('Biology review'),
      })
      expect((injectedContext?.contentParts[0] as { text?: string } | undefined)?.text).toContain(
        'Saved deck: Biology review.chatbridge-flashcards.json'
      )
      expect((injectedContext?.contentParts[0] as { text?: string } | undefined)?.text).toContain('Recent decks: 1')
      expect((injectedContext?.contentParts[0] as { text?: string } | undefined)?.text).toContain(
        'Needs review: What is photosynthesis?'
      )
      expect((injectedContext?.contentParts[0] as { text?: string } | undefined)?.text).not.toContain(
        'Plants use sunlight to make food.'
      )
      expect(resumed.chatBridgeAppRecords?.events.map((event) => event.kind)).toEqual([
        'instance.created',
        'bridge.ready',
        'state.updated',
        'auth.requested',
        'auth.linked',
        'state.updated',
        'state.updated',
      ])
    }))

  it('surfaces a denied Drive auth attempt without leaving the reviewed launch session', () =>
    traceScenario('surfaces a denied Drive auth attempt without leaving the reviewed launch session', () => {
      const { session, launchPart } = createSessionWithLaunchPart()

      const bootstrapped = applyReviewedAppLaunchBootstrapToSession(session, {
        messageId: 'assistant-reviewed-flashcard-drive-1',
        part: launchPart,
        bridgeSessionId: 'bridge-session-reviewed-flashcard-drive-1',
        now: () => 30_000,
        createId: () => 'event-reviewed-flashcard-drive-created-2',
      })

      const deniedSnapshot = createDeckSnapshot({
        drive: {
          status: 'error',
          statusText: 'Drive action blocked',
          detail: 'Google Drive permission was not granted.',
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
        messageId: 'assistant-reviewed-flashcard-drive-1',
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
      expect(deniedPart).toMatchObject({
        lifecycle: 'active',
        snapshot: {
          drive: {
            status: 'error',
            statusText: 'Drive action blocked',
            detail: 'Google Drive permission was not granted.',
          },
        },
      })
      expect(deniedPart.summaryForModel).toContain('Drive needs attention: Google Drive permission was not granted.')
      expect(denied.chatBridgeAppRecords?.events.map((event) => event.kind)).toEqual([
        'instance.created',
        'bridge.ready',
        'state.updated',
      ])
    }))

  it('fails closed when the selected Drive deck payload is malformed', () =>
    traceScenario('fails closed when the selected Drive deck payload is malformed', () => {
      const { session, launchPart } = createSessionWithLaunchPart()

      const bootstrapped = applyReviewedAppLaunchBootstrapToSession(session, {
        messageId: 'assistant-reviewed-flashcard-drive-1',
        part: launchPart,
        bridgeSessionId: 'bridge-session-reviewed-flashcard-drive-1',
        now: () => 32_000,
        createId: () => 'event-reviewed-flashcard-drive-created-3',
      })

      const connectedSnapshot = createDeckSnapshot({
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
          lastSavedAt: 1_717_000_300_000,
        },
        lastUpdatedAt: 33_000,
      })

      const malformedSnapshot = createDeckSnapshot({
        drive: {
          ...connectedSnapshot.drive,
          status: 'error',
          statusText: 'Drive action blocked',
          detail: 'The selected Drive deck does not match the saved Flashcard schema.',
        },
        lastUpdatedAt: 34_000,
      })

      const malformed = applyReviewedAppLaunchHostSnapshotToSession(bootstrapped, {
        messageId: 'assistant-reviewed-flashcard-drive-1',
        part: getLaunchPart(bootstrapped),
        snapshot: malformedSnapshot,
        payload: {
          action: 'drive.load',
          outcome: 'error',
          detail: 'The selected Drive deck does not match the saved Flashcard schema.',
        },
        summaryForModel: malformedSnapshot.summary,
        now: () => 34_000,
      })

      const malformedPart = getLaunchPart(malformed)
      expect(malformedPart).toMatchObject({
        lifecycle: 'active',
        snapshot: {
          drive: {
            status: 'error',
            statusText: 'Drive action blocked',
          },
        },
      })
      expect(malformedPart.summaryForModel).toContain(
        'Drive needs attention: The selected Drive deck does not match the saved Flashcard schema.'
      )
      expect(malformedPart.summaryForModel).not.toContain('Plants use sunlight to make food.')
    }))

  it('keeps reconnect guidance explicit when the Drive session expires after a saved deck exists', () =>
    traceScenario('keeps reconnect guidance explicit when the Drive session expires after a saved deck exists', () => {
      const { session, launchPart } = createSessionWithLaunchPart()

      const bootstrapped = applyReviewedAppLaunchBootstrapToSession(session, {
        messageId: 'assistant-reviewed-flashcard-drive-1',
        part: launchPart,
        bridgeSessionId: 'bridge-session-reviewed-flashcard-drive-1',
        now: () => 35_000,
        createId: () => 'event-reviewed-flashcard-drive-created-4',
      })

      const reconnectSnapshot = createDeckSnapshot({
        drive: {
          status: 'needs-auth',
          statusText: 'Reconnect Drive to resume',
          detail: 'Reconnect Drive to reopen "Biology review.chatbridge-flashcards.json" or save new progress from this deck.',
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
        messageId: 'assistant-reviewed-flashcard-drive-1',
        part: getLaunchPart(bootstrapped),
        snapshot: reconnectSnapshot,
        payload: {
          action: 'drive.save',
          outcome: 'expired',
        },
        summaryForModel: reconnectSnapshot.summary,
        now: () => 36_000,
      })

      const degradedPart = getLaunchPart(degraded)
      expect(degradedPart).toMatchObject({
        lifecycle: 'active',
        snapshot: {
          drive: {
            status: 'needs-auth',
            statusText: 'Reconnect Drive to resume',
            lastSavedDeckName: 'Biology review.chatbridge-flashcards.json',
          },
        },
      })
      expect(degradedPart.summaryForModel).toContain('Drive resume is available for 1 saved deck after reconnect.')
      expect((degradedPart.snapshot as { resumeHint?: string })?.resumeHint).toContain(
        'Reconnect Drive to reopen "Biology review.chatbridge-flashcards.json".'
      )
    }))
})
