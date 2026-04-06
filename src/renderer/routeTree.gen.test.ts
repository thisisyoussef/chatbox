import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('route tree generation', () => {
  it('commits the ChatBridge Partners settings route into the generated tree', () => {
    const routeTreeSource = readFileSync(new URL('./routeTree.gen.ts', import.meta.url), 'utf8')

    expect(routeTreeSource).toContain("./routes/settings/chatbridge-partners")
    expect(routeTreeSource).toContain("'/settings/chatbridge-partners'")
  })
})
