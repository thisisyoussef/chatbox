import type { Message, MessageAppPart } from '@shared/types/session'
import { cloneMessage } from '@shared/utils/message'
import { getChatBridgeAppSummaryForModel, selectChatBridgeAppContexts } from '@shared/chatbridge/app-memory'
import type { ChatBridgeSelectedAppContext } from '@shared/chatbridge/app-memory'
import {
  CHATBRIDGE_APP_MEDIA_VALUES_KEY,
  formatChatBridgeAppStateDigest,
  describeChatBridgeAppScreenshot,
} from '@shared/chatbridge/app-state'
import { DRAWING_KIT_APP_ID } from '@shared/chatbridge/apps/drawing-kit'

export const CHATBRIDGE_APP_CONTEXT_MESSAGE_PREFIX = 'chatbridge-app-context:'
export const CHATBRIDGE_APP_VISION_CONTEXT_MESSAGE_PREFIX = 'chatbridge-app-vision-context:'
const CHATBRIDGE_HOST_MEMORY_VALUE_KEYS = [
  'chatbridgeCompletion',
  'chatbridgeDebateArena',
  CHATBRIDGE_APP_MEDIA_VALUES_KEY,
] as const

function removeHostApprovedAppMemory(part: MessageAppPart): MessageAppPart {
  const { summaryForModel: _summaryForModel, values, ...rest } = part

  if (!values) {
    return rest
  }

  let changed = false
  const remainingValues = { ...values }

  for (const key of CHATBRIDGE_HOST_MEMORY_VALUE_KEYS) {
    if (key in remainingValues) {
      changed = true
      delete remainingValues[key]
    }
  }

  if (!changed) {
    return rest
  }

  if (Object.keys(remainingValues).length === 0) {
    return rest
  }

  return {
    ...rest,
    values: remainingValues,
  }
}

export function getChatBridgeAppContextMessageId(selection: ChatBridgeSelectedAppContext): string {
  return `${CHATBRIDGE_APP_CONTEXT_MESSAGE_PREFIX}${selection.messageId}:${selection.appInstanceId}`
}

function createInjectedAppContextMessage(selection: ChatBridgeSelectedAppContext): Message {
  const appLabel = selection.appName?.trim() || selection.appId
  const lifecycleLabel = selection.lifecycle === 'active' ? 'active' : 'recently completed'
  const continuityPriority =
    selection.lifecycle === 'active' ? 'Primary active app context' : 'Recent completed app context'
  const digest = formatChatBridgeAppStateDigest(selection.stateDigest ?? null)
  const screenshot = describeChatBridgeAppScreenshot(selection.latestScreenshot ?? null)

  return {
    id: getChatBridgeAppContextMessageId(selection),
    role: 'system',
    contentParts: [
      {
        type: 'text',
        text:
          `ChatBridge continuity context:\n` +
          `Use this host-approved app summary only when it is relevant to the user's follow-up.\n` +
          `Priority: ${continuityPriority}\n` +
          `App: ${appLabel}\n` +
          `Lifecycle: ${lifecycleLabel}\n` +
          `Summary: ${selection.summaryForModel}` +
          (digest ? `\n${digest}` : '') +
          (screenshot ? `\nScreenshot: ${screenshot}` : ''),
      },
    ],
  }
}

function getChatBridgeAppVisionContextMessageId(selection: ChatBridgeSelectedAppContext) {
  return `${CHATBRIDGE_APP_VISION_CONTEXT_MESSAGE_PREFIX}${selection.messageId}:${selection.appInstanceId}`
}

function createInjectedAppVisionContextMessage(selection: ChatBridgeSelectedAppContext): Message | null {
  const screenshot = selection.latestScreenshot
  if (!screenshot) {
    return null
  }

  const appLabel = selection.appName?.trim() || selection.appId
  const lifecycleLabel = selection.lifecycle === 'active' ? 'active' : 'recently completed'
  const continuityPriority =
    selection.lifecycle === 'active' ? 'Primary active app screenshot' : 'Recent completed app screenshot'
  const screenshotDescription = describeChatBridgeAppScreenshot(screenshot)

  return {
    id: getChatBridgeAppVisionContextMessageId(selection),
    role: 'user',
    contentParts: [
      {
        type: 'text',
        text:
          `ChatBridge visual continuity context:\n` +
          `This is a host-approved app screenshot for grounding later follow-up, not a new user request.\n` +
          `Priority: ${continuityPriority}\n` +
          `App: ${appLabel}\n` +
          `Lifecycle: ${lifecycleLabel}\n` +
          `Summary: ${selection.summaryForModel}` +
          (screenshotDescription ? `\nScreenshot note: ${screenshotDescription}` : '') +
          (selection.appId === DRAWING_KIT_APP_ID
            ? '\nThe attached image keeps the exact board view and a zoomed focus crop together for sparse drawing inspection.'
            : '') +
          `\nUse the image only when the user's follow-up depends on the exact visible app state. Do not infer anything outside this screenshot.`,
      },
      {
        type: 'image',
        storageKey: screenshot.storageKey,
        detail: 'high',
      },
    ],
  }
}

function sanitizeChatBridgeAppParts(contextMessages: Message[], selected: ChatBridgeSelectedAppContext[]): Message[] {
  return contextMessages.map((message) => {
    let changed = false

    const nextParts = message.contentParts.map((part) => {
      if (part.type !== 'app') {
        return part
      }

      const isSelected = selected.some(
        (selection) =>
          message.id === selection.messageId &&
          part.appId === selection.appId &&
          part.appInstanceId === selection.appInstanceId &&
          getChatBridgeAppSummaryForModel(part) === selection.summaryForModel
      )

      if (isSelected) {
        return part
      }

      const sanitizedPart = removeHostApprovedAppMemory(part)
      if (sanitizedPart !== part) {
        changed = true
      }
      return sanitizedPart
    })

    if (!changed) {
      return message
    }

    const nextMessage = cloneMessage(message)
    nextMessage.contentParts = nextParts
    return nextMessage
  })
}

export function applyChatBridgeAppContext(contextMessages: Message[], sourceMessages: Message[]): Message[] {
  const selected = selectChatBridgeAppContexts(sourceMessages)
  const sanitizedMessages = sanitizeChatBridgeAppParts(contextMessages, selected)

  if (selected.length === 0) {
    return sanitizedMessages
  }

  const firstSystemIndex = sanitizedMessages.findIndex((message) => message.role === 'system')
  const injectedMessages = selected
    .filter((selection) => {
      const injectedMessageId = getChatBridgeAppContextMessageId(selection)
      const alreadyInjected = sanitizedMessages.some((message) => message.id === injectedMessageId)
      const sourceMessagePresent = sanitizedMessages.some((message) => message.id === selection.messageId)
      return !alreadyInjected && !sourceMessagePresent
    })
    .map(createInjectedAppContextMessage)

  if (injectedMessages.length === 0) {
    return sanitizedMessages
  }

  if (firstSystemIndex === -1) {
    return [...injectedMessages, ...sanitizedMessages]
  }

  return [
    ...sanitizedMessages.slice(0, firstSystemIndex + 1),
    ...injectedMessages,
    ...sanitizedMessages.slice(firstSystemIndex + 1),
  ]
}

export function applyChatBridgeAppVisionContext(contextMessages: Message[], sourceMessages: Message[]): Message[] {
  const selected = selectChatBridgeAppContexts(sourceMessages)
  const preferredSelection =
    selected.find((selection) => selection.lifecycle === 'active' && selection.latestScreenshot) ??
    selected.find((selection) => selection.latestScreenshot)

  if (!preferredSelection) {
    return contextMessages
  }

  const injectedMessageId = getChatBridgeAppVisionContextMessageId(preferredSelection)
  if (contextMessages.some((message) => message.id === injectedMessageId)) {
    return contextMessages
  }

  const injectedMessage = createInjectedAppVisionContextMessage(preferredSelection)
  if (!injectedMessage) {
    return contextMessages
  }

  const lastSystemIndex = contextMessages.reduce(
    (lastIndex, message, index) => (message.role === 'system' ? index : lastIndex),
    -1
  )

  if (lastSystemIndex === -1) {
    return [injectedMessage, ...contextMessages]
  }

  return [
    ...contextMessages.slice(0, lastSystemIndex + 1),
    injectedMessage,
    ...contextMessages.slice(lastSystemIndex + 1),
  ]
}
