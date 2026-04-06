import '../setup'

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateChatBridgePartnerManifest } from '@shared/chatbridge'

const repoRoot = process.cwd()
const partnerSdkPath = resolve(repoRoot, 'chatbridge/PARTNER_SDK.md')
const submissionPacketPath = resolve(repoRoot, 'chatbridge/SUBMISSION.md')
const exampleManifestPath = resolve(repoRoot, 'chatbridge/examples/reviewed-partner-manifest.example.json')

describe('ChatBridge partner quickstart docs', () => {
  it('explains the quickstart flow and keeps the example manifest valid', () => {
    expect(existsSync(partnerSdkPath)).toBe(true)
    expect(existsSync(submissionPacketPath)).toBe(true)
    expect(existsSync(exampleManifestPath)).toBe(true)

    const partnerSdk = readFileSync(partnerSdkPath, 'utf8')
    const submissionPacket = readFileSync(submissionPacketPath, 'utf8')
    const exampleManifest = JSON.parse(readFileSync(exampleManifestPath, 'utf8'))
    const report = validateChatBridgePartnerManifest(exampleManifest)

    expect(report.valid).toBe(true)
    expect(report.guidance?.authBoundary).toMatchObject({
      appGrantRequired: false,
      platformSessionRequired: true,
    })

    expect(partnerSdk).toContain('## Quickstart')
    expect(partnerSdk).toContain('chatbridge/examples/reviewed-partner-manifest.example.json')
    expect(partnerSdk).toContain('validateChatBridgePartnerManifest')
    expect(partnerSdk).toContain('createChatBridgePartnerHarness')
    expect(partnerSdk).toContain('host.bootstrap')
    expect(partnerSdk).toContain('app.ready')
    expect(partnerSdk).toContain('host.render')
    expect(partnerSdk).toContain('app.state')
    expect(partnerSdk).toContain('app.complete')
    expect(partnerSdk).toContain('app.requestAuth')
    expect(partnerSdk).toContain('## Register -> Invoke -> Render -> Complete')
    expect(partnerSdk).toContain('OAuth Or API-Key Delta')
    expect(partnerSdk).toContain('test/integration/chatbridge/scenarios/partner-sdk-harness.test.ts')

    expect(submissionPacket).toContain('PARTNER_SDK.md')
    expect(submissionPacket).toContain('examples/reviewed-partner-manifest.example.json')
  })
})
