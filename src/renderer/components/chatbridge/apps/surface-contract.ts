import {
  getChatBridgeDebateArenaState,
  getChatBridgeRouteDecision,
  getChatBridgeStoryBuilderState,
  isChatBridgeChessAppId,
  readChatBridgeReviewedAppLaunch,
} from '@shared/chatbridge'
import type { MessageAppPart } from '@shared/types'

const TRAY_ELIGIBLE_LIFECYCLES = new Set(['launching', 'ready', 'active'])

export type ChatBridgeSurfaceKind =
  | 'reviewed-launch'
  | 'chess-runtime'
  | 'story-builder'
  | 'debate-arena'
  | 'inline-route-artifact'

export function getChatBridgeSurfaceKind(part: MessageAppPart): ChatBridgeSurfaceKind | null {
  if (!part.appId || !part.appInstanceId) {
    return null
  }

  if (readChatBridgeReviewedAppLaunch(part.values) && TRAY_ELIGIBLE_LIFECYCLES.has(part.lifecycle)) {
    return 'reviewed-launch'
  }

  if (getChatBridgeRouteDecision(part)) {
    return 'inline-route-artifact'
  }

  if (part.lifecycle === 'active' && isChatBridgeChessAppId(part.appId)) {
    return 'chess-runtime'
  }

  if (part.appId === 'story-builder') {
    return getChatBridgeStoryBuilderState(part.values?.chatbridgeStoryBuilder) ? 'story-builder' : null
  }

  if (part.appId === 'debate-arena') {
    return getChatBridgeDebateArenaState(part.values?.chatbridgeDebateArena) ? 'debate-arena' : null
  }

  return null
}

export function isChatBridgeTrayEligiblePart(part: MessageAppPart) {
  const surfaceKind = getChatBridgeSurfaceKind(part)
  if (surfaceKind === 'reviewed-launch' || surfaceKind === 'chess-runtime') {
    return true
  }

  if (surfaceKind === 'story-builder' || surfaceKind === 'debate-arena') {
    return TRAY_ELIGIBLE_LIFECYCLES.has(part.lifecycle)
  }

  return false
}
