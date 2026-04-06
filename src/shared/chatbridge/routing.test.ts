import { describe, expect, it } from 'vitest'
import type { ReviewedAppEligibilityDecision, ReviewedAppRouterCandidate } from './eligibility'
import type { ReviewedAppCatalogEntry } from './manifest'
import { createChatBridgeRouteMessagePart, resolveReviewedAppRouteDecision } from './routing'

function createCandidate(
  overrides: {
    manifest?: Partial<ReviewedAppCatalogEntry['manifest']>
    approval?: Partial<ReviewedAppCatalogEntry['approval']>
    matchedContexts?: string[]
  } = {}
): ReviewedAppRouterCandidate {
  const base: ReviewedAppRouterCandidate = {
    entry: {
      manifest: {
        appId: 'story-builder',
        name: 'Story Builder',
        version: '1.2.3',
        protocolVersion: 1,
        origin: 'https://apps.example.com',
        uiEntry: 'https://apps.example.com/story-builder',
        authMode: 'oauth',
        permissions: [
          {
            id: 'drive.read',
            resource: 'drive',
            access: 'read',
            required: true,
            purpose: 'Resume and save reviewed story drafts.',
          },
        ],
        toolSchemas: [
          {
            name: 'story_builder_resume',
            title: 'Story Builder resume',
            description: 'Resume a story draft, chapter outline, or narrative revision.',
            schemaVersion: 1,
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
        supportedEvents: ['host.init', 'app.ready', 'app.state', 'app.complete', 'app.requestAuth'],
        completionModes: ['summary', 'handoff'],
        timeouts: {
          launchMs: 15_000,
          idleMs: 120_000,
          completionMs: 10_000,
        },
        safetyMetadata: {
          reviewed: true,
          sandbox: 'hosted-iframe',
          handlesStudentData: true,
          requiresTeacherApproval: true,
        },
        launchSurfaces: {
          'desktop-electron': {
            sandbox: 'hosted-iframe',
          },
        },
        tenantAvailability: {
          default: 'enabled',
          allow: [],
          deny: [],
        },
      },
      approval: {
        status: 'approved',
        reviewedAt: 1_711_930_000_000,
        reviewedBy: 'platform-review',
        catalogVersion: 3,
      },
    },
    matchedContexts: [],
  }

  return {
    ...base,
    entry: {
      ...base.entry,
      manifest: {
        ...base.entry.manifest,
        ...overrides.manifest,
      },
      approval: {
        ...base.entry.approval,
        ...overrides.approval,
      },
    },
    matchedContexts: overrides.matchedContexts ?? base.matchedContexts,
  }
}

describe('resolveReviewedAppRouteDecision', () => {
  it('returns invoke when the user explicitly names a reviewed app', () => {
    const decision = resolveReviewedAppRouteDecision(
      [createCandidate()],
      'Open Story Builder and continue the chapter draft.',
      {
        hostRuntime: 'desktop-electron',
      }
    )

    expect(decision.kind).toBe('invoke')
    expect(decision.reasonCode).toBe('explicit-app-match')
    expect(decision.selectedAppId).toBe('story-builder')
    expect(decision.matches[0]?.appName).toBe('Story Builder')
  })

  it('returns clarify when the prompt could fit multiple reviewed apps', () => {
    const decision = resolveReviewedAppRouteDecision(
      [
        createCandidate(),
        createCandidate({
          manifest: {
            appId: 'debate-arena',
            name: 'Debate Arena',
            uiEntry: 'https://apps.example.com/debate-arena',
            authMode: 'none',
            permissions: [],
            toolSchemas: [
              {
                name: 'debate_arena_round',
                title: 'Debate Arena round',
                description: 'Open a debate round, draft claims, rebuttals, and opening statements.',
                schemaVersion: 1,
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
            ],
            supportedEvents: ['host.init', 'app.ready', 'app.state', 'app.complete'],
            safetyMetadata: {
              reviewed: true,
              sandbox: 'hosted-iframe',
              handlesStudentData: false,
              requiresTeacherApproval: false,
            },
          },
        }),
      ],
      'Help me draft an opening statement and rebuttal for class.',
      {
        hostRuntime: 'desktop-electron',
      }
    )

    expect(decision.kind).toBe('clarify')
    expect(decision.reasonCode).toBe('ambiguous-match')
    expect(decision.selectedAppId).toBe('debate-arena')
    expect(decision.matches.map((match) => match.appId)).toEqual(['debate-arena', 'story-builder'])
  })

  it('returns refuse when no reviewed app is a confident fit', () => {
    const decision = resolveReviewedAppRouteDecision([createCandidate()], 'What should I cook for dinner tonight?', {
      hostRuntime: 'desktop-electron',
    })

    expect(decision.kind).toBe('refuse')
    expect(decision.reasonCode).toBe('no-confident-match')
    expect(decision.selectedAppId).toBeUndefined()
  })

  it('keeps zero-score alternates out of clarify matches', () => {
    const decision = resolveReviewedAppRouteDecision(
      [
        createCandidate({
          manifest: {
            appId: 'debate-arena',
            name: 'Debate Arena',
            uiEntry: 'https://apps.example.com/debate-arena',
            authMode: 'none',
            permissions: [],
            toolSchemas: [
              {
                name: 'debate_arena_round',
                title: 'Debate Arena round',
                description: 'Open a debate round, draft claims, rebuttals, and opening statements.',
                schemaVersion: 1,
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
            ],
            supportedEvents: ['host.init', 'app.ready', 'app.state', 'app.complete'],
            safetyMetadata: {
              reviewed: true,
              sandbox: 'hosted-iframe',
              handlesStudentData: false,
              requiresTeacherApproval: false,
            },
          },
        }),
        createCandidate({
          manifest: {
            appId: 'weather-dashboard',
            name: 'Weather Dashboard',
            uiEntry: 'https://apps.example.com/weather-dashboard',
            authMode: 'none',
            permissions: [],
            toolSchemas: [
              {
                name: 'weather_dashboard_open',
                title: 'Open Weather Dashboard',
                description: 'Show forecast changes, current conditions, and weather alerts.',
                schemaVersion: 1,
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
            ],
            supportedEvents: ['host.init', 'app.ready', 'app.state', 'app.complete'],
            safetyMetadata: {
              reviewed: true,
              sandbox: 'hosted-iframe',
              handlesStudentData: false,
              requiresTeacherApproval: false,
            },
          },
        }),
      ],
      'Help me draft an opening statement and rebuttal for class.',
      {
        hostRuntime: 'desktop-electron',
      }
    )

    expect(decision.kind).toBe('clarify')
    expect(decision.matches.map((match) => match.appId)).toEqual(['debate-arena'])
  })

  it('can upgrade a low-lexical study request into a semantic invoke for Flashcard Studio', () => {
    const decision = resolveReviewedAppRouteDecision(
      [
        createCandidate({
          manifest: {
            appId: 'flashcard-studio',
            name: 'Flashcard Studio',
            uiEntry: 'https://apps.example.com/flashcard-studio',
            authMode: 'oauth',
            permissions: [
              {
                id: 'drive.read',
                resource: 'drive',
                access: 'read',
                required: true,
                purpose: 'Reopen saved flashcard decks.',
              },
            ],
            toolSchemas: [
              {
                name: 'flashcard_studio_open',
                title: 'Open Flashcard Studio',
                description: 'Create, edit, study, and review flashcards in a deck.',
                schemaVersion: 1,
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
            ],
            supportedEvents: ['host.init', 'app.ready', 'app.state', 'app.complete', 'app.requestAuth'],
            safetyMetadata: {
              reviewed: true,
              sandbox: 'hosted-iframe',
              handlesStudentData: true,
              requiresTeacherApproval: false,
            },
          },
        }),
      ],
      'I need to cram biology terms before tomorrow\'s quiz.',
      {
        hostRuntime: 'desktop-electron',
        semanticHint: {
          decision: 'invoke',
          selectedAppId: 'flashcard-studio',
          alternateAppIds: [],
          confidence: 'high',
          rationale: 'The user wants to study before a quiz.',
        },
      }
    )

    expect(decision).toMatchObject({
      kind: 'invoke',
      reasonCode: 'semantic-app-match',
      selectedAppId: 'flashcard-studio',
    })
    expect(decision.matches[0]).toMatchObject({
      appId: 'flashcard-studio',
    })
  })

  it('can preserve a semantic clarify between Drawing Kit and Weather Dashboard', () => {
    const decision = resolveReviewedAppRouteDecision(
      [
        createCandidate({
          manifest: {
            appId: 'drawing-kit',
            name: 'Drawing Kit',
            uiEntry: 'https://apps.example.com/drawing-kit',
            authMode: 'none',
            permissions: [],
            toolSchemas: [
              {
                name: 'drawing_kit_open',
                title: 'Open Drawing Kit',
                description: 'Sketch posters, doodles, and diagrams in-thread.',
                schemaVersion: 1,
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
            ],
            supportedEvents: ['host.init', 'app.ready', 'app.state', 'app.complete'],
            safetyMetadata: {
              reviewed: true,
              sandbox: 'hosted-iframe',
              handlesStudentData: false,
              requiresTeacherApproval: false,
            },
          },
        }),
        createCandidate({
          manifest: {
            appId: 'weather-dashboard',
            name: 'Weather Dashboard',
            uiEntry: 'https://apps.example.com/weather-dashboard',
            authMode: 'none',
            permissions: [],
            toolSchemas: [
              {
                name: 'weather_dashboard_open',
                title: 'Open Weather Dashboard',
                description: 'Inspect current conditions and forecast changes.',
                schemaVersion: 1,
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
            ],
            supportedEvents: ['host.init', 'app.ready', 'app.state', 'app.complete'],
            safetyMetadata: {
              reviewed: true,
              sandbox: 'hosted-iframe',
              handlesStudentData: false,
              requiresTeacherApproval: false,
            },
          },
        }),
      ],
      'Help me sketch a weather-themed poster.',
      {
        hostRuntime: 'desktop-electron',
        semanticHint: {
          decision: 'clarify',
          selectedAppId: 'drawing-kit',
          alternateAppIds: ['weather-dashboard'],
          confidence: 'medium',
          rationale: 'The user could be asking for a visual sketch or a forecast view.',
        },
      }
    )

    expect(decision).toMatchObject({
      kind: 'clarify',
      reasonCode: 'ambiguous-match',
      selectedAppId: 'drawing-kit',
    })
    expect(decision.matches.map((match) => match.appId)).toEqual(['drawing-kit', 'weather-dashboard'])
  })

  it('can build a host-owned message artifact from the routing decision', () => {
    const decision = resolveReviewedAppRouteDecision(
      [createCandidate()],
      'Maybe Story Builder can help with this outline.',
      {
        hostRuntime: 'desktop-electron',
      }
    )

    const part = createChatBridgeRouteMessagePart(decision)

    expect(part.type).toBe('app')
    expect(part.lifecycle).toBe('ready')
    expect(part.values?.chatbridgeRouteDecision).toMatchObject({
      kind: decision.kind,
      prompt: decision.prompt,
    })
    expect(part.statusText).toBe('Launch app')
  })

  it('returns a runtime-unsupported refusal when the top reviewed-app match is blocked on the current host runtime', () => {
    const storyBuilder = createCandidate()
    const blockedDecision: ReviewedAppEligibilityDecision = {
      entry: storyBuilder.entry,
      eligible: false,
      matchedContexts: [],
      reasons: [
        {
          code: 'runtime-unsupported',
          message: 'Story Builder is not available in the current host runtime.',
          details: ['current runtime: Web browser', 'supported runtimes: Desktop app'],
        },
      ],
    }

    const decision = resolveReviewedAppRouteDecision([], 'Open Story Builder and continue the outline draft.', {
      excluded: [blockedDecision],
      hostRuntime: 'web-browser',
    })
    const part = createChatBridgeRouteMessagePart(decision)

    expect(decision).toMatchObject({
      kind: 'refuse',
      reasonCode: 'runtime-unsupported',
      selectedAppId: 'story-builder',
      runtimeBlock: {
        hostRuntime: 'web-browser',
        supportedHostRuntimes: ['desktop-electron'],
      },
    })
    expect(part.lifecycle).toBe('error')
    expect(part.statusText).toBe('Desktop only')
    expect(part.fallbackText).toContain('Current runtime: Web browser')
    expect(part.fallbackText).toContain('Supported runtimes: Desktop app')
  })
})
