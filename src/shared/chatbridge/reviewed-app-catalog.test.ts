import { beforeEach, describe, expect, it } from 'vitest'
import { clearReviewedAppRegistry, getReviewedAppCatalog } from './registry'
import {
  ensureDefaultReviewedAppsRegistered,
  getDefaultReviewedAppCatalogEntries,
  getLegacyReviewedAppCatalogEntries,
} from './reviewed-app-catalog'

describe('default reviewed app catalog', () => {
  beforeEach(() => {
    clearReviewedAppRegistry()
  })

  it('defaults the active reviewed catalog to Chess, Drawing Kit, Flashcard Studio, and Weather Dashboard', () => {
    expect(getDefaultReviewedAppCatalogEntries().map((entry) => entry.manifest.appId)).toEqual([
      'chess',
      'drawing-kit',
      'flashcard-studio',
      'weather-dashboard',
    ])
  })

  it('keeps Debate Arena and Story Builder available only as legacy references', () => {
    expect(getLegacyReviewedAppCatalogEntries().map((entry) => entry.manifest.appId)).toEqual([
      'debate-arena',
      'story-builder',
    ])
  })

  it('registers only the active reviewed catalog into the default runtime registry', () => {
    ensureDefaultReviewedAppsRegistered()

    expect(getReviewedAppCatalog().map((entry) => entry.manifest.appId)).toEqual([
      'chess',
      'drawing-kit',
      'flashcard-studio',
      'weather-dashboard',
    ])
  })

  it('marks Flashcard Studio as the oauth reviewed app with host-owned Google Sheets permissions', () => {
    const flashcardStudio = getDefaultReviewedAppCatalogEntries().find(
      (entry) => entry.manifest.appId === 'flashcard-studio'
    )

    expect(flashcardStudio).toMatchObject({
      manifest: {
        authMode: 'oauth',
        permissions: expect.arrayContaining([
          expect.objectContaining({ id: 'session.context.read', required: true }),
          expect.objectContaining({ id: 'sheets.read', required: true }),
          expect.objectContaining({ id: 'sheets.write', required: true }),
        ]),
        supportedEvents: expect.arrayContaining(['app.requestAuth']),
      },
    })
  })
})
