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

const DEFAULT_WIDTH = 420
const DEFAULT_HEIGHT = 320
const EXPANDED_WIDTH = 760
const EXPANDED_HEIGHT = 560
const MIN_WIDTH = 320
const MIN_HEIGHT = 220
const MIN_AVAILABLE_WIDTH = 220
const MIN_AVAILABLE_HEIGHT = 180

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

function getWidthBounds(viewport: FloatingShellViewport) {
  const maxWidth = getAvailableDimension(viewport.width, FLOATING_SHELL_MARGIN, MIN_AVAILABLE_WIDTH)
  const minWidth = Math.min(MIN_WIDTH, maxWidth)

  return { minWidth, maxWidth }
}

function getHeightBounds(viewport: FloatingShellViewport) {
  const maxHeight = getAvailableDimension(viewport.height, FLOATING_SHELL_MARGIN, MIN_AVAILABLE_HEIGHT)
  const minHeight = Math.min(MIN_HEIGHT, maxHeight)

  return { minHeight, maxHeight }
}

export function areFloatingShellFramesEqual(
  left: FloatingShellFrame | null | undefined,
  right: FloatingShellFrame | null | undefined
) {
  if (!left || !right) {
    return left === right
  }

  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  )
}

export function clampFloatingShellFrame(
  frame: FloatingShellFrame,
  viewport: FloatingShellViewport
): FloatingShellFrame {
  const { minWidth, maxWidth } = getWidthBounds(viewport)
  const { minHeight, maxHeight } = getHeightBounds(viewport)

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

export function getDefaultFloatingShellFrame(viewport: FloatingShellViewport): FloatingShellFrame {
  const { maxWidth } = getWidthBounds(viewport)
  const { maxHeight } = getHeightBounds(viewport)
  const width = Math.min(DEFAULT_WIDTH, maxWidth)
  const height = Math.min(DEFAULT_HEIGHT, maxHeight)

  return clampFloatingShellFrame(
    {
      x: viewport.width - width - FLOATING_SHELL_MARGIN,
      y: viewport.height - height - FLOATING_SHELL_MARGIN,
      width,
      height,
    },
    viewport
  )
}

export function getExpandedFloatingShellFrame(viewport: FloatingShellViewport): FloatingShellFrame {
  const { maxWidth } = getWidthBounds(viewport)
  const { maxHeight } = getHeightBounds(viewport)
  const width = Math.min(EXPANDED_WIDTH, maxWidth)
  const height = Math.min(EXPANDED_HEIGHT, maxHeight)

  return clampFloatingShellFrame(
    {
      x: viewport.width - width - FLOATING_SHELL_MARGIN,
      y: viewport.height - height - FLOATING_SHELL_MARGIN,
      width,
      height,
    },
    viewport
  )
}

export function moveFloatingShellFrame(
  frame: FloatingShellFrame,
  viewport: FloatingShellViewport,
  deltaX: number,
  deltaY: number
) {
  return clampFloatingShellFrame(
    {
      ...frame,
      x: frame.x + deltaX,
      y: frame.y + deltaY,
    },
    viewport
  )
}

export function resizeFloatingShellFrame(
  frame: FloatingShellFrame,
  viewport: FloatingShellViewport,
  deltaX: number,
  deltaY: number
) {
  return clampFloatingShellFrame(
    {
      ...frame,
      width: frame.width + deltaX,
      height: frame.height + deltaY,
    },
    viewport
  )
}

export function getMinimizedFloatingShellFrame(
  frame: FloatingShellFrame,
  viewport: FloatingShellViewport
): FloatingShellFrame {
  const width = Math.min(FLOATING_SHELL_MINIMIZED_WIDTH, getWidthBounds(viewport).maxWidth)
  const height = Math.min(FLOATING_SHELL_MINIMIZED_HEIGHT, getHeightBounds(viewport).maxHeight)
  const maxX = Math.max(FLOATING_SHELL_MARGIN, viewport.width - width - FLOATING_SHELL_MARGIN)
  const maxY = Math.max(FLOATING_SHELL_MARGIN, viewport.height - height - FLOATING_SHELL_MARGIN)

  return roundFrame({
    x: clamp(frame.x + frame.width - width, FLOATING_SHELL_MARGIN, maxX),
    y: clamp(frame.y + frame.height - height, FLOATING_SHELL_MARGIN, maxY),
    width,
    height,
  })
}
