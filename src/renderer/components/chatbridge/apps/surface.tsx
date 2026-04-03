import { getChatBridgeDebateArenaState, getChatBridgeStoryBuilderState } from '@shared/chatbridge'
import type { MessageAppPart } from '@shared/types'
import type { ReactNode } from 'react'
import { DebateArenaPanel } from './debate-arena/DebateArenaPanel'
import { ReviewedAppLaunchSurface } from './ReviewedAppLaunchSurface'
import { StoryBuilderPanel } from './story-builder/StoryBuilderPanel'
import { getChatBridgeSurfaceKind } from './surface-contract'

type ChatBridgeSurfaceContentOptions = {
  part: MessageAppPart
  sessionId?: string
  messageId?: string
}

export function getChatBridgeSurfaceContent({ part, sessionId, messageId }: ChatBridgeSurfaceContentOptions): ReactNode {
  switch (getChatBridgeSurfaceKind(part)) {
    case 'reviewed-launch':
      return <ReviewedAppLaunchSurface part={part} sessionId={sessionId} messageId={messageId} />
    case 'story-builder': {
      const state = getChatBridgeStoryBuilderState(part.values?.chatbridgeStoryBuilder)
      return state ? <StoryBuilderPanel part={part} state={state} /> : null
    }
    case 'debate-arena': {
      const state = getChatBridgeDebateArenaState(part.values?.chatbridgeDebateArena)
      return state ? <DebateArenaPanel part={part} state={state} /> : null
    }
    default:
      return null
  }
}
