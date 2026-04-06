import type { ChatBridgeRouteDecision } from './routing'
import type { ReviewedSingleAppSelection } from './single-app-discovery'

export type ChatBridgeExecutionGovernorSelectionSource = 'route-decision' | 'natural-chess-fallback' | 'none'

export type ChatBridgeExecutionGovernorArtifactKind = 'clarify' | 'refuse' | null

export type ChatBridgeExecutionGovernorRoutingStrategy = 'lexical' | 'semantic'

export type ChatBridgeExecutionGovernorSemanticClassifierStatus =
  | 'not-attempted'
  | 'accepted'
  | 'rejected'
  | 'parse-failed'
  | 'model-error'
  | 'timeout'

export type ChatBridgeExecutionGovernorTracePayload = {
  decisionKind: ChatBridgeRouteDecision['kind']
  reasonCode: ChatBridgeRouteDecision['reasonCode']
  selectedAppId: string | null
  selectionStatus: ReviewedSingleAppSelection['status']
  selectionSource: ChatBridgeExecutionGovernorSelectionSource
  routingStrategy: ChatBridgeExecutionGovernorRoutingStrategy
  semanticClassifierStatus: ChatBridgeExecutionGovernorSemanticClassifierStatus
  toolNames: string[]
  artifactInserted: boolean
  artifactKind: ChatBridgeExecutionGovernorArtifactKind
}

export type ChatBridgeExecutionGovernorRouteResolution = {
  routeDecision: ChatBridgeRouteDecision
  selection: ReviewedSingleAppSelection
  selectionSource: ChatBridgeExecutionGovernorSelectionSource
  routingStrategy: ChatBridgeExecutionGovernorRoutingStrategy
  semanticClassifierStatus: ChatBridgeExecutionGovernorSemanticClassifierStatus
  toolNames: string[]
  tracePayload: ChatBridgeExecutionGovernorTracePayload
}
