import '../setup'

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const costAnalysisPath = resolve(repoRoot, 'chatbridge/AI_COST_ANALYSIS.md')
const submissionPacketPath = resolve(repoRoot, 'chatbridge/SUBMISSION.md')
const referencePath = resolve(repoRoot, 'chatbridge/examples/ai-cost-analysis.reference.json')

describe('ChatBridge AI cost analysis docs', () => {
  it('keeps the submission packet linked to a reproducible cost model', () => {
    expect(existsSync(costAnalysisPath)).toBe(true)
    expect(existsSync(submissionPacketPath)).toBe(true)
    expect(existsSync(referencePath)).toBe(true)

    const costAnalysis = readFileSync(costAnalysisPath, 'utf8')
    const submissionPacket = readFileSync(submissionPacketPath, 'utf8')
    const reference = JSON.parse(readFileSync(referencePath, 'utf8'))

    expect(reference.actualReproducibleDevelopmentHarness).toMatchObject({
      llmApiCostUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      apiCalls: 0,
      embeddingsCostUsd: 0,
      otherAiCostUsd: 0,
    })

    expect(reference.monthlyTotalsPerActiveUser).toMatchObject({
      inputTokens: 65200,
      outputTokens: 15300,
    })

    expect(reference.monthlyProjectionUsd.openai_gpt_5_4_mini['100']).toBeGreaterThan(0)
    expect(reference.monthlyProjectionUsd.openai_gpt_5_4_mini['1000']).toBeGreaterThan(
      reference.monthlyProjectionUsd.openai_gpt_5_4_mini['100'],
    )
    expect(reference.monthlyProjectionUsd.openai_gpt_5_4_mini['100000']).toBeGreaterThan(
      reference.monthlyProjectionUsd.openai_gpt_5_4_mini['10000'],
    )

    expect(costAnalysis).toContain('## Development & Testing Costs')
    expect(costAnalysis).toContain('## Production Cost Projections')
    expect(costAnalysis).toContain('100')
    expect(costAnalysis).toContain('1,000')
    expect(costAnalysis).toContain('10,000')
    expect(costAnalysis).toContain('100,000')
    expect(costAnalysis).toContain('GPT-5.4 mini')
    expect(costAnalysis).toContain('Claude Haiku 3.5')
    expect(costAnalysis).toContain('Gemini 2.5 Flash-Lite')
    expect(costAnalysis).toContain('openai.com/api/pricing')
    expect(costAnalysis).toContain('platform.claude.com/docs/en/about-claude/pricing')
    expect(costAnalysis).toContain('ai.google.dev/gemini-api/docs/pricing')
    expect(costAnalysis).toContain('0.11775')
    expect(costAnalysis).toContain('11,775.00')
    expect(costAnalysis).toContain('examples/ai-cost-analysis.reference.json')

    expect(submissionPacket).toContain('AI_COST_ANALYSIS.md')
  })
})
