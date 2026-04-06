import type { ModelMessage } from 'ai'
import {
  ChatBridgeSemanticRouteDecisionHintSchema,
  type ChatBridgeSemanticRouteDecisionHint,
  type ReviewedAppRouterCandidate,
} from '@shared/chatbridge'
import type { ModelInterface } from '@shared/models/types'
import type { Message, StreamTextResult } from '@shared/types'
import type { LangSmithTraceContext } from '@shared/utils/langsmith_adapter'
import { getMessageText } from '@shared/utils/message'

const SEMANTIC_ROUTE_TIMEOUT_MS = 1500
const MAX_TRANSCRIPT_MESSAGES = 6
const MAX_TRANSCRIPT_PREVIEW_LENGTH = 280
const JSON_BLOCK_PATTERN = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g

export type SemanticReviewedAppIntentClassifierStatus =
  | 'accepted'
  | 'rejected'
  | 'parse-failed'
  | 'model-error'
  | 'timeout'

export type SemanticReviewedAppIntentClassifierResult = {
  status: SemanticReviewedAppIntentClassifierStatus
  hint?: ChatBridgeSemanticRouteDecisionHint
  rawText?: string
  errorMessage?: string
}

function buildConversationExcerpt(messages: Message[]) {
  return messages
    .filter((message) => message.role !== 'system')
    .slice(-MAX_TRANSCRIPT_MESSAGES)
    .map((message) => ({
      role: message.role,
      text: getMessageText(message).replace(/\s+/g, ' ').trim().slice(0, MAX_TRANSCRIPT_PREVIEW_LENGTH),
    }))
    .filter((entry) => entry.text.length > 0)
}

function buildCandidatePayload(candidates: ReviewedAppRouterCandidate[]) {
  return candidates.map((candidate) => {
    const primaryTool = candidate.entry.manifest.toolSchemas[0]
    return {
      appId: candidate.entry.manifest.appId,
      appName: candidate.entry.manifest.name,
      toolName: primaryTool?.name ?? null,
      toolTitle: primaryTool?.title ?? null,
      toolDescription: primaryTool?.description ?? null,
      permissionPurposes: candidate.entry.manifest.permissions.map((permission) => permission.purpose),
      matchedContexts: candidate.matchedContexts,
    }
  })
}

function buildSemanticRouterMessages(options: {
  prompt: string
  messages: Message[]
  candidates: ReviewedAppRouterCandidate[]
  modelSupportsSystemMessage: boolean
}): ModelMessage[] {
  const systemPrompt = [
    'You are the ChatBridge reviewed app intent router.',
    'Choose whether the latest user request should launch one reviewed app, ask for clarification, or stay in normal chat.',
    'Use only the provided reviewed apps. Never invent an app.',
    'Return ONLY valid JSON with this shape:',
    '{"decision":"invoke|clarify|refuse","selectedAppId":"string?","alternateAppIds":["string"],"confidence":"high|medium|low","rationale":"string"}',
    'Routing rules:',
    '- Use "invoke" only when one reviewed app is clearly the best fit.',
    '- Use "clarify" when two apps plausibly fit or the intent is still underspecified.',
    '- Use "refuse" when the request should stay in normal chat.',
    '- Prefer safety over guessing. If the request is not app-shaped, refuse.',
  ].join('\n')

  const userPayload = JSON.stringify(
    {
      latestUserPrompt: options.prompt,
      conversationExcerpt: buildConversationExcerpt(options.messages),
      candidates: buildCandidatePayload(options.candidates),
    },
    null,
    2
  )

  return options.modelSupportsSystemMessage
    ? [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPayload,
        },
      ]
    : [
        {
          role: 'user',
          content: `${systemPrompt}\n\n${userPayload}`,
        },
      ]
}

function getTextResponse(result: StreamTextResult) {
  return result.contentParts
    .filter((part): part is Extract<StreamTextResult['contentParts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim()
}

function extractJsonObject(text: string) {
  const matches = text.match(JSON_BLOCK_PATTERN) ?? []
  for (const candidate of matches) {
    try {
      return JSON.parse(candidate) as unknown
    } catch {
      // Continue until a valid JSON block is found.
    }
  }

  return null
}

function normalizeHint(
  hint: ChatBridgeSemanticRouteDecisionHint,
  validAppIds: Set<string>
): ChatBridgeSemanticRouteDecisionHint | null {
  const selectedAppId = hint.selectedAppId && validAppIds.has(hint.selectedAppId) ? hint.selectedAppId : undefined
  const alternateAppIds = hint.alternateAppIds.filter((appId) => appId !== selectedAppId && validAppIds.has(appId))

  if (hint.decision === 'refuse') {
    return {
      ...hint,
      selectedAppId: undefined,
      alternateAppIds: [],
    }
  }

  const normalizedSelectedAppId = selectedAppId ?? alternateAppIds[0]
  if (!normalizedSelectedAppId) {
    return null
  }

  return {
    ...hint,
    selectedAppId: normalizedSelectedAppId,
    alternateAppIds: alternateAppIds.filter((appId) => appId !== normalizedSelectedAppId),
  }
}

export async function classifyReviewedAppIntentWithModel(options: {
  model: ModelInterface
  prompt: string
  messages: Message[]
  candidates: ReviewedAppRouterCandidate[]
  traceParentRunId?: string
  correlationMetadata?: Record<string, unknown>
}): Promise<SemanticReviewedAppIntentClassifierResult> {
  const prompt = options.prompt.replace(/\s+/g, ' ').trim()
  if (!prompt || options.candidates.length === 0) {
    return {
      status: 'rejected',
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort('semantic-routing-timeout')
  }, SEMANTIC_ROUTE_TIMEOUT_MS)

  try {
    const result = await options.model.chat(
      buildSemanticRouterMessages({
        prompt,
        messages: options.messages,
        candidates: options.candidates,
        modelSupportsSystemMessage: options.model.isSupportSystemMessage(),
      }),
      {
        signal: controller.signal,
        traceContext: {
          name: 'chatbox.session.generate.chatbridge.semantic_route.llm',
          parentRunId: options.traceParentRunId,
          metadata: {
            ...options.correlationMetadata,
            operation: 'chatbridgeSemanticRouteClassification',
          },
          tags: ['chatbox', 'renderer', 'chatbridge', 'routing', 'semantic'],
        } satisfies LangSmithTraceContext,
      }
    )

    const rawText = getTextResponse(result)
    const rawJson = extractJsonObject(rawText)
    if (!rawJson) {
      return {
        status: 'parse-failed',
        rawText,
      }
    }

    const parsedHint = ChatBridgeSemanticRouteDecisionHintSchema.safeParse(rawJson)
    if (!parsedHint.success) {
      return {
        status: 'parse-failed',
        rawText,
      }
    }

    const normalizedHint = normalizeHint(
      parsedHint.data,
      new Set(options.candidates.map((candidate) => candidate.entry.manifest.appId))
    )
    if (!normalizedHint) {
      return {
        status: 'rejected',
        rawText,
      }
    }

    return {
      status: 'accepted',
      hint: normalizedHint,
      rawText,
    }
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        status: 'timeout',
        errorMessage: `Semantic routing exceeded ${SEMANTIC_ROUTE_TIMEOUT_MS}ms.`,
      }
    }

    return {
      status: 'model-error',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
