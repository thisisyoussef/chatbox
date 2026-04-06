/**
 * @vitest-environment jsdom
 */

import { createMemoryHistory } from '@tanstack/react-router'
import { beforeAll, describe, expect, it } from 'vitest'
import { createSettingsModalRouter } from './Settings'

describe('Settings modal router', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  })

  it('includes the ChatBridge Partners settings route', async () => {
    const router = createSettingsModalRouter(
      createMemoryHistory({
        initialEntries: ['/settings/chatbridge-partners'],
      })
    )

    await router.load()

    expect(router.state.matches.at(-1)?.routeId).toBe('/settings/chatbridge-partners')
  })
})
