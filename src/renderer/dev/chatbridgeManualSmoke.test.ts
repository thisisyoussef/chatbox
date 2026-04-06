/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  endRun: vi.fn(async () => undefined),
  startRun: vi.fn(async () => ({
    runId: 'manual-run-1',
    end: mocks.endRun,
  })),
  invoke: vi.fn(async (channel: string) => {
    if (channel === 'langsmith:get-status') {
      return {
        enabled: true,
        projectName: 'chatbox-chatbridge',
        reason: 'enabled',
      }
    }

    throw new Error(`Unexpected channel: ${channel}`)
  }),
}))

vi.mock('@/adapters/langsmith', () => ({
  langsmith: {
    startRun: mocks.startRun,
  },
}))

import { getChatBridgeLiveSeedFixtures } from '@shared/chatbridge/live-seeds'
import {
  finishChatBridgeManualSmokeTrace,
  getChatBridgeManualSmokeFixtureMode,
  getChatBridgeManualSmokeTraceSupport,
  startChatBridgeManualSmokeTrace,
} from './chatbridgeManualSmoke'

describe('chatbridge manual smoke tracing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'electronAPI', {
      value: {
        invoke: mocks.invoke,
      },
      configurable: true,
      writable: true,
    })
  })

  it('reports desktop tracing as unsupported when the Electron bridge is unavailable', async () => {
    Object.defineProperty(window, 'electronAPI', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    await expect(getChatBridgeManualSmokeTraceSupport()).resolves.toMatchObject({
      enabled: false,
      reasonCode: 'renderer-ipc-unavailable',
      runtimeTarget: 'desktop-electron',
      supportState: 'supported',
    })
  })

  it('marks the Story Builder preview fixture as a legacy reference instead of active smoke coverage', () => {
    expect(getChatBridgeManualSmokeFixtureMode('history-and-preview')).toMatchObject({
      support: 'legacy',
      reasonCode: 'legacy-reference',
    })
  })

  it('starts and finishes a traced smoke run for supported Chess fixtures', async () => {
    const fixture = getChatBridgeLiveSeedFixtures().find((candidate) => candidate.id === 'chess-runtime')
    expect(fixture).toBeTruthy()
    if (!fixture) {
      return
    }

    const started = await startChatBridgeManualSmokeTrace(fixture, 'seeded-session-42')

    expect(started).toMatchObject({
      status: 'started',
      traceId: 'manual-run-1',
      traceLabel: expect.stringContaining('chatbridge.manual_smoke.chatbridge-chess-runtime'),
      support: {
        enabled: true,
        runtimeTarget: 'desktop-electron',
        supportState: 'supported',
      },
      run: {
        fixtureId: 'chess-runtime',
        runId: 'manual-run-1',
        projectName: 'chatbox-chatbridge',
      },
    })
    expect(mocks.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringContaining('chatbridge.manual_smoke.chatbridge-chess-runtime'),
        runType: 'chain',
        inputs: expect.objectContaining({
          fixtureId: 'chess-runtime',
          sessionId: 'seeded-session-42',
        }),
        metadata: expect.objectContaining({
          runtimeTarget: 'desktop-electron',
          smokeSupport: 'supported',
        }),
        tags: expect.arrayContaining(['runtime-target:desktop-electron', 'smoke-support:supported']),
      })
    )

    await expect(finishChatBridgeManualSmokeTrace('manual-run-1', 'passed')).resolves.toBe(true)
    expect(mocks.endRun).toHaveBeenCalledWith(
      expect.objectContaining({
        outputs: expect.objectContaining({
          outcome: 'passed',
          fixtureId: 'chess-runtime',
        }),
      })
    )
  })

  it('marks the Drawing Kit doodle fixture as a supported CB-509 smoke path', async () => {
    expect(getChatBridgeManualSmokeFixtureMode('drawing-kit-doodle-dare')).toMatchObject({
      support: 'supported',
      descriptor: expect.objectContaining({
        slug: 'chatbridge-drawing-kit-doodle-dare',
        storyId: 'CB-509',
      }),
    })

    const fixture = getChatBridgeLiveSeedFixtures().find((candidate) => candidate.id === 'drawing-kit-doodle-dare')
    expect(fixture).toBeTruthy()
    if (!fixture) {
      return
    }

    await expect(startChatBridgeManualSmokeTrace(fixture, 'seeded-session-drawing')).resolves.toMatchObject({
      status: 'started',
      traceId: 'manual-run-1',
      traceLabel: expect.stringContaining('chatbridge.manual_smoke.chatbridge-drawing-kit-doodle-dare'),
      run: {
        fixtureId: 'drawing-kit-doodle-dare',
      },
    })

    expect(mocks.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          fixtureId: 'drawing-kit-doodle-dare',
          storyId: 'CB-509',
        }),
        tags: expect.arrayContaining(['cb-509', 'seed-lab']),
      })
    )

    await expect(finishChatBridgeManualSmokeTrace('manual-run-1', 'passed')).resolves.toBe(true)
  })

  it('marks the Flashcard Studio study fixture as a supported SC-006B smoke path', async () => {
    expect(getChatBridgeManualSmokeFixtureMode('flashcard-studio-study-mode')).toMatchObject({
      support: 'supported',
      descriptor: expect.objectContaining({
        slug: 'chatbridge-flashcard-studio-study-mode',
        storyId: 'SC-006B',
      }),
    })

    const fixture = getChatBridgeLiveSeedFixtures().find((candidate) => candidate.id === 'flashcard-studio-study-mode')
    expect(fixture).toBeTruthy()
    if (!fixture) {
      return
    }

    await expect(startChatBridgeManualSmokeTrace(fixture, 'seeded-session-flashcard')).resolves.toMatchObject({
      status: 'started',
      traceId: 'manual-run-1',
      traceLabel: expect.stringContaining('chatbridge.manual_smoke.chatbridge-flashcard-studio-study-mode'),
      run: {
        fixtureId: 'flashcard-studio-study-mode',
      },
    })

    expect(mocks.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          fixtureId: 'flashcard-studio-study-mode',
          storyId: 'SC-006B',
        }),
        tags: expect.arrayContaining(['sc-006b', 'seed-lab']),
      })
    )

    await expect(finishChatBridgeManualSmokeTrace('manual-run-1', 'passed')).resolves.toBe(true)
  })

  it('marks the Flashcard Studio Drive resume fixture as a supported SC-007A smoke path', async () => {
    expect(getChatBridgeManualSmokeFixtureMode('flashcard-studio-drive-resume')).toMatchObject({
      support: 'supported',
      descriptor: expect.objectContaining({
        slug: 'chatbridge-flashcard-studio-drive-resume',
        storyId: 'SC-007A',
      }),
    })

    const fixture = getChatBridgeLiveSeedFixtures().find((candidate) => candidate.id === 'flashcard-studio-drive-resume')
    expect(fixture).toBeTruthy()
    if (!fixture) {
      return
    }

    await expect(startChatBridgeManualSmokeTrace(fixture, 'seeded-session-flashcard-drive')).resolves.toMatchObject({
      status: 'started',
      traceId: 'manual-run-1',
      traceLabel: expect.stringContaining('chatbridge.manual_smoke.chatbridge-flashcard-studio-drive-resume'),
      run: {
        fixtureId: 'flashcard-studio-drive-resume',
      },
    })

    expect(mocks.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          fixtureId: 'flashcard-studio-drive-resume',
          storyId: 'SC-007A',
        }),
        tags: expect.arrayContaining(['sc-007a', 'seed-lab']),
      })
    )

    await expect(finishChatBridgeManualSmokeTrace('manual-run-1', 'passed')).resolves.toBe(true)
  })

  it('marks the Flashcard Studio Drive denied reconnect fixture as a supported SC-007B smoke path', async () => {
    expect(getChatBridgeManualSmokeFixtureMode('flashcard-studio-drive-denied')).toMatchObject({
      support: 'supported',
      descriptor: expect.objectContaining({
        slug: 'chatbridge-flashcard-studio-drive-denied',
        storyId: 'SC-007B',
      }),
    })

    const fixture = getChatBridgeLiveSeedFixtures().find((candidate) => candidate.id === 'flashcard-studio-drive-denied')
    expect(fixture).toBeTruthy()
    if (!fixture) {
      return
    }

    await expect(startChatBridgeManualSmokeTrace(fixture, 'seeded-session-flashcard-drive-denied')).resolves.toMatchObject({
      status: 'started',
      traceId: 'manual-run-1',
      traceLabel: expect.stringContaining('chatbridge.manual_smoke.chatbridge-flashcard-studio-drive-denied'),
      run: {
        fixtureId: 'flashcard-studio-drive-denied',
      },
    })

    expect(mocks.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          fixtureId: 'flashcard-studio-drive-denied',
          storyId: 'SC-007B',
        }),
        tags: expect.arrayContaining(['sc-007b', 'seed-lab']),
      })
    )

    await expect(finishChatBridgeManualSmokeTrace('manual-run-1', 'passed')).resolves.toBe(true)
  })

  it('marks the Intelligent routing fixture as a supported SC-002A smoke path', async () => {
    expect(getChatBridgeManualSmokeFixtureMode('intelligent-routing')).toMatchObject({
      support: 'supported',
      descriptor: expect.objectContaining({
        slug: 'chatbridge-intelligent-routing',
        storyId: 'SC-002A',
      }),
    })

    const fixture = getChatBridgeLiveSeedFixtures().find((candidate) => candidate.id === 'intelligent-routing')
    expect(fixture).toBeTruthy()
    if (!fixture) {
      return
    }

    await expect(startChatBridgeManualSmokeTrace(fixture, 'seeded-session-intelligent-routing')).resolves.toMatchObject({
      status: 'started',
      traceId: 'manual-run-1',
      traceLabel: expect.stringContaining('chatbridge.manual_smoke.chatbridge-intelligent-routing'),
      run: {
        fixtureId: 'intelligent-routing',
      },
    })
  })

  it('marks the Flashcard Studio Drive expired auth fixture as a supported SC-007B smoke path', async () => {
    expect(getChatBridgeManualSmokeFixtureMode('flashcard-studio-drive-expired')).toMatchObject({
      support: 'supported',
      descriptor: expect.objectContaining({
        slug: 'chatbridge-flashcard-studio-drive-expired',
        storyId: 'SC-007B',
      }),
    })

    const fixture = getChatBridgeLiveSeedFixtures().find((candidate) => candidate.id === 'flashcard-studio-drive-expired')
    expect(fixture).toBeTruthy()
    if (!fixture) {
      return
    }

    await expect(startChatBridgeManualSmokeTrace(fixture, 'seeded-session-flashcard-drive-expired')).resolves.toMatchObject({
      status: 'started',
      traceId: 'manual-run-1',
      traceLabel: expect.stringContaining('chatbridge.manual_smoke.chatbridge-flashcard-studio-drive-expired'),
      run: {
        fixtureId: 'flashcard-studio-drive-expired',
      },
    })

    expect(mocks.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          fixtureId: 'flashcard-studio-drive-expired',
          storyId: 'SC-007B',
        }),
        tags: expect.arrayContaining(['sc-007b', 'seed-lab']),
      })
    )

    await expect(finishChatBridgeManualSmokeTrace('manual-run-1', 'passed')).resolves.toBe(true)
  })

  it('marks the Weather Dashboard fixture as a supported CB-510 smoke path', async () => {
    expect(getChatBridgeManualSmokeFixtureMode('weather-dashboard')).toMatchObject({
      support: 'supported',
      descriptor: expect.objectContaining({
        slug: 'chatbridge-weather-dashboard',
        storyId: 'CB-510',
      }),
    })

    const fixture = getChatBridgeLiveSeedFixtures().find((candidate) => candidate.id === 'weather-dashboard')
    expect(fixture).toBeTruthy()
    if (!fixture) {
      return
    }

    await expect(startChatBridgeManualSmokeTrace(fixture, 'seeded-session-weather')).resolves.toMatchObject({
      status: 'started',
      traceId: 'manual-run-1',
      traceLabel: expect.stringContaining('chatbridge.manual_smoke.chatbridge-weather-dashboard'),
      run: {
        fixtureId: 'weather-dashboard',
      },
    })

    expect(mocks.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          fixtureId: 'weather-dashboard',
          storyId: 'CB-510',
        }),
        tags: expect.arrayContaining(['cb-510', 'seed-lab']),
      })
    )

    await expect(finishChatBridgeManualSmokeTrace('manual-run-1', 'passed')).resolves.toBe(true)
  })

  it('returns an explicit unsupported smoke result for legacy reference fixtures', async () => {
    const fixture = getChatBridgeLiveSeedFixtures().find((candidate) => candidate.id === 'history-and-preview')
    expect(fixture).toBeTruthy()
    if (!fixture) {
      return
    }

    await expect(startChatBridgeManualSmokeTrace(fixture, 'seeded-session-legacy')).resolves.toMatchObject({
      status: 'unsupported',
      traceId: null,
      traceLabel: null,
      support: {
        enabled: false,
        runtimeTarget: 'desktop-electron',
        supportState: 'legacy-reference',
        reasonCode: 'legacy-reference',
      },
    })
    expect(mocks.startRun).not.toHaveBeenCalled()
  })
})
