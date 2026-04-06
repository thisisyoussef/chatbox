import '../setup'

import { beforeEach, describe, expect, it } from 'vitest'
import { createMessage } from '@shared/types'
import { getReviewedAppCatalog } from '@shared/chatbridge'
import { createReviewedSingleAppToolSet, executeReviewedSelection } from '@/packages/chatbridge/single-app-tools'
import {
  approveChatBridgePartnerSubmission,
  getApprovedPartnerRuntimeMarkup,
  getChatBridgePartnerSubmissionPortalSample,
  resetChatBridgePartnerSubmissionStateForTests,
  submitChatBridgePartnerSubmission,
} from '@/packages/chatbridge/partner-submissions'

describe('ChatBridge partner submission intake flow', () => {
  beforeEach(async () => {
    await resetChatBridgePartnerSubmissionStateForTests()
  })

  it('promotes an approved partner submission into the routing catalog and keeps its uploaded runtime available', async () => {
    const sample = getChatBridgePartnerSubmissionPortalSample()
    const submission = await submitChatBridgePartnerSubmission({
      manifestInput: sample.manifest,
      runtimeHtml: sample.runtimeHtml,
      runtimeFileName: sample.runtimeFileName,
      createId: () => 'submission-checkpoint-coach',
      now: () => 1_717_000_000_000,
    })

    await approveChatBridgePartnerSubmission({
      submissionId: submission.submissionId,
      reviewNotes: 'Approved for the live demo.',
      now: () => 1_717_000_100_000,
    })

    const toolSetResult = createReviewedSingleAppToolSet({
      messages: [createMessage('user', "Open Checkpoint Coach for today's water cycle exit ticket.")],
      contextInput: {
        grantedPermissions: ['session.context.read'],
        hostRuntime: 'web-browser',
      },
      entries: getReviewedAppCatalog(),
    })

    expect(toolSetResult.selection.status).toBe('matched')
    expect(toolSetResult.routeDecision).toMatchObject({
      kind: 'invoke',
      selectedAppId: 'checkpoint-coach',
      reasonCode: 'explicit-app-match',
    })
    if (toolSetResult.selection.status !== 'matched') {
      throw new Error('Expected a matched reviewed-app selection.')
    }

    expect(toolSetResult.selection.appId).toBe('checkpoint-coach')

    const executionRecord = await executeReviewedSelection({
      selection: toolSetResult.selection,
      sessionId: 'session-partner-submission-1',
      executionOptions: {
        toolCallId: 'tool-partner-submission-1',
        messages: [],
      },
    })

    expect(executionRecord.outcome.status).toBe('success')
    if (executionRecord.outcome.status !== 'success') {
      throw new Error('Expected the reviewed host tool execution to succeed.')
    }

    expect(executionRecord.outcome.result).toMatchObject({
      appId: 'checkpoint-coach',
      appName: 'Checkpoint Coach',
      launchReady: true,
    })
    expect(getApprovedPartnerRuntimeMarkup('checkpoint-coach')).toContain('Checkpoint Coach')
  })
})
