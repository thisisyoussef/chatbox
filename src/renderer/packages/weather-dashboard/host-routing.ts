import {
  CHATBRIDGE_WEATHER_DASHBOARD_APP_ID,
  getChatBridgeHostToolPartUpdate,
  readChatBridgeReviewedAppLaunch,
} from '@shared/chatbridge'
import { createMessage, type Message, type MessageInfoPart, type MessageToolCallPart } from '@shared/types'
import {
  type WeatherDashboardHostState,
  WEATHER_DASHBOARD_MODEL_NAME,
  resolveWeatherDashboardTurn,
} from '@shared/weather-dashboard/intent'
import { getMessageText } from '@shared/utils/message'
import { upsertReviewedAppLaunchParts } from '../chatbridge/reviewed-app-launch'
import { createReviewedSingleAppToolSet, executeReviewedSelection } from '../chatbridge/single-app-tools'

function createWeatherDashboardInfoPart(text: string, state: WeatherDashboardHostState): MessageInfoPart {
  return {
    type: 'info',
    text,
    values: state,
  }
}

function createWeatherDashboardLaunchPrompt(locationQuery?: string) {
  return locationQuery?.trim()
    ? `Open Weather Dashboard for ${locationQuery.trim()} and show the forecast.`
    : 'Open Weather Dashboard and show the forecast.'
}

async function createWeatherDashboardLaunchMessage(
  state: WeatherDashboardHostState,
  sessionId?: string
): Promise<Message | null> {
  const selectionPrompt = createWeatherDashboardLaunchPrompt(state.locationQuery)
  const { selection } = createReviewedSingleAppToolSet({
    messages: [createMessage('user', selectionPrompt)],
  })

  if (selection.status !== 'matched' || selection.appId !== CHATBRIDGE_WEATHER_DASHBOARD_APP_ID) {
    return null
  }

  const toolCallId = `tool-weather-dashboard-host-${crypto.randomUUID()}`
  const toolRecord = await executeReviewedSelection({
    selection,
    sessionId,
    input: {
      request: state.originalRequest,
      ...(state.locationQuery ? { location: state.locationQuery } : {}),
    },
    executionOptions: {
      toolCallId,
      messages: [],
    },
  })
  const toolPartUpdate = getChatBridgeHostToolPartUpdate(toolRecord)
  if (!toolPartUpdate) {
    return null
  }

  const toolCallPart: MessageToolCallPart = {
    type: 'tool-call',
    toolCallId,
    toolName: selection.toolName,
    args: toolPartUpdate.args,
    result: toolPartUpdate.result,
    state: toolPartUpdate.state,
  }

  const assistantMessage = createMessage('assistant')
  assistantMessage.model = WEATHER_DASHBOARD_MODEL_NAME
  assistantMessage.name = WEATHER_DASHBOARD_MODEL_NAME
  assistantMessage.contentParts = upsertReviewedAppLaunchParts([toolCallPart])
  return readChatBridgeReviewedAppLaunch(assistantMessage.contentParts.find((part) => part.type === 'app')?.values)
    ? assistantMessage
    : null
}

type InterceptWeatherDashboardTurnOptions = {
  sessionId?: string
}

export async function interceptWeatherDashboardTurn(
  messages: Message[],
  newUserMsg: Message,
  options: InterceptWeatherDashboardTurnOptions = {}
): Promise<Message | null> {
  if (newUserMsg.files?.length || newUserMsg.links?.length) {
    return null
  }

  const userText = getMessageText(newUserMsg, false, true).trim()
  if (!userText) {
    return null
  }

  const result = resolveWeatherDashboardTurn(messages, userText)
  if (result.kind === 'none') {
    return null
  }

  if (result.kind === 'route-ready') {
    const launchMessage = await createWeatherDashboardLaunchMessage(result.state, options.sessionId)
    if (launchMessage) {
      return launchMessage
    }
  }

  const assistantMessage = createMessage('assistant')
  assistantMessage.model = WEATHER_DASHBOARD_MODEL_NAME
  assistantMessage.name = WEATHER_DASHBOARD_MODEL_NAME
  assistantMessage.contentParts = [createWeatherDashboardInfoPart(result.message, result.state)]
  return assistantMessage
}
