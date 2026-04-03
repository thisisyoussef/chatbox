import type { Message, MessageAppPart } from '@shared/types'
import { isChatBridgeTrayEligiblePart } from './apps/surface-contract'

export interface ChatBridgeFloatingRuntimeTarget {
  messageId: string
  messageIndex: number
  partIndex: number
  part: MessageAppPart
}

function isFloatableAppPart(part: MessageAppPart) {
  return Boolean(part.appId) && Boolean(part.appInstanceId) && isChatBridgeTrayEligiblePart(part)
}

export function resolveChatBridgeFloatingRuntimeTarget(messages: Message[]): ChatBridgeFloatingRuntimeTarget | null {
  const seenInstanceIds = new Set<string>()

  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex]
    for (let partIndex = message.contentParts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.contentParts[partIndex]
      if (part.type !== 'app' || !part.appInstanceId || seenInstanceIds.has(part.appInstanceId)) {
        continue
      }

      seenInstanceIds.add(part.appInstanceId)

      if (!isFloatableAppPart(part)) {
        continue
      }

      return {
        messageId: message.id,
        messageIndex,
        partIndex,
        part,
      }
    }
  }

  return null
}

export function isChatBridgeFloatingRuntimePart(
  target: ChatBridgeFloatingRuntimeTarget | null,
  part: Pick<MessageAppPart, 'appInstanceId'> | null | undefined
) {
  return Boolean(target && part?.appInstanceId && target.part.appInstanceId === part.appInstanceId)
}
