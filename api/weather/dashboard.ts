import {
  createNoopLangSmithAdapter,
  type LangSmithAdapter,
  type LangSmithRunEndInput,
  type LangSmithRunStartInput,
} from '../../src/shared/utils/langsmith_adapter'
import type { ChatBridgeWeatherDashboardQuery } from '../../src/shared/chatbridge/apps/weather-dashboard'
import { createChatBridgeWeatherService } from '../../src/shared/chatbridge/weather-service'
import {
  ensurePost,
  readJsonBody,
  recordLangSmithWebEvent,
  writeJson,
} from '../langsmith/_shared'

function createWeatherWebTraceAdapter(): LangSmithAdapter {
  const noop = createNoopLangSmithAdapter()

  return {
    ...noop,
    async recordEvent(input: LangSmithRunStartInput & LangSmithRunEndInput) {
      await recordLangSmithWebEvent(input)
    },
  }
}

const chatBridgeWeatherWebService = createChatBridgeWeatherService({
  traceAdapter: createWeatherWebTraceAdapter(),
})

export default async function handler(req: { method?: string; body?: unknown }, res: any) {
  if (!ensurePost(req, res)) {
    return
  }

  try {
    const payload = readJsonBody<ChatBridgeWeatherDashboardQuery>(req)
    const result = await chatBridgeWeatherWebService.fetchDashboard(payload)
    writeJson(res, 200, result)
  } catch (error) {
    writeJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
