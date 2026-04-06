import { z } from 'zod'
import {
  ReviewedAppCatalogEntrySchema,
  ReviewedAppManifestSchema,
  type ReviewedAppCatalogEntry,
  type ReviewedAppManifest,
} from './manifest'
import {
  ChatBridgePartnerManifestValidationReportSchema,
  validateChatBridgePartnerManifest,
  type ChatBridgePartnerManifestValidationReport,
} from './partner-validator'

export const CHATBRIDGE_PARTNER_SUBMISSION_SCHEMA_VERSION = 1 as const
export const CHATBRIDGE_PARTNER_SUBMISSION_SAMPLE_RUNTIME_FILE_NAME = 'checkpoint-coach-runtime.example.html'

export const ChatBridgePartnerSubmissionStatusSchema = z.enum(['submitted', 'approved', 'rejected'])
export type ChatBridgePartnerSubmissionStatus = z.infer<typeof ChatBridgePartnerSubmissionStatusSchema>

export const ChatBridgePartnerSubmissionRuntimePackageSchema = z
  .object({
    kind: z.literal('html'),
    fileName: z.string().trim().min(1),
    storageKey: z.string().trim().min(1),
    byteLength: z.number().int().nonnegative(),
    uploadedAt: z.number().int().nonnegative(),
  })
  .strict()
export type ChatBridgePartnerSubmissionRuntimePackage = z.infer<typeof ChatBridgePartnerSubmissionRuntimePackageSchema>

export const ChatBridgePartnerSubmissionReviewSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    reviewedAt: z.number().int().nonnegative(),
    reviewedBy: z.string().trim().min(1),
    notes: z.string().trim().min(1).optional(),
    catalogVersion: z.number().int().positive().optional(),
  })
  .strict()
export type ChatBridgePartnerSubmissionReview = z.infer<typeof ChatBridgePartnerSubmissionReviewSchema>

export const ChatBridgePartnerSubmissionRecordSchema = z
  .object({
    schemaVersion: z.literal(CHATBRIDGE_PARTNER_SUBMISSION_SCHEMA_VERSION),
    submissionId: z.string().trim().min(1),
    manifest: ReviewedAppManifestSchema,
    validation: ChatBridgePartnerManifestValidationReportSchema,
    status: ChatBridgePartnerSubmissionStatusSchema,
    submittedAt: z.number().int().nonnegative(),
    submittedBy: z.string().trim().min(1),
    developerNotes: z.string().trim().min(1).optional(),
    runtimePackage: ChatBridgePartnerSubmissionRuntimePackageSchema.nullable().default(null),
    review: ChatBridgePartnerSubmissionReviewSchema.nullable().default(null),
  })
  .strict()
  .superRefine((record, ctx) => {
    if (!record.validation.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validation'],
        message: 'Partner submission records may only persist validated manifests.',
      })
    }

    if (record.status === 'submitted' && record.review) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['review'],
        message: 'Submitted records may not have a review decision yet.',
      })
    }

    if (record.status === 'approved') {
      if (!record.review || record.review.decision !== 'approved') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['review'],
          message: 'Approved records must include an approved review decision.',
        })
      }

      if (!record.review?.catalogVersion) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['review', 'catalogVersion'],
          message: 'Approved records must record the catalog version used during approval.',
        })
      }
    }

    if (record.status === 'rejected' && (!record.review || record.review.decision !== 'rejected')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['review'],
        message: 'Rejected records must include a rejected review decision.',
      })
    }
  })
export type ChatBridgePartnerSubmissionRecord = z.infer<typeof ChatBridgePartnerSubmissionRecordSchema>

export const ChatBridgePartnerSubmissionStoreSchema = z
  .object({
    schemaVersion: z.literal(CHATBRIDGE_PARTNER_SUBMISSION_SCHEMA_VERSION),
    submissions: z.array(ChatBridgePartnerSubmissionRecordSchema).default([]),
  })
  .strict()
export type ChatBridgePartnerSubmissionStore = z.infer<typeof ChatBridgePartnerSubmissionStoreSchema>

export const ChatBridgePartnerSubmissionSampleManifestSchema = z.object({
  manifest: ReviewedAppManifestSchema,
  runtimeHtml: z.string().min(1),
  runtimeFileName: z.string().trim().min(1),
  developerNotes: z.string().trim().min(1),
})
export type ChatBridgePartnerSubmissionSampleManifest = z.infer<typeof ChatBridgePartnerSubmissionSampleManifestSchema>

function createDraftReviewedAppCatalogEntry(manifest: ReviewedAppManifest): ReviewedAppCatalogEntry {
  return ReviewedAppCatalogEntrySchema.parse({
    manifest,
    approval: {
      status: 'approved',
      reviewedAt: 0,
      reviewedBy: 'partner-draft',
      catalogVersion: 1,
    },
  })
}

function isCatalogEntryLike(value: unknown): value is { manifest: unknown } {
  return typeof value === 'object' && value !== null && 'manifest' in value
}

export function normalizeChatBridgePartnerSubmissionManifestInput(input: unknown): ReviewedAppManifest {
  if (isCatalogEntryLike(input)) {
    return ReviewedAppCatalogEntrySchema.parse(input).manifest
  }

  return ReviewedAppManifestSchema.parse(input)
}

export function createChatBridgePartnerSubmissionValidationReport(
  manifest: ReviewedAppManifest
): ChatBridgePartnerManifestValidationReport {
  return ChatBridgePartnerManifestValidationReportSchema.parse(
    validateChatBridgePartnerManifest(createDraftReviewedAppCatalogEntry(manifest))
  )
}

export function createReviewedAppCatalogEntryFromPartnerSubmission(
  record: ChatBridgePartnerSubmissionRecord
): ReviewedAppCatalogEntry {
  if (
    record.status !== 'approved' ||
    !record.review ||
    record.review.decision !== 'approved' ||
    !record.review.catalogVersion
  ) {
    throw new Error(`Partner submission "${record.submissionId}" is not approved and cannot join the reviewed catalog.`)
  }

  return ReviewedAppCatalogEntrySchema.parse({
    manifest: record.manifest,
    approval: {
      status: 'approved',
      reviewedAt: record.review.reviewedAt,
      reviewedBy: record.review.reviewedBy,
      catalogVersion: record.review.catalogVersion,
    },
  })
}

export function getApprovedPartnerSubmissionCatalogEntries(records: ChatBridgePartnerSubmissionRecord[]) {
  return records
    .filter((record) => record.status === 'approved')
    .map((record) => createReviewedAppCatalogEntryFromPartnerSubmission(record))
}

export function getChatBridgePartnerSubmissionSample(): ChatBridgePartnerSubmissionSampleManifest {
  return ChatBridgePartnerSubmissionSampleManifestSchema.parse({
    manifest: {
      appId: 'checkpoint-coach',
      name: 'Checkpoint Coach',
      version: '0.1.0',
      protocolVersion: 1,
      origin: 'https://apps.example.com',
      uiEntry: 'https://apps.example.com/checkpoint-coach',
      authMode: 'host-session',
      permissions: [
        {
          id: 'session.context.read',
          resource: 'chat.session',
          access: 'read',
          required: true,
          purpose: 'Resume the current classroom checkpoint from host-owned conversation context.',
        },
      ],
      toolSchemas: [
        {
          name: 'checkpoint_coach_open',
          title: 'Open Checkpoint Coach',
          description: 'Launch the reviewed Checkpoint Coach app for a structured class checkpoint.',
          schemaVersion: 1,
          inputSchema: {
            type: 'object',
            properties: {
              request: {
                type: 'string',
                description: 'Natural-language request that triggered the launch.',
                minLength: 1,
              },
              checkpointId: {
                type: 'string',
                description: 'Optional checkpoint identifier to reopen.',
              },
            },
            required: ['request'],
          },
        },
      ],
      supportedEvents: ['host.init', 'app.ready', 'app.state', 'app.complete', 'app.error'],
      completionModes: ['summary', 'state'],
      timeouts: {
        launchMs: 15_000,
        idleMs: 120_000,
        completionMs: 10_000,
      },
      safetyMetadata: {
        reviewed: true,
        sandbox: 'hosted-iframe',
        handlesStudentData: true,
        requiresTeacherApproval: false,
      },
      launchSurfaces: {
        'desktop-electron': {
          sandbox: 'hosted-iframe',
        },
        'web-browser': {
          sandbox: 'hosted-iframe',
        },
      },
      tenantAvailability: {
        default: 'enabled',
        allow: [],
        deny: [],
      },
      healthcheck: {
        url: 'https://apps.example.com/healthz',
        intervalMs: 30_000,
        timeoutMs: 2_000,
      },
    },
    runtimeFileName: CHATBRIDGE_PARTNER_SUBMISSION_SAMPLE_RUNTIME_FILE_NAME,
    developerNotes:
      'Single-file reviewed runtime example for the self-serve partner portal. It acknowledges host.bootstrap, emits resumable app.state snapshots, and completes explicitly.',
    runtimeHtml: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Checkpoint Coach</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(20, 83, 45, 0.14), transparent 42%),
          linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
        color: #0f172a;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        padding: 24px;
      }
      .shell {
        max-width: 720px;
        margin: 0 auto;
        padding: 24px;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.88);
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
        display: grid;
        gap: 20px;
      }
      .eyebrow {
        margin: 0;
        font-size: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #166534;
        font-weight: 700;
      }
      h1 {
        margin: 0;
        font-size: 30px;
        line-height: 1.1;
      }
      p {
        margin: 0;
      }
      .status {
        display: grid;
        gap: 8px;
        padding: 16px;
        border-radius: 18px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
      }
      .status strong {
        font-size: 14px;
      }
      .prompts {
        display: grid;
        gap: 12px;
      }
      .prompt {
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid #d1d5db;
        background: white;
      }
      .prompt h2 {
        margin: 0 0 8px;
        font-size: 16px;
      }
      .prompt button {
        margin-top: 12px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      button {
        border: 0;
        border-radius: 999px;
        padding: 11px 16px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .primary {
        background: #0f172a;
        color: white;
      }
      .secondary {
        background: #dcfce7;
        color: #14532d;
      }
      .muted {
        background: #e2e8f0;
        color: #334155;
      }
      code {
        padding: 2px 6px;
        border-radius: 999px;
        background: #e2e8f0;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <div>
        <p class="eyebrow">Reviewed partner runtime</p>
        <h1>Checkpoint Coach</h1>
      </div>
      <section class="status" aria-live="polite">
        <strong id="status-title">Waiting for host bootstrap...</strong>
        <p id="status-detail">This sample runtime becomes active after the host sends its launch-scoped bridge envelope.</p>
      </section>
      <section class="prompts">
        <article class="prompt">
          <h2>Checkpoint 1</h2>
          <p>Summarize the water cycle in your own words.</p>
          <button id="advance-button" class="secondary" type="button" disabled>Mark checkpoint complete</button>
        </article>
        <article class="prompt">
          <h2>Checkpoint 2</h2>
          <p>Explain why evaporation and condensation are both necessary.</p>
          <button id="complete-button" class="primary" type="button" disabled>Finish session</button>
        </article>
      </section>
      <div class="actions">
        <span><code id="bridge-session-label">bridge: pending</code></span>
        <span><code id="checkpoint-label">checkpoint: 0 of 2</code></span>
      </div>
    </main>
    <script>
      const COMPLETION_SCHEMA_VERSION = 1
      let bridge = null
      let checkpoint = 0

      const statusTitle = document.getElementById('status-title')
      const statusDetail = document.getElementById('status-detail')
      const bridgeLabel = document.getElementById('bridge-session-label')
      const checkpointLabel = document.getElementById('checkpoint-label')
      const advanceButton = document.getElementById('advance-button')
      const completeButton = document.getElementById('complete-button')

      function updateCheckpointUi() {
        checkpointLabel.textContent = 'checkpoint: ' + checkpoint + ' of 2'
        advanceButton.disabled = !bridge || checkpoint >= 1
        completeButton.disabled = !bridge || checkpoint < 1
      }

      function postEvent(message) {
        if (!bridge) {
          return
        }

        window.parent.postMessage(
          {
            ...message,
            bridgeSessionId: bridge.bridgeSessionId,
            appInstanceId: bridge.appInstanceId,
            bridgeToken: bridge.bridgeToken,
          },
          bridge.expectedOrigin || '*'
        )
      }

      function emitState() {
        postEvent({
          kind: 'app.state',
          sequence: bridge.nextSequence++,
          idempotencyKey: 'checkpoint-state-' + checkpoint,
          snapshot: {
            route: '/checkpoints/checkpoint-' + (checkpoint + 1),
            checkpointIndex: checkpoint,
            checkpointLabel: checkpoint === 0 ? 'Checkpoint 1' : 'Checkpoint 2',
            completionReady: checkpoint >= 1,
          },
        })
      }

      window.addEventListener('message', (event) => {
        const payload = event.data
        if (!payload || payload.kind !== 'host.bootstrap') {
          return
        }

        const envelope = payload.envelope
        bridge = {
          bridgeSessionId: envelope.bridgeSessionId,
          appInstanceId: envelope.appInstanceId,
          bridgeToken: envelope.bridgeToken,
          bootstrapNonce: envelope.bootstrapNonce,
          expectedOrigin: event.origin,
          nextSequence: 2,
        }

        statusTitle.textContent = 'Host bootstrap accepted'
        statusDetail.textContent =
          'Checkpoint Coach is now running inside the reviewed host shell and can publish resumable checkpoint state.'
        bridgeLabel.textContent = 'bridge: ' + bridge.bridgeSessionId
        updateCheckpointUi()

        window.parent.postMessage(
          {
            kind: 'app.ready',
            bridgeSessionId: bridge.bridgeSessionId,
            appInstanceId: bridge.appInstanceId,
            bridgeToken: bridge.bridgeToken,
            ackNonce: bridge.bootstrapNonce,
            sequence: 1,
          },
          bridge.expectedOrigin || '*'
        )

        emitState()
      })

      advanceButton.addEventListener('click', () => {
        checkpoint = 1
        statusTitle.textContent = 'Checkpoint 1 complete'
        statusDetail.textContent = 'The runtime emitted app.state so the host can resume the second checkpoint later.'
        updateCheckpointUi()
        emitState()
      })

      completeButton.addEventListener('click', () => {
        statusTitle.textContent = 'Checkpoint session complete'
        statusDetail.textContent =
          'The runtime is sending app.complete so the host can keep only the bounded completion summary for later chat turns.'

        postEvent({
          kind: 'app.complete',
          sequence: bridge.nextSequence++,
          idempotencyKey: 'checkpoint-complete-' + checkpoint,
          completion: {
            schemaVersion: COMPLETION_SCHEMA_VERSION,
            status: 'success',
            outcomeData: {
              checkpointId: 'checkpoint-2',
              completedSteps: 2,
            },
            suggestedSummary: {
              text: 'Checkpoint Coach finished the current two-step checkpoint and returned the saved student progress to chat.',
            },
          },
        })
      })

      updateCheckpointUi()
    </script>
  </body>
</html>`,
  })
}
