/**
 * @vitest-environment jsdom
 */

import '../../../../test/integration/chatbridge/setup'

import { beforeEach, describe, expect, it } from 'vitest'
import { getReviewedApp, getReviewedAppCatalog } from '@shared/chatbridge'
import {
  approveChatBridgePartnerSubmission,
  assessChatBridgePartnerSubmissionInput,
  getApprovedPartnerRuntimeMarkup,
  getChatBridgePartnerSubmissionPortalSample,
  listChatBridgePartnerSubmissions,
  rejectChatBridgePartnerSubmission,
  resetChatBridgePartnerSubmissionStateForTests,
  submitChatBridgePartnerSubmission,
} from './partner-submissions'

describe('partner submission renderer service', () => {
  beforeEach(async () => {
    await resetChatBridgePartnerSubmissionStateForTests()
  })

  it('submits a reviewed partner draft, approves it into the catalog, and hydrates the uploaded runtime markup', async () => {
    const sample = getChatBridgePartnerSubmissionPortalSample()
    const assessment = await assessChatBridgePartnerSubmissionInput(sample.manifest)

    expect(assessment.submittable).toBe(true)
    expect(assessment.conflicts).toEqual([])

    const submitted = await submitChatBridgePartnerSubmission({
      manifestInput: sample.manifest,
      developerNotes: sample.developerNotes,
      runtimeHtml: sample.runtimeHtml,
      runtimeFileName: sample.runtimeFileName,
      createId: () => 'submission-1',
      now: () => 1_717_000_000_000,
    })

    expect(submitted.status).toBe('submitted')
    expect((await listChatBridgePartnerSubmissions())[0]?.submissionId).toBe('submission-1')

    const approved = await approveChatBridgePartnerSubmission({
      submissionId: submitted.submissionId,
      reviewNotes: 'Approved for the demo tenant.',
      now: () => 1_717_000_100_000,
    })

    expect(approved.status).toBe('approved')
    expect(getReviewedApp('checkpoint-coach')?.manifest.name).toBe('Checkpoint Coach')
    expect(getReviewedAppCatalog().some((entry) => entry.manifest.appId === 'checkpoint-coach')).toBe(true)
    expect(getApprovedPartnerRuntimeMarkup('checkpoint-coach')).toContain('Checkpoint Coach')
  })

  it('surfaces duplicate app and tool conflicts and allows rejected drafts to be resubmitted later', async () => {
    const sample = getChatBridgePartnerSubmissionPortalSample()

    await submitChatBridgePartnerSubmission({
      manifestInput: sample.manifest,
      createId: () => 'submission-1',
      now: () => 1_717_000_000_000,
    })

    const duplicateAssessment = await assessChatBridgePartnerSubmissionInput(sample.manifest)
    expect(duplicateAssessment.submittable).toBe(false)
    expect(duplicateAssessment.conflicts.map((conflict) => conflict.kind)).toEqual(['appId', 'toolName'])

    await rejectChatBridgePartnerSubmission({
      submissionId: 'submission-1',
      reviewNotes: 'Need a narrower permission set first.',
      now: () => 1_717_000_100_000,
    })

    const resubmissionAssessment = await assessChatBridgePartnerSubmissionInput(sample.manifest)
    expect(resubmissionAssessment.submittable).toBe(true)
    expect(resubmissionAssessment.conflicts).toEqual([])
  })
})
