import '../setup'

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const submissionPacketPath = resolve(repoRoot, 'chatbridge/SUBMISSION.md')

const requiredDocReferences = [
  '../README.md',
  './BOOTSTRAP.md',
  './DEPLOYMENT.md',
  './README.md',
  './ARCHITECTURE.md',
  './SERVICE_TOPOLOGY.md',
  './INTEGRATION_HARNESS.md',
  './EVALS_AND_OBSERVABILITY.md',
  './PARTNER_SDK.md',
]

const requiredDocPaths = [
  'README.md',
  'chatbridge/BOOTSTRAP.md',
  'chatbridge/DEPLOYMENT.md',
  'chatbridge/README.md',
  'chatbridge/ARCHITECTURE.md',
  'chatbridge/SERVICE_TOPOLOGY.md',
  'chatbridge/INTEGRATION_HARNESS.md',
  'chatbridge/EVALS_AND_OBSERVABILITY.md',
  'chatbridge/PARTNER_SDK.md',
]

const gradedScenarioHeadings = [
  '### 1. Tool discovery and invocation from a natural-language request',
  '### 2. App UI rendering inside chat',
  '### 3. User interaction with the app, then completion signaling back to chat',
  '### 4. Follow-up questions after the app finishes, with context retention',
  '### 5. Multiple apps used in the same conversation',
  '### 6. Ambiguous requests routed to the correct app',
  '### 7. Refusal when a request should not invoke an app',
]

const requiredScenarioReferences = [
  '../test/integration/chatbridge/scenarios/single-app-tool-discovery-and-invocation.test.ts',
  '../test/integration/chatbridge/scenarios/live-reviewed-app-invocation.test.ts',
  '../test/integration/chatbridge/scenarios/reviewed-app-bridge-launch.test.ts',
  '../test/integration/chatbridge/scenarios/drawing-kit-flagship.test.ts',
  '../test/integration/chatbridge/scenarios/flashcard-studio-study-mode.test.ts',
  '../test/integration/chatbridge/scenarios/weather-dashboard-flagship.test.ts',
  '../test/integration/chatbridge/scenarios/mid-game-board-context.test.ts',
  '../test/integration/chatbridge/scenarios/app-aware-persistence.test.ts',
  '../test/integration/chatbridge/scenarios/multi-app-continuity.test.ts',
  '../test/integration/chatbridge/scenarios/full-program-convergence.test.ts',
  '../test/integration/chatbridge/scenarios/route-decision-live-artifacts.test.ts',
  '../test/integration/chatbridge/scenarios/flashcard-studio-drive-connect-save-load.test.ts',
  '../test/integration/chatbridge/scenarios/flashcard-studio-drive-auth-recovery.test.ts',
]

const requiredScenarioProofPaths = [
  'test/integration/chatbridge/scenarios/single-app-tool-discovery-and-invocation.test.ts',
  'test/integration/chatbridge/scenarios/live-reviewed-app-invocation.test.ts',
  'test/integration/chatbridge/scenarios/reviewed-app-bridge-launch.test.ts',
  'test/integration/chatbridge/scenarios/drawing-kit-flagship.test.ts',
  'test/integration/chatbridge/scenarios/flashcard-studio-study-mode.test.ts',
  'test/integration/chatbridge/scenarios/weather-dashboard-flagship.test.ts',
  'test/integration/chatbridge/scenarios/mid-game-board-context.test.ts',
  'test/integration/chatbridge/scenarios/app-aware-persistence.test.ts',
  'test/integration/chatbridge/scenarios/multi-app-continuity.test.ts',
  'test/integration/chatbridge/scenarios/full-program-convergence.test.ts',
  'test/integration/chatbridge/scenarios/route-decision-live-artifacts.test.ts',
  'test/integration/chatbridge/scenarios/flashcard-studio-drive-connect-save-load.test.ts',
  'test/integration/chatbridge/scenarios/flashcard-studio-drive-auth-recovery.test.ts',
]

const requiredSeedIds = [
  'chess-mid-game-board-context',
  'chess-runtime',
  'drawing-kit-doodle-dare',
  'flashcard-studio-study-mode',
  'flashcard-studio-drive-resume',
  'flashcard-studio-drive-denied',
  'flashcard-studio-drive-expired',
  'runtime-and-route-receipt',
]

describe('ChatBridge submission packet', () => {
  it('maps all graded scenarios to real docs, repo proofs, and seeded reviewer paths', () => {
    expect(existsSync(submissionPacketPath)).toBe(true)

    const packet = readFileSync(submissionPacketPath, 'utf8')

    expect(packet).toContain('https://chatbox-web-two.vercel.app/')
    expect(packet).toContain('../src/shared/chatbridge/live-seeds.ts')

    for (const heading of gradedScenarioHeadings) {
      expect(packet).toContain(heading)
    }

    for (const reference of requiredDocReferences) {
      expect(packet).toContain(reference)
    }

    for (const relativePath of requiredDocPaths) {
      expect(existsSync(resolve(repoRoot, relativePath))).toBe(true)
    }

    for (const reference of requiredScenarioReferences) {
      expect(packet).toContain(reference)
    }

    for (const relativePath of requiredScenarioProofPaths) {
      expect(existsSync(resolve(repoRoot, relativePath))).toBe(true)
    }

    for (const seedId of requiredSeedIds) {
      expect(packet).toContain(seedId)
    }
  })
})
