# SC-007B Feature Spec

## Metadata

- Story ID: SC-007B
- Story Title: Flashcard Studio Drive auth recovery states
- Author: Codex
- Date: 2026-04-05
- Parent story: `SC-007 Flashcard Studio Google Drive connect, save, load, and resume`

## Problem Statement

`SC-007A` proved the happy-path Drive connect, save, load, and resume flow, but
denied and expired auth still collapse into a generic blocked state. That makes
the host/app auth boundary harder to audit in production and gives students weak
guidance about whether they can keep studying locally or must reconnect Drive
before retrying a save or load.

## User Story

- As a student, I want denied or expired Drive auth to return me to a clear
  reconnect state without losing deck or study progress so I know when I can
  keep working locally and when I need to reconnect Google Drive.

## Acceptance Criteria

- [ ] AC-1: A denied Drive connect attempt returns Flashcard Studio to a
      reconnect-required state instead of a generic blocked error.
- [ ] AC-2: Expired or unauthorized Drive save/load requests surface an
      explicit expired-auth state with reconnect guidance while preserving the
      current local deck and study progress.
- [ ] AC-3: Hydration recognizes expired or revoked persisted auth grants and
      resumes into reconnect guidance with bounded recent-deck metadata intact.
- [ ] AC-4: Flashcard summaries, resume hints, and app-context digests mention
      reconnect-required Drive state without leaking answers or raw auth
      details.
- [ ] AC-5: Seeded production fixtures exist for denied and expired Drive auth
      recovery so the degraded path is directly auditable on the submission
      deployment.

## Edge Cases

- The student denies consent before any deck has ever been saved.
- Drive save/load receives `401` or `403` after a prior successful grant.
- A persisted grant is present locally but its status is no longer active.
- Recovery state should not wipe current authoring or in-progress study data.
- Invalid Drive deck payloads should remain a bounded content error, not an
  auth-expired state.

## Out Of Scope

- Explicit disconnect or revoke controls
- Google Picker integration
- Teacher sharing or classroom workflows
- Automatic background refresh of Drive grants

## Done Definition

- Flashcard Studio distinguishes denied versus expired Drive recovery paths in
  the host-owned shell.
- The degraded auth path is traceable through tests and prod-visible seeded
  fixtures.
- Later chat continuity stays bounded and useful after auth failure.
