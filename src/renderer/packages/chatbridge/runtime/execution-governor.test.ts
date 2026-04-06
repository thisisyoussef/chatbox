import '../../../../../test/integration/chatbridge/setup'

import type { ToolSet } from 'ai'
import { tool } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { ModelInterface } from '@shared/models/types'
import type { Message, MessageInfoPart, StreamTextResult } from '@shared/types'
import { prepareChatBridgeExecutionGovernor, normalizeChatBridgeExecutionGovernorContentParts } from './execution-governor'

function createTextMessage(id: string, text: string): Message {
  return {
    id,
    role: 'user',
    timestamp: 1,
    contentParts: [{ type: 'text', text }],
  }
}

function createBaseTools(): ToolSet {
  return {
    ping: tool({
      description: 'Ping the host.',
      inputSchema: z.object({}),
      execute: async () => ({
        ok: true,
      }),
    }),
  }
}

function createRoutingModel(responseText = ''): ModelInterface {
  const contentParts: StreamTextResult['contentParts'] = responseText ? [{ type: 'text', text: responseText }] : []

  return {
    name: 'Routing Governor Test Model',
    modelId: 'routing-governor-test-model',
    isSupportVision: () => true,
    isSupportToolUse: () => true,
    isSupportSystemMessage: () => true,
    chat: vi.fn(async () => ({
      contentParts,
    })),
    chatStream: vi.fn(async function* () {}),
    paint: vi.fn(async () => []),
  }
}

describe('ChatBridge renderer execution governor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps tool-use-disabled turns bounded while still returning the wrapped base tool set', async () => {
    const traceAdapter = {
      recordEvent: vi.fn(async () => undefined),
    }

    const result = await prepareChatBridgeExecutionGovernor({
      messages: [createTextMessage('msg-no-tools', 'hello there')],
      model: createRoutingModel(),
      baseTools: createBaseTools(),
      modelSupportsToolUse: false,
      sessionId: 'session-no-tools',
      traceAdapter,
      traceParentRunId: 'renderer-run-no-tools',
      correlationMetadata: {
        session_id: 'session-no-tools',
      },
    })

    expect(Object.keys(result.tools)).toEqual(['ping'])
    expect(result.reviewedRouteArtifact).toBeUndefined()
    expect(result.routeResolution).toBeUndefined()
    expect(traceAdapter.recordEvent).not.toHaveBeenCalled()
  })

  it('prepares an invoke resolution for an explicit Drawing Kit request and emits the stable route-decision trace event', async () => {
    const traceAdapter = {
      recordEvent: vi.fn(async () => undefined),
    }

    const result = await prepareChatBridgeExecutionGovernor({
      messages: [createTextMessage('msg-drawing', 'Open Drawing Kit and start a sticky-note doodle dare.')],
      model: createRoutingModel(),
      baseTools: {},
      modelSupportsToolUse: true,
      sessionId: 'session-drawing',
      traceAdapter,
      traceParentRunId: 'renderer-run-drawing',
      correlationMetadata: {
        session_id: 'session-drawing',
      },
    })

    expect(Object.keys(result.tools)).toEqual(['drawing_kit_open'])
    expect(result.reviewedRouteArtifact).toBeUndefined()
    expect(result.routeResolution).toMatchObject({
      routeDecision: {
        kind: 'invoke',
        selectedAppId: 'drawing-kit',
      },
      selectionSource: 'route-decision',
      routingStrategy: 'lexical',
      semanticClassifierStatus: 'not-attempted',
      toolNames: ['drawing_kit_open'],
      tracePayload: {
        decisionKind: 'invoke',
        selectedAppId: 'drawing-kit',
        selectionSource: 'route-decision',
        routingStrategy: 'lexical',
        semanticClassifierStatus: 'not-attempted',
        toolNames: ['drawing_kit_open'],
        artifactInserted: false,
        artifactKind: null,
      },
    })
    expect(traceAdapter.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'chatbridge.routing.reviewed-app-decision',
        parentRunId: 'renderer-run-drawing',
        outputs: expect.objectContaining({
          decisionKind: 'invoke',
          selectedAppId: 'drawing-kit',
          selectionSource: 'route-decision',
          routingStrategy: 'lexical',
          semanticClassifierStatus: 'not-attempted',
          toolNames: ['drawing_kit_open'],
        }),
      })
    )
  })

  it('prepares a clarify artifact for an ambiguous active-app request without mounting reviewed tools', async () => {
    const traceAdapter = {
      recordEvent: vi.fn(async () => undefined),
    }

    const result = await prepareChatBridgeExecutionGovernor({
      messages: [createTextMessage('msg-clarify', 'Help me sketch a weather-themed poster.')],
      model: createRoutingModel(
        JSON.stringify({
          decision: 'clarify',
          selectedAppId: 'drawing-kit',
          alternateAppIds: ['weather-dashboard'],
          confidence: 'medium',
          rationale: 'The request could fit a drawing surface or a weather view.',
        })
      ),
      baseTools: {},
      modelSupportsToolUse: true,
      sessionId: 'session-clarify',
      traceAdapter,
      traceParentRunId: 'renderer-run-clarify',
      correlationMetadata: {
        session_id: 'session-clarify',
      },
    })

    expect(Object.keys(result.tools)).toEqual([])
    expect(result.reviewedRouteArtifact).toMatchObject({
      type: 'app',
      title: 'Choose the next step',
      values: {
        chatbridgeRouteDecision: {
          kind: 'clarify',
        },
      },
    })
    expect(result.routeResolution).toMatchObject({
      routeDecision: {
        kind: 'clarify',
      },
      routingStrategy: 'semantic',
      semanticClassifierStatus: 'accepted',
      toolNames: [],
      tracePayload: {
        decisionKind: 'clarify',
        routingStrategy: 'semantic',
        semanticClassifierStatus: 'accepted',
        artifactInserted: true,
        artifactKind: 'clarify',
      },
    })
  })

  it('keeps route-decision trace failures non-fatal for the governor preparation step', async () => {
    const traceAdapter = {
      recordEvent: vi.fn(async () => {
        throw new Error('LangSmith unavailable')
      }),
    }

    await expect(
      prepareChatBridgeExecutionGovernor({
        messages: [createTextMessage('msg-refuse', 'What should I cook for dinner tonight?')],
        model: createRoutingModel(),
        baseTools: {},
        modelSupportsToolUse: true,
        sessionId: 'session-refuse',
        traceAdapter,
        traceParentRunId: 'renderer-run-refuse',
        correlationMetadata: {
          session_id: 'session-refuse',
        },
      })
    ).resolves.toBeTruthy()
  })

  it('normalizes info parts, route artifacts, and content parts through the governor helper', async () => {
    const infoPart: MessageInfoPart = {
      type: 'info',
      text: 'OCR completed for the attached image.',
    }
    const { reviewedRouteArtifact } = await prepareChatBridgeExecutionGovernor({
      messages: [createTextMessage('msg-route', 'What should I cook for dinner tonight?')],
      model: createRoutingModel(),
      baseTools: {},
      modelSupportsToolUse: true,
      sessionId: 'session-route',
      traceAdapter: {
        recordEvent: vi.fn(async () => undefined),
      },
      traceParentRunId: 'renderer-run-route',
      correlationMetadata: {
        session_id: 'session-route',
      },
    })

    const normalized = normalizeChatBridgeExecutionGovernorContentParts([infoPart], [{ type: 'text', text: 'host reply' }], {
      reviewedRouteArtifact,
    })

    expect(normalized).toMatchObject([
      {
        type: 'info',
        text: 'OCR completed for the attached image.',
      },
      {
        type: 'app',
        title: 'Keep this in chat',
      },
      {
        type: 'text',
        text: 'host reply',
      },
    ])
  })
})
