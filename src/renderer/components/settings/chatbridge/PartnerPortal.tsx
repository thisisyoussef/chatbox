import {
  Alert,
  Badge,
  Box,
  Button,
  Code,
  FileButton,
  Flex,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconCheck, IconFileCode, IconUpload, IconX } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type {
  ChatBridgePartnerSubmissionAssessment,
  ChatBridgePartnerSubmissionConflict,
} from '@/packages/chatbridge/partner-submissions'
import {
  approveChatBridgePartnerSubmission,
  assessChatBridgePartnerSubmissionInput,
  getChatBridgePartnerSubmissionPortalSample,
  listChatBridgePartnerSubmissions,
  rejectChatBridgePartnerSubmission,
  submitChatBridgePartnerSubmission,
} from '@/packages/chatbridge/partner-submissions'

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

function getStatusColor(status: 'submitted' | 'approved' | 'rejected') {
  if (status === 'approved') {
    return 'green'
  }

  if (status === 'rejected') {
    return 'red'
  }

  return 'yellow'
}

function getConflictLabel(conflict: ChatBridgePartnerSubmissionConflict) {
  const source =
    conflict.sourceStatus === 'active-flagship'
      ? 'active catalog'
      : conflict.sourceStatus === 'legacy-reference'
        ? 'legacy reference'
        : conflict.sourceStatus

  return conflict.kind === 'appId'
    ? `App id "${conflict.value}" is already reserved by ${conflict.sourceAppName} (${source}).`
    : `Tool "${conflict.value}" is already reserved by ${conflict.sourceAppName} (${source}).`
}

function getSubmissionErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }

  return 'The partner submission action failed.'
}

export function PartnerPortal() {
  const [manifestText, setManifestText] = useState('')
  const [developerNotes, setDeveloperNotes] = useState('')
  const [runtimePackage, setRuntimePackage] = useState<{
    fileName: string
    html: string
    byteLength: number
  } | null>(null)
  const [assessment, setAssessment] = useState<ChatBridgePartnerSubmissionAssessment | null>(null)
  const [submissions, setSubmissions] = useState<Awaited<ReturnType<typeof listChatBridgePartnerSubmissions>>>([])
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [reviewNotesBySubmissionId, setReviewNotesBySubmissionId] = useState<Record<string, string>>({})

  const queueSummary = useMemo(() => {
    return submissions.reduce(
      (summary, record) => {
        summary[record.status] += 1
        return summary
      },
      {
        submitted: 0,
        approved: 0,
        rejected: 0,
      }
    )
  }, [submissions])

  async function refreshSubmissions() {
    const nextSubmissions = await listChatBridgePartnerSubmissions()
    setSubmissions(nextSubmissions)
  }

  useEffect(() => {
    void refreshSubmissions()
  }, [])

  async function handleValidate() {
    setBusyAction('validate')
    try {
      const nextAssessment = await assessChatBridgePartnerSubmissionInput(manifestText)
      setAssessment(nextAssessment)
      if (nextAssessment.submittable) {
        toast.success('Partner manifest is ready for review.')
      } else {
        toast.message('Partner manifest needs fixes before submission.')
      }
    } catch (error) {
      setAssessment({
        manifest: null,
        validation: null,
        parseError: getSubmissionErrorMessage(error),
        conflicts: [],
        submittable: false,
      })
      toast.error(getSubmissionErrorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function handleRuntimePackageUpload(file: File | null) {
    if (!file) {
      return
    }

    const html = await file.text()
    setRuntimePackage({
      fileName: file.name,
      html,
      byteLength: file.size || new TextEncoder().encode(html).length,
    })
    toast.success(`Loaded runtime package "${file.name}".`)
  }

  async function handleSubmit() {
    setBusyAction('submit')
    try {
      const record = await submitChatBridgePartnerSubmission({
        manifestInput: manifestText,
        developerNotes,
        runtimeHtml: runtimePackage?.html,
        runtimeFileName: runtimePackage?.fileName,
      })
      await refreshSubmissions()
      setAssessment(null)
      setManifestText('')
      setDeveloperNotes('')
      setRuntimePackage(null)
      toast.success(`Submitted ${record.manifest.name} for host review.`)
    } catch (error) {
      toast.error(getSubmissionErrorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function handleApprove(submissionId: string) {
    setBusyAction(`approve:${submissionId}`)
    try {
      const record = await approveChatBridgePartnerSubmission({
        submissionId,
        reviewNotes: reviewNotesBySubmissionId[submissionId],
      })
      await refreshSubmissions()
      toast.success(`${record.manifest.name} is now in the reviewed catalog.`)
    } catch (error) {
      toast.error(getSubmissionErrorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function handleReject(submissionId: string) {
    setBusyAction(`reject:${submissionId}`)
    try {
      const record = await rejectChatBridgePartnerSubmission({
        submissionId,
        reviewNotes: reviewNotesBySubmissionId[submissionId],
      })
      await refreshSubmissions()
      toast.success(`${record.manifest.name} was rejected from the review queue.`)
    } catch (error) {
      toast.error(getSubmissionErrorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  function loadSampleManifest() {
    const sample = getChatBridgePartnerSubmissionPortalSample()
    setManifestText(JSON.stringify(sample.manifest, null, 2))
    setDeveloperNotes(sample.developerNotes)
    setAssessment(null)
  }

  function loadSampleRuntime() {
    const sample = getChatBridgePartnerSubmissionPortalSample()
    setRuntimePackage({
      fileName: sample.runtimeFileName,
      html: sample.runtimeHtml,
      byteLength: new TextEncoder().encode(sample.runtimeHtml).length,
    })
  }

  const assessmentIssues = assessment?.validation?.issues ?? []
  const assessmentWarnings = assessmentIssues.filter((issue) => issue.severity === 'warning')
  const assessmentErrors = assessmentIssues.filter((issue) => issue.severity === 'error')

  return (
    <Stack p="md" gap="xl">
      <Stack gap="xs">
        <Title order={5}>ChatBridge Partners</Title>
        <Text c="chatbox-tertiary" maw={860}>
          This host-owned intake surface handles the missing self-serve partner workflow: developers can paste a
          reviewed manifest, optionally upload a single-file HTML runtime, submit it into the queue, and reviewers can
          approve or reject it without leaving the product shell.
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <Paper withBorder p="lg" radius="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text fw={600}>Developer submission</Text>
                <Text size="sm" c="chatbox-tertiary">
                  Paste either a bare reviewed manifest or a full reviewed catalog entry. Runtime upload is optional.
                </Text>
              </Box>
              <Group gap="xs">
                <Button variant="light" size="xs" onClick={loadSampleManifest}>
                  Load sample manifest
                </Button>
                <Button variant="light" size="xs" onClick={loadSampleRuntime}>
                  Load sample runtime
                </Button>
              </Group>
            </Group>

            <Textarea
              label="Manifest JSON"
              description="The portal accepts either a manifest object or a full reviewed catalog entry. Approval metadata in pasted examples is ignored until review."
              autosize
              minRows={16}
              value={manifestText}
              onChange={(event) => {
                setManifestText(event.currentTarget.value)
                setAssessment(null)
              }}
              styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } }}
            />

            <Stack gap="xs">
              <Text fw={500}>Optional HTML runtime package</Text>
              <Group gap="xs">
                <FileButton accept=".html,text/html,.htm" onChange={handleRuntimePackageUpload}>
                  {(props) => (
                    <Button {...props} variant="outline" leftSection={<IconUpload size={16} />}>
                      Upload HTML runtime
                    </Button>
                  )}
                </FileButton>
                {runtimePackage ? (
                  <>
                    <Badge color="green" variant="light" leftSection={<IconFileCode size={14} />}>
                      {runtimePackage.fileName}
                    </Badge>
                    <Button size="xs" variant="subtle" color="chatbox-gray" onClick={() => setRuntimePackage(null)}>
                      Clear runtime
                    </Button>
                  </>
                ) : (
                  <Text size="sm" c="chatbox-tertiary">
                    No runtime uploaded. Approved apps will fall back to the generic reviewed runtime shell.
                  </Text>
                )}
              </Group>
              {runtimePackage ? (
                <Text size="xs" c="chatbox-tertiary">
                  Uploaded package size: {runtimePackage.byteLength.toLocaleString()} bytes
                </Text>
              ) : null}
            </Stack>

            <Textarea
              label="Developer notes"
              description="Optional notes for the reviewer queue."
              autosize
              minRows={3}
              value={developerNotes}
              onChange={(event) => setDeveloperNotes(event.currentTarget.value)}
            />

            <Group gap="sm">
              <Button variant="outline" onClick={handleValidate} loading={busyAction === 'validate'}>
                Validate manifest
              </Button>
              <Button onClick={handleSubmit} loading={busyAction === 'submit'} disabled={!assessment?.submittable}>
                Submit for review
              </Button>
            </Group>

            {assessment ? (
              <Paper withBorder radius="md" p="md" bg="var(--mantine-color-body)">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text fw={600}>Validation summary</Text>
                    <Badge color={assessment.submittable ? 'green' : 'red'} variant="light">
                      {assessment.submittable ? 'Ready to submit' : 'Needs fixes'}
                    </Badge>
                  </Group>

                  {assessment.parseError ? (
                    <Alert color="red" icon={<IconAlertCircle size={16} />} title="Manifest parse failed">
                      {assessment.parseError}
                    </Alert>
                  ) : null}

                  {assessment.manifest ? (
                    <Stack gap={4}>
                      <Text size="sm">
                        <strong>App:</strong> {assessment.manifest.name} (<Code>{assessment.manifest.appId}</Code>)
                      </Text>
                      <Text size="sm">
                        <strong>Auth mode:</strong> {assessment.manifest.authMode}
                      </Text>
                      <Text size="sm">
                        <strong>Tools:</strong>{' '}
                        {assessment.manifest.toolSchemas.map((tool) => tool.name).join(', ') || 'None'}
                      </Text>
                    </Stack>
                  ) : null}

                  {assessment.conflicts.length > 0 ? (
                    <Alert color="red" icon={<IconX size={16} />} title="Catalog conflicts">
                      <Stack gap={4}>
                        {assessment.conflicts.map((conflict) => (
                          <Text key={`${conflict.kind}:${conflict.value}:${conflict.sourceAppId}`} size="sm">
                            {getConflictLabel(conflict)}
                          </Text>
                        ))}
                      </Stack>
                    </Alert>
                  ) : null}

                  {assessmentErrors.length > 0 ? (
                    <Alert color="red" icon={<IconX size={16} />} title="Validator errors">
                      <Stack gap={4}>
                        {assessmentErrors.map((issue) => (
                          <Text key={`${issue.code}:${issue.message}`} size="sm">
                            {issue.message}
                          </Text>
                        ))}
                      </Stack>
                    </Alert>
                  ) : null}

                  {assessmentWarnings.length > 0 ? (
                    <Alert color="yellow" icon={<IconAlertCircle size={16} />} title="Validator warnings">
                      <Stack gap={4}>
                        {assessmentWarnings.map((issue) => (
                          <Text key={`${issue.code}:${issue.message}`} size="sm">
                            {issue.message}
                          </Text>
                        ))}
                      </Stack>
                    </Alert>
                  ) : null}
                </Stack>
              </Paper>
            ) : null}
          </Stack>
        </Paper>

        <Paper withBorder p="lg" radius="lg">
          <Stack gap="md">
            <Text fw={600}>Review queue overview</Text>
            <SimpleGrid cols={3} spacing="sm">
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="chatbox-tertiary">
                  Submitted
                </Text>
                <Text fw={700} size="xl">
                  {queueSummary.submitted}
                </Text>
              </Paper>
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="chatbox-tertiary">
                  Approved
                </Text>
                <Text fw={700} size="xl">
                  {queueSummary.approved}
                </Text>
              </Paper>
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="chatbox-tertiary">
                  Rejected
                </Text>
                <Text fw={700} size="xl">
                  {queueSummary.rejected}
                </Text>
              </Paper>
            </SimpleGrid>

            <Alert color="blue" icon={<IconCheck size={16} />} title="What approval does">
              Approval hydrates the app into the reviewed catalog immediately. After that, users can launch it through
              the existing ChatBridge routing path by asking chat to open the approved app by name.
            </Alert>

            <Text size="sm" c="chatbox-tertiary">
              This keeps the submission queue, approval decision, catalog ingest, and runtime package lookup host-owned.
              No separate portal backend is required for the current submission build.
            </Text>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Text fw={600}>Submission queue</Text>
          <Button variant="subtle" size="xs" onClick={() => void refreshSubmissions()}>
            Refresh
          </Button>
        </Group>

        {submissions.length === 0 ? (
          <Paper withBorder p="lg" radius="lg">
            <Text size="sm" c="chatbox-tertiary">
              No partner submissions have been created yet.
            </Text>
          </Paper>
        ) : null}

        {submissions.map((record) => (
          <Paper key={record.submissionId} withBorder p="lg" radius="lg">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Group gap="xs" align="center">
                    <Text fw={600}>{record.manifest.name}</Text>
                    <Badge color={getStatusColor(record.status)} variant="light">
                      {record.status}
                    </Badge>
                  </Group>
                  <Text size="sm" c="chatbox-tertiary">
                    <Code>{record.manifest.appId}</Code> submitted {formatDate(record.submittedAt)} by{' '}
                    {record.submittedBy}
                  </Text>
                </Box>
                <Group gap="xs">
                  <Badge variant="outline">{record.manifest.authMode}</Badge>
                  <Badge variant="outline">
                    {record.manifest.toolSchemas.length} tool{record.manifest.toolSchemas.length === 1 ? '' : 's'}
                  </Badge>
                  {record.runtimePackage ? <Badge variant="outline">HTML runtime uploaded</Badge> : null}
                </Group>
              </Group>

              <Text size="sm">
                <strong>Tools:</strong> {record.manifest.toolSchemas.map((tool) => tool.name).join(', ')}
              </Text>

              {record.developerNotes ? (
                <Text size="sm" c="chatbox-tertiary">
                  <strong>Developer notes:</strong> {record.developerNotes}
                </Text>
              ) : null}

              {record.review?.notes ? (
                <Text size="sm" c="chatbox-tertiary">
                  <strong>Review notes:</strong> {record.review.notes}
                </Text>
              ) : null}

              {record.validation.issues.length > 0 ? (
                <Alert color="yellow" icon={<IconAlertCircle size={16} />} title="Validation guidance">
                  <Stack gap={4}>
                    {record.validation.issues.map((issue) => (
                      <Text key={`${record.submissionId}:${issue.code}:${issue.message}`} size="sm">
                        {issue.severity === 'warning' ? 'Warning' : 'Error'}: {issue.message}
                      </Text>
                    ))}
                  </Stack>
                </Alert>
              ) : null}

              {record.status === 'approved' ? (
                <Alert color="green" icon={<IconCheck size={16} />} title="Catalog active">
                  Ask chat to open <Code>{record.manifest.name}</Code> or use one of its tool names. The approved app is
                  already hydrated into the reviewed catalog.
                </Alert>
              ) : null}

              {record.status === 'submitted' ? (
                <Stack gap="sm">
                  <Textarea
                    label="Review notes"
                    autosize
                    minRows={2}
                    value={reviewNotesBySubmissionId[record.submissionId] ?? ''}
                    onChange={(event) =>
                      setReviewNotesBySubmissionId((current) => ({
                        ...current,
                        [record.submissionId]: event.currentTarget.value,
                      }))
                    }
                  />
                  <Group gap="sm">
                    <Button
                      color="green"
                      onClick={() => void handleApprove(record.submissionId)}
                      loading={busyAction === `approve:${record.submissionId}`}
                    >
                      Approve and ingest
                    </Button>
                    <Button
                      variant="outline"
                      color="red"
                      onClick={() => void handleReject(record.submissionId)}
                      loading={busyAction === `reject:${record.submissionId}`}
                    >
                      Reject
                    </Button>
                  </Group>
                </Stack>
              ) : null}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Stack>
  )
}
