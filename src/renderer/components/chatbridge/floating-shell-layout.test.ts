import { DRAWING_KIT_APP_ID } from '@shared/chatbridge/apps/drawing-kit'
import { describe, expect, it } from 'vitest'
import {
  clampFloatingShellFrame,
  FLOATING_SHELL_MARGIN,
  getDefaultFloatingShellFrame,
  getExpandedFloatingShellFrame,
  getMinimizedFloatingShellFrame,
  moveFloatingShellFrame,
  resizeFloatingShellFrame,
} from './floating-shell-layout'

const viewport = {
  width: 960,
  height: 720,
}

describe('floating shell layout', () => {
  it('bootstraps a lower-corner picture-in-picture frame by default', () => {
    expect(getDefaultFloatingShellFrame(viewport)).toEqual({
      x: 516,
      y: 376,
      width: 420,
      height: 320,
    })
  })

  it('clamps oversized or off-screen frames back into the viewport', () => {
    expect(
      clampFloatingShellFrame(
        {
          x: -40,
          y: 900,
          width: 1200,
          height: 900,
        },
        viewport
      )
    ).toEqual({
      x: FLOATING_SHELL_MARGIN,
      y: FLOATING_SHELL_MARGIN,
      width: 912,
      height: 672,
    })
  })

  it('moves frames without letting them disappear off screen', () => {
    const frame = getDefaultFloatingShellFrame(viewport)

    expect(moveFloatingShellFrame(frame, viewport, 400, 400)).toEqual({
      x: 516,
      y: 376,
      width: 420,
      height: 320,
    })
  })

  it('resizes frames while respecting bounds', () => {
    const frame = getDefaultFloatingShellFrame(viewport)

    expect(resizeFloatingShellFrame(frame, viewport, 200, 300)).toEqual({
      x: 316,
      y: 76,
      width: 620,
      height: 620,
    })
  })

  it('provides a larger expanded frame without mutating the stored base size', () => {
    expect(getExpandedFloatingShellFrame(viewport)).toEqual({
      x: 176,
      y: 136,
      width: 760,
      height: 560,
    })
  })

  it('uses a larger default frame for Drawing Kit so the board is usable without immediate resizing', () => {
    expect(getDefaultFloatingShellFrame(viewport, DRAWING_KIT_APP_ID)).toEqual({
      x: 24,
      y: 24,
      width: 912,
      height: 672,
    })
  })

  it('clamps persisted Drawing Kit frames back to a usable minimum size', () => {
    expect(
      clampFloatingShellFrame(
        {
          x: 640,
          y: 400,
          width: 420,
          height: 320,
        },
        viewport,
        DRAWING_KIT_APP_ID
      )
    ).toEqual({
      x: 176,
      y: 56,
      width: 760,
      height: 640,
    })
  })

  it('derives a compact minimized chip from the current overlay position', () => {
    const frame = getDefaultFloatingShellFrame(viewport)

    expect(getMinimizedFloatingShellFrame(frame, viewport)).toEqual({
      x: 704,
      y: 612,
      width: 232,
      height: 84,
    })
  })
})
