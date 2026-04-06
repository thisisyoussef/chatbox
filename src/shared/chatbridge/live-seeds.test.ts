import { describe, expect, it } from 'vitest'
import {
  buildAppAwareSessionFixture,
  buildChatBridgeChessMidGameSessionFixture,
  buildChatBridgeDegradedCompletionRecoverySessionFixture,
  buildChatBridgeDrawingKitDoodleDareSessionFixture,
  buildChatBridgeFlashcardStudioDriveDeniedSessionFixture,
  buildChatBridgeFlashcardStudioDriveExpiredSessionFixture,
  buildChatBridgeFlashcardStudioDriveResumeSessionFixture,
  buildChatBridgeFlashcardStudioStudySessionFixture,
  buildChatBridgeWeatherDashboardSessionFixture,
  buildChatBridgePlatformRecoverySessionFixture,
  buildChatBridgeChessRuntimeSessionFixture,
  buildChatBridgeHistoryAndPreviewSessionFixture,
  buildChatBridgeIntelligentRoutingSessionFixture,
  buildChatBridgeLifecycleTourSessionFixture,
  buildPartialLifecycleSessionFixture,
  getChatBridgeLiveSeedFixtures,
} from './live-seeds'

describe('chatbridge live seed fixtures', () => {
  it('keeps the app-aware fixture thread history and active checkpoint explicit', () => {
    const fixture = buildAppAwareSessionFixture()

    expect(fixture.sessionInput.threads).toHaveLength(1)
    expect(fixture.sessionInput.messages.at(-1)?.contentParts.some((part) => part.type === 'app')).toBe(true)
    expect(fixture.historyThread.messages.at(-1)?.contentParts.some((part) => part.type === 'app')).toBe(true)
  })

  it('keeps the partial lifecycle fixture stale and intentionally incomplete', () => {
    const fixture = buildPartialLifecycleSessionFixture()
    const assistantMessage = fixture.messages.at(-1)
    const appPart = assistantMessage?.contentParts.find((part) => part.type === 'app')
    const toolCallPart = assistantMessage?.contentParts.find((part) => part.type === 'tool-call')

    expect(appPart && appPart.type === 'app' ? appPart.lifecycle : undefined).toBe('stale')
    expect(toolCallPart && toolCallPart.type === 'tool-call' ? toolCallPart.state : undefined).toBe('call')
    expect(toolCallPart && toolCallPart.type === 'tool-call' ? toolCallPart.result : undefined).toBeUndefined()
  })

  it('builds a lifecycle tour that covers every host shell state', () => {
    const fixture = buildChatBridgeLifecycleTourSessionFixture()
    const lifecycles = fixture.messages
      .flatMap((message) => message.contentParts)
      .filter((part) => part.type === 'app')
      .map((part) => part.lifecycle)

    expect(lifecycles).toEqual(['launching', 'ready', 'active', 'complete', 'stale', 'error'])
  })

  it('builds a degraded recovery fixture with explicit recovery metadata for each state', () => {
    const fixture = buildChatBridgeDegradedCompletionRecoverySessionFixture()
    const appParts = fixture.messages
      .flatMap((message) => message.contentParts)
      .filter((part) => part.type === 'app')

    expect(appParts).toHaveLength(3)
    expect(appParts.map((part) => part.statusText)).toEqual([
      'Partial completion',
      'Missing completion',
      'Invalid completion',
    ])
    expect(
      appParts.map((part) => part.values?.chatbridgeDegradedCompletion && typeof part.values?.chatbridgeDegradedCompletion === 'object')
    ).toEqual([true, true, true])
  })

  it('builds a platform recovery fixture with explicit host-owned failure contracts', () => {
    const fixture = buildChatBridgePlatformRecoverySessionFixture()
    const appParts = fixture.messages
      .flatMap((message) => message.contentParts)
      .filter((part) => part.type === 'app')

    expect(appParts).toHaveLength(5)
    expect(appParts.map((part) => part.statusText)).toEqual([
      'Timed out',
      'Runtime crash',
      'Invalid tool call',
      'Malformed event',
      'Bridge rejected',
    ])
    expect(
      appParts.map(
        (part) => part.values?.chatbridgeRecoveryContract && typeof part.values?.chatbridgeRecoveryContract === 'object'
      )
    ).toEqual([true, true, true, true, true])
  })

  it('builds a history plus preview fixture with renderable HTML and stored blobs', () => {
    const fixture = buildChatBridgeHistoryAndPreviewSessionFixture()
    const assistantMessage = fixture.sessionInput.messages.at(-1)
    const previewText =
      assistantMessage?.contentParts.find((part) => part.type === 'text' && part.text.includes('```html')) || null

    expect(fixture.sessionInput.threads).toHaveLength(1)
    expect(previewText).toBeTruthy()
    expect(fixture.blobEntries).toHaveLength(1)
    expect(fixture.blobEntries[0].key).toContain('fixture:msg-current-assistant:attachment')
  })

  it('builds a chess mid-game fixture with a validated host-owned board summary', () => {
    const fixture = buildChatBridgeChessMidGameSessionFixture()
    const assistantMessage = fixture.messages.find((message) => message.id === 'msg-chess-assistant-board')

    const appPart = assistantMessage?.contentParts.find((part) => part.type === 'app')

    expect(appPart && appPart.type === 'app' ? appPart.appId : undefined).toBe('chess')
    expect(appPart && appPart.type === 'app' ? appPart.lifecycle : undefined).toBe('active')
    expect(appPart && appPart.type === 'app' ? appPart.snapshot : undefined).toMatchObject({
      route: '/apps/chess',
      boardContext: {
        schemaVersion: 1,
        sideToMove: 'white',
        fullmoveNumber: 6,
      },
    })
  })

  it('builds a chess runtime fixture with a live board snapshot and seeded app records', () => {
    const fixture = buildChatBridgeChessRuntimeSessionFixture()
    const assistantMessage = fixture.messages.at(-1)
    const appPart = assistantMessage?.contentParts.find((part) => part.type === 'app')

    expect(appPart && appPart.type === 'app' ? appPart.appId : undefined).toBe('chess')
    expect(appPart && appPart.type === 'app' ? appPart.lifecycle : undefined).toBe('active')
    expect(fixture.chatBridgeAppRecords?.instances[0]).toMatchObject({
      appId: 'chess',
      status: 'active',
    })
    expect(fixture.chatBridgeAppRecords?.events).toHaveLength(3)
  })

  it('builds a Drawing Kit doodle dare fixture with a ready reviewed launch surface and seeded continuity', () => {
    const fixture = buildChatBridgeDrawingKitDoodleDareSessionFixture()
    const assistantMessage = fixture.messages.find((message) => message.id === 'msg-drawing-assistant')
    const appPart = assistantMessage?.contentParts.find((part) => part.type === 'app')

    expect(appPart && appPart.type === 'app' ? appPart.appId : undefined).toBe('drawing-kit')
    expect(appPart && appPart.type === 'app' ? appPart.lifecycle : undefined).toBe('ready')
    expect(appPart && appPart.type === 'app' ? appPart.values : undefined).toMatchObject({
      chatbridgeReviewedAppLaunch: {
        appId: 'drawing-kit',
        toolName: 'drawing_kit_open',
      },
    })
    expect(fixture.chatBridgeAppRecords?.instances[0]).toMatchObject({
      appId: 'drawing-kit',
      status: 'ready',
    })
    expect(fixture.chatBridgeAppRecords?.events).toHaveLength(2)
  })

  it('builds a Flashcard Studio study fixture with a ready reviewed launch surface and seeded continuity', () => {
    const fixture = buildChatBridgeFlashcardStudioStudySessionFixture()
    const assistantMessage = fixture.messages.find((message) => message.id === 'msg-flashcard-assistant')
    const appPart = assistantMessage?.contentParts.find((part) => part.type === 'app')

    expect(appPart && appPart.type === 'app' ? appPart.appId : undefined).toBe('flashcard-studio')
    expect(appPart && appPart.type === 'app' ? appPart.lifecycle : undefined).toBe('ready')
    expect(appPart && appPart.type === 'app' ? appPart.snapshot : undefined).toMatchObject({
      mode: 'study',
      studyStatus: 'studying',
      studyCounts: {
        easy: 1,
        medium: 0,
        hard: 1,
      },
    })
    expect(appPart && appPart.type === 'app' ? appPart.values : undefined).toMatchObject({
      chatbridgeReviewedAppLaunch: {
        appId: 'flashcard-studio',
        toolName: 'flashcard_studio_open',
      },
    })
    expect(fixture.chatBridgeAppRecords?.instances[0]).toMatchObject({
      appId: 'flashcard-studio',
      status: 'ready',
    })
    expect(fixture.chatBridgeAppRecords?.events).toHaveLength(2)
  })

  it('builds a Flashcard Studio Drive resume fixture with explicit reconnect metadata', () => {
    const fixture = buildChatBridgeFlashcardStudioDriveResumeSessionFixture()
    const assistantMessage = fixture.messages.find((message) => message.id === 'msg-flashcard-drive-assistant')
    const appPart = assistantMessage?.contentParts.find((part) => part.type === 'app')

    expect(appPart && appPart.type === 'app' ? appPart.appId : undefined).toBe('flashcard-studio')
    expect(appPart && appPart.type === 'app' ? appPart.lifecycle : undefined).toBe('ready')
    expect(appPart && appPart.type === 'app' ? appPart.snapshot : undefined).toMatchObject({
      mode: 'study',
      drive: {
        status: 'needs-auth',
        lastSavedDeckName: 'Biology review.chatbridge-flashcards.json',
        recentDecks: [
          {
            deckId: 'drive-deck-biology-review',
          },
        ],
      },
    })
    expect(fixture.chatBridgeAppRecords?.instances[0]).toMatchObject({
      appId: 'flashcard-studio',
      status: 'ready',
    })
    expect(fixture.chatBridgeAppRecords?.events).toHaveLength(2)
  })

  it('builds a Flashcard Studio Drive denied reconnect fixture that keeps the local deck open', () => {
    const fixture = buildChatBridgeFlashcardStudioDriveDeniedSessionFixture()
    const assistantMessage = fixture.messages.find((message) => message.id === 'msg-flashcard-drive-denied-assistant')
    const appPart = assistantMessage?.contentParts.find((part) => part.type === 'app')

    expect(appPart && appPart.type === 'app' ? appPart.appId : undefined).toBe('flashcard-studio')
    expect(appPart && appPart.type === 'app' ? appPart.lifecycle : undefined).toBe('ready')
    expect(appPart && appPart.type === 'app' ? appPart.snapshot : undefined).toMatchObject({
      mode: 'study',
      drive: {
        status: 'needs-auth',
        statusText: 'Reconnect Drive to resume',
        detail: 'Google Drive permission was not granted. Connect Drive when you want to save or reopen decks.',
        lastSavedDeckName: 'Biology review.chatbridge-flashcards.json',
      },
    })
    expect(fixture.chatBridgeAppRecords?.instances[0]).toMatchObject({
      appId: 'flashcard-studio',
      status: 'ready',
    })
  })

  it('builds a Flashcard Studio Drive expired auth fixture that keeps reconnect-required state explicit', () => {
    const fixture = buildChatBridgeFlashcardStudioDriveExpiredSessionFixture()
    const assistantMessage = fixture.messages.find((message) => message.id === 'msg-flashcard-drive-expired-assistant')
    const appPart = assistantMessage?.contentParts.find((part) => part.type === 'app')

    expect(appPart && appPart.type === 'app' ? appPart.appId : undefined).toBe('flashcard-studio')
    expect(appPart && appPart.type === 'app' ? appPart.lifecycle : undefined).toBe('ready')
    expect(appPart && appPart.type === 'app' ? appPart.snapshot : undefined).toMatchObject({
      mode: 'study',
      drive: {
        status: 'expired',
        statusText: 'Reconnect Drive to continue',
        lastSavedDeckName: 'Biology review.chatbridge-flashcards.json',
      },
    })
    expect((appPart && appPart.type === 'app' ? appPart.snapshot : undefined) as { resumeHint?: string }).toMatchObject({
      resumeHint: expect.stringContaining('Reconnect Drive to restore saved deck access.'),
    })
    expect(fixture.chatBridgeAppRecords?.instances[0]).toMatchObject({
      appId: 'flashcard-studio',
      status: 'ready',
    })
  })

  it('builds a Weather Dashboard fixture with a ready reviewed launch surface and restartable continuity', () => {
    const fixture = buildChatBridgeWeatherDashboardSessionFixture()
    const assistantMessage = fixture.messages.find((message) => message.id === 'msg-weather-assistant')
    const appPart = assistantMessage?.contentParts.find((part) => part.type === 'app')

    expect(appPart && appPart.type === 'app' ? appPart.appId : undefined).toBe('weather-dashboard')
    expect(appPart && appPart.type === 'app' ? appPart.lifecycle : undefined).toBe('ready')
    expect(appPart && appPart.type === 'app' ? appPart.values : undefined).toMatchObject({
      chatbridgeReviewedAppLaunch: {
        appId: 'weather-dashboard',
        toolName: 'weather_dashboard_open',
        location: 'Chicago',
      },
    })
    expect(fixture.chatBridgeAppRecords?.instances[0]).toMatchObject({
      appId: 'weather-dashboard',
      status: 'ready',
    })
    expect(fixture.chatBridgeAppRecords?.events).toHaveLength(2)
  })

  it('builds an intelligent routing fixture with semantic invoke receipts and an ambiguous clarify receipt', () => {
    const fixture = buildChatBridgeIntelligentRoutingSessionFixture()
    const appParts = fixture.messages
      .flatMap((message) => message.contentParts)
      .filter((part): part is Extract<(typeof fixture.messages)[number]['contentParts'][number], { type: 'app' }> => part.type === 'app')
    const semanticReasonCodes = appParts.slice(0, 3).map(
      (part) => (part.values?.chatbridgeRouteDecision as { reasonCode?: string } | undefined)?.reasonCode
    )

    expect(appParts).toHaveLength(4)
    expect(appParts.map((part) => part.title)).toEqual([
      'Flashcard Studio is ready',
      'Drawing Kit is ready',
      'Weather Dashboard is ready',
      'Choose the next step',
    ])
    expect(semanticReasonCodes).toEqual([
      'semantic-app-match',
      'semantic-app-match',
      'semantic-app-match',
    ])
  })

  it('publishes the live seed catalog with stable scenario ids', () => {
    const fixtures = getChatBridgeLiveSeedFixtures()

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      'lifecycle-tour',
      'degraded-completion-recovery',
      'platform-recovery',
      'chess-mid-game-board-context',
      'drawing-kit-doodle-dare',
      'flashcard-studio-study-mode',
      'flashcard-studio-drive-resume',
      'flashcard-studio-drive-denied',
      'flashcard-studio-drive-expired',
      'weather-dashboard',
      'chess-runtime',
      'runtime-and-route-receipt',
      'intelligent-routing',
      'history-and-preview',
    ])
    expect(fixtures.find((fixture) => fixture.id === 'drawing-kit-doodle-dare')).toMatchObject({
      fixtureRole: 'active-flagship',
      smokeSupport: 'supported',
    })
    expect(fixtures.find((fixture) => fixture.id === 'flashcard-studio-study-mode')).toMatchObject({
      fixtureRole: 'active-flagship',
      smokeSupport: 'supported',
    })
    expect(fixtures.find((fixture) => fixture.id === 'flashcard-studio-drive-resume')).toMatchObject({
      fixtureRole: 'active-flagship',
      smokeSupport: 'supported',
    })
    expect(fixtures.find((fixture) => fixture.id === 'flashcard-studio-drive-denied')).toMatchObject({
      fixtureRole: 'platform-regression',
      smokeSupport: 'supported',
    })
    expect(fixtures.find((fixture) => fixture.id === 'flashcard-studio-drive-expired')).toMatchObject({
      fixtureRole: 'platform-regression',
      smokeSupport: 'supported',
    })
    expect(fixtures.find((fixture) => fixture.id === 'weather-dashboard')).toMatchObject({
      fixtureRole: 'active-flagship',
      smokeSupport: 'supported',
    })
    expect(fixtures.find((fixture) => fixture.id === 'chess-runtime')).toMatchObject({
      fixtureRole: 'active-flagship',
      smokeSupport: 'supported',
    })
    expect(fixtures.find((fixture) => fixture.id === 'runtime-and-route-receipt')).toMatchObject({
      fixtureRole: 'platform-regression',
      smokeSupport: 'supported',
    })
    expect(fixtures.find((fixture) => fixture.id === 'intelligent-routing')).toMatchObject({
      fixtureRole: 'platform-regression',
      smokeSupport: 'supported',
    })
    expect(fixtures.find((fixture) => fixture.id === 'history-and-preview')).toMatchObject({
      fixtureRole: 'legacy-reference',
      smokeSupport: 'legacy-reference',
    })
  })
})
