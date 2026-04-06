import {
  createChatBridgePartnerSubmissionValidationReport,
  createReviewedAppCatalogEntryFromPartnerSubmission,
  getApprovedPartnerSubmissionCatalogEntries,
  getChatBridgePartnerSubmissionSample,
  getDefaultReviewedAppCatalogEntries,
  getLegacyReviewedAppCatalogEntries,
  normalizeChatBridgePartnerSubmissionManifestInput,
  setReviewedAppCatalog,
  ChatBridgePartnerSubmissionRecordSchema,
  ChatBridgePartnerSubmissionStoreSchema,
  type ChatBridgePartnerManifestValidationReport,
  type ChatBridgePartnerSubmissionRecord,
  type ChatBridgePartnerSubmissionRuntimePackage,
  type ReviewedAppCatalogEntry,
  type ReviewedAppManifest,
} from '@shared/chatbridge'
import storage from '@/storage'

const CHATBRIDGE_PARTNER_SUBMISSIONS_STORAGE_KEY = 'chatbridge:partner-submissions'
const CHATBRIDGE_PARTNER_RUNTIME_BLOB_PREFIX = 'chatbridge:partner-runtime'
const DEFAULT_SUBMITTED_BY = 'partner-portal'
const DEFAULT_REVIEWED_BY = 'platform-review'

export type ChatBridgePartnerSubmissionConflictSource =
  | 'active-flagship'
  | 'legacy-reference'
  | 'submitted'
  | 'approved'

export interface ChatBridgePartnerSubmissionConflict {
  kind: 'appId' | 'toolName'
  value: string
  sourceAppId: string
  sourceAppName: string
  sourceStatus: ChatBridgePartnerSubmissionConflictSource
}

export interface ChatBridgePartnerSubmissionAssessment {
  manifest: ReviewedAppManifest | null
  validation: ChatBridgePartnerManifestValidationReport | null
  parseError: string | null
  conflicts: ChatBridgePartnerSubmissionConflict[]
  submittable: boolean
}

export class ChatBridgePartnerSubmissionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'parse-error'
      | 'invalid-manifest'
      | 'duplicate-app-id'
      | 'duplicate-tool-name'
      | 'not-found'
      | 'invalid-status'
      | 'runtime-package-invalid'
  ) {
    super(message)
    this.name = 'ChatBridgePartnerSubmissionError'
  }
}

type SubmitChatBridgePartnerSubmissionInput = {
  manifestInput: unknown
  developerNotes?: string
  runtimeHtml?: string | null
  runtimeFileName?: string | null
  submittedBy?: string
  now?: () => number
  createId?: () => string
}

type ReviewChatBridgePartnerSubmissionInput = {
  submissionId: string
  reviewNotes?: string
  reviewedBy?: string
  now?: () => number
}

type ConflictCandidate = {
  sourceStatus: ChatBridgePartnerSubmissionConflictSource
  entry: ReviewedAppCatalogEntry
}

let cachedSubmissions: ChatBridgePartnerSubmissionRecord[] | null = null
const approvedRuntimeMarkupByAppId = new Map<string, string>()

function createDefaultStore() {
  return ChatBridgePartnerSubmissionStoreSchema.parse({
    schemaVersion: 1,
    submissions: [],
  })
}

function cloneRecord<T>(value: T): T {
  return structuredClone(value)
}

function parseManifestInput(input: unknown) {
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) {
      throw new ChatBridgePartnerSubmissionError(
        'Paste a reviewed manifest JSON payload before validating it.',
        'parse-error'
      )
    }

    try {
      return JSON.parse(trimmed) as unknown
    } catch (error) {
      throw new ChatBridgePartnerSubmissionError(
        error instanceof Error ? error.message : 'The manifest JSON could not be parsed.',
        'parse-error'
      )
    }
  }

  return input
}

function buildRuntimeBlobKey(submissionId: string) {
  return `${CHATBRIDGE_PARTNER_RUNTIME_BLOB_PREFIX}:${submissionId}`
}

function createByteLength(value: string) {
  return new TextEncoder().encode(value).length
}

function normalizeReviewNotes(notes?: string) {
  const trimmed = notes?.trim()
  return trimmed ? trimmed : undefined
}

function getReservedCatalogCandidates(
  records: ChatBridgePartnerSubmissionRecord[],
  excludeSubmissionId?: string
): ConflictCandidate[] {
  const activeCatalog = getDefaultReviewedAppCatalogEntries().map((entry) => ({
    sourceStatus: 'active-flagship' as const,
    entry,
  }))
  const legacyCatalog = getLegacyReviewedAppCatalogEntries().map((entry) => ({
    sourceStatus: 'legacy-reference' as const,
    entry,
  }))
  const dynamicCatalog = records
    .filter((record) => record.submissionId !== excludeSubmissionId && record.status !== 'rejected')
    .map((record) => ({
      sourceStatus:
        record.status === 'approved'
          ? ('approved' as ChatBridgePartnerSubmissionConflictSource)
          : ('submitted' as ChatBridgePartnerSubmissionConflictSource),
      entry:
        record.status === 'approved'
          ? createReviewedAppCatalogEntryFromPartnerSubmission(record)
          : ({
              manifest: record.manifest,
              approval: {
                status: 'approved',
                reviewedAt: record.submittedAt,
                reviewedBy: record.submittedBy,
                catalogVersion: 1,
              },
            } satisfies ReviewedAppCatalogEntry),
    }))

  return [...activeCatalog, ...legacyCatalog, ...dynamicCatalog]
}

function collectSubmissionConflicts(
  manifest: ReviewedAppManifest,
  candidates: ConflictCandidate[]
): ChatBridgePartnerSubmissionConflict[] {
  const conflicts: ChatBridgePartnerSubmissionConflict[] = []

  for (const candidate of candidates) {
    if (candidate.entry.manifest.appId === manifest.appId) {
      conflicts.push({
        kind: 'appId',
        value: manifest.appId,
        sourceAppId: candidate.entry.manifest.appId,
        sourceAppName: candidate.entry.manifest.name,
        sourceStatus: candidate.sourceStatus,
      })
    }

    const toolNames = new Set(candidate.entry.manifest.toolSchemas.map((tool) => tool.name))
    for (const tool of manifest.toolSchemas) {
      if (!toolNames.has(tool.name)) {
        continue
      }

      conflicts.push({
        kind: 'toolName',
        value: tool.name,
        sourceAppId: candidate.entry.manifest.appId,
        sourceAppName: candidate.entry.manifest.name,
        sourceStatus: candidate.sourceStatus,
      })
    }
  }

  return conflicts.filter((conflict, index, source) => {
    return (
      source.findIndex(
        (candidate) =>
          candidate.kind === conflict.kind &&
          candidate.value === conflict.value &&
          candidate.sourceAppId === conflict.sourceAppId &&
          candidate.sourceStatus === conflict.sourceStatus
      ) === index
    )
  })
}

function sortSubmissions(records: ChatBridgePartnerSubmissionRecord[]) {
  return [...records].sort((left, right) => {
    if (left.submittedAt !== right.submittedAt) {
      return right.submittedAt - left.submittedAt
    }

    return left.submissionId.localeCompare(right.submissionId)
  })
}

async function readSubmissionStore() {
  const rawValue = await storage.getItem(CHATBRIDGE_PARTNER_SUBMISSIONS_STORAGE_KEY, createDefaultStore())
  const parsed = ChatBridgePartnerSubmissionStoreSchema.safeParse(rawValue)

  if (parsed.success) {
    return parsed.data
  }

  const fallback = createDefaultStore()
  await storage.setItemNow(CHATBRIDGE_PARTNER_SUBMISSIONS_STORAGE_KEY, fallback)
  return fallback
}

async function writeSubmissionStore(records: ChatBridgePartnerSubmissionRecord[]) {
  const nextStore = ChatBridgePartnerSubmissionStoreSchema.parse({
    schemaVersion: 1,
    submissions: sortSubmissions(records),
  })
  await storage.setItemNow(CHATBRIDGE_PARTNER_SUBMISSIONS_STORAGE_KEY, nextStore)
  cachedSubmissions = nextStore.submissions.map((record) => cloneRecord(record))
  return cachedSubmissions
}

async function ensureCachedSubmissions() {
  if (cachedSubmissions) {
    return cachedSubmissions.map((record) => cloneRecord(record))
  }

  const store = await readSubmissionStore()
  cachedSubmissions = store.submissions.map((record) => cloneRecord(record))
  return cachedSubmissions.map((record) => cloneRecord(record))
}

function getNextCatalogVersion(records: ChatBridgePartnerSubmissionRecord[]) {
  const builtInCatalogVersions = [
    ...getDefaultReviewedAppCatalogEntries(),
    ...getLegacyReviewedAppCatalogEntries(),
  ].map((entry) => entry.approval.catalogVersion)
  const approvedSubmissionVersions = records
    .filter((record) => record.status === 'approved')
    .map((record) => record.review?.catalogVersion ?? 0)

  return Math.max(0, ...builtInCatalogVersions, ...approvedSubmissionVersions) + 1
}

function coerceRuntimePackage(
  submissionId: string,
  runtimeHtml: string | null | undefined,
  runtimeFileName: string | null | undefined,
  uploadedAt: number
): ChatBridgePartnerSubmissionRuntimePackage | null {
  if (!runtimeHtml || runtimeHtml.trim().length === 0) {
    return null
  }

  const fileName = runtimeFileName?.trim() || 'reviewed-partner-runtime.html'
  return {
    kind: 'html',
    fileName,
    storageKey: buildRuntimeBlobKey(submissionId),
    byteLength: createByteLength(runtimeHtml),
    uploadedAt,
  }
}

export async function hydrateChatBridgePartnerSubmissions() {
  const records = await ensureCachedSubmissions()
  const approvedEntries = getApprovedPartnerSubmissionCatalogEntries(records)
  setReviewedAppCatalog([...getDefaultReviewedAppCatalogEntries(), ...approvedEntries])

  approvedRuntimeMarkupByAppId.clear()

  await Promise.all(
    records
      .filter((record) => record.status === 'approved' && record.runtimePackage)
      .map(async (record) => {
        const runtimeHtml = await storage.getBlob(record.runtimePackage!.storageKey).catch(() => null)
        if (runtimeHtml) {
          approvedRuntimeMarkupByAppId.set(record.manifest.appId, runtimeHtml)
        }
      })
  )

  return records
}

export function getApprovedPartnerRuntimeMarkup(appId: string) {
  return approvedRuntimeMarkupByAppId.get(appId) ?? null
}

export async function assessChatBridgePartnerSubmissionInput(
  manifestInput: unknown,
  options: { excludeSubmissionId?: string } = {}
): Promise<ChatBridgePartnerSubmissionAssessment> {
  const records = await ensureCachedSubmissions()
  let parsedInput: unknown
  try {
    parsedInput = parseManifestInput(manifestInput)
  } catch (error) {
    return {
      manifest: null,
      validation: null,
      parseError: error instanceof Error ? error.message : 'The manifest JSON could not be parsed.',
      conflicts: [],
      submittable: false,
    }
  }

  let manifest: ReviewedAppManifest
  try {
    manifest = normalizeChatBridgePartnerSubmissionManifestInput(parsedInput)
  } catch (error) {
    return {
      manifest: null,
      validation: null,
      parseError: error instanceof Error ? error.message : 'The manifest did not match the reviewed partner schema.',
      conflicts: [],
      submittable: false,
    }
  }

  const validation = createChatBridgePartnerSubmissionValidationReport(manifest)
  const conflicts = collectSubmissionConflicts(
    manifest,
    getReservedCatalogCandidates(records, options.excludeSubmissionId)
  )

  return {
    manifest,
    validation,
    parseError: null,
    conflicts,
    submittable: validation.valid && conflicts.length === 0,
  }
}

export async function listChatBridgePartnerSubmissions() {
  const records = await ensureCachedSubmissions()
  return sortSubmissions(records).map((record) => cloneRecord(record))
}

export async function submitChatBridgePartnerSubmission(
  input: SubmitChatBridgePartnerSubmissionInput
): Promise<ChatBridgePartnerSubmissionRecord> {
  const now = input.now ?? (() => Date.now())
  const createId = input.createId ?? (() => crypto.randomUUID())
  const submittedAt = now()
  const assessment = await assessChatBridgePartnerSubmissionInput(input.manifestInput)

  if (assessment.parseError) {
    throw new ChatBridgePartnerSubmissionError(assessment.parseError, 'parse-error')
  }

  if (!assessment.manifest || !assessment.validation?.valid) {
    throw new ChatBridgePartnerSubmissionError(
      'The manifest did not pass the reviewed partner contract.',
      'invalid-manifest'
    )
  }

  const duplicateApp = assessment.conflicts.find((conflict) => conflict.kind === 'appId')
  if (duplicateApp) {
    throw new ChatBridgePartnerSubmissionError(
      `App id "${duplicateApp.value}" is already reserved by ${duplicateApp.sourceAppName}.`,
      'duplicate-app-id'
    )
  }

  const duplicateTool = assessment.conflicts.find((conflict) => conflict.kind === 'toolName')
  if (duplicateTool) {
    throw new ChatBridgePartnerSubmissionError(
      `Tool name "${duplicateTool.value}" is already reserved by ${duplicateTool.sourceAppName}.`,
      'duplicate-tool-name'
    )
  }

  const submissionId = createId()
  const runtimePackage = coerceRuntimePackage(submissionId, input.runtimeHtml, input.runtimeFileName, submittedAt)
  if (input.runtimeHtml && !runtimePackage) {
    throw new ChatBridgePartnerSubmissionError('The uploaded runtime package was empty.', 'runtime-package-invalid')
  }

  if (runtimePackage && input.runtimeHtml) {
    await storage.setBlob(runtimePackage.storageKey, input.runtimeHtml)
  }

  const records = await ensureCachedSubmissions()
  const nextRecord = ChatBridgePartnerSubmissionRecordSchema.parse({
    schemaVersion: 1,
    submissionId,
    manifest: assessment.manifest,
    validation: assessment.validation,
    status: 'submitted',
    submittedAt,
    submittedBy: input.submittedBy?.trim() || DEFAULT_SUBMITTED_BY,
    developerNotes: normalizeReviewNotes(input.developerNotes),
    runtimePackage,
    review: null,
  })

  await writeSubmissionStore([...records, nextRecord])
  await hydrateChatBridgePartnerSubmissions()
  return cloneRecord(nextRecord)
}

export async function approveChatBridgePartnerSubmission(
  input: ReviewChatBridgePartnerSubmissionInput
): Promise<ChatBridgePartnerSubmissionRecord> {
  const now = input.now ?? (() => Date.now())
  const records = await ensureCachedSubmissions()
  const target = records.find((record) => record.submissionId === input.submissionId)

  if (!target) {
    throw new ChatBridgePartnerSubmissionError(`Partner submission "${input.submissionId}" was not found.`, 'not-found')
  }

  if (target.status !== 'submitted') {
    throw new ChatBridgePartnerSubmissionError(
      `Partner submission "${input.submissionId}" is already ${target.status}.`,
      'invalid-status'
    )
  }

  const assessment = await assessChatBridgePartnerSubmissionInput(target.manifest, {
    excludeSubmissionId: target.submissionId,
  })
  if (!assessment.manifest || !assessment.validation?.valid) {
    throw new ChatBridgePartnerSubmissionError(
      `Partner submission "${input.submissionId}" no longer passes validation and cannot be approved.`,
      'invalid-manifest'
    )
  }

  const duplicateConflict = assessment.conflicts[0]
  if (duplicateConflict) {
    throw new ChatBridgePartnerSubmissionError(
      `Partner submission "${input.submissionId}" conflicts with ${duplicateConflict.sourceAppName} and cannot be approved.`,
      duplicateConflict.kind === 'appId' ? 'duplicate-app-id' : 'duplicate-tool-name'
    )
  }

  const reviewedAt = now()
  const catalogVersion = getNextCatalogVersion(records)
  const approvedRecord = ChatBridgePartnerSubmissionRecordSchema.parse({
    ...target,
    validation: assessment.validation,
    status: 'approved',
    review: {
      decision: 'approved',
      reviewedAt,
      reviewedBy: input.reviewedBy?.trim() || DEFAULT_REVIEWED_BY,
      notes: normalizeReviewNotes(input.reviewNotes),
      catalogVersion,
    },
  })

  await writeSubmissionStore(
    records.map((record) => (record.submissionId === approvedRecord.submissionId ? approvedRecord : record))
  )
  await hydrateChatBridgePartnerSubmissions()
  return cloneRecord(approvedRecord)
}

export async function rejectChatBridgePartnerSubmission(
  input: ReviewChatBridgePartnerSubmissionInput
): Promise<ChatBridgePartnerSubmissionRecord> {
  const now = input.now ?? (() => Date.now())
  const records = await ensureCachedSubmissions()
  const target = records.find((record) => record.submissionId === input.submissionId)

  if (!target) {
    throw new ChatBridgePartnerSubmissionError(`Partner submission "${input.submissionId}" was not found.`, 'not-found')
  }

  if (target.status !== 'submitted') {
    throw new ChatBridgePartnerSubmissionError(
      `Partner submission "${input.submissionId}" is already ${target.status}.`,
      'invalid-status'
    )
  }

  const rejectedRecord = ChatBridgePartnerSubmissionRecordSchema.parse({
    ...target,
    status: 'rejected',
    review: {
      decision: 'rejected',
      reviewedAt: now(),
      reviewedBy: input.reviewedBy?.trim() || DEFAULT_REVIEWED_BY,
      notes: normalizeReviewNotes(input.reviewNotes) ?? 'Rejected from the host review queue.',
    },
  })

  await writeSubmissionStore(
    records.map((record) => (record.submissionId === rejectedRecord.submissionId ? rejectedRecord : record))
  )
  await hydrateChatBridgePartnerSubmissions()
  return cloneRecord(rejectedRecord)
}

export function getChatBridgePartnerSubmissionPortalSample() {
  return cloneRecord(getChatBridgePartnerSubmissionSample())
}

export async function resetChatBridgePartnerSubmissionStateForTests() {
  cachedSubmissions = null
  approvedRuntimeMarkupByAppId.clear()

  await storage.removeItem(CHATBRIDGE_PARTNER_SUBMISSIONS_STORAGE_KEY).catch(() => undefined)
  const blobKeys = await storage.getBlobKeys().catch(() => [])
  await Promise.all(
    blobKeys
      .filter((key) => key.startsWith(CHATBRIDGE_PARTNER_RUNTIME_BLOB_PREFIX))
      .map((key) => storage.delBlob(key).catch(() => undefined))
  )
  setReviewedAppCatalog(getDefaultReviewedAppCatalogEntries())
}
