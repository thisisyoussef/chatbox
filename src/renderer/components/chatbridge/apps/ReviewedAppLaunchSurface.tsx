import {
  DRAWING_KIT_APP_ID,
  FLASHCARD_STUDIO_APP_ID,
  WEATHER_DASHBOARD_APP_ID,
} from '@shared/chatbridge'
import type { MessageAppPart } from '@shared/types'
import { readChatBridgeReviewedAppLaunch } from '@/packages/chatbridge/reviewed-app-launch'
import { FlashcardStudioLaunchSurface } from './flashcard/FlashcardStudioLaunchSurface'
import { ReviewedAppRuntimeFrame } from './ReviewedAppRuntimeFrame'
import { WeatherDashboardLaunchSurface } from './weather/WeatherDashboardLaunchSurface'

interface ReviewedAppLaunchSurfaceProps {
  part: MessageAppPart
  sessionId?: string
  messageId?: string
}

export function ReviewedAppLaunchSurface({ part, sessionId, messageId }: ReviewedAppLaunchSurfaceProps) {
  const launch = readChatBridgeReviewedAppLaunch(part.values)
  const isDrawingKit = part.appId === DRAWING_KIT_APP_ID
  const isFlashcardStudio = part.appId === FLASHCARD_STUDIO_APP_ID
  const isWeatherDashboard = part.appId === WEATHER_DASHBOARD_APP_ID

  if (!launch || part.lifecycle === 'error' || part.lifecycle === 'stale' || part.lifecycle === 'complete') {
    return null
  }

  if (isWeatherDashboard) {
    return <WeatherDashboardLaunchSurface part={part} launch={launch} sessionId={sessionId} messageId={messageId} />
  }

  if (isFlashcardStudio) {
    return <FlashcardStudioLaunchSurface part={part} launch={launch} sessionId={sessionId} messageId={messageId} />
  }

  return (
    <ReviewedAppRuntimeFrame
      part={part}
      launch={launch}
      sessionId={sessionId}
      messageId={messageId}
      minHeight={isDrawingKit ? 560 : 260}
    />
  )
}
