import { ipcMain } from 'electron'
import type { ChatBridgeWeatherDashboardQuery } from '../../../shared/chatbridge/apps/weather-dashboard'
import { createChatBridgeWeatherService } from '../../../shared/chatbridge/weather-service'
import { langsmith } from '../../adapters/langsmith'

export { createChatBridgeWeatherService } from '../../../shared/chatbridge/weather-service'

export const chatBridgeWeatherService = createChatBridgeWeatherService({
  traceAdapter: langsmith,
})

export function registerChatBridgeWeatherIpcHandlers(service = chatBridgeWeatherService) {
  ipcMain.handle('chatbridge-weather:get-dashboard', async (_event, query: ChatBridgeWeatherDashboardQuery) => {
    return await service.fetchDashboard(query)
  })
}
