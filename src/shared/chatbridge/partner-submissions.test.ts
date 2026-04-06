import { describe, expect, it } from 'vitest'
import {
  createChatBridgePartnerSubmissionValidationReport,
  createReviewedAppCatalogEntryFromPartnerSubmission,
  getChatBridgePartnerSubmissionSample,
  normalizeChatBridgePartnerSubmissionManifestInput,
} from './partner-submissions'

describe('partner submission shared helpers', () => {
  it('normalizes either a bare manifest or a full reviewed catalog entry into the reviewed manifest contract', () => {
    const sample = getChatBridgePartnerSubmissionSample()
    const bareManifest = normalizeChatBridgePartnerSubmissionManifestInput(sample.manifest)
    const fullEntryManifest = normalizeChatBridgePartnerSubmissionManifestInput({
      manifest: sample.manifest,
      approval: {
        status: 'approved',
        reviewedAt: 1,
        reviewedBy: 'platform-review',
        catalogVersion: 2,
      },
    })

    expect(bareManifest.appId).toBe('checkpoint-coach')
    expect(fullEntryManifest.toolSchemas[0]?.name).toBe('checkpoint_coach_open')
  })

  it('creates validation reports for draft manifests and promotes approved records back into the reviewed catalog', () => {
    const sample = getChatBridgePartnerSubmissionSample()
    const validation = createChatBridgePartnerSubmissionValidationReport(sample.manifest)

    expect(validation.valid).toBe(true)
    expect(validation.guidance?.requiredManifestEvents).toContain('app.complete')

    const catalogEntry = createReviewedAppCatalogEntryFromPartnerSubmission({
      schemaVersion: 1,
      submissionId: 'submission-1',
      manifest: sample.manifest,
      validation,
      status: 'approved',
      submittedAt: 1_717_000_000_000,
      submittedBy: 'partner-portal',
      developerNotes: sample.developerNotes,
      runtimePackage: {
        kind: 'html',
        fileName: sample.runtimeFileName,
        storageKey: 'chatbridge:partner-runtime:submission-1',
        byteLength: sample.runtimeHtml.length,
        uploadedAt: 1_717_000_000_000,
      },
      review: {
        decision: 'approved',
        reviewedAt: 1_717_000_100_000,
        reviewedBy: 'platform-review',
        notes: 'Approved for demo tenant.',
        catalogVersion: 4,
      },
    })

    expect(catalogEntry.manifest.appId).toBe('checkpoint-coach')
    expect(catalogEntry.approval.catalogVersion).toBe(4)
  })
})
