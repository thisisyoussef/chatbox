import { normalizeChatBridgeChessRuntimeSnapshot } from './chess'
import {
  CHESS_APP_ID,
  CHESS_APP_NAME,
  DEFAULT_CHESS_AI_CONFIG,
  createInitialChessAppSnapshot,
  getChessDescription,
  getChessFallbackText,
  getChessStatusLabel,
  getChessSummary,
} from './apps/chess'
import {
  DRAWING_KIT_APP_ID,
  DRAWING_KIT_APP_NAME,
  createInitialDrawingKitAppSnapshot,
  getDrawingKitFallbackText,
  getDrawingKitStatusLabel,
  type DrawingKitAppSnapshot,
} from './apps/drawing-kit'
import {
  FLASHCARD_STUDIO_APP_ID,
  FLASHCARD_STUDIO_APP_NAME,
  createFlashcardStudioAppSnapshot,
  type FlashcardStudioAppSnapshot,
} from './apps/flashcard-studio'
import {
  WEATHER_DASHBOARD_APP_ID,
  WEATHER_DASHBOARD_APP_NAME,
  createWeatherDashboardReadySnapshot,
  type WeatherDashboardSnapshot,
} from './apps/weather-dashboard'
import {
  CHATBRIDGE_DEGRADED_COMPLETION_SCHEMA_VERSION,
  writeChatBridgeDegradedCompletionValues,
} from './degraded-completion'
import { createChatBridgeAppEvent, applyChatBridgeAppEvent } from './events'
import { createChatBridgeAppInstance } from './instance'
import {
  createChatBridgeBridgeRejectionRecoveryContract,
  createChatBridgeMalformedBridgeRecoveryContract,
  createChatBridgeRuntimeCrashRecoveryContract,
  createChatBridgeTimeoutRecoveryContract,
  writeChatBridgeRecoveryContractValues,
} from './recovery-contract'
import { writeChatBridgeReviewedAppLaunchValues } from './reviewed-app-launch'
import { createChatBridgeRouteMessagePart } from './routing'
import {
  ChatBridgeStoryBuilderStateSchema,
  type ChatBridgeStoryBuilderMode,
} from './story-builder'
import { CHATBRIDGE_HOST_TOOL_SCHEMA_VERSION } from './tools'
import type { Message, Session, SessionThread } from '../types'

type ToolCallState = 'call' | 'result' | 'error'
type AppLifecycle = 'launching' | 'ready' | 'active' | 'complete' | 'stale' | 'error'

type AppLifecycleMessageOptions = {
  appId?: string
  appName?: string
  toolCallId: string
  lifecycle: AppLifecycle
  state?: ToolCallState
  partial?: boolean
  attachmentName?: string
  summary?: string
  error?: string
  title?: string
  description?: string
  statusText?: string
  fallbackTitle?: string
  fallbackText?: string
  snapshot?: Record<string, unknown>
  values?: Record<string, unknown>
}

export type ChatBridgeLiveSeedAuditStep = {
  action: string
  expected: string
}

export type ChatBridgeLiveSeedFixtureRole = 'active-flagship' | 'legacy-reference' | 'platform-regression'
export type ChatBridgeLiveSeedSmokeSupport = 'legacy-reference' | 'supported'

export type ChatBridgeLiveSeedFixture = {
  id: string
  name: string
  description: string
  fixtureRole: ChatBridgeLiveSeedFixtureRole
  smokeSupport: ChatBridgeLiveSeedSmokeSupport
  coverage: string[]
  auditSteps: ChatBridgeLiveSeedAuditStep[]
  sessionInput: Omit<Session, 'id'>
  blobEntries?: Array<{
    key: string
    value: string
  }>
}

export type ChatBridgeLiveSeedInspectionEntry = {
  fixtureId: string
  fixtureName: string
  description: string
  fixtureRole: ChatBridgeLiveSeedFixtureRole
  smokeSupport: ChatBridgeLiveSeedSmokeSupport
  coverage: string[]
  auditStepCount: number
  blobEntryCount: number
}

const APP_ID = 'story-builder'
const APP_NAME = 'Story Builder'
export const CHATBRIDGE_LIVE_SEED_PREFIX = '[Seeded] ChatBridge:'
const CHESS_MID_GAME_FEN = 'r1bqkbnr/ppp2ppp/2np4/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 6'

function buildAttachmentStorageKey(messageId: string) {
  return `fixture:${messageId}:attachment`
}

function createTextMessage(id: string, role: Message['role'], text: string, timestamp: number): Message {
  return {
    id,
    role,
    timestamp,
    contentParts: [{ type: 'text', text }],
  }
}

export function createAppLifecycleMessage(
  id: string,
  role: Message['role'],
  text: string,
  options: AppLifecycleMessageOptions & { timestamp?: number }
): Message {
  const appId = options.appId ?? APP_ID
  const appName = options.appName ?? APP_NAME
  const lifecycle = options.lifecycle
  const summary = options.summary ?? `${appName} lifecycle: ${lifecycle}`
  const appInstanceId = `app-instance-${options.toolCallId}`
  const bridgeSessionId = `bridge-${options.toolCallId}`
  const timestamp = options.timestamp ?? 1
  const snapshot = options.snapshot ?? {
    route: '/apps/story-builder',
    status: lifecycle,
  }

  return {
    id,
    role,
    timestamp,
    contentParts: [
      { type: 'text', text },
      {
        type: 'app',
        appId,
        appName,
        appInstanceId,
        lifecycle,
        summary,
        toolCallId: options.toolCallId,
        bridgeSessionId,
        title: options.title,
        description: options.description,
        statusText: options.statusText,
        fallbackTitle: options.fallbackTitle,
        fallbackText: options.fallbackText,
        values: options.values,
        error: options.error,
        snapshot,
      },
      {
        type: 'tool-call',
        state: options.state ?? 'result',
        toolCallId: options.toolCallId,
        toolName: 'chatbridge_app_state',
        args: {
          appId,
          lifecycle,
          bridgeSessionId,
        },
        ...(options.partial
          ? {}
          : {
              result: {
                appId,
                appName,
                appInstanceId,
                lifecycle,
                summary,
                snapshot,
              },
            }),
      },
    ],
    files: options.attachmentName
      ? [
          {
            id: `file-${id}`,
            name: options.attachmentName,
            fileType: 'application/json',
            storageKey: buildAttachmentStorageKey(id),
          },
        ]
      : undefined,
  }
}

function createHtmlPreviewMessage(id: string, timestamp: number): Message {
  const htmlPreviewMarkdown = [
    'Here is the seeded HTML preview runtime for live inspection.',
    '',
    '```html',
    '<main class="preview-card">',
    '  <p class="eyebrow">ChatBridge Seed</p>',
    '  <h1 id="title">Host-owned preview runtime</h1>',
    '  <p id="detail">The seeded runtime is mounted inside the message shell.</p>',
    '  <button id="advance" type="button">Advance state</button>',
    '</main>',
    '```',
    '',
    '```css',
    'body {',
    '  margin: 0;',
    '  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;',
    '  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);',
    '  color: #0f172a;',
    '}',
    '.preview-card {',
    '  min-height: 100vh;',
    '  display: grid;',
    '  gap: 16px;',
    '  align-content: center;',
    '  padding: 32px;',
    '}',
    '.eyebrow {',
    '  margin: 0;',
    '  text-transform: uppercase;',
    '  letter-spacing: 0.18em;',
    '  font-size: 12px;',
    '  color: #475569;',
    '}',
    'h1 {',
    '  margin: 0;',
    '  font-size: 32px;',
    '}',
    '#detail {',
    '  margin: 0;',
    '  max-width: 42ch;',
    '  color: #334155;',
    '}',
    'button {',
    '  width: fit-content;',
    '  border: 0;',
    '  border-radius: 999px;',
    '  background: #0f172a;',
    '  color: white;',
    '  padding: 12px 18px;',
    '  font: inherit;',
    '  cursor: pointer;',
    '}',
    '```',
    '',
    '```javascript',
    'const detail = document.getElementById("detail")',
    'const advance = document.getElementById("advance")',
    'advance?.addEventListener("click", () => {',
    '  if (detail) {',
    '    detail.textContent = "The runtime updated inside the bridge session without leaving the host shell."',
    '  }',
    '  if (advance) {',
    '    advance.textContent = "State advanced"',
    '  }',
    '})',
    '```',
  ].join('\n')

  return createTextMessage(id, 'assistant', htmlPreviewMarkdown, timestamp)
}

function createStoryBuilderState(options: {
  mode: ChatBridgeStoryBuilderMode
  driveStatus: 'needs-auth' | 'connecting' | 'connected' | 'expired'
  driveStatusLabel: string
  driveDetail: string
  chapterLabel: string
  title: string
  summary: string
  excerpt: string
  wordCount: number
  saveState: 'saved' | 'saving' | 'attention'
  saveLabel: string
  connectedAs?: string
  folderLabel?: string
  lastSyncedLabel?: string
  calloutTitle?: string
  calloutDescription?: string
  checkpoints?: Array<{
    checkpointId: string
    label: string
    description: string
    savedAtLabel: string
    status: 'latest' | 'saved' | 'attention'
    locationLabel?: string
  }>
  completion?: {
    title: string
    description: string
    handoffLabel?: string
    nextStepLabel?: string
  }
  userGoal?: string
}) {
  return ChatBridgeStoryBuilderStateSchema.parse({
    schemaVersion: 1,
    mode: options.mode,
    drive: {
      provider: 'google-drive',
      status: options.driveStatus,
      statusLabel: options.driveStatusLabel,
      detail: options.driveDetail,
      connectedAs: options.connectedAs,
      folderLabel: options.folderLabel,
      lastSyncedLabel: options.lastSyncedLabel,
    },
    draft: {
      title: options.title,
      chapterLabel: options.chapterLabel,
      summary: options.summary,
      excerpt: options.excerpt,
      wordCount: options.wordCount,
      saveState: options.saveState,
      saveLabel: options.saveLabel,
      userGoal: options.userGoal,
    },
    checkpoints: options.checkpoints ?? [],
    callout:
      options.calloutTitle && options.calloutDescription
        ? {
            eyebrow: 'Host guidance',
            title: options.calloutTitle,
            description: options.calloutDescription,
          }
        : undefined,
    completion: options.completion,
  })
}

function createStoryBuilderActiveState() {
  return createStoryBuilderState({
    mode: 'active',
    driveStatus: 'connected',
    driveStatusLabel: 'Drive connected',
    driveDetail: 'Host-issued Drive access is active for the classroom writing folder.',
    connectedAs: 'student.writer@example.edu',
    folderLabel: 'Creative Writing / Chapter 4',
    lastSyncedLabel: '2 minutes ago',
    chapterLabel: 'Chapter 4',
    title: 'Storm Lantern',
    summary: 'Mara hides the storm lantern before the flood siren starts and the library doors lock.',
    excerpt:
      'Mara tucked the lantern beneath the library desk and counted the sirens again before she dared to breathe.',
    wordCount: 812,
    saveState: 'saved',
    saveLabel: 'Saved to Drive 2 minutes ago',
    userGoal: 'Finish chapter four and keep the latest checkpoint in Drive.',
    calloutTitle: 'Resume stays explicit',
    calloutDescription: 'The host can reopen this checkpoint without exposing a raw Drive token to the app runtime.',
    checkpoints: [
      {
        checkpointId: 'draft-42',
        label: 'Checkpoint 42',
        description: 'Latest draft with the lantern reveal and flood siren beat.',
        savedAtLabel: '2 minutes ago',
        status: 'latest',
        locationLabel: 'Creative Writing / Chapter 4',
      },
      {
        checkpointId: 'draft-41',
        label: 'Checkpoint 41',
        description: 'Previous chapter pass before the flood siren escalation.',
        savedAtLabel: 'Yesterday',
        status: 'saved',
        locationLabel: 'Creative Writing / Archive',
      },
    ],
  })
}

function createStoryBuilderResumeReadyState() {
  return createStoryBuilderState({
    mode: 'resume-ready',
    driveStatus: 'connected',
    driveStatusLabel: 'Checkpoint ready',
    driveDetail: 'The host already has permission to reopen the latest Drive-backed draft.',
    connectedAs: 'student.writer@example.edu',
    folderLabel: 'Creative Writing / Chapter 4',
    lastSyncedLabel: '12 minutes ago',
    chapterLabel: 'Chapter 4',
    title: 'Storm Lantern',
    summary: 'The latest checkpoint is ready to reopen without leaving the thread.',
    excerpt:
      'Mara stopped at the stairwell and read the warning light again before deciding whether to go back for the lantern.',
    wordCount: 788,
    saveState: 'saved',
    saveLabel: 'Checkpoint ready to resume',
    calloutTitle: 'Resume from the latest safe save',
    calloutDescription: 'Story Builder can reopen the latest checkpoint immediately from the host shell.',
    checkpoints: [
      {
        checkpointId: 'draft-42',
        label: 'Checkpoint 42',
        description: 'Latest Drive-backed draft ready to resume.',
        savedAtLabel: '12 minutes ago',
        status: 'latest',
        locationLabel: 'Creative Writing / Chapter 4',
      },
    ],
  })
}

function createStoryBuilderCompletionState() {
  return createStoryBuilderState({
    mode: 'complete',
    driveStatus: 'connected',
    driveStatusLabel: 'Drive synced',
    driveDetail: 'The finished draft and checkpoint trail are saved in the host-approved Drive folder.',
    connectedAs: 'student.writer@example.edu',
    folderLabel: 'Creative Writing / Chapter 4',
    lastSyncedLabel: 'Just now',
    chapterLabel: 'Chapter 4',
    title: 'Storm Lantern',
    summary: 'The completed chapter draft is back in chat with the latest checkpoint and next revision cue.',
    excerpt:
      'When the lights returned, Mara lifted the lantern from beneath the desk and saw her own reflection in the wet brass.',
    wordCount: 1048,
    saveState: 'saved',
    saveLabel: 'Final draft saved to Drive',
    calloutTitle: 'Completion stays in-thread',
    calloutDescription: 'The draft handoff, checkpoint trail, and next step remain visible in the host shell.',
    checkpoints: [
      {
        checkpointId: 'draft-43',
        label: 'Final checkpoint',
        description: 'Completed chapter pass with resolved lantern reveal.',
        savedAtLabel: 'Just now',
        status: 'latest',
        locationLabel: 'Creative Writing / Chapter 4',
      },
      {
        checkpointId: 'draft-42',
        label: 'Checkpoint 42',
        description: 'Latest resumable draft before the final pass.',
        savedAtLabel: '18 minutes ago',
        status: 'saved',
        locationLabel: 'Creative Writing / Chapter 4',
      },
    ],
    completion: {
      title: 'Draft returned to chat',
      description: 'The host preserved the completed chapter, Drive save, and revision cue for the next conversation turn.',
      handoffLabel: 'Ask for revision notes or continue with chapter five.',
      nextStepLabel: 'Continue the writing session from the final checkpoint if you want another pass.',
    },
  })
}

function createDegradedCompletionValues(options: {
  kind: 'partial-completion' | 'missing-completion' | 'invalid-completion'
  statusLabel: string
  title: string
  description: string
  supportTitle: string
  supportDescription: string
  supportItems: Array<{
    label: string
    description: string
    tone: 'safe' | 'blocked' | 'warning'
  }>
  actions: Array<{
    id:
      | 'retry-completion'
      | 'continue-in-chat'
      | 'dismiss-runtime'
      | 'inspect-invalid-fields'
    label: string
    variant: 'primary' | 'secondary'
  }>
}) {
  return writeChatBridgeDegradedCompletionValues(undefined, {
    schemaVersion: CHATBRIDGE_DEGRADED_COMPLETION_SCHEMA_VERSION,
    kind: options.kind,
    statusLabel: options.statusLabel,
    title: options.title,
    description: options.description,
    supportPanel: {
      eyebrow: 'Trust rail',
      title: options.supportTitle,
      description: options.supportDescription,
      items: options.supportItems,
    },
    actions: options.actions,
  })
}

function createRecoveryContractValues(
  contract: Parameters<typeof writeChatBridgeRecoveryContractValues>[1]
) {
  return writeChatBridgeRecoveryContractValues(undefined, contract)
}

export function buildChatBridgeDegradedCompletionRecoverySessionFixture(): Omit<Session, 'id'> {
  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Degraded completion recovery`,
    type: 'chat',
    threadName: 'Degraded Recovery',
    messages: [
      createTextMessage(
        'msg-degraded-system',
        'system',
        'Keep degraded completion endings explicit, recoverable, and bounded to validated host-owned state.',
        1
      ),
      createTextMessage(
        'msg-degraded-user',
        'user',
        'Show me the degraded completion states and the safe recovery actions the host keeps inline.',
        2
      ),
      createAppLifecycleMessage(
        'msg-degraded-partial',
        'assistant',
        'Story Builder streamed part of the completion, but the host refused to treat the incomplete ending as final output.',
        {
          toolCallId: 'tool-degraded-partial',
          lifecycle: 'error',
          summary: 'Partial completion stayed bounded inside the host shell.',
          title: 'Story Builder recovery',
          description: 'Partial completion stayed inline so the thread can recover without inventing a final result.',
          statusText: 'Partial completion',
          fallbackTitle: 'Partial completion fallback',
          fallbackText: 'Only the validated draft fragment remains available until a safe retry or chat continuation happens.',
          values: createDegradedCompletionValues({
            kind: 'partial-completion',
            statusLabel: 'Partial completion',
            title: 'Completion stopped after a partial draft',
            description:
              'The host captured the validated fragment, blocked the missing tail from model memory, and kept recovery in the same message.',
            supportTitle: 'What still holds',
            supportDescription: 'Only the validated fragment and host diagnostics remain trusted.',
            supportItems: [
              {
                label: 'Validated fragment is still visible',
                description: 'The host can continue from the confirmed partial draft.',
                tone: 'safe',
              },
              {
                label: 'Missing completion tail stays blocked',
                description: 'No synthetic ending is promoted as if the app actually finished.',
                tone: 'blocked',
              },
            ],
            actions: [
              { id: 'retry-completion', label: 'Retry completion', variant: 'primary' },
              { id: 'continue-in-chat', label: 'Continue safely', variant: 'secondary' },
            ],
          }),
          timestamp: 3,
        }
      ),
      createAppLifecycleMessage(
        'msg-degraded-missing',
        'assistant',
        'Form Runner finished its runtime step without producing a completion payload, so the host fell back to an explicit recovery state.',
        {
          appId: 'form-runner',
          appName: 'Form Runner',
          toolCallId: 'tool-degraded-missing',
          lifecycle: 'error',
          summary: 'Missing completion payload stayed explicit in the thread.',
          title: 'Form Runner recovery',
          description: 'The host kept the missing completion visible instead of pretending the runtime returned a final answer.',
          statusText: 'Missing completion',
          fallbackTitle: 'Missing completion fallback',
          fallbackText: 'The runtime returned no completion payload, so the host kept the next safe action inline.',
          values: createDegradedCompletionValues({
            kind: 'missing-completion',
            statusLabel: 'Missing completion',
            title: 'Completion payload never arrived',
            description:
              'The runtime ended without a valid completion payload. The host preserved the verified state and exposed a bounded next step.',
            supportTitle: 'Trust rail',
            supportDescription: 'The conversation can continue safely from the last validated host-owned state.',
            supportItems: [
              {
                label: 'Latest validated state is preserved',
                description: 'The host retained the last safe checkpoint for follow-up work.',
                tone: 'safe',
              },
              {
                label: 'Missing payload remains unavailable',
                description: 'Nothing is inferred or reconstructed from absent runtime output.',
                tone: 'warning',
              },
            ],
            actions: [
              { id: 'continue-in-chat', label: 'Continue safely', variant: 'primary' },
              { id: 'dismiss-runtime', label: 'Dismiss runtime', variant: 'secondary' },
            ],
          }),
          error: 'Completion payload missing from runtime response.',
          timestamp: 4,
        }
      ),
      createAppLifecycleMessage(
        'msg-degraded-invalid',
        'assistant',
        'Insight Board returned malformed completion fields, so the host quarantined them and kept a bounded inspection path in the thread.',
        {
          appId: 'insight-board',
          appName: 'Insight Board',
          toolCallId: 'tool-degraded-invalid',
          lifecycle: 'error',
          summary: 'Invalid completion fields remained quarantined.',
          title: 'Insight Board recovery',
          description: 'Malformed completion fields are blocked from model memory until the host or user chooses a safe follow-up.',
          statusText: 'Invalid completion',
          fallbackTitle: 'Invalid completion fallback',
          fallbackText: 'The runtime responded with malformed completion fields, so the host kept diagnostics inline instead of trusting them.',
          values: createDegradedCompletionValues({
            kind: 'invalid-completion',
            statusLabel: 'Invalid completion',
            title: 'Completion fields failed validation',
            description:
              'The host kept only validated state, quarantined malformed fields, and exposed a safe explanation path instead of leaking broken output.',
            supportTitle: 'Trust rail',
            supportDescription: 'Only validated fields remain available to the conversation.',
            supportItems: [
              {
                label: 'Validated state remains available',
                description: 'The thread can continue from safe host-owned fields.',
                tone: 'safe',
              },
              {
                label: 'Malformed fields stay quarantined',
                description: 'Invalid data is blocked from model memory and user-visible summaries.',
                tone: 'blocked',
              },
            ],
            actions: [
              { id: 'continue-in-chat', label: 'Continue safely', variant: 'primary' },
              { id: 'inspect-invalid-fields', label: 'Inspect invalid fields', variant: 'secondary' },
            ],
          }),
          error: 'Completion fields failed schema validation.',
          timestamp: 5,
        }
      ),
    ],
  }
}

export function buildChatBridgePlatformRecoverySessionFixture(): Omit<Session, 'id'> {
  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Platform recovery`,
    type: 'chat',
    threadName: 'Platform Recovery',
    messages: [
      createTextMessage(
        'msg-platform-recovery-system',
        'system',
        'Keep platform failures explicit, host-owned, and recoverable from the thread instead of hiding them inside generic runtime errors.',
        1
      ),
      createTextMessage(
        'msg-platform-recovery-user',
        'user',
        'Show me how the host handles timeouts, crashes, invalid tool calls, and malformed bridge events.',
        2
      ),
      createAppLifecycleMessage(
        'msg-platform-timeout',
        'assistant',
        'Story Builder did not respond before the host timeout, so the host preserved only the last safe checkpoint and kept recovery inline.',
        {
          toolCallId: 'tool-platform-timeout',
          lifecycle: 'stale',
          summary: 'Story Builder timed out before resume could be trusted.',
          title: 'Story Builder recovery',
          description: 'The host kept the timeout explicit instead of inventing a resumed runtime state.',
          statusText: 'Timed out',
          fallbackTitle: 'Timed out',
          fallbackText: 'Continue in chat from the last validated checkpoint or ask for a bounded explanation before retrying.',
          values: createRecoveryContractValues(
            createChatBridgeTimeoutRecoveryContract({
              appId: 'story-builder',
              appName: 'Story Builder',
              appInstanceId: 'story-builder-timeout',
              bridgeSessionId: 'bridge-story-builder-timeout',
              waitedMs: 10_000,
            })
          ),
          timestamp: 3,
        }
      ),
      createAppLifecycleMessage(
        'msg-platform-crash',
        'assistant',
        'Debate Arena crashed mid-round, so the host kept only validated round state and a bounded recovery path inside the thread.',
        {
          appId: 'debate-arena',
          appName: 'Debate Arena',
          toolCallId: 'tool-platform-crash',
          lifecycle: 'error',
          summary: 'Debate Arena crashed before the final rebuttal could be trusted.',
          title: 'Debate Arena recovery',
          description: 'The host caught the crash and kept the thread usable from preserved host-owned state.',
          statusText: 'Runtime crash',
          fallbackTitle: 'Recovery available',
          fallbackText: 'Continue safely from preserved state or dismiss the failed runtime.',
          error: 'Worker process exited during round three rebuttal.',
          values: createRecoveryContractValues(
            createChatBridgeRuntimeCrashRecoveryContract({
              appId: 'debate-arena',
              appName: 'Debate Arena',
              appInstanceId: 'debate-arena-crash',
              bridgeSessionId: 'bridge-debate-arena-crash',
              error: 'Worker process exited during round three rebuttal.',
              code: 'worker_exit',
            })
          ),
          timestamp: 4,
        }
      ),
      createAppLifecycleMessage(
        'msg-platform-tool',
        'assistant',
        'Story Builder asked the host to save a draft without the required idempotency key, so the host blocked the tool call and kept the validation gap bounded.',
        {
          toolCallId: 'tool-platform-tool',
          lifecycle: 'error',
          summary: 'The host rejected the invalid save request before it could mutate Drive state.',
          title: 'Story Builder recovery',
          description: 'The invalid tool call stayed bounded to host validation output instead of becoming a side effect.',
          statusText: 'Invalid tool call',
          fallbackTitle: 'Tool blocked',
          fallbackText: 'Continue in chat or inspect the bounded validation diagnostics before retrying the save action.',
          values: createRecoveryContractValues({
            schemaVersion: 1,
            failureClass: 'invalid-tool-call',
            source: 'tool',
            severity: 'recoverable',
            title: 'save_story did not pass host validation',
            description: 'The host refused the tool call, kept the failure bounded, and preserved conversation continuity without executing an unsafe save.',
            statusLabel: 'Invalid tool call',
            summary: 'save_story failed host validation, so the request stayed explicit instead of becoming an unsafe side effect.',
            fallbackTitle: 'Tool blocked',
            fallbackText: 'Continue in chat or inspect the bounded validation diagnostics before retrying the tool call.',
            supportPanel: {
              eyebrow: 'Trust rail',
              title: 'What still holds',
              description: 'The host blocked the invalid save request before it could change Drive state.',
              items: [
                {
                  label: 'No side effect was executed',
                  description: 'Host validation stopped the invalid save before it could mutate external state.',
                  tone: 'safe',
                },
                {
                  label: 'Rejected inputs remain bounded',
                  description: 'Only safe validation diagnostics remain visible to the user and operator.',
                  tone: 'blocked',
                },
              ],
            },
            actions: [
              { id: 'continue-in-chat', label: 'Continue safely', variant: 'primary' },
              { id: 'inspect-invalid-fields', label: 'Inspect invalid fields', variant: 'secondary' },
            ],
            observability: {
              traceCode: 'recovery.invalid-tool-call',
              auditCategory: 'lifecycle.recovery',
              outcome: 'missing_idempotency_key',
              details: ['toolName: save_story', 'outcome: rejected', 'errorCode: missing_idempotency_key'],
            },
            correlation: {
              appId: 'story-builder',
              toolName: 'save_story',
            },
          }),
          timestamp: 5,
        }
      ),
      createAppLifecycleMessage(
        'msg-platform-bridge',
        'assistant',
        'Chess sent malformed bridge state, so the host rejected the runtime update and kept recovery bounded to trusted context.',
        {
          appId: 'chess',
          appName: 'Chess',
          toolCallId: 'tool-platform-bridge',
          lifecycle: 'error',
          summary: 'Malformed bridge traffic stayed blocked from host-owned state.',
          title: 'Chess recovery',
          description: 'The host failed closed on malformed bridge data and kept the thread usable from validated state.',
          statusText: 'Malformed event',
          fallbackTitle: 'Runtime blocked',
          fallbackText: 'Dismiss the runtime or ask for a bounded explanation while the host keeps invalid bridge data quarantined.',
          values: createRecoveryContractValues(
            createChatBridgeMalformedBridgeRecoveryContract({
              appId: 'chess',
              appName: 'Chess',
              appInstanceId: 'chess-bridge-invalid',
              bridgeSessionId: 'bridge-chess-invalid',
              rawKind: 'app.state',
              issues: ['snapshot.boardContext: Required', 'idempotencyKey: Required'],
            })
          ),
          timestamp: 6,
        }
      ),
      createAppLifecycleMessage(
        'msg-platform-reject',
        'assistant',
        'A replayed Debate Arena bridge event was rejected, so the host kept the runtime quarantined and preserved safe continuity from the last trusted state.',
        {
          appId: 'debate-arena',
          appName: 'Debate Arena',
          toolCallId: 'tool-platform-reject',
          lifecycle: 'error',
          summary: 'The host rejected a replayed bridge event instead of applying duplicate state.',
          title: 'Debate Arena recovery',
          description: 'Bridge-session validation stayed host-owned and fail-closed after the replay attempt.',
          statusText: 'Bridge rejected',
          fallbackTitle: 'Runtime rejected',
          fallbackText: 'Dismiss the runtime or ask for a bounded explanation while the host keeps replayed bridge events out of state.',
          values: createRecoveryContractValues(
            createChatBridgeBridgeRejectionRecoveryContract({
              appId: 'debate-arena',
              appName: 'Debate Arena',
              reason: 'replayed-sequence',
              event: {
                kind: 'app.state',
                appInstanceId: 'debate-replayed-state',
                bridgeSessionId: 'bridge-debate-replayed',
              },
            })
          ),
          timestamp: 7,
        }
      ),
    ],
  }
}

function createChessRuntimeMessage(id: string, timestamp: number): Message {
  const snapshot = createInitialChessAppSnapshot(timestamp, {
    ai: DEFAULT_CHESS_AI_CONFIG,
  })
  const appInstanceId = 'chess-instance-seeded-runtime'
  const bridgeSessionId = 'bridge-chess-seeded-runtime'

  return {
    id,
    role: 'assistant',
    timestamp,
    contentParts: [
      {
        type: 'text',
        text: 'The chess runtime is live in-thread. You play White by default, Black replies automatically, and the host keeps the latest board state on reload.',
      },
      {
        type: 'app',
        appId: CHESS_APP_ID,
        appName: CHESS_APP_NAME,
        appInstanceId,
        lifecycle: 'active',
        summary: getChessSummary(snapshot),
        toolCallId: 'tool-chess-runtime-seeded',
        bridgeSessionId,
        title: 'Chess board',
        description: getChessDescription(snapshot),
        statusText: getChessStatusLabel(snapshot),
        fallbackTitle: 'Chess fallback',
        fallbackText: getChessFallbackText(snapshot),
        snapshot,
      },
      {
        type: 'tool-call',
        state: 'result',
        toolCallId: 'tool-chess-runtime-seeded',
        toolName: 'chatbridge_app_state',
        args: {
          appId: CHESS_APP_ID,
          lifecycle: 'active',
          bridgeSessionId,
        },
        result: {
          appId: CHESS_APP_ID,
          appName: CHESS_APP_NAME,
          appInstanceId,
          lifecycle: 'active',
          summary: getChessSummary(snapshot),
          snapshot,
        },
      },
    ],
  }
}

function createSeededChessAppRecords() {
  const snapshot = createInitialChessAppSnapshot(3, {
    ai: DEFAULT_CHESS_AI_CONFIG,
  })
  const baseInstance = createChatBridgeAppInstance({
    id: 'chess-instance-seeded-runtime',
    appId: CHESS_APP_ID,
    appVersion: '1.0.0',
    bridgeSessionId: 'bridge-chess-seeded-runtime',
    owner: {
      authority: 'host',
      conversationSessionId: 'seeded-chess-runtime-session',
      initiatedBy: 'assistant',
    },
    resumability: {
      mode: 'resumable',
      resumeKey: 'chess-instance-seeded-runtime',
    },
    createdAt: 3,
  })

  const createdEvent = createChatBridgeAppEvent({
    id: 'event-chess-created',
    appInstanceId: baseInstance.id,
    kind: 'instance.created',
    actor: 'host',
    sequence: 1,
    createdAt: 3,
    bridgeSessionId: 'bridge-chess-seeded-runtime',
    nextStatus: 'launching',
    payload: {
      initiatedBy: 'assistant',
    },
  })

  const createdTransition = applyChatBridgeAppEvent(baseInstance, createdEvent)
  if (!createdTransition.accepted) {
    throw new Error(`Unable to seed chess created event: ${createdTransition.reason}`)
  }

  const readyEvent = createChatBridgeAppEvent({
    id: 'event-chess-ready',
    appInstanceId: baseInstance.id,
    kind: 'bridge.ready',
    actor: 'host',
    sequence: 2,
    createdAt: 3,
    bridgeSessionId: 'bridge-chess-seeded-runtime',
    nextStatus: 'ready',
    snapshot,
    payload: {
      source: 'seeded-runtime',
    },
  })

  const readyTransition = applyChatBridgeAppEvent(createdTransition.instance, readyEvent)
  if (!readyTransition.accepted) {
    throw new Error(`Unable to seed chess ready event: ${readyTransition.reason}`)
  }

  const activeEvent = createChatBridgeAppEvent({
    id: 'event-chess-active',
    appInstanceId: baseInstance.id,
    kind: 'state.updated',
    actor: 'host',
    sequence: 3,
    createdAt: 3,
    bridgeSessionId: 'bridge-chess-seeded-runtime',
    nextStatus: 'active',
    snapshot,
    payload: {
      moveCount: 0,
      turn: snapshot.turn,
      phase: snapshot.status.phase,
      lastAction: snapshot.lastAction,
    },
    summaryForModel: getChessSummary(snapshot),
  })

  const activeTransition = applyChatBridgeAppEvent(readyTransition.instance, activeEvent)
  if (!activeTransition.accepted) {
    throw new Error(`Unable to seed chess active event: ${activeTransition.reason}`)
  }

  return {
    instances: [activeTransition.instance],
    events: [createdEvent, readyEvent, activeEvent],
  }
}

function createDrawingKitRuntimeMessage(id: string, timestamp: number, snapshot: DrawingKitAppSnapshot): Message {
  const request = snapshot.request ?? 'Open Drawing Kit and start a sticky-note doodle dare.'
  const toolCallId = 'tool-drawing-kit-seeded'
  const appInstanceId = `reviewed-launch:${toolCallId}`
  const bridgeSessionId = 'bridge-drawing-kit-seeded'
  const launchSummary = 'Prepared the reviewed Drawing Kit doodle dare for the host-owned launch path.'

  return {
    id,
    role: 'assistant',
    timestamp,
    contentParts: [
      {
        type: 'text',
        text: 'Drawing Kit is ready in-thread. Add a squiggle, drop a sticker, bank the round, then ask chat what it remembers.',
      },
      {
        type: 'app',
        appId: DRAWING_KIT_APP_ID,
        appName: DRAWING_KIT_APP_NAME,
        appInstanceId,
        lifecycle: 'ready',
        summary: snapshot.summary,
        summaryForModel: snapshot.summary,
        toolCallId,
        bridgeSessionId,
        title: 'Drawing Kit',
        description:
          'The host kept the doodle dare inline so you can sketch, bank a checkpoint, and carry the bounded round summary into later chat.',
        statusText: getDrawingKitStatusLabel(snapshot),
        fallbackTitle: 'Drawing Kit fallback',
        fallbackText: getDrawingKitFallbackText(snapshot),
        snapshot,
        values: writeChatBridgeReviewedAppLaunchValues(undefined, {
          schemaVersion: 1,
          appId: DRAWING_KIT_APP_ID,
          appName: DRAWING_KIT_APP_NAME,
          appVersion: '0.1.0',
          toolName: 'drawing_kit_open',
          capability: 'open',
          summary: launchSummary,
          request,
          uiEntry: 'https://apps.example.com/drawing-kit',
          origin: 'https://apps.example.com',
        }),
      },
      {
        type: 'tool-call',
        state: 'result',
        toolCallId,
        toolName: 'drawing_kit_open',
        args: {
          request,
        },
        result: {
          kind: 'chatbridge.host.tool.record.v1',
          toolName: 'drawing_kit_open',
          appId: DRAWING_KIT_APP_ID,
          sessionId: 'seeded-drawing-kit-session',
          schemaVersion: CHATBRIDGE_HOST_TOOL_SCHEMA_VERSION,
          executionAuthority: 'host',
          effect: 'read',
          retryClassification: 'safe',
          invocation: {
            args: {
              request,
            },
          },
          outcome: {
            status: 'success',
            result: {
              appId: DRAWING_KIT_APP_ID,
              appName: DRAWING_KIT_APP_NAME,
              capability: 'open',
              launchReady: true,
              summary: launchSummary,
              request,
            },
          },
        },
      },
    ],
  }
}

function createFlashcardStudioRuntimeMessage(id: string, timestamp: number, snapshot: FlashcardStudioAppSnapshot): Message {
  const request = snapshot.request ?? 'Open Flashcard Studio and help me study biology flashcards.'
  const toolCallId = 'tool-flashcard-studio-seeded'
  const appInstanceId = `reviewed-launch:${toolCallId}`
  const bridgeSessionId = 'bridge-flashcard-studio-seeded'
  const launchSummary = 'Prepared the reviewed Flashcard Studio study session for the host-owned launch path.'

  return {
    id,
    role: 'assistant',
    timestamp,
    contentParts: [
      {
        type: 'text',
        text: 'Flashcard Studio is ready in-thread. Reveal the answer, mark confidence, and confirm later chat stays grounded in weak-card review cues.',
      },
      {
        type: 'app',
        appId: FLASHCARD_STUDIO_APP_ID,
        appName: FLASHCARD_STUDIO_APP_NAME,
        appInstanceId,
        lifecycle: 'ready',
        summary: snapshot.summary,
        summaryForModel: snapshot.summary,
        toolCallId,
        bridgeSessionId,
        title: FLASHCARD_STUDIO_APP_NAME,
        description:
          'The host kept Flashcard Studio inline so students can study one card at a time and carry only bounded review signals into later chat.',
        statusText: snapshot.statusText,
        fallbackTitle: 'Flashcard Studio fallback',
        fallbackText:
          'If the study runtime cannot continue, the host keeps the latest safe deck and review summary visible in this thread.',
        snapshot,
        values: writeChatBridgeReviewedAppLaunchValues(undefined, {
          schemaVersion: 1,
          appId: FLASHCARD_STUDIO_APP_ID,
          appName: FLASHCARD_STUDIO_APP_NAME,
          appVersion: '0.1.0',
          toolName: 'flashcard_studio_open',
          capability: 'open',
          summary: launchSummary,
          request,
          uiEntry: 'https://apps.example.com/flashcard-studio',
          origin: 'https://apps.example.com',
        }),
      },
      {
        type: 'tool-call',
        state: 'result',
        toolCallId,
        toolName: 'flashcard_studio_open',
        args: {
          request,
        },
        result: {
          kind: 'chatbridge.host.tool.record.v1',
          toolName: 'flashcard_studio_open',
          appId: FLASHCARD_STUDIO_APP_ID,
          sessionId: 'seeded-flashcard-studio-session',
          schemaVersion: CHATBRIDGE_HOST_TOOL_SCHEMA_VERSION,
          executionAuthority: 'host',
          effect: 'read',
          retryClassification: 'safe',
          invocation: {
            args: {
              request,
            },
          },
          outcome: {
            status: 'success',
            result: {
              appId: FLASHCARD_STUDIO_APP_ID,
              appName: FLASHCARD_STUDIO_APP_NAME,
              capability: 'open',
              launchReady: true,
              summary: launchSummary,
              request,
            },
          },
        },
      },
    ],
  }
}

function createWeatherDashboardRuntimeMessage(id: string, timestamp: number, snapshot: WeatherDashboardSnapshot): Message {
  const request = snapshot.request ?? 'Open Weather Dashboard for Chicago and show the forecast.'
  const location = snapshot.locationQuery ?? 'Chicago'
  const toolCallId = 'tool-weather-dashboard-seeded'
  const appInstanceId = `reviewed-launch:${toolCallId}`
  const bridgeSessionId = 'bridge-weather-dashboard-seeded'
  const launchSummary = 'Prepared the reviewed Weather Dashboard request for the host-owned launch path.'

  return {
    id,
    role: 'assistant',
    timestamp,
    contentParts: [
      {
        type: 'text',
        text: 'Weather Dashboard is ready in-thread. Inspect the current conditions, refresh the host-owned snapshot, and confirm the later summary stays weather-bounded.',
      },
      {
        type: 'app',
        appId: WEATHER_DASHBOARD_APP_ID,
        appName: WEATHER_DASHBOARD_APP_NAME,
        appInstanceId,
        lifecycle: 'ready',
        summary: snapshot.summary,
        summaryForModel: snapshot.summary,
        toolCallId,
        bridgeSessionId,
        title: WEATHER_DASHBOARD_APP_NAME,
        description:
          'The host is preparing Weather Dashboard inline so current conditions, short forecast data, and stale-state recovery stay inside the reviewed shell.',
        statusText: snapshot.statusText,
        fallbackTitle: 'Weather Dashboard fallback',
        fallbackText:
          'If live weather cannot load, the host keeps the latest safe snapshot or an explicit unavailable-state explanation in this thread.',
        snapshot,
        values: writeChatBridgeReviewedAppLaunchValues(undefined, {
          schemaVersion: 1,
          appId: WEATHER_DASHBOARD_APP_ID,
          appName: WEATHER_DASHBOARD_APP_NAME,
          appVersion: '0.1.0',
          toolName: 'weather_dashboard_open',
          capability: 'open',
          summary: launchSummary,
          request,
          location,
          uiEntry: 'https://apps.example.com/weather-dashboard',
          origin: 'https://apps.example.com',
        }),
      },
      {
        type: 'tool-call',
        state: 'result',
        toolCallId,
        toolName: 'weather_dashboard_open',
        args: {
          request,
          location,
        },
        result: {
          kind: 'chatbridge.host.tool.record.v1',
          toolName: 'weather_dashboard_open',
          appId: WEATHER_DASHBOARD_APP_ID,
          sessionId: 'seeded-weather-dashboard-session',
          schemaVersion: CHATBRIDGE_HOST_TOOL_SCHEMA_VERSION,
          executionAuthority: 'host',
          effect: 'read',
          retryClassification: 'safe',
          invocation: {
            args: {
              request,
              location,
            },
          },
          outcome: {
            status: 'success',
            result: {
              appId: WEATHER_DASHBOARD_APP_ID,
              appName: WEATHER_DASHBOARD_APP_NAME,
              capability: 'open',
              launchReady: true,
              summary: launchSummary,
              request,
              location,
            },
          },
        },
      },
    ],
  }
}

function createSeededDrawingKitAppRecords(snapshot: DrawingKitAppSnapshot) {
  const appInstanceId = 'reviewed-launch:tool-drawing-kit-seeded'
  const bridgeSessionId = 'bridge-drawing-kit-seeded'
  const baseInstance = createChatBridgeAppInstance({
    id: appInstanceId,
    appId: DRAWING_KIT_APP_ID,
    appVersion: '1.0.0',
    bridgeSessionId,
    owner: {
      authority: 'host',
      conversationSessionId: 'seeded-drawing-kit-session',
      initiatedBy: 'assistant',
    },
    resumability: {
      mode: 'resumable',
      resumeKey: appInstanceId,
    },
    createdAt: 3,
  })

  const createdEvent = createChatBridgeAppEvent({
    id: 'event-drawing-created',
    appInstanceId: baseInstance.id,
    kind: 'instance.created',
    actor: 'host',
    sequence: 1,
    createdAt: 3,
    bridgeSessionId,
    nextStatus: 'launching',
    payload: {
      initiatedBy: 'assistant',
    },
  })

  const createdTransition = applyChatBridgeAppEvent(baseInstance, createdEvent)
  if (!createdTransition.accepted) {
    throw new Error(`Unable to seed Drawing Kit created event: ${createdTransition.reason}`)
  }

  const readyEvent = createChatBridgeAppEvent({
    id: 'event-drawing-ready',
    appInstanceId: baseInstance.id,
    kind: 'bridge.ready',
    actor: 'host',
    sequence: 2,
    createdAt: 4,
    bridgeSessionId,
    nextStatus: 'ready',
    snapshot,
    payload: {
      source: 'seeded-runtime',
    },
  })

  const readyTransition = applyChatBridgeAppEvent(createdTransition.instance, readyEvent)
  if (!readyTransition.accepted) {
    throw new Error(`Unable to seed Drawing Kit ready event: ${readyTransition.reason}`)
  }

  return {
    instances: [readyTransition.instance],
    events: [createdEvent, readyEvent],
  }
}

function createSeededFlashcardStudioAppRecords(snapshot: FlashcardStudioAppSnapshot) {
  const appInstanceId = 'reviewed-launch:tool-flashcard-studio-seeded'
  const bridgeSessionId = 'bridge-flashcard-studio-seeded'
  const baseInstance = createChatBridgeAppInstance({
    id: appInstanceId,
    appId: FLASHCARD_STUDIO_APP_ID,
    appVersion: '1.0.0',
    bridgeSessionId,
    owner: {
      authority: 'host',
      conversationSessionId: 'seeded-flashcard-studio-session',
      initiatedBy: 'assistant',
    },
    resumability: {
      mode: 'resumable',
      resumeKey: appInstanceId,
    },
    createdAt: 3,
  })

  const createdEvent = createChatBridgeAppEvent({
    id: 'event-flashcard-created',
    appInstanceId: baseInstance.id,
    kind: 'instance.created',
    actor: 'host',
    sequence: 1,
    createdAt: 3,
    bridgeSessionId,
    nextStatus: 'launching',
    payload: {
      initiatedBy: 'assistant',
    },
  })

  const createdTransition = applyChatBridgeAppEvent(baseInstance, createdEvent)
  if (!createdTransition.accepted) {
    throw new Error(`Unable to seed Flashcard Studio created event: ${createdTransition.reason}`)
  }

  const readyEvent = createChatBridgeAppEvent({
    id: 'event-flashcard-ready',
    appInstanceId: baseInstance.id,
    kind: 'bridge.ready',
    actor: 'host',
    sequence: 2,
    createdAt: 4,
    bridgeSessionId,
    nextStatus: 'ready',
    snapshot,
    payload: {
      source: 'seeded-runtime',
    },
  })

  const readyTransition = applyChatBridgeAppEvent(createdTransition.instance, readyEvent)
  if (!readyTransition.accepted) {
    throw new Error(`Unable to seed Flashcard Studio ready event: ${readyTransition.reason}`)
  }

  return {
    instances: [readyTransition.instance],
    events: [createdEvent, readyEvent],
  }
}

function createSeededWeatherDashboardAppRecords(snapshot: WeatherDashboardSnapshot) {
  const appInstanceId = 'reviewed-launch:tool-weather-dashboard-seeded'
  const bridgeSessionId = 'bridge-weather-dashboard-seeded'
  const baseInstance = createChatBridgeAppInstance({
    id: appInstanceId,
    appId: WEATHER_DASHBOARD_APP_ID,
    appVersion: '1.0.0',
    bridgeSessionId,
    owner: {
      authority: 'host',
      conversationSessionId: 'seeded-weather-dashboard-session',
      initiatedBy: 'assistant',
    },
    resumability: {
      mode: 'restartable',
      reason: 'The host can relaunch Weather Dashboard from the preserved weather request.',
    },
    createdAt: 3,
  })

  const createdEvent = createChatBridgeAppEvent({
    id: 'event-weather-created',
    appInstanceId: baseInstance.id,
    kind: 'instance.created',
    actor: 'host',
    sequence: 1,
    createdAt: 3,
    bridgeSessionId,
    nextStatus: 'launching',
    payload: {
      initiatedBy: 'assistant',
    },
  })

  const createdTransition = applyChatBridgeAppEvent(baseInstance, createdEvent)
  if (!createdTransition.accepted) {
    throw new Error(`Unable to seed Weather Dashboard created event: ${createdTransition.reason}`)
  }

  const readyEvent = createChatBridgeAppEvent({
    id: 'event-weather-ready',
    appInstanceId: baseInstance.id,
    kind: 'bridge.ready',
    actor: 'host',
    sequence: 2,
    createdAt: 4,
    bridgeSessionId,
    nextStatus: 'ready',
    snapshot,
    payload: {
      source: 'seeded-runtime',
    },
  })

  const readyTransition = applyChatBridgeAppEvent(createdTransition.instance, readyEvent)
  if (!readyTransition.accepted) {
    throw new Error(`Unable to seed Weather Dashboard ready event: ${readyTransition.reason}`)
  }

  return {
    instances: [readyTransition.instance],
    events: [createdEvent, readyEvent],
  }
}

function createStoryBuilderAppRecords(options: {
  appInstanceId: string
  bridgeSessionId: string
  conversationSessionId: string
  status: 'active' | 'complete' | 'stale'
  summaryForModel?: string
  createdAt: number
  updatedAt: number
}) {
  const baseInstance = createChatBridgeAppInstance({
    id: options.appInstanceId,
    appId: APP_ID,
    appVersion: '1.0.0',
    bridgeSessionId: options.bridgeSessionId,
    owner: {
      authority: 'host',
      conversationSessionId: options.conversationSessionId,
      initiatedBy: 'assistant',
    },
    resumability: {
      mode: 'resumable',
      resumeKey: options.appInstanceId,
    },
    createdAt: options.createdAt,
  })

  const createdEvent = createChatBridgeAppEvent({
    id: `event-created-${options.appInstanceId}`,
    appInstanceId: baseInstance.id,
    kind: 'instance.created',
    actor: 'host',
    sequence: 1,
    createdAt: options.createdAt,
    bridgeSessionId: options.bridgeSessionId,
    nextStatus: 'launching',
    payload: {
      initiatedBy: 'assistant',
    },
  })

  const createdTransition = applyChatBridgeAppEvent(baseInstance, createdEvent)
  if (!createdTransition.accepted) {
    throw new Error(`Unable to seed Story Builder created event: ${createdTransition.reason}`)
  }

  if (options.status === 'stale') {
    const staleEvent = createChatBridgeAppEvent({
      id: `event-stale-${options.appInstanceId}`,
      appInstanceId: baseInstance.id,
      kind: 'instance.marked-stale',
      actor: 'host',
      sequence: 2,
      createdAt: options.updatedAt,
      bridgeSessionId: options.bridgeSessionId,
      nextStatus: 'stale',
    })

    const staleTransition = applyChatBridgeAppEvent(createdTransition.instance, staleEvent)
    if (!staleTransition.accepted) {
      throw new Error(`Unable to seed Story Builder stale event: ${staleTransition.reason}`)
    }

    return {
      instances: [staleTransition.instance],
      events: [createdEvent, staleEvent],
    }
  }

  const readyEvent = createChatBridgeAppEvent({
    id: `event-ready-${options.appInstanceId}`,
    appInstanceId: baseInstance.id,
    kind: 'bridge.ready',
    actor: 'host',
    sequence: 2,
    createdAt: options.createdAt + 1,
    bridgeSessionId: options.bridgeSessionId,
    nextStatus: 'ready',
    payload: {
      source: 'seeded-runtime',
    },
  })

  const readyTransition = applyChatBridgeAppEvent(createdTransition.instance, readyEvent)
  if (!readyTransition.accepted) {
    throw new Error(`Unable to seed Story Builder ready event: ${readyTransition.reason}`)
  }

  if (options.status === 'active') {
    const activeEvent = createChatBridgeAppEvent({
      id: `event-active-${options.appInstanceId}`,
      appInstanceId: baseInstance.id,
      kind: 'state.updated',
      actor: 'host',
      sequence: 3,
      createdAt: options.updatedAt,
      bridgeSessionId: options.bridgeSessionId,
      nextStatus: 'active',
      payload: {
        route: '/apps/story-builder',
      },
      summaryForModel: options.summaryForModel,
    })

    const activeTransition = applyChatBridgeAppEvent(readyTransition.instance, activeEvent)
    if (!activeTransition.accepted) {
      throw new Error(`Unable to seed Story Builder active event: ${activeTransition.reason}`)
    }

    return {
      instances: [activeTransition.instance],
      events: [createdEvent, readyEvent, activeEvent],
    }
  }

  const completionEvent = createChatBridgeAppEvent({
    id: `event-complete-${options.appInstanceId}`,
    appInstanceId: baseInstance.id,
    kind: 'completion.recorded',
    actor: 'host',
    sequence: 3,
    createdAt: options.updatedAt,
    bridgeSessionId: options.bridgeSessionId,
    nextStatus: 'complete',
    payload: {
      route: '/apps/story-builder',
    },
    summaryForModel: options.summaryForModel,
  })

  const completionTransition = applyChatBridgeAppEvent(readyTransition.instance, completionEvent)
  if (!completionTransition.accepted) {
    throw new Error(`Unable to seed Story Builder completion event: ${completionTransition.reason}`)
  }

  return {
    instances: [completionTransition.instance],
    events: [createdEvent, readyEvent, completionEvent],
  }
}

export function buildAppAwareSessionFixture(): {
  sessionInput: Omit<Session, 'id'>
  historyThread: SessionThread
  currentMessageIds: string[]
  historyMessageIds: string[]
} {
  const systemMessage = createTextMessage(
    'msg-system',
    'system',
    'Keep host-owned app lifecycle state explicit and recoverable.',
    1
  )

  const currentUserMessage = createTextMessage(
    'msg-current-user',
    'user',
    'Resume my Story Builder draft and keep the draft summary attached.',
    2
  )

  const currentAssistantMessage = createAppLifecycleMessage(
    'msg-current-assistant',
    'assistant',
    'Story Builder resumed with the latest draft checkpoint.',
    {
      toolCallId: 'tool-current-assistant',
      lifecycle: 'active',
      attachmentName: 'story-builder-state.json',
      summary: 'Restored the active story draft and preserved the exportable checkpoint.',
      values: {
        chatbridgeStoryBuilder: createStoryBuilderActiveState(),
      },
      timestamp: 3,
    }
  )

  const historyThread: SessionThread = {
    id: 'thread-story-builder-history',
    name: 'Story Builder Draft',
    createdAt: 1,
    messages: [
      createTextMessage('msg-history-user', 'user', 'Open Story Builder and summarize the current scene.', 1),
      createAppLifecycleMessage(
        'msg-history-assistant',
        'assistant',
        'Story Builder completed the previous draft summary.',
        {
          toolCallId: 'tool-history-assistant',
          lifecycle: 'complete',
          summary: 'Saved the previous draft summary for later follow-up questions.',
          values: {
            chatbridgeStoryBuilder: createStoryBuilderCompletionState(),
          },
          timestamp: 2,
        }
      ),
    ],
  }

  return {
    sessionInput: {
      name: 'ChatBridge Story Session',
      type: 'chat',
      threadName: 'Story Builder Active',
      messages: [systemMessage, currentUserMessage, currentAssistantMessage],
      threads: [historyThread],
      chatBridgeAppRecords: createStoryBuilderAppRecords({
        appInstanceId: 'app-instance-tool-current-assistant',
        bridgeSessionId: 'bridge-tool-current-assistant',
        conversationSessionId: 'seeded-story-builder-session',
        status: 'active',
        summaryForModel: 'Restored the active story draft and preserved the exportable checkpoint.',
        createdAt: 3,
        updatedAt: 3,
      }),
    },
    historyThread,
    currentMessageIds: [systemMessage.id, currentUserMessage.id, currentAssistantMessage.id],
    historyMessageIds: historyThread.messages.map((message) => message.id),
  }
}

export function buildPartialLifecycleSessionFixture(): Omit<Session, 'id'> {
  return {
    name: 'ChatBridge Partial Lifecycle Session',
    type: 'chat',
    messages: [
      createTextMessage(
        'msg-partial-user',
        'user',
        'Try to resume the last Story Builder state even if the snapshot is stale.',
        1
      ),
      createAppLifecycleMessage(
        'msg-partial-assistant',
        'assistant',
        'Cached app state expired. Resume should stay explicit without inventing a recovered result.',
        {
          toolCallId: 'tool-partial-assistant',
          lifecycle: 'stale',
          state: 'call',
          partial: true,
          summary: 'Cached app state expired before a fresh checkpoint arrived.',
          timestamp: 2,
        }
      ),
    ],
    chatBridgeAppRecords: createStoryBuilderAppRecords({
      appInstanceId: 'app-instance-tool-partial-assistant',
      bridgeSessionId: 'bridge-tool-partial-assistant',
      conversationSessionId: 'seeded-partial-story-builder-session',
      status: 'stale',
      createdAt: 2,
      updatedAt: 2,
    }),
  }
}

export function buildChatBridgeLifecycleTourSessionFixture(): Omit<Session, 'id'> {
  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Lifecycle tour`,
    type: 'chat',
    threadName: 'Lifecycle Tour',
    messages: [
      createTextMessage(
        'msg-tour-system',
        'system',
        'Keep the host shell visible for every app lifecycle state, including stale and error recovery.',
        1
      ),
      createTextMessage(
        'msg-tour-user',
        'user',
        'Show me every host-owned ChatBridge lifecycle state in one place.',
        2
      ),
      createAppLifecycleMessage(
        'msg-tour-launching',
        'assistant',
        'Story Builder is still restoring the draft runtime.',
        {
          toolCallId: 'tool-tour-launching',
          lifecycle: 'launching',
          summary: 'Story Builder is booting the saved runtime.',
          timestamp: 3,
        }
      ),
      createAppLifecycleMessage('msg-tour-ready', 'assistant', 'Story Builder is ready to reopen from the thread.', {
        toolCallId: 'tool-tour-ready',
        lifecycle: 'ready',
        summary: 'Story Builder is staged and waiting for the next action.',
        values: {
          chatbridgeStoryBuilder: createStoryBuilderResumeReadyState(),
        },
        timestamp: 4,
      }),
      createAppLifecycleMessage(
        'msg-tour-active',
        'assistant',
        'Story Builder is active and still owned by the host shell.',
        {
          toolCallId: 'tool-tour-active',
          lifecycle: 'active',
          summary: 'The runtime is live inside the conversation.',
          values: {
            chatbridgeStoryBuilder: createStoryBuilderActiveState(),
          },
          timestamp: 5,
        }
      ),
      createAppLifecycleMessage(
        'msg-tour-complete',
        'assistant',
        'Story Builder finished without leaving a separate summary receipt.',
        {
          toolCallId: 'tool-tour-complete',
          lifecycle: 'complete',
          summary: 'Completion stays inline in the same host shell.',
          values: {
            chatbridgeStoryBuilder: createStoryBuilderCompletionState(),
          },
          timestamp: 6,
        }
      ),
      createAppLifecycleMessage(
        'msg-tour-stale',
        'assistant',
        'The cached checkpoint expired before the runtime could resume.',
        {
          toolCallId: 'tool-tour-stale',
          lifecycle: 'stale',
          state: 'call',
          partial: true,
          summary: 'The host kept the stale state explicit instead of inventing a successful resume.',
          fallbackText:
            'The runtime could not resume from the cached checkpoint, so the host is keeping recovery inline.',
          timestamp: 7,
        }
      ),
      createAppLifecycleMessage(
        'msg-tour-error',
        'assistant',
        'The bridge handshake failed after the shell requested a resume.',
        {
          toolCallId: 'tool-tour-error',
          lifecycle: 'error',
          state: 'error',
          summary: 'Bridge session expired before resume completed.',
          error: 'Bridge session expired before resume completed.',
          fallbackText: 'The host keeps the failure and recovery path in the same thread instead of dropping context.',
          timestamp: 8,
        }
      ),
    ],
  }
}

export function buildChatBridgeHistoryAndPreviewSessionFixture(): {
  sessionInput: Omit<Session, 'id'>
  blobEntries: Array<{
    key: string
    value: string
  }>
} {
  const appAware = buildAppAwareSessionFixture()
  const htmlPreviewUserMessage = createTextMessage(
    'msg-preview-user',
    'user',
    'Render a previewable review app inside the thread and keep it host-owned.',
    4
  )
  const htmlPreviewAssistantMessage = createHtmlPreviewMessage('msg-preview-assistant', 5)

  return {
    sessionInput: {
      ...appAware.sessionInput,
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} History + preview`,
      threadName: 'Story Builder Review',
      messages: [...appAware.sessionInput.messages, htmlPreviewUserMessage, htmlPreviewAssistantMessage],
    },
    blobEntries: [
      {
        key: buildAttachmentStorageKey('msg-current-assistant'),
        value: JSON.stringify(
          {
            draftId: 'seeded-story-draft-001',
            checkpoint: 'active-shell',
            summary: 'Restored the active story draft and preserved the exportable checkpoint.',
          },
          null,
          2
        ),
      },
    ],
  }
}

export function buildChatBridgeChessMidGameSessionFixture(): Omit<Session, 'id'> {
  const seededChessSnapshot = normalizeChatBridgeChessRuntimeSnapshot({
    route: '/apps/chess',
    status: 'active',
    startingFen: CHESS_MID_GAME_FEN,
    moveHistory: [],
    boardContext: {
      schemaVersion: 1,
      fen: CHESS_MID_GAME_FEN,
      sideToMove: 'white',
      fullmoveNumber: 6,
      legalMovesCount: 33,
      positionStatus: 'in_progress',
      lastMove: {
        san: '...e5',
        uci: 'e7e5',
      },
      summary: 'White to move in an Italian Game structure after ...e5.',
    },
    feedback: {
      kind: 'info',
      title: 'Host snapshot',
      message: 'White to move in an Italian Game structure after ...e5.',
    },
  })

  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Chess mid-game board context`,
    type: 'chat',
    threadName: 'Chess Mid-game',
    messages: [
      createTextMessage(
        'msg-chess-system',
        'system',
        'Keep Chess reasoning grounded in the host-owned board summary rather than partner-authored prose.',
        1
      ),
      createTextMessage(
        'msg-chess-user-open',
        'user',
        'Open Chess and keep the board visible in the thread while I think.',
        2
      ),
      createAppLifecycleMessage(
        'msg-chess-assistant-board',
        'assistant',
        'Chess is open in the thread with the current mid-game position restored.',
        {
          appId: 'chess',
          appName: 'Chess',
          toolCallId: 'tool-chess-mid-game',
          lifecycle: 'active',
          summary: 'White to move in an Italian Game structure after ...e5.',
          snapshot: seededChessSnapshot,
          timestamp: 3,
        }
      ),
      createTextMessage('msg-chess-user-follow-up', 'user', 'What should White focus on here?', 4),
    ],
  }
}

export function buildChatBridgeDrawingKitDoodleDareSessionFixture(): Omit<Session, 'id'> {
  const request = 'Open Drawing Kit and start a sticky-note doodle dare.'
  const snapshot = createInitialDrawingKitAppSnapshot({
    request,
    updatedAt: 3,
  })

  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Drawing Kit doodle dare`,
    type: 'chat',
    threadName: 'Drawing Kit Doodle Dare',
    messages: [
      createTextMessage(
        'msg-drawing-system',
        'system',
        'Keep Drawing Kit follow-up grounded in the host-owned doodle summary, checkpoint id, and sticker reward instead of raw stroke telemetry.',
        1
      ),
      createTextMessage(
        'msg-drawing-user',
        'user',
        'Open Drawing Kit and give me a doodle round I can play inside the thread.',
        2
      ),
      createDrawingKitRuntimeMessage('msg-drawing-assistant', 3, snapshot),
    ],
    chatBridgeAppRecords: createSeededDrawingKitAppRecords(snapshot),
  }
}

export function buildChatBridgeFlashcardStudioStudySessionFixture(): Omit<Session, 'id'> {
  const request = 'Open Flashcard Studio and help me study biology flashcards.'
  const snapshot = createFlashcardStudioAppSnapshot({
    request,
    deckTitle: 'Biology review',
    mode: 'study',
    studyStatus: 'studying',
    cards: [
      {
        cardId: 'card-1',
        prompt: 'What does the mitochondria do?',
        answer: 'It helps the cell produce energy.',
      },
      {
        cardId: 'card-2',
        prompt: 'What is photosynthesis?',
        answer: 'Plants use sunlight to make food.',
      },
      {
        cardId: 'card-3',
        prompt: 'What is cellular respiration?',
        answer: 'Cells convert glucose and oxygen into usable energy.',
      },
    ],
    selectedCardId: 'card-1',
    studyPosition: 2,
    revealedCardId: 'card-3',
    studyMarks: [
      { cardId: 'card-1', confidence: 'easy' },
      { cardId: 'card-2', confidence: 'hard' },
    ],
    lastAction: 'revealed-card',
    lastUpdatedAt: 3,
  })

  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Flashcard Studio study mode`,
    type: 'chat',
    threadName: 'Flashcard Studio Study Mode',
    messages: [
      createTextMessage(
        'msg-flashcard-system',
        'system',
        'Keep Flashcard follow-up grounded in the host-owned deck summary, study counts, and weak-card prompts instead of raw answer text.',
        1
      ),
      createTextMessage('msg-flashcard-user', 'user', request, 2),
      createFlashcardStudioRuntimeMessage('msg-flashcard-assistant', 3, snapshot),
    ],
    chatBridgeAppRecords: createSeededFlashcardStudioAppRecords(snapshot),
  }
}

function createSeededFlashcardStudioDriveSnapshot(options: {
  request: string
  drive: {
    status: 'needs-auth' | 'expired'
    statusText?: string
    detail?: string
  }
  lastUpdatedAt: number
}) {
  const savedDeckName = 'Biology review.chatbridge-flashcards.json'

  return createFlashcardStudioAppSnapshot({
    request: options.request,
    deckTitle: 'Biology review',
    mode: 'study',
    studyStatus: 'studying',
    cards: [
      {
        cardId: 'card-1',
        prompt: 'What does the mitochondria do?',
        answer: 'It helps the cell produce energy.',
      },
      {
        cardId: 'card-2',
        prompt: 'What is photosynthesis?',
        answer: 'Plants use sunlight to make food.',
      },
      {
        cardId: 'card-3',
        prompt: 'What is cellular respiration?',
        answer: 'Cells convert glucose and oxygen into usable energy.',
      },
    ],
    selectedCardId: 'card-3',
    studyPosition: 2,
    revealedCardId: 'card-3',
    studyMarks: [
      { cardId: 'card-1', confidence: 'easy' },
      { cardId: 'card-2', confidence: 'hard' },
    ],
    drive: {
      status: options.drive.status,
      statusText: options.drive.statusText,
      detail: options.drive.detail,
      recentDecks: [
        {
          deckId: 'drive-deck-biology-review',
          deckName: savedDeckName,
          modifiedAt: 1_717_000_100_000,
          lastOpenedAt: 1_717_000_200_000,
        },
      ],
      lastSavedDeckId: 'drive-deck-biology-review',
      lastSavedDeckName: savedDeckName,
      lastSavedAt: 1_717_000_100_000,
    },
    lastAction: 'revealed-card',
    lastUpdatedAt: options.lastUpdatedAt,
  })
}

export function buildChatBridgeFlashcardStudioDriveResumeSessionFixture(): Omit<Session, 'id'> {
  const request = 'Open Flashcard Studio and reconnect Drive so I can resume my saved biology deck.'
  const snapshot = createSeededFlashcardStudioDriveSnapshot({
    request,
    drive: {
      status: 'needs-auth',
    },
    lastUpdatedAt: 3,
  })

  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Flashcard Studio Drive resume`,
    type: 'chat',
    threadName: 'Flashcard Studio Drive Resume',
    messages: [
      createTextMessage(
        'msg-flashcard-drive-system',
        'system',
        'Keep Flashcard follow-up grounded in the host-owned Drive resume metadata, study counts, and weak-card prompts instead of raw answer text or Drive payloads.',
        1
      ),
      createTextMessage('msg-flashcard-drive-user', 'user', request, 2),
      createFlashcardStudioRuntimeMessage('msg-flashcard-drive-assistant', 3, snapshot),
    ],
    chatBridgeAppRecords: createSeededFlashcardStudioAppRecords(snapshot),
  }
}

export function buildChatBridgeFlashcardStudioDriveDeniedSessionFixture(): Omit<Session, 'id'> {
  const request = 'Open Flashcard Studio and reconnect Drive so I can resume my saved biology deck.'
  const snapshot = createSeededFlashcardStudioDriveSnapshot({
    request,
    drive: {
      status: 'needs-auth',
      statusText: 'Reconnect Drive to resume',
      detail: 'Google Drive permission was not granted. Connect Drive when you want to save or reopen decks.',
    },
    lastUpdatedAt: 4,
  })

  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Flashcard Studio Drive denied reconnect`,
    type: 'chat',
    threadName: 'Flashcard Studio Drive Denied Reconnect',
    messages: [
      createTextMessage(
        'msg-flashcard-drive-denied-system',
        'system',
        'Keep Flashcard follow-up grounded in the host-owned Drive recovery state, the local deck summary, and the weak-card prompts instead of raw Drive payloads.',
        1
      ),
      createTextMessage('msg-flashcard-drive-denied-user', 'user', request, 2),
      createFlashcardStudioRuntimeMessage('msg-flashcard-drive-denied-assistant', 3, snapshot),
    ],
    chatBridgeAppRecords: createSeededFlashcardStudioAppRecords(snapshot),
  }
}

export function buildChatBridgeFlashcardStudioDriveExpiredSessionFixture(): Omit<Session, 'id'> {
  const request = 'Open Flashcard Studio and keep saving my biology deck to Drive.'
  const snapshot = createSeededFlashcardStudioDriveSnapshot({
    request,
    drive: {
      status: 'expired',
    },
    lastUpdatedAt: 5,
  })

  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Flashcard Studio Drive expired auth`,
    type: 'chat',
    threadName: 'Flashcard Studio Drive Expired Auth',
    messages: [
      createTextMessage(
        'msg-flashcard-drive-expired-system',
        'system',
        'Keep Flashcard follow-up grounded in the host-owned expired-auth state, the still-open local deck, and the weak-card prompts instead of raw Drive payloads.',
        1
      ),
      createTextMessage('msg-flashcard-drive-expired-user', 'user', request, 2),
      createFlashcardStudioRuntimeMessage('msg-flashcard-drive-expired-assistant', 3, snapshot),
    ],
    chatBridgeAppRecords: createSeededFlashcardStudioAppRecords(snapshot),
  }
}

export function buildChatBridgeWeatherDashboardSessionFixture(): Omit<Session, 'id'> {
  const request = 'Open Weather Dashboard for Chicago and show the forecast.'
  const snapshot = createWeatherDashboardReadySnapshot({
    request,
    locationQuery: 'Chicago',
    locationName: 'Chicago, Illinois, United States',
    timezone: 'America/Chicago',
    units: 'imperial',
    fetchedAt: 3,
    staleAt: 603_000,
    referenceTime: 4,
    current: {
      temperature: 72,
      apparentTemperature: 70,
      weatherCode: 800,
      conditionLabel: 'Clear sky',
      windSpeed: 9,
    },
    hourly: [
      {
        timeKey: '2026-04-02T17:00:00-05:00',
        hourLabel: '12 PM',
        temperature: 72,
        weatherCode: 800,
        conditionLabel: 'Clear sky',
        precipitationChance: 10,
      },
      {
        timeKey: '2026-04-02T18:00:00-05:00',
        hourLabel: '1 PM',
        temperature: 74,
        weatherCode: 801,
        conditionLabel: 'Few clouds',
        precipitationChance: 10,
      },
    ],
    daily: [
      {
        dateKey: '2026-04-02',
        dayLabel: 'Thu',
        high: 74,
        low: 58,
        weatherCode: 800,
        conditionLabel: 'Clear sky',
        precipitationChance: 10,
      },
      {
        dateKey: '2026-04-03',
        dayLabel: 'Fri',
        high: 76,
        low: 60,
        weatherCode: 801,
        conditionLabel: 'Few clouds',
        precipitationChance: 20,
      },
      {
        dateKey: '2026-04-04',
        dayLabel: 'Sat',
        high: 71,
        low: 54,
        weatherCode: 500,
        conditionLabel: 'Light rain',
        precipitationChance: 40,
      },
      {
        dateKey: '2026-04-05',
        dayLabel: 'Sun',
        high: 66,
        low: 51,
        weatherCode: 804,
        conditionLabel: 'Overcast',
        precipitationChance: 55,
      },
    ],
    alerts: [
      {
        source: 'National Weather Service',
        event: 'Heat Advisory',
        startsAt: 1_717_000_000_000,
        endsAt: 1_717_003_600_000,
        description: 'Hot conditions are expected through the afternoon.',
        tags: ['Extreme temperature value'],
      },
    ],
  })

  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Weather dashboard`,
    type: 'chat',
    threadName: 'Weather Dashboard',
    messages: [
      createTextMessage(
        'msg-weather-system',
        'system',
        'Keep weather follow-up grounded in the host-owned snapshot, freshness state, and short forecast summary rather than raw provider payloads.',
        1
      ),
      createTextMessage('msg-weather-user', 'user', request, 2),
      createWeatherDashboardRuntimeMessage('msg-weather-assistant', 3, snapshot),
    ],
    chatBridgeAppRecords: createSeededWeatherDashboardAppRecords(snapshot),
  }
}

export function buildChatBridgeChessRuntimeSessionFixture(): Omit<Session, 'id'> {
  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Chess runtime`,
    type: 'chat',
    threadName: 'Chess Runtime',
    messages: [
      createTextMessage(
        'msg-chess-system',
        'system',
        'Keep the live chess runtime inside the host shell and persist the legal board state after every relevant move attempt.',
        1
      ),
      createTextMessage(
        'msg-chess-user',
        'user',
        'Open the chess board in the thread and let me test legal and illegal moves.',
        2
      ),
      createChessRuntimeMessage('msg-chess-assistant', 3),
    ],
    chatBridgeAppRecords: createSeededChessAppRecords(),
  }
}

export function buildChatBridgeRuntimeAndRouteReceiptSessionFixture(): Omit<Session, 'id'> {
  const routeReceipt = createChatBridgeRouteMessagePart({
    schemaVersion: 2,
    hostRuntime: 'desktop-electron',
    kind: 'refuse',
    reasonCode: 'no-confident-match',
    prompt: 'What should I cook for dinner tonight?',
    summary:
      'No reviewed app is a confident fit for this request, so the host will keep helping in chat instead of forcing a launch.',
    matches: [],
  })

  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Runtime + route receipt`,
    type: 'chat',
    threadName: 'Runtime + Route Receipt',
    messages: [
      createTextMessage(
        'msg-runtime-route-system',
        'system',
        'Only render docked app chrome when a real host-owned runtime surface exists; keep route receipts inline in chat.',
        1
      ),
      createTextMessage(
        'msg-runtime-route-user-open',
        'user',
        'Open the chess board in the thread and keep it live while I ask other questions.',
        2
      ),
      createChessRuntimeMessage('msg-runtime-route-chess', 3),
      createTextMessage('msg-runtime-route-user-follow-up', 'user', 'What should I cook for dinner tonight?', 4),
      {
        id: 'msg-runtime-route-receipt',
        role: 'assistant',
        timestamp: 5,
        contentParts: [routeReceipt],
      },
    ],
    chatBridgeAppRecords: createSeededChessAppRecords(),
  }
}

export function buildChatBridgeIntelligentRoutingSessionFixture(): Omit<Session, 'id'> {
  const flashcardRouteReceipt = createChatBridgeRouteMessagePart({
    schemaVersion: 2,
    hostRuntime: 'desktop-electron',
    kind: 'invoke',
    reasonCode: 'semantic-app-match',
    prompt: 'I need to cram biology terms before tomorrow\'s quiz.',
    summary: 'The host identified Flashcard Studio as the best reviewed-app fit for this request.',
    selectedAppId: 'flashcard-studio',
    matches: [
      {
        appId: 'flashcard-studio',
        appName: 'Flashcard Studio',
        matchedContexts: [],
        matchedTerms: ['biology', 'quiz'],
        score: 9,
        exactAppMatch: false,
        exactToolMatch: false,
      },
    ],
  })
  const drawingRouteReceipt = createChatBridgeRouteMessagePart({
    schemaVersion: 2,
    hostRuntime: 'desktop-electron',
    kind: 'invoke',
    reasonCode: 'semantic-app-match',
    prompt: 'Help me sketch a poster idea for Earth Day.',
    summary: 'The host identified Drawing Kit as the best reviewed-app fit for this request.',
    selectedAppId: 'drawing-kit',
    matches: [
      {
        appId: 'drawing-kit',
        appName: 'Drawing Kit',
        matchedContexts: [],
        matchedTerms: ['sketch', 'poster'],
        score: 8,
        exactAppMatch: false,
        exactToolMatch: false,
      },
    ],
  })
  const weatherRouteReceipt = createChatBridgeRouteMessagePart({
    schemaVersion: 2,
    hostRuntime: 'desktop-electron',
    kind: 'invoke',
    reasonCode: 'semantic-app-match',
    prompt: 'Do I need an umbrella before school tomorrow in Chicago?',
    summary: 'The host identified Weather Dashboard as the best reviewed-app fit for this request.',
    selectedAppId: 'weather-dashboard',
    matches: [
      {
        appId: 'weather-dashboard',
        appName: 'Weather Dashboard',
        matchedContexts: [],
        matchedTerms: ['umbrella', 'tomorrow', 'chicago'],
        score: 8,
        exactAppMatch: false,
        exactToolMatch: false,
      },
    ],
  })
  const clarifyReceipt = createChatBridgeRouteMessagePart({
    schemaVersion: 2,
    hostRuntime: 'desktop-electron',
    kind: 'clarify',
    reasonCode: 'ambiguous-match',
    prompt: 'Help me sketch a weather-themed poster.',
    summary: 'This request could fit Drawing Kit or Weather Dashboard, so the host is asking before launching anything.',
    selectedAppId: 'drawing-kit',
    matches: [
      {
        appId: 'drawing-kit',
        appName: 'Drawing Kit',
        matchedContexts: [],
        matchedTerms: ['sketch', 'poster'],
        score: 7,
        exactAppMatch: false,
        exactToolMatch: false,
      },
      {
        appId: 'weather-dashboard',
        appName: 'Weather Dashboard',
        matchedContexts: [],
        matchedTerms: ['weather'],
        score: 6,
        exactAppMatch: false,
        exactToolMatch: false,
      },
    ],
  })

  return {
    name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Intelligent routing`,
    type: 'chat',
    threadName: 'Intelligent Routing',
    messages: [
      createTextMessage(
        'msg-intelligent-routing-system',
        'system',
        'Treat reviewed-app routing as a host-owned intent decision: loose natural-language requests may still map to the right app, but ambiguous prompts must stay explainable.',
        1
      ),
      createTextMessage('msg-intelligent-routing-user-flashcards', 'user', 'I need to cram biology terms before tomorrow\'s quiz.', 2),
      {
        id: 'msg-intelligent-routing-assistant-flashcards',
        role: 'assistant',
        timestamp: 3,
        contentParts: [flashcardRouteReceipt],
      },
      createTextMessage('msg-intelligent-routing-user-drawing', 'user', 'Help me sketch a poster idea for Earth Day.', 4),
      {
        id: 'msg-intelligent-routing-assistant-drawing',
        role: 'assistant',
        timestamp: 5,
        contentParts: [drawingRouteReceipt],
      },
      createTextMessage(
        'msg-intelligent-routing-user-weather',
        'user',
        'Do I need an umbrella before school tomorrow in Chicago?',
        6
      ),
      {
        id: 'msg-intelligent-routing-assistant-weather',
        role: 'assistant',
        timestamp: 7,
        contentParts: [weatherRouteReceipt],
      },
      createTextMessage(
        'msg-intelligent-routing-user-clarify',
        'user',
        'Help me sketch a weather-themed poster.',
        8
      ),
      {
        id: 'msg-intelligent-routing-assistant-clarify',
        role: 'assistant',
        timestamp: 9,
        contentParts: [clarifyReceipt],
      },
    ],
  }
}

export function getChatBridgeLiveSeedFixtures(): ChatBridgeLiveSeedFixture[] {
  const historyAndPreview = buildChatBridgeHistoryAndPreviewSessionFixture()

  return [
    {
      id: 'lifecycle-tour',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Lifecycle tour`,
      description:
        'Seeds every host-owned lifecycle shell state so you can inspect loading, ready, active, complete, stale, and error handling in the real message timeline.',
      fixtureRole: 'platform-regression',
      smokeSupport: 'supported',
      coverage: ['Host shell states', 'Inline completion', 'Stale + error recovery'],
      auditSteps: [
        {
          action: 'Open the seeded session and scroll through the assistant messages.',
          expected: 'Each lifecycle state renders through the host shell, not a raw status card or detached receipt.',
        },
        {
          action: 'Inspect the `Complete`, `Stale`, and `Error` states.',
          expected: 'Completion stays inline, and stale/error states keep fallback text visible in the thread.',
        },
      ],
      sessionInput: buildChatBridgeLifecycleTourSessionFixture(),
    },
    {
      id: 'degraded-completion-recovery',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Degraded completion recovery`,
      description:
        'Seeds partial, missing, and invalid completion endings so you can verify the host-owned recovery UI, trust rail, and inline action acknowledgements in the live chat timeline.',
      fixtureRole: 'platform-regression',
      smokeSupport: 'supported',
      coverage: ['Degraded completion states', 'Inline recovery actions', 'Trust rail'],
      auditSteps: [
        {
          action: 'Open the seeded degraded recovery session and inspect the three assistant recovery messages.',
          expected:
            'Each degraded ending stays inside the host shell with an explicit recovery banner and a separate trust rail instead of collapsing into a generic error card.',
        },
        {
          action: 'On the `Completion payload never arrived` message, click `Continue safely`.',
          expected:
            'The same message updates inline to an acknowledgement state, the status badge changes to the requested action, and the selected action becomes disabled.',
        },
        {
          action: 'On the `Completion fields failed validation` message, click `Inspect invalid fields`.',
          expected:
            'The message stays in place, the acknowledgement text explains that invalid fields remain quarantined, and no extra summary receipt appears below it.',
        },
      ],
      sessionInput: buildChatBridgeDegradedCompletionRecoverySessionFixture(),
    },
    {
      id: 'platform-recovery',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Platform recovery`,
      description:
        'Seeds timeout, crash, invalid tool call, malformed bridge event, and bridge rejection recoveries so you can inspect the unified host-owned failure model in the live thread.',
      fixtureRole: 'platform-regression',
      smokeSupport: 'supported',
      coverage: ['Timeout recovery', 'Crash recovery', 'Invalid tool handling', 'Bridge failure recovery'],
      auditSteps: [
        {
          action: 'Open the seeded Platform recovery session and inspect the five assistant recovery messages.',
          expected:
            'Each failure class stays inside the host shell with a bounded recovery banner and trust rail instead of collapsing into a generic error card.',
        },
        {
          action: 'Compare the `Timed out`, `Runtime crash`, `Invalid tool call`, and `Malformed event` badges.',
          expected:
            'Each message explains a distinct host-owned failure class with a matching safe next action rather than reusing one generic fallback string.',
        },
        {
          action: 'Open the `save_story did not pass host validation` message and verify the trust rail.',
          expected:
            'The trust rail makes it explicit that no side effect executed and that the rejected inputs remain bounded to safe diagnostics.',
        },
      ],
      sessionInput: buildChatBridgePlatformRecoverySessionFixture(),
    },
    {
      id: 'chess-mid-game-board-context',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Chess mid-game board context`,
      description:
        'Seeds a live Chess session with a validated host-owned board summary so you can ask a follow-up and confirm the assistant sees bounded mid-game context instead of raw app prose.',
      fixtureRole: 'active-flagship',
      smokeSupport: 'supported',
      coverage: ['Chess board context', 'Mid-game follow-up reasoning', 'Host-owned normalized summary'],
      auditSteps: [
        {
          action: 'Open the seeded Chess session and inspect the active app message.',
          expected:
            'The message stays inside the host shell and exposes a live Chess runtime instead of a detached completion receipt.',
        },
        {
          action: 'Play a legal move such as `Bxf7+` directly on the seeded board.',
          expected: 'The move is accepted inline and the host-owned app snapshot updates without leaving the thread.',
        },
        {
          action: 'Ask a follow-up such as `What should White focus on here?` from the seeded thread.',
          expected:
            'The reply stays grounded in the current host-owned board summary and does not invent board details outside the validated snapshot.',
        },
      ],
      sessionInput: buildChatBridgeChessMidGameSessionFixture(),
    },
    {
      id: 'drawing-kit-doodle-dare',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Drawing Kit doodle dare`,
      description:
        'Seeds the approved Drawing Kit doodle game so you can sketch inline, bank a checkpoint, and verify later chat stays grounded in the host-owned round summary.',
      fixtureRole: 'active-flagship',
      smokeSupport: 'supported',
      coverage: ['Drawing Kit runtime', 'Checkpoint continuity', 'Follow-up chat'],
      auditSteps: [
        {
          action: 'Open the seeded Drawing Kit session and confirm the doodle runtime appears inline with the round prompt and tool rail.',
          expected:
            'The round opens inside the host shell as a playful doodle game, not a detached artifact preview or static placeholder.',
        },
        {
          action: 'Use `Add squiggle` or the canvas, then click `Drop sticker` and `Bank this round`.',
          expected:
            'The status, checkpoint panel, and host-owned summary update inline while keeping only bounded checkpoint details visible.',
        },
        {
          action: 'Ask a follow-up such as `What did I just draw?` in the same thread after banking or locking the round.',
          expected:
            'The reply references the host-owned caption, prompt, checkpoint, or sticker reward instead of inventing details from raw canvas marks.',
        },
      ],
      sessionInput: buildChatBridgeDrawingKitDoodleDareSessionFixture(),
    },
    {
      id: 'flashcard-studio-study-mode',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Flashcard Studio study mode`,
      description:
        'Seeds Flashcard Studio in the middle of a study round so you can reveal answers, mark confidence, and verify later chat stays grounded in bounded weak-card review cues.',
      fixtureRole: 'active-flagship',
      smokeSupport: 'supported',
      coverage: ['Flashcard runtime', 'Study progress', 'Weak-card continuity'],
      auditSteps: [
        {
          action: 'Open the seeded Flashcard Studio session and confirm the study card appears inline with progress and confidence controls.',
          expected:
            'The reviewed runtime opens directly into study mode, keeps one active card centered, and shows bounded counts instead of a detached result card.',
        },
        {
          action: 'Click `Reveal answer`, then mark the card `Medium` or `Hard`.',
          expected:
            'The answer reveals inline, the confidence buttons record the result, and the next card advances without dumping answer text into the surrounding chat timeline.',
        },
        {
          action: 'Ask a follow-up such as `Which card should I review again?` in the same thread after returning the study summary to chat.',
          expected:
            'The reply stays grounded in the host-owned weak-card prompt list and confidence totals instead of repeating the full stored answers.',
        },
      ],
      sessionInput: buildChatBridgeFlashcardStudioStudySessionFixture(),
    },
    {
      id: 'flashcard-studio-drive-resume',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Flashcard Studio Drive resume`,
      description:
        'Seeds Flashcard Studio with bounded Drive resume metadata so you can reconnect Google Drive, reopen the saved deck, and confirm the host keeps auth and persistence outside the reviewed runtime.',
      fixtureRole: 'active-flagship',
      smokeSupport: 'supported',
      coverage: ['Flashcard Drive auth rail', 'Drive save and resume metadata', 'Host-owned reconnect flow'],
      auditSteps: [
        {
          action: 'Open the seeded Flashcard Studio Drive resume session and inspect the host-owned Drive rail above the study card.',
          expected:
            'The inline shell shows `Reconnect Drive to resume`, a recent saved deck entry, and the regular study card beneath it instead of hiding Drive state inside the embedded runtime.',
        },
        {
          action: 'Click `Connect Drive` and complete the Google consent flow when prompted.',
          expected:
            'The same inline shell stays mounted, the status changes to `Drive connected`, and the save or reopen controls remain host-owned instead of moving auth into the iframe.',
        },
        {
          action: 'Click `Open recent` for the saved Biology deck after Drive is connected.',
          expected:
            'The deck reloads inside the same thread with the saved study progress restored, and later chat remains grounded in weak-card prompts plus Drive resume metadata.',
        },
      ],
      sessionInput: buildChatBridgeFlashcardStudioDriveResumeSessionFixture(),
    },
    {
      id: 'flashcard-studio-drive-denied',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Flashcard Studio Drive denied reconnect`,
      description:
        'Seeds Flashcard Studio after a Google Drive consent denial so you can confirm the host keeps the deck open locally, preserves resume metadata, and offers a clear reconnect path without collapsing into a generic error shell.',
      fixtureRole: 'platform-regression',
      smokeSupport: 'supported',
      coverage: ['Flashcard Drive denial recovery', 'Local deck continuity', 'Reconnect guidance'],
      auditSteps: [
        {
          action: 'Open the seeded Flashcard Studio Drive denied reconnect session and inspect the host-owned Drive rail above the study card.',
          expected:
            'The rail still says `Reconnect Drive to resume`, explains that Google Drive permission was not granted, and keeps the same Biology deck plus study progress visible underneath.',
        },
        {
          action: 'Verify the deck and weak-card context are still present in the inline study shell.',
          expected:
            'The current deck remains open locally, the study card still shows the active prompt, and later chat can reference weak-card metadata without assuming Drive access succeeded.',
        },
        {
          action: 'Click `Connect Drive` when you want to retry consent.',
          expected:
            'The same host-owned shell handles the reconnect attempt instead of dropping the thread into a detached auth receipt or generic Drive error state.',
        },
      ],
      sessionInput: buildChatBridgeFlashcardStudioDriveDeniedSessionFixture(),
    },
    {
      id: 'flashcard-studio-drive-expired',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Flashcard Studio Drive expired auth`,
      description:
        'Seeds Flashcard Studio after a previously granted Drive connection has expired so you can confirm the host keeps the deck open locally, preserves saved-deck metadata, and asks for reconnect before save or reopen resumes.',
      fixtureRole: 'platform-regression',
      smokeSupport: 'supported',
      coverage: ['Flashcard Drive expired auth recovery', 'Saved deck continuity', 'Reconnect-required shell state'],
      auditSteps: [
        {
          action: 'Open the seeded Flashcard Studio Drive expired auth session and inspect the host-owned Drive rail above the study card.',
          expected:
            'The rail says `Reconnect Drive to continue`, explains that authorization expired, and still names the saved Biology deck instead of acting like the deck disappeared.',
        },
        {
          action: 'Verify the study shell still holds the local deck and weak-card context.',
          expected:
            'The current card, study counts, and weak-card continuity stay visible even though save or reopen actions remain gated until Drive is reconnected.',
        },
        {
          action: 'Click `Reconnect Drive` when you want to restore Drive access.',
          expected:
            'The reconnect attempt happens inside the same host-owned shell, and successful auth re-enables the save or reopen path without losing the local deck state.',
        },
      ],
      sessionInput: buildChatBridgeFlashcardStudioDriveExpiredSessionFixture(),
    },
    {
      id: 'weather-dashboard',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Weather dashboard`,
      description:
        'Seeds the reviewed Weather Dashboard launch so you can verify the host-owned weather snapshot, stale fallback behavior, location swap controls, and the explicit close-to-chat handoff inside the normal chat shell.',
      fixtureRole: 'active-flagship',
      smokeSupport: 'supported',
      coverage: [
        'Weather runtime',
        'Host-owned weather fetch',
        'Refresh continuity',
        'Location continuity',
        'Close handoff',
      ],
      auditSteps: [
        {
          action: 'Open the seeded Weather Dashboard session and wait for the initial host-owned weather snapshot to load.',
          expected:
            'The dashboard renders inline with current conditions, hourly and daily outlook sections, alert coverage, and explicit host snapshot cards instead of a plain text fallback.',
        },
        {
          action: 'Click `Refresh weather` after the first snapshot loads.',
          expected:
            'The same inline dashboard remains mounted, the host status updates, and the refreshed or cached snapshot stays visible without spawning a separate receipt.',
        },
        {
          action: 'Change the `Location` field to a different city such as `Denver` and click `Update location`.',
          expected:
            'The same inline dashboard stays mounted, the host snapshot swaps to the new city, and later refreshes continue from that updated location instead of the original launch request.',
        },
        {
          action: 'Ask a follow-up such as `Summarize the weather you just showed me.` in the same thread.',
          expected:
            'Later chat stays grounded in the latest host-owned weather summary for the active location and does not invent provider details that were never rendered or normalized.',
        },
        {
          action: 'Click `Close dashboard`, then ask what weather was last shown in the thread.',
          expected:
            'The weather app closes with an explicit host-owned completion summary, and the follow-up answer stays grounded in that last validated snapshot instead of inventing a fresh provider read.',
        },
      ],
      sessionInput: buildChatBridgeWeatherDashboardSessionFixture(),
    },
    {
      id: 'chess-runtime',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Chess runtime`,
      description:
        'Seeds a playable chess board in the real host shell so you can verify legal move acceptance, illegal move rejection, and reload continuity against live session storage.',
      fixtureRole: 'active-flagship',
      smokeSupport: 'supported',
      coverage: ['Chess runtime', 'Legal + illegal moves', 'Host state persistence'],
      auditSteps: [
        {
          action: 'Open the seeded chess session, click `E2`, then click `E5`.',
          expected: 'The board rejects the illegal move inline and keeps the legal opening position unchanged.',
        },
        {
          action: 'Click `E2`, then click `E4`.',
          expected:
            'The board updates to the legal move, the move ledger shows `1. e4`, and the host sync card reflects the new position key.',
        },
        {
          action: 'Reload the session route or switch away and back to the seeded session.',
          expected:
            'The pawn remains on `E4`; the board does not reset to the opening position because the host persisted the latest chess snapshot.',
        },
      ],
      sessionInput: buildChatBridgeChessRuntimeSessionFixture(),
    },
    {
      id: 'runtime-and-route-receipt',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Runtime + route receipt`,
      description:
        'Seeds a live Chess runtime followed by a later chat-only route receipt so you can verify the docked tray stays tied to the real runtime and the receipt remains inline.',
      fixtureRole: 'platform-regression',
      smokeSupport: 'supported',
      coverage: ['Mixed runtime history', 'Tray eligibility gating', 'Inline route receipts'],
      auditSteps: [
        {
          action: 'Open the seeded session and confirm the Chess runtime is the docked app tray target.',
          expected:
            'The tray mounts with the live Chess board because it is the only renderable runtime surface in the thread.',
        },
        {
          action: 'Scroll to the later `Keep this in chat` refusal receipt.',
          expected:
            'The receipt stays inline in the normal timeline and does not collapse into anchor chrome or show `Focus app` / `Restore app` controls.',
        },
        {
          action: 'Use the tray `Source` action or jump between the tray and the later receipt.',
          expected:
            'The tray continues pointing back to the Chess source message, and the later route receipt never steals the docked runtime slot.',
        },
      ],
      sessionInput: buildChatBridgeRuntimeAndRouteReceiptSessionFixture(),
    },
    {
      id: 'intelligent-routing',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} Intelligent routing`,
      description:
        'Seeds semantic reviewed-app route receipts so you can verify loose study, drawing, and weather prompts map to the correct app while ambiguous prompts still ask for clarification.',
      fixtureRole: 'platform-regression',
      smokeSupport: 'supported',
      coverage: ['Semantic reviewed-app routing', 'Loose natural-language intent', 'Explainable clarify fallback'],
      auditSteps: [
        {
          action: 'Open the seeded Intelligent routing session and inspect the first three assistant route receipts.',
          expected:
            'Loose natural-language prompts route to Flashcard Studio, Drawing Kit, and Weather Dashboard even though none of the prompts explicitly names the app.',
        },
        {
          action: 'Compare the receipt titles and summaries for the study, drawing, and umbrella prompts.',
          expected:
            'Each receipt stays inline in chat, shows the correct app readiness title, and describes the app as the best reviewed fit instead of relying on exact-name matching.',
        },
        {
          action: 'Inspect the final `Help me sketch a weather-themed poster.` receipt.',
          expected:
            'The host asks you to choose the next step instead of guessing between Drawing Kit and Weather Dashboard.',
        },
      ],
      sessionInput: buildChatBridgeIntelligentRoutingSessionFixture(),
    },
    {
      id: 'history-and-preview',
      name: `${CHATBRIDGE_LIVE_SEED_PREFIX} History + preview`,
      description:
        'Seeds a legacy Story Builder reference session with thread history, a persisted attachment checkpoint, and a renderable HTML artifact preview you can open and refresh live.',
      fixtureRole: 'legacy-reference',
      smokeSupport: 'legacy-reference',
      coverage: ['Thread history', 'Attachment presence', 'HTML preview runtime'],
      auditSteps: [
        {
          action: 'Open the seeded session and use the normal thread-history control in the chat UI.',
          expected: 'The older complete Story Builder thread is still present and explicit.',
        },
        {
          action: 'In the current thread, find the HTML preview message and click `Preview`, then `Refresh`.',
          expected: 'The runtime opens inside the host shell, and refresh keeps it in the same inline surface.',
        },
      ],
      sessionInput: historyAndPreview.sessionInput,
      blobEntries: historyAndPreview.blobEntries,
    },
  ]
}

export function getChatBridgeLiveSeedInspectionEntries(): ChatBridgeLiveSeedInspectionEntry[] {
  return getChatBridgeLiveSeedFixtures().map((fixture) => ({
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    description: fixture.description,
    fixtureRole: fixture.fixtureRole,
    smokeSupport: fixture.smokeSupport,
    coverage: [...fixture.coverage],
    auditStepCount: fixture.auditSteps.length,
    blobEntryCount: fixture.blobEntries?.length ?? 0,
  }))
}
