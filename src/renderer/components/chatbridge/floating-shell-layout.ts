import { DRAWING_KIT_APP_ID } from '@shared/chatbridge/apps/drawing-kit'

export interface FloatingShellFrame {
  x: number
  y: number
  width: number
  height: number
}

export interface FloatingShellViewport {
  width: number
  height: number
}

export const FLOATING_SHELL_MARGIN = 24
export const FLOATING_SHELL_MINIMIZED_WIDTH = 232
export const FLOATING_SHELL_MINIMIZED_HEIGHT = 84

const MIN_AVAILABLE_WIDTH = 220
const MIN_AVAILABLE_HEIGHT = 180

type FloatingShellSizingProfile = {
  defaultWidth: number
  defaultHeight: number
  expandedWidth: number
  expandedHeight: number
  minWidth: number
  minHeight: number
}

const DEFAULT_FLOATING_SHELL_SIZING: FloatingShellSizingProfile = {
  defaultWidth: 420,
  defaultHeight: 320,
  expandedWidth: 760,
  expandedHeight: 560,
  minWidth: 320,
  minHeight: 220,
}

const DRAWING_KIT_FLOATING_SHELL_SIZING: FloatingShellSizingProfile = {
  defaultWidth: 920,
  defaultHeight: 840,
  expandedWidth: 1180,
  expandedHeight: 940,
  minWidth: 760,
  minHeight: 640,
}

function getFloatingShellSizing(appId?: string): FloatingShellSizingProfile {
  return appId === DRAWING_KIT_APP_ID ? DRAWING_KIT_FLOATING_SHELL_SIZING : DEFAULT_FLOATING_SHELL_SIZING
}

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}

function roundFrame(frame: FloatingShellFrame): FloatingShellFrame {
  return {
    x: Math.round(frame.x),
    y: Math.round(frame.y),
    width: Math.round(frame.width),
    height: Math.round(frame.height),
  }
}

function getAvailableDimension(size: number, margin: number, minimum: number) {
  return Math.max(minimum, size - margin * 2)
}

function getWidthBounds(viewport: FloatingShellViewport, appId?: string) {
  const sizing = getFloatingShellSizing(appId)
  const maxWidth = getAvailableDimension(viewport.width, FLOATING_SHELL_MARGIN, MIN_AVAILABLE_WIDTH)
  const minWidth = Math.min(sizing.minWidth, maxWidth)

  return { minWidth, maxWidth }
}

function getHeightBounds(viewport: FloatingShellViewport, appId?: string) {
  const sizing = getFloatingShellSizing(appId)
  const maxHeight = getAvailableDimension(viewport.height, FLOATING_SHELL_MARGIN, MIN_AVAILABLE_HEIGHT)
  const minHeight = Math.min(sizing.minHeight, maxHeight)

  return { minHeight, maxHeight }
}

export function areFloatingShellFramesEqual(
  left: FloatingShellFrame | null | undefined,
  right: FloatingShellFrame | null | undefined
) {
  if (!left || !right) {
    return left === right
  }

  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height
}

export function clampFloatingShellFrame(
  frame: FloatingShellFrame,
  viewport: FloatingShellViewport,
  appId?: string
): FloatingShellFrame {
  const { minWidth, maxWidth } = getWidthBounds(viewport, appId)
  const { minHeight, maxHeight } = getHeightBounds(viewport, appId)

  const width = clamp(frame.width, minWidth, maxWidth)
  const height = clamp(frame.height, minHeight, maxHeight)
  const maxX = Math.max(FLOATING_SHELL_MARGIN, viewport.width - width - FLOATING_SHELL_MARGIN)
  const maxY = Math.max(FLOATING_SHELL_MARGIN, viewport.height - height - FLOATING_SHELL_MARGIN)

  return roundFrame({
    x: clamp(frame.x, FLOATING_SHELL_MARGIN, maxX),
    y: clamp(frame.y, FLOATING_SHELL_MARGIN, maxY),
    width,
    height,
  })
}

export function getDefaultFloatingShellFrame(viewport: FloatingShellViewport, appId?: string): FloatingShellFrame {
  const sizing = getFloatingShellSizing(appId)
  const { maxWidth } = getWidthBounds(viewport, appId)
  const { maxHeight } = getHeightBounds(viewport, appId)
  const width = Math.min(sizing.defaultWidth, maxWidth)
  const height = Math.min(sizing.defaultHeight, maxHeight)

  return clampFloatingShellFrame(
    {
      x: viewport.width - width - FLOATING_SHELL_MARGIN,
      y: viewport.height - height - FLOATING_SHELL_MARGIN,
      width,
      height,
    },
    viewport,
    appId
  )
}

export function getExpandedFloatingShellFrame(viewport: FloatingShellViewport, appId?: string): FloatingShellFrame {
  const sizing = getFloatingShellSizing(appId)
  const { maxWidth } = getWidthBounds(viewport, appId)
  const { maxHeight } = getHeightBounds(viewport, appId)
  const width = Math.min(sizing.expandedWidth, maxWidth)
  const height = Math.min(sizing.expandedHeight, maxHeight)

  return clampFloatingShellFrame(
    {
      x: viewport.width - width - FLOATING_SHELL_MARGIN,
      y: viewport.height - height - FLOATING_SHELL_MARGIN,
      width,
      height,
    },
    viewport,
    appId
  )
}

export function moveFloatingShellFrame(
  frame: FloatingShellFrame,
  viewport: FloatingShellViewport,
  deltaX: number,
  deltaY: number,
  appId?: string
) {
  return clampFloatingShellFrame(
    {
      ...frame,
      x: frame.x + deltaX,
      y: frame.y + deltaY,
    },
    viewport,
    appId
  )
}

export function resizeFloatingShellFrame(
  frame: FloatingShellFrame,
  viewport: FloatingShellViewport,
  deltaX: number,
  deltaY: number,
  appId?: string
) {
  return clampFloatingShellFrame(
    {
      ...frame,
      width: frame.width + deltaX,
      height: frame.height + deltaY,
    },
    viewport,
    appId
  )
}

export function getMinimizedFloatingShellFrame(
  frame: FloatingShellFrame,
  viewport: FloatingShellViewport,
  appId?: string
): FloatingShellFrame {
  const width = Math.min(FLOATING_SHELL_MINIMIZED_WIDTH, getWidthBounds(viewport, appId).maxWidth)
  const height = Math.min(FLOATING_SHELL_MINIMIZED_HEIGHT, getHeightBounds(viewport, appId).maxHeight)
  const maxX = Math.max(FLOATING_SHELL_MARGIN, viewport.width - width - FLOATING_SHELL_MARGIN)
  const maxY = Math.max(FLOATING_SHELL_MARGIN, viewport.height - height - FLOATING_SHELL_MARGIN)

  return roundFrame({
    x: clamp(frame.x + frame.width - width, FLOATING_SHELL_MARGIN, maxX),
    y: clamp(frame.y + frame.height - height, FLOATING_SHELL_MARGIN, maxY),
    width,
    height,
  })
}
