import {
  createChatBridgeRouteMessagePart,
  getReviewedAppCatalog,
  resolveReviewedAppRouteDecision,
  type ChatBridgeExecutionGovernorRoutingStrategy,
  type ChatBridgeExecutionGovernorSemanticClassifierStatus,
  type ChatBridgeRouteDecision,
  type ReviewedAppCatalogEntry,
} from '@shared/chatbridge'
import type { ModelInterface } from '@shared/models/types'
import type { Message } from '@shared/types'
import { getReviewedAppRouterCatalog, type ChatBridgeRouterCatalog } from './candidates'
import { classifyReviewedAppIntentWithModel } from './semantic'

export interface ReviewedAppRouteDecisionResult {
  catalog: ChatBridgeRouterCatalog
  decision: ChatBridgeRouteDecision
}

export interface IntelligentReviewedAppRouteDecisionResult extends ReviewedAppRouteDecisionResult {
  routingStrategy: ChatBridgeExecutionGovernorRoutingStrategy
  semanticClassifierStatus: ChatBridgeExecutionGovernorSemanticClassifierStatus
  lexicalDecision: ChatBridgeRouteDecision
}

export function getReviewedAppRouteDecision(options: {
  promptInput: unknown
  contextInput: unknown
  entries?: ReviewedAppCatalogEntry[]
}): ReviewedAppRouteDecisionResult {
  const catalog = getReviewedAppRouterCatalog(options.contextInput, options.entries ?? getReviewedAppCatalog())

  return {
    catalog,
    decision: resolveReviewedAppRouteDecision(catalog.candidates, options.promptInput, {
      excluded: catalog.excluded,
      hostRuntime: catalog.context?.hostRuntime,
    }),
  }
}

function shouldAttemptSemanticRouting(decision: ChatBridgeRouteDecision, catalog: ChatBridgeRouterCatalog) {
  if (!decision.prompt || catalog.candidates.length === 0) {
    return false
  }

  if (decision.kind === 'invoke' && decision.reasonCode === 'explicit-app-match') {
    return false
  }

  return decision.reasonCode !== 'runtime-unsupported' && decision.reasonCode !== 'no-eligible-apps'
}

export async function getIntelligentReviewedAppRouteDecision(options: {
  promptInput: unknown
  contextInput: unknown
  messages: Message[]
  model: ModelInterface
  entries?: ReviewedAppCatalogEntry[]
  traceParentRunId?: string
  correlationMetadata?: Record<string, unknown>
}): Promise<IntelligentReviewedAppRouteDecisionResult> {
  const lexical = getReviewedAppRouteDecision(options)

  if (!shouldAttemptSemanticRouting(lexical.decision, lexical.catalog)) {
    return {
      ...lexical,
      lexicalDecision: lexical.decision,
      routingStrategy: 'lexical',
      semanticClassifierStatus: 'not-attempted',
    }
  }

  const semanticResult = await classifyReviewedAppIntentWithModel({
    model: options.model,
    prompt: lexical.decision.prompt,
    messages: options.messages,
    candidates: lexical.catalog.candidates,
    traceParentRunId: options.traceParentRunId,
    correlationMetadata: options.correlationMetadata,
  })

  if (semanticResult.status !== 'accepted' || !semanticResult.hint) {
    return {
      ...lexical,
      lexicalDecision: lexical.decision,
      routingStrategy: 'lexical',
      semanticClassifierStatus: semanticResult.status,
    }
  }

  const semanticDecision = resolveReviewedAppRouteDecision(lexical.catalog.candidates, options.promptInput, {
    excluded: lexical.catalog.excluded,
    hostRuntime: lexical.catalog.context?.hostRuntime,
    semanticHint: semanticResult.hint,
  })
  const semanticApplied =
    semanticDecision.reasonCode === 'semantic-app-match' ||
    semanticDecision.kind !== lexical.decision.kind ||
    semanticDecision.selectedAppId !== lexical.decision.selectedAppId

  return {
    catalog: lexical.catalog,
    decision: semanticApplied ? semanticDecision : lexical.decision,
    lexicalDecision: lexical.decision,
    routingStrategy: semanticApplied ? 'semantic' : 'lexical',
    semanticClassifierStatus: 'accepted',
  }
}

export function createReviewedAppRouteArtifact(decision: ChatBridgeRouteDecision) {
  return createChatBridgeRouteMessagePart(decision)
}
