import {
  DRAWING_KIT_APP_ID,
  FLASHCARD_STUDIO_APP_ID,
  createInitialDrawingKitAppSnapshot,
  createInitialFlashcardStudioAppSnapshot,
  parseFlashcardStudioAppSnapshot,
  type DrawingKitAppSnapshot,
  type FlashcardStudioAppSnapshot,
} from '@shared/chatbridge'
import type { ChatBridgeReviewedAppLaunch } from '../reviewed-app-launch'

function escapeInlineScriptValue(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function createGenericReviewedAppLaunchRuntimeMarkup(launch: ChatBridgeReviewedAppLaunch) {
  const serializedLaunch = escapeInlineScriptValue(launch)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${launch.appName} runtime</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      }

      html, body {
        margin: 0;
        padding: 0;
        min-height: 100%;
        background: linear-gradient(180deg, #f7f4ed 0%, #ffffff 100%);
        color: #1f2933;
      }

      body {
        display: grid;
        place-items: center;
        padding: 20px;
        box-sizing: border-box;
      }

      #reviewed-app-runtime-root {
        width: min(100%, 720px);
      }

      .runtime-card {
        border: 1px solid #d9c6a7;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 20px 45px rgba(77, 57, 28, 0.08);
        padding: 20px;
      }

      .runtime-eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 11px;
        color: #8a6b3d;
        margin-bottom: 10px;
      }

      .runtime-title {
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 10px;
      }

      .runtime-summary {
        margin: 0 0 16px;
        color: #44505c;
        line-height: 1.5;
      }

      .runtime-meta {
        display: grid;
        gap: 10px;
      }

      .runtime-meta-row {
        border-radius: 12px;
        background: #f4eee3;
        padding: 10px 12px;
      }

      .runtime-meta-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #7c5b2d;
        margin-bottom: 4px;
      }

      .runtime-meta-value {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        color: #1f2933;
      }
    </style>
  </head>
  <body>
    <div id="reviewed-app-runtime-root"></div>
    <script>
      const launch = ${serializedLaunch};

      (() => {
        let bridgePort = null;
        let currentEnvelope = null;
        let nextSequence = 2;

        const root = document.getElementById('reviewed-app-runtime-root');

        function appendMeta(container, label, value) {
          if (!value) {
            return;
          }

          const row = document.createElement('div');
          row.className = 'runtime-meta-row';

          const labelEl = document.createElement('div');
          labelEl.className = 'runtime-meta-label';
          labelEl.textContent = label;

          const valueEl = document.createElement('p');
          valueEl.className = 'runtime-meta-value';
          valueEl.textContent = value;

          row.appendChild(labelEl);
          row.appendChild(valueEl);
          container.appendChild(row);
        }

        function renderSurface() {
          const card = document.createElement('article');
          card.className = 'runtime-card';

          const eyebrow = document.createElement('div');
          eyebrow.className = 'runtime-eyebrow';
          eyebrow.textContent = 'Reviewed app bridge launch';

          const title = document.createElement('h1');
          title.className = 'runtime-title';
          title.textContent = launch.appName + ' runtime';

          const summary = document.createElement('p');
          summary.className = 'runtime-summary';
          summary.textContent = launch.summary;

          const meta = document.createElement('div');
          meta.className = 'runtime-meta';

          appendMeta(meta, 'Request', launch.request);
          appendMeta(meta, 'Capability', launch.capability);
          appendMeta(meta, 'Initial FEN', launch.fen);
          appendMeta(meta, 'Initial PGN', launch.pgn);

          card.appendChild(eyebrow);
          card.appendChild(title);
          card.appendChild(summary);
          card.appendChild(meta);
          root.replaceChildren(card);
        }

        function sendState(kind, payload) {
          if (!bridgePort || !currentEnvelope) {
            return;
          }

          bridgePort.postMessage({
            kind,
            bridgeSessionId: currentEnvelope.bridgeSessionId,
            appInstanceId: currentEnvelope.appInstanceId,
            bridgeToken: currentEnvelope.bridgeToken,
            sequence: nextSequence++,
            ...payload,
          });
        }

        function sendInitialState() {
          sendState('app.state', {
            idempotencyKey: 'launch-ready-' + currentEnvelope.bridgeSessionId,
            snapshot: {
              kind: 'reviewed-app-launch',
              schemaVersion: 1,
              appId: launch.appId,
              appName: launch.appName,
              summary: launch.summary,
              statusText: 'Bridge active',
              request: launch.request || null,
              capability: launch.capability || null,
              fen: launch.fen || null,
              pgn: launch.pgn || null,
              uiEntry: launch.uiEntry || null,
              launchSurface: 'reviewed-app-bridge',
            },
          });
        }

        renderSurface();

        window.addEventListener('message', (event) => {
          const data = event.data;
          if (!data || data.kind !== 'host.bootstrap' || bridgePort) {
            return;
          }
          if (!event.ports || event.ports.length === 0 || !data.envelope) {
            return;
          }

          currentEnvelope = data.envelope;
          if (currentEnvelope.expectedOrigin !== '*' && event.origin !== currentEnvelope.expectedOrigin) {
            return;
          }

          bridgePort = event.ports[0];
          bridgePort.start && bridgePort.start();
          bridgePort.onmessage = (portEvent) => {
            const message = portEvent.data;
            if (!message || message.kind !== 'host.syncContext') {
              return;
            }
            if (
              message.bridgeSessionId !== currentEnvelope.bridgeSessionId ||
              message.appInstanceId !== currentEnvelope.appInstanceId ||
              !message.snapshot ||
              typeof message.snapshot !== 'object' ||
              Array.isArray(message.snapshot)
            ) {
              return;
            }

            state.snapshot = clone(message.snapshot);
            state.marks = clone(Array.isArray(message.snapshot.previewMarks) ? message.snapshot.previewMarks : []);
            if (
              message.snapshot.status === 'checkpointed' ||
              message.snapshot.status === 'complete' ||
              message.snapshot.status === 'blank'
            ) {
              state.bankedSnapshot = clone(message.snapshot);
            }
            state.pointerStroke = null;
            render();
          };

          bridgePort.postMessage({
            kind: 'app.ready',
            bridgeSessionId: currentEnvelope.bridgeSessionId,
            appInstanceId: currentEnvelope.appInstanceId,
            bridgeToken: currentEnvelope.bridgeToken,
            ackNonce: currentEnvelope.bootstrapNonce,
            sequence: 1,
          });

          queueMicrotask(sendInitialState);
        });

        window.addEventListener('error', (event) => {
          sendState('app.error', {
            idempotencyKey: 'window-error-' + nextSequence,
            error: event.message || 'reviewed app runtime error',
          });
        });

        window.addEventListener('unhandledrejection', (event) => {
          sendState('app.error', {
            idempotencyKey: 'unhandled-rejection-' + nextSequence,
            error: event.reason instanceof Error ? event.reason.message : String(event.reason),
          });
        });
      })();
    </script>
  </body>
</html>`
}

function createDrawingKitRuntimeMarkup(launch: ChatBridgeReviewedAppLaunch, initialSnapshot: DrawingKitAppSnapshot) {
  const serializedLaunch = escapeInlineScriptValue(launch)
  const serializedSnapshot = escapeInlineScriptValue(initialSnapshot)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${launch.appName} runtime</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif;
        --paper: #fffdf4;
        --paper-edge: #f1c56c;
        --paper-accent: #ff8a4c;
        --paper-soft: #fff1c7;
        --ink: #26211d;
        --muted: #6f6156;
        --blue: #267df0;
        --blue-soft: #eaf3ff;
      }

      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        min-height: 100%;
        background:
          radial-gradient(circle at top left, rgba(255, 209, 102, 0.45), transparent 35%),
          linear-gradient(180deg, #fff7e5 0%, #fffdf7 100%);
        color: var(--ink);
      }

      body {
        padding: 12px;
        box-sizing: border-box;
        overflow: hidden;
      }

      button,
      input {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      button:focus-visible,
      input:focus-visible,
      canvas:focus-visible {
        outline: 3px solid rgba(38, 125, 240, 0.45);
        outline-offset: 2px;
      }

      #reviewed-app-runtime-root {
        width: 100%;
        height: 100%;
        margin: 0 auto;
      }

      .doodle-shell {
        border: 1px solid var(--paper-edge);
        border-radius: 28px;
        background: rgba(255, 253, 244, 0.97);
        box-shadow: 0 24px 60px rgba(157, 113, 18, 0.12);
        box-sizing: border-box;
        height: 100%;
        padding: 14px;
      }

      .runtime-stack {
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr) auto;
        gap: 12px;
        height: 100%;
      }

      .runtime-round-strip,
      .runtime-tool-strip {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border: 1px solid var(--paper-edge);
        border-radius: 22px;
        padding: 12px 14px;
      }

      .runtime-round-strip {
        background: #f0d6ff;
      }

      .runtime-tool-strip {
        background: #ffe6a7;
      }

      .runtime-round-meta,
      .runtime-tool-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .runtime-round-meta {
        min-width: 0;
        flex: 1 1 420px;
      }

      .runtime-round-label {
        margin: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.75);
        border: 1px solid rgba(38, 33, 29, 0.18);
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .runtime-round-text {
        min-width: 0;
        display: grid;
        gap: 4px;
      }

      .runtime-round-text strong {
        font-size: 18px;
        line-height: 1.1;
      }

      .runtime-round-text span {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.3;
      }

      .runtime-topbar,
      .runtime-toolbar,
      .runtime-meta-grid,
      .runtime-footer-grid,
      .runtime-canvas-actions {
        display: flex;
        gap: 12px;
      }

      .runtime-topbar,
      .runtime-toolbar {
        align-items: center;
        justify-content: space-between;
      }

      .runtime-topbar {
        gap: 16px;
        flex-wrap: wrap;
      }

      .runtime-title-block {
        min-width: 0;
        flex: 1 1 420px;
      }

      .runtime-eyebrow {
        margin: 0 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 11px;
        color: #b87000;
        font-family: "IBM Plex Mono", monospace;
      }

      .runtime-title {
        margin: 0;
        font-family: "Avenir Next Condensed", "Avenir Next", "Trebuchet MS", sans-serif;
        font-size: clamp(28px, 5vw, 38px);
        line-height: 1.04;
      }

      .runtime-subtitle {
        margin: 10px 0 0;
        color: var(--muted);
        line-height: 1.45;
        max-width: 66ch;
      }

      .runtime-pill,
      .tool-chip,
      .stat-chip {
        border: 1px solid transparent;
        border-radius: 999px;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
      }

      .runtime-pill {
        background: var(--paper-soft);
        border-color: #dfb04b;
        color: #7d5600;
      }

      .runtime-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .action-button {
        border-radius: 14px;
        border: 1px solid #dfb04b;
        background: #fff2c2;
        color: #4e3900;
        padding: 11px 16px;
        font-size: 13px;
        font-weight: 700;
      }

      .action-button--primary {
        border-color: #ff8a4c;
        background: #ff8a4c;
        color: white;
      }

      .runtime-toolbar {
        margin-top: 16px;
        padding: 10px 12px;
        border-radius: 20px;
        background: #ffe6a7;
        border: 1px solid var(--paper-edge);
        flex-wrap: wrap;
      }

      .runtime-tools {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .tool-chip {
        background: white;
        border-color: #d4e7ff;
        color: var(--blue);
      }

      .tool-chip[aria-pressed="true"] {
        background: var(--blue-soft);
        border-color: var(--blue);
      }

      .tool-chip--warm {
        border-color: #f3c17f;
        color: #915100;
        background: #fff6dd;
      }

      .runtime-meta-grid {
        margin-top: 18px;
        gap: 18px;
        align-items: stretch;
      }

      .runtime-canvas-card {
        min-width: 0;
        flex: 1 1 560px;
        border-radius: 28px;
        border: 1px solid var(--paper-edge);
        background: #fffdf4;
        padding: 16px;
      }

      .runtime-prompt-card {
        display: inline-flex;
        flex-direction: column;
        gap: 6px;
        border-radius: 20px;
        border: 2px solid var(--paper-accent);
        background: white;
        padding: 14px 16px;
        box-shadow: 0 12px 22px rgba(255, 138, 76, 0.14);
        margin-bottom: 12px;
      }

      .runtime-prompt-card strong {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--paper-accent);
      }

      .runtime-prompt-card span {
        font-size: 26px;
        font-weight: 800;
        line-height: 1.04;
      }

      .runtime-canvas-frame {
        position: relative;
        border-radius: 24px;
        border: 1px dashed #f0c36a;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(255, 249, 232, 0.96));
        overflow: hidden;
        flex: 1 1 auto;
        min-height: 320px;
      }

      .runtime-board-card {
        min-width: 0;
        border-radius: 28px;
        border: 1px solid var(--paper-edge);
        background: #fffdf4;
        padding: 14px;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .runtime-board-footer {
        margin-top: 12px;
      }

      .runtime-caption-inline {
        display: grid;
        gap: 6px;
      }

      .runtime-caption-inline label {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #915100;
      }

      .runtime-caption-inline input {
        width: 100%;
        box-sizing: border-box;
        border-radius: 14px;
        border: 1px solid #edc676;
        padding: 12px 14px;
        background: white;
      }

      canvas {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 320px;
        cursor: crosshair;
        border: 0;
        background: transparent;
      }

      .runtime-canvas-actions {
        flex-wrap: wrap;
        align-items: end;
        margin-top: 12px;
      }

      .runtime-caption-field {
        flex: 1 1 260px;
      }

      .runtime-caption-field label {
        display: block;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #915100;
        margin-bottom: 6px;
      }

      .runtime-caption-field input {
        width: 100%;
        box-sizing: border-box;
        border-radius: 14px;
        border: 1px solid #edc676;
        padding: 12px 14px;
        background: white;
      }

      .runtime-footer-grid {
        margin-top: 18px;
        flex-wrap: wrap;
      }

      .runtime-support-card {
        min-width: 0;
        flex: 1 1 220px;
        border-radius: 24px;
        border: 1px solid #e8d7ad;
        background: white;
        padding: 18px;
      }

      .runtime-support-card--accent {
        background: #fff7de;
        border-color: var(--paper-edge);
      }

      .runtime-support-card--blue {
        background: #f4f9ff;
        border-color: #bed8ff;
      }

      .runtime-support-eyebrow {
        margin: 0 0 8px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-weight: 800;
      }

      .runtime-support-card h2 {
        margin: 0;
        font-size: 28px;
        line-height: 1.02;
      }

      .runtime-support-card p {
        margin: 10px 0 0;
        color: var(--muted);
        line-height: 1.45;
      }

      .runtime-summary-inline {
        margin-top: 12px;
        font-size: 13px;
        color: #7b5b1d;
        background: rgba(255, 247, 222, 0.92);
        border-radius: 14px;
        padding: 10px 12px;
      }

      .runtime-keyboard-note {
        margin-top: 10px;
        font-size: 12px;
        color: var(--muted);
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      @media (max-width: 820px) {
        body {
          padding: 10px;
        }

        .doodle-shell {
          padding: 12px;
        }

        .runtime-canvas-frame,
        canvas {
          min-height: 260px;
        }
      }
    </style>
  </head>
  <body>
    <div id="reviewed-app-runtime-root"></div>
    <script>
      const launch = ${serializedLaunch};
      const initialSnapshot = ${serializedSnapshot};

      (() => {
        let bridgePort = null;
        let currentEnvelope = null;
        let nextSequence = 2;
        const root = document.getElementById('reviewed-app-runtime-root');
        const state = {
          snapshot: JSON.parse(JSON.stringify(initialSnapshot)),
          marks: Array.isArray(initialSnapshot.previewMarks) ? JSON.parse(JSON.stringify(initialSnapshot.previewMarks)) : [],
          bankedSnapshot: JSON.parse(JSON.stringify(initialSnapshot)),
          pointerStroke: null,
          lastPublishedBoardFingerprint:
            Array.isArray(initialSnapshot.previewMarks) && initialSnapshot.previewMarks.length > 0
              ? JSON.stringify(normalizeMarks(initialSnapshot.previewMarks))
              : '',
        };

        function clone(value) {
          return JSON.parse(JSON.stringify(value));
        }

        function pluralize(count, singular, plural) {
          return count === 1 ? singular : plural || singular + 's';
        }

        function clamp(value) {
          if (!Number.isFinite(value)) {
            return 0;
          }
          return Math.min(1, Math.max(0, value));
        }

        function samplePoints(points) {
          if (points.length <= 12) {
            return points.map((point) => ({ x: clamp(point.x), y: clamp(point.y) }));
          }

          const sampled = [];
          for (let index = 0; index < 12; index += 1) {
            const sourceIndex = Math.round((index / 11) * (points.length - 1));
            const point = points[sourceIndex] || points[points.length - 1];
            sampled.push({
              x: clamp(point.x),
              y: clamp(point.y),
            });
          }
          return sampled;
        }

        function normalizeMarks(marks) {
          return marks.slice(-24).map((mark) => {
            if (mark.kind === 'line') {
              return {
                kind: 'line',
                tool: mark.tool,
                color: mark.color,
                width: mark.width,
                points: samplePoints(mark.points || []),
              };
            }

            return {
              kind: 'stamp',
              stamp: mark.stamp,
              color: mark.color,
              size: mark.size,
              x: clamp(mark.x),
              y: clamp(mark.y),
            };
          });
        }

        function buildCheckpointSummary(snapshot) {
          const captionSegment = snapshot.caption ? '"' + snapshot.caption + '"' : 'Uncaptioned doodle';
          const stickerSegment = snapshot.stickerCount > 0
            ? snapshot.stickerCount + ' ' + pluralize(snapshot.stickerCount, 'sticker') + ' (' + snapshot.rewardLabel + ')'
            : 'no stickers banked yet';

          return captionSegment + '; ' + snapshot.strokeCount + ' ' + pluralize(snapshot.strokeCount, 'stroke') + '; ' + stickerSegment + '.';
        }

        function buildStatusText(status, stickerCount) {
          if (status === 'complete') {
            return 'Round locked';
          }
          if (status === 'checkpointed') {
            return stickerCount > 0 ? stickerCount + ' ' + pluralize(stickerCount, 'sticker') + ' banked' : 'Checkpoint banked';
          }
          if (status === 'drawing') {
            return 'Round in progress';
          }
          return 'Ready for doodle dare';
        }

        function buildSummary(snapshot) {
          const captionSegment = snapshot.caption
            ? 'The doodle is labeled "' + snapshot.caption + '".'
            : 'The doodle is still uncaptured by caption.';
          const rewardSegment = snapshot.stickerCount > 0
            ? snapshot.stickerCount + ' ' + pluralize(snapshot.stickerCount, 'sticker') + ' are banked as ' + snapshot.rewardLabel + '.'
            : 'No sticker reward is banked yet.';

          if (snapshot.status === 'blank') {
            return 'Drawing Kit is ready with the prompt "' + snapshot.roundPrompt + '". The host keeps a blank canvas checkpoint visible before any marks are made.';
          }

          if (snapshot.status === 'complete') {
            return 'Drawing Kit round complete. Prompt "' + snapshot.roundPrompt + '". ' + captionSegment + ' ' + snapshot.strokeCount + ' ' + pluralize(snapshot.strokeCount, 'stroke') + ' were captured with ' + snapshot.selectedTool + '. ' + rewardSegment + ' Later chat can recap or replay the saved round without raw stroke history.';
          }

          if (snapshot.status === 'checkpointed') {
            return 'Drawing Kit checkpoint banked. Prompt "' + snapshot.roundPrompt + '". ' + captionSegment + ' ' + snapshot.strokeCount + ' ' + pluralize(snapshot.strokeCount, 'stroke') + ' were saved with ' + snapshot.selectedTool + '. ' + rewardSegment + ' Later chat can use the checkpoint instead of raw stroke history.';
          }

          return 'Drawing Kit round in progress. Prompt "' + snapshot.roundPrompt + '". ' + captionSegment + ' ' + snapshot.strokeCount + ' ' + pluralize(snapshot.strokeCount, 'stroke') + ' are visible with ' + snapshot.selectedTool + '. ' + rewardSegment;
        }

        function createSnapshot(status) {
          const captionInput = document.getElementById('caption-input');
          const caption = captionInput && captionInput.value.trim() ? captionInput.value.trim() : undefined;
          const nextSnapshot = {
            ...state.snapshot,
            status,
            caption,
            selectedTool: state.snapshot.selectedTool,
            strokeCount: state.marks.length,
            stickerCount: state.marks.filter((mark) => mark.kind === 'stamp').length,
            checkpointId: 'drawing-kit-' + Date.now(),
            previewMarks: normalizeMarks(state.marks),
            lastUpdatedAt: Date.now(),
          };

          nextSnapshot.statusText = buildStatusText(nextSnapshot.status, nextSnapshot.stickerCount);
          nextSnapshot.summary = buildSummary(nextSnapshot);
          nextSnapshot.checkpointSummary = buildCheckpointSummary(nextSnapshot);
          nextSnapshot.resumeHint =
            nextSnapshot.status === 'complete'
              ? 'Play again reopens ' + nextSnapshot.roundLabel + ' from checkpoint ' + nextSnapshot.checkpointId + '.'
              : 'Replay round reopens ' + nextSnapshot.roundLabel + ' from checkpoint ' + nextSnapshot.checkpointId + '.';

          return nextSnapshot;
        }

        function createBoardFingerprint() {
          if (!Array.isArray(state.marks) || state.marks.length === 0) {
            return '';
          }

          return JSON.stringify(normalizeMarks(state.marks));
        }

        function sendBridgeEvent(kind, payload) {
          if (!bridgePort || !currentEnvelope) {
            return;
          }

          bridgePort.postMessage({
            kind,
            bridgeSessionId: currentEnvelope.bridgeSessionId,
            appInstanceId: currentEnvelope.appInstanceId,
            bridgeToken: currentEnvelope.bridgeToken,
            sequence: nextSequence++,
            ...payload,
          });
        }

        function publishSnapshot(status, reason) {
          const nextSnapshot = createSnapshot(status);
          state.snapshot = clone(nextSnapshot);
          if (status === 'checkpointed' || status === 'complete' || status === 'blank') {
            state.bankedSnapshot = clone(nextSnapshot);
          }

          render();

          sendBridgeEvent('app.state', {
            idempotencyKey: reason + '-' + nextSnapshot.checkpointId,
            snapshot: nextSnapshot,
            ...createScreenshotPayload(),
          });
          return nextSnapshot;
        }

        function publishCompletion() {
          const nextSnapshot = publishSnapshot('complete', 'complete');
          sendBridgeEvent('app.complete', {
            idempotencyKey: 'complete-' + nextSnapshot.checkpointId,
            completion: {
              schemaVersion: 1,
              status: 'success',
              suggestedSummary: {
                title: 'Drawing Kit round returned to chat',
                text: nextSnapshot.summary,
                bullets: [
                  'Prompt: ' + nextSnapshot.roundPrompt,
                  'Caption: ' + (nextSnapshot.caption || 'Uncaptioned doodle'),
                  nextSnapshot.stickerCount + ' ' + pluralize(nextSnapshot.stickerCount, 'sticker') + ' banked',
                ],
              },
              outcomeData: {
                appId: launch.appId,
                roundLabel: nextSnapshot.roundLabel,
                checkpointId: nextSnapshot.checkpointId,
                caption: nextSnapshot.caption || null,
                rewardLabel: nextSnapshot.rewardLabel,
              },
              resumability: {
                resumable: true,
                checkpointId: nextSnapshot.checkpointId,
                resumeHint: nextSnapshot.resumeHint,
              },
            },
          });
        }

        function sendProgressCheckpoint(reason) {
          publishSnapshot(state.marks.length > 0 ? 'drawing' : 'blank', reason);
        }

        function drawLine(ctx, mark, width, height) {
          if (!mark.points || mark.points.length < 2) {
            return;
          }

          if (mark.tool === 'spray') {
            ctx.fillStyle = mark.color;
            mark.points.forEach((point, pointIndex) => {
              const x = point.x * width;
              const y = point.y * height;
              for (let sprayIndex = 0; sprayIndex < 6; sprayIndex += 1) {
                const radius = 6 + sprayIndex * 1.5;
                const angle = pointIndex * 0.9 + sprayIndex;
                ctx.beginPath();
                ctx.arc(
                  x + Math.cos(angle) * radius,
                  y + Math.sin(angle) * radius,
                  1.2,
                  0,
                  Math.PI * 2
                );
                ctx.fill();
              }
            });
            return;
          }

          ctx.strokeStyle = mark.color;
          ctx.lineWidth = mark.width;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          mark.points.forEach((point, index) => {
            const x = point.x * width;
            const y = point.y * height;
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.stroke();
        }

        function drawStamp(ctx, mark, width, height) {
          const x = mark.x * width;
          const y = mark.y * height;
          const radius = mark.size;
          ctx.save();
          ctx.translate(x, y);
          ctx.fillStyle = mark.color;
          ctx.beginPath();
          if (mark.stamp === 'burst') {
            for (let index = 0; index < 12; index += 1) {
              const outer = index % 2 === 0 ? radius : radius * 0.45;
              const angle = (Math.PI / 6) * index;
              const px = Math.cos(angle) * outer;
              const py = Math.sin(angle) * outer;
              if (index === 0) {
                ctx.moveTo(px, py);
              } else {
                ctx.lineTo(px, py);
              }
            }
            ctx.closePath();
          } else {
            for (let index = 0; index < 5; index += 1) {
              const outerAngle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
              const innerAngle = outerAngle + Math.PI / 5;
              const outerX = Math.cos(outerAngle) * radius;
              const outerY = Math.sin(outerAngle) * radius;
              const innerX = Math.cos(innerAngle) * radius * 0.45;
              const innerY = Math.sin(innerAngle) * radius * 0.45;
              if (index === 0) {
                ctx.moveTo(outerX, outerY);
              } else {
                ctx.lineTo(outerX, outerY);
              }
              ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
          }
          ctx.fill();
          ctx.restore();
        }

        function paintCanvasBackground(ctx, width, height) {
          ctx.fillStyle = '#fff8b8';
          ctx.fillRect(0, 0, width, height);

          ctx.strokeStyle = 'rgba(234, 198, 97, 0.28)';
          ctx.lineWidth = 1;
          for (let y = 28; y < height; y += 28) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
        }

        function renderCanvas() {
          const canvas = document.getElementById('drawing-canvas');
          if (!canvas) {
            return;
          }

          const frame = canvas.parentElement;
          const width = Math.max(320, frame ? Math.floor(frame.clientWidth) : 720);
          const height = Math.max(320, frame ? Math.floor(frame.clientHeight) : 420);
          const scale = Math.max(window.devicePixelRatio || 1, 1);
          const pixelWidth = Math.max(1, Math.floor(width * scale));
          const pixelHeight = Math.max(1, Math.floor(height * scale));

          canvas.style.width = width + 'px';
          canvas.style.height = height + 'px';
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return;
          }

          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, pixelWidth, pixelHeight);
          ctx.setTransform(scale, 0, 0, scale, 0, 0);
          paintCanvasBackground(ctx, width, height);

          state.marks.forEach((mark) => {
            if (mark.kind === 'line') {
              drawLine(ctx, mark, width, height);
            } else {
              drawStamp(ctx, mark, width, height);
            }
          });

          if (state.pointerStroke) {
            drawLine(ctx, state.pointerStroke, width, height);
          }
        }

        function captureBoardImageDataUrl() {
          const canvas = document.getElementById('drawing-canvas');
          if (!(canvas instanceof HTMLCanvasElement)) {
            return null;
          }

          try {
            return canvas.toDataURL('image/png');
          } catch {
            return null;
          }
        }

        function createScreenshotPayload() {
          const fingerprint = createBoardFingerprint();
          if (!fingerprint) {
            state.lastPublishedBoardFingerprint = '';
            return {};
          }

          if (fingerprint === state.lastPublishedBoardFingerprint) {
            return {};
          }

          const screenshotDataUrl = captureBoardImageDataUrl();
          if (!screenshotDataUrl) {
            return {};
          }

          state.lastPublishedBoardFingerprint = fingerprint;
          return {
            screenshotDataUrl,
          };
        }

        function pushMark(mark, reason) {
          state.marks = normalizeMarks(state.marks.concat(mark));
          sendProgressCheckpoint(reason);
        }

        function getCanvasPoint(event, canvas) {
          const rect = canvas.getBoundingClientRect();
          return {
            x: clamp((event.clientX - rect.left) / rect.width),
            y: clamp((event.clientY - rect.top) / rect.height),
          };
        }

        function createSyntheticLine(tool) {
          const seed = state.marks.length + 1;
          const points = [
            { x: 0.16 + (seed % 3) * 0.08, y: 0.24 + (seed % 4) * 0.08 },
            { x: 0.3 + (seed % 2) * 0.06, y: 0.36 + (seed % 5) * 0.05 },
            { x: 0.48 + (seed % 3) * 0.04, y: 0.28 + (seed % 2) * 0.1 },
            { x: 0.7, y: 0.45 + (seed % 4) * 0.05 },
          ];
          return {
            kind: 'line',
            tool,
            color: tool === 'spray' ? '#ff8a4c' : '#267df0',
            width: tool === 'spray' ? 3 : 5,
            points,
          };
        }

        function createSyntheticStamp() {
          const seed = state.marks.length + 1;
          const stampKinds = ['star', 'spark', 'burst'];
          return {
            kind: 'stamp',
            stamp: stampKinds[seed % stampKinds.length],
            color: '#f2b61b',
            size: 16,
            x: 0.2 + (seed % 6) * 0.11,
            y: 0.24 + (seed % 4) * 0.15,
          };
        }

        function updateSelectedTool(nextTool) {
          state.snapshot.selectedTool = nextTool;
          render();
        }

        function undoMark() {
          if (state.marks.length === 0) {
            return;
          }

          state.marks = state.marks.slice(0, -1);
          sendProgressCheckpoint('undo');
        }

        function replayRound() {
          const baseSnapshot = clone(state.bankedSnapshot);
          state.snapshot = {
            ...baseSnapshot,
            status: baseSnapshot.status === 'complete' ? 'checkpointed' : baseSnapshot.status,
            statusText: baseSnapshot.status === 'complete' ? 'Checkpoint banked' : baseSnapshot.statusText,
          };
          state.marks = clone(baseSnapshot.previewMarks || []);

          const captionInput = document.getElementById('caption-input');
          if (captionInput) {
            captionInput.value = baseSnapshot.caption || '';
          }

          render();
          sendBridgeEvent('app.state', {
            idempotencyKey: 'replay-' + state.snapshot.checkpointId,
            snapshot: state.snapshot,
            ...createScreenshotPayload(),
          });
        }

        function bindCanvas() {
          const canvas = document.getElementById('drawing-canvas');
          if (!canvas) {
            return;
          }

          canvas.addEventListener('pointerdown', (event) => {
            if (state.snapshot.selectedTool === 'stamp') {
              pushMark(
                {
                  kind: 'stamp',
                  stamp: 'star',
                  color: '#f2b61b',
                  size: 16,
                  ...getCanvasPoint(event, canvas),
                },
                'stamp'
              );
              return;
            }

            state.pointerStroke = {
              kind: 'line',
              tool: state.snapshot.selectedTool,
              color: state.snapshot.selectedTool === 'spray' ? '#ff8a4c' : '#267df0',
              width: state.snapshot.selectedTool === 'spray' ? 3 : 5,
              points: [getCanvasPoint(event, canvas)],
            };
            canvas.setPointerCapture && canvas.setPointerCapture(event.pointerId);
            renderCanvas();
          });

          canvas.addEventListener('pointermove', (event) => {
            if (!state.pointerStroke) {
              return;
            }

            state.pointerStroke.points.push(getCanvasPoint(event, canvas));
            renderCanvas();
          });

          function finishPointerStroke() {
            if (!state.pointerStroke) {
              return;
            }

            if (state.pointerStroke.points.length > 1) {
              pushMark(
                {
                  ...state.pointerStroke,
                  points: samplePoints(state.pointerStroke.points),
                },
                'stroke'
              );
            }
            state.pointerStroke = null;
            renderCanvas();
          }

          canvas.addEventListener('pointerup', finishPointerStroke);
          canvas.addEventListener('pointercancel', finishPointerStroke);
          canvas.addEventListener('keydown', (event) => {
            if (event.key.toLowerCase() === 'b') {
              updateSelectedTool('brush');
            }
            if (event.key.toLowerCase() === 's') {
              updateSelectedTool('spray');
            }
            if (event.key.toLowerCase() === 't') {
              updateSelectedTool('stamp');
            }
            if (event.key.toLowerCase() === 'u') {
              undoMark();
            }
          });
        }

        function bindControls() {
          root.querySelectorAll('[data-tool]').forEach((button) => {
            button.addEventListener('click', () => updateSelectedTool(button.getAttribute('data-tool')));
          });

          const undoButton = document.getElementById('undo-button');
          undoButton && undoButton.addEventListener('click', undoMark);

          const squiggleButton = document.getElementById('squiggle-button');
          squiggleButton &&
            squiggleButton.addEventListener('click', () => {
              pushMark(createSyntheticLine(state.snapshot.selectedTool === 'stamp' ? 'brush' : state.snapshot.selectedTool), 'keyboard-squiggle');
            });

          const stickerButton = document.getElementById('sticker-button');
          stickerButton &&
            stickerButton.addEventListener('click', () => {
              pushMark(createSyntheticStamp(), 'stamp');
            });

          const checkpointButton = document.getElementById('checkpoint-button');
          checkpointButton && checkpointButton.addEventListener('click', () => publishSnapshot('checkpointed', 'checkpoint'));

          const replayButton = document.getElementById('replay-button');
          replayButton && replayButton.addEventListener('click', replayRound);

          const lockButton = document.getElementById('lock-button');
          lockButton && lockButton.addEventListener('click', publishCompletion);
        }

        function render() {
          const snapshot = state.snapshot;
          root.innerHTML = \`
            <article class="doodle-shell" data-drawing-kit-runtime="true">
              <div class="runtime-stack">
                <div class="runtime-round-strip">
                  <div class="runtime-round-meta">
                    <p class="runtime-round-label">\${snapshot.roundLabel}</p>
                    <div class="runtime-round-text">
                      <strong>\${snapshot.roundPrompt}</strong>
                      <span>\${snapshot.statusText}</span>
                    </div>
                  </div>
                  <div class="runtime-actions">
                    <button id="replay-button" class="action-button" type="button">Replay round</button>
                    <button id="lock-button" class="action-button action-button--primary" type="button">Lock this round</button>
                  </div>
                </div>

                <div class="runtime-tool-strip">
                  <div class="runtime-tools" role="toolbar" aria-label="Drawing Kit tools">
                    <button class="tool-chip" data-tool="brush" aria-pressed="\${snapshot.selectedTool === 'brush'}" type="button">Brush</button>
                    <button class="tool-chip" data-tool="spray" aria-pressed="\${snapshot.selectedTool === 'spray'}" type="button">Spray</button>
                    <button class="tool-chip" data-tool="stamp" aria-pressed="\${snapshot.selectedTool === 'stamp'}" type="button">Stamp</button>
                    <button id="undo-button" class="tool-chip tool-chip--warm" type="button">Undo</button>
                    <button id="squiggle-button" class="tool-chip tool-chip--warm" type="button">Add squiggle</button>
                    <button id="sticker-button" class="tool-chip tool-chip--warm" type="button">Drop sticker</button>
                  </div>
                  <div class="runtime-tool-actions">
                    <span class="runtime-pill">\${snapshot.statusText}</span>
                    <button id="checkpoint-button" class="action-button" type="button">Bank this round</button>
                  </div>
                </div>

                <section class="runtime-board-card">
                  <div class="runtime-canvas-frame">
                    <canvas id="drawing-canvas" tabindex="0" aria-label="Drawing Kit doodle canvas"></canvas>
                  </div>
                  <div class="runtime-board-footer">
                    <div class="runtime-caption-inline">
                      <label for="caption-input">Tell chat what you drew</label>
                      <input
                        id="caption-input"
                        type="text"
                        maxlength="80"
                        value="\${snapshot.caption ? snapshot.caption.replace(/"/g, '&quot;') : ''}"
                        placeholder="Example: triple pickle sandwich"
                      />
                    </div>
                  </div>
                </section>
                <p class="runtime-keyboard-note">Keyboard path: use the buttons above or press B, S, T, and U while the canvas is focused.</p>
              </div>
            </article>
            <p id="runtime-status-live" class="sr-only" aria-live="polite">\${snapshot.statusText}</p>
          \`;

          const captionInput = document.getElementById('caption-input');
          if (captionInput) {
            captionInput.value = snapshot.caption || '';
          }
          bindControls();
          bindCanvas();
          renderCanvas();
        }

        function sendInitialState() {
          render();
          sendBridgeEvent('app.state', {
            idempotencyKey: 'drawing-kit-ready-' + currentEnvelope.bridgeSessionId,
            snapshot: state.snapshot,
          });
        }

        render();

        window.addEventListener('resize', renderCanvas);

        window.addEventListener('message', (event) => {
          const data = event.data;
          if (!data || data.kind !== 'host.bootstrap' || bridgePort) {
            return;
          }
          if (!event.ports || event.ports.length === 0 || !data.envelope) {
            return;
          }

          currentEnvelope = data.envelope;
          if (currentEnvelope.expectedOrigin !== '*' && event.origin !== currentEnvelope.expectedOrigin) {
            return;
          }

          bridgePort = event.ports[0];
          bridgePort.start && bridgePort.start();

          bridgePort.postMessage({
            kind: 'app.ready',
            bridgeSessionId: currentEnvelope.bridgeSessionId,
            appInstanceId: currentEnvelope.appInstanceId,
            bridgeToken: currentEnvelope.bridgeToken,
            ackNonce: currentEnvelope.bootstrapNonce,
            sequence: 1,
          });

          queueMicrotask(sendInitialState);
        });

        window.addEventListener('error', (event) => {
          sendBridgeEvent('app.error', {
            idempotencyKey: 'window-error-' + nextSequence,
            error: event.message || 'drawing kit runtime error',
          });
        });

        window.addEventListener('unhandledrejection', (event) => {
          sendBridgeEvent('app.error', {
            idempotencyKey: 'unhandled-rejection-' + nextSequence,
            error: event.reason instanceof Error ? event.reason.message : String(event.reason),
          });
        });
      })();
    </script>
  </body>
</html>`
}

function createFlashcardStudioRuntimeMarkup(
  launch: ChatBridgeReviewedAppLaunch,
  initialSnapshot: FlashcardStudioAppSnapshot
) {
  const serializedLaunch = escapeInlineScriptValue(launch)
  const serializedSnapshot = escapeInlineScriptValue(initialSnapshot)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${launch.appName} runtime</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif;
        --paper: #fffdfa;
        --paper-soft: #fff6e8;
        --paper-strong: #ffe1b6;
        --ink: #221b16;
        --muted: #6d5f54;
        --accent: #cb6b2b;
        --accent-soft: #fff0e1;
        --accent-strong: #f08a37;
        --line: #e7cfb0;
        --panel: rgba(255, 255, 255, 0.92);
        --panel-soft: rgba(255, 248, 239, 0.95);
        --selected: #fff3d5;
        --selected-line: #f0b24f;
        --success: #e6f7ee;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        min-height: 100%;
        background:
          radial-gradient(circle at top left, rgba(255, 204, 142, 0.45), transparent 34%),
          linear-gradient(180deg, #fff7eb 0%, #fffdfa 100%);
        color: var(--ink);
      }

      body {
        box-sizing: border-box;
        padding: 12px;
      }

      button,
      input,
      textarea {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      button:focus-visible,
      input:focus-visible,
      textarea:focus-visible {
        outline: 3px solid rgba(240, 138, 55, 0.35);
        outline-offset: 2px;
      }

      #reviewed-app-runtime-root {
        height: 100%;
      }

      .flashcard-shell {
        border: 1px solid var(--line);
        border-radius: 28px;
        background: rgba(255, 253, 250, 0.97);
        box-shadow: 0 24px 60px rgba(108, 72, 27, 0.1);
        min-height: 560px;
        box-sizing: border-box;
        padding: 16px;
      }

      .flashcard-stack {
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr);
        gap: 14px;
        min-height: 528px;
      }

      .flashcard-strip,
      .flashcard-status-strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 12px 14px;
        background: var(--panel-soft);
      }

      .flashcard-eyebrow {
        margin: 0 0 6px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 11px;
        color: var(--accent);
      }

      .flashcard-title {
        margin: 0;
        font-size: clamp(26px, 5vw, 34px);
        line-height: 1.02;
      }

      .flashcard-subtitle {
        margin: 8px 0 0;
        max-width: 62ch;
        color: var(--muted);
        line-height: 1.45;
      }

      .flashcard-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        border: 1px solid #efbe84;
        background: #fff2df;
        color: #8d4f19;
        padding: 8px 12px;
        font-size: 13px;
        font-weight: 700;
      }

      .flashcard-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .flashcard-button {
        border-radius: 14px;
        border: 1px solid #efbe84;
        background: #fff4e6;
        color: #7b4618;
        padding: 10px 14px;
        font-size: 13px;
        font-weight: 700;
      }

      .flashcard-button--primary {
        background: var(--accent-strong);
        border-color: var(--accent-strong);
        color: white;
      }

      .flashcard-button[disabled] {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .flashcard-workspace {
        display: grid;
        grid-template-columns: minmax(240px, 0.92fr) minmax(0, 1.45fr);
        gap: 14px;
        min-height: 0;
      }

      .flashcard-panel {
        min-width: 0;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--panel);
        padding: 14px;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .flashcard-panel h2 {
        margin: 0;
        font-size: 16px;
      }

      .flashcard-panel-copy {
        margin: 8px 0 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .flashcard-deck-list {
        margin-top: 14px;
        display: grid;
        gap: 10px;
        overflow: auto;
        padding-right: 2px;
      }

      .flashcard-card-chip {
        display: grid;
        gap: 8px;
        width: 100%;
        text-align: left;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: white;
        padding: 12px;
      }

      .flashcard-card-chip[data-selected="true"] {
        background: var(--selected);
        border-color: var(--selected-line);
      }

      .flashcard-card-topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .flashcard-card-index {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--accent);
      }

      .flashcard-card-prompt {
        font-size: 15px;
        font-weight: 700;
        line-height: 1.3;
      }

      .flashcard-card-answer {
        font-size: 13px;
        color: var(--muted);
        line-height: 1.4;
      }

      .flashcard-empty {
        margin-top: 14px;
        border: 1px dashed #e7caa5;
        border-radius: 20px;
        background: #fffaf3;
        padding: 16px;
        color: var(--muted);
        line-height: 1.5;
      }

      .flashcard-form {
        margin-top: 14px;
        display: grid;
        gap: 12px;
      }

      .flashcard-field {
        display: grid;
        gap: 6px;
      }

      .flashcard-field label {
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #8d4f19;
      }

      .flashcard-field input,
      .flashcard-field textarea {
        width: 100%;
        box-sizing: border-box;
        border-radius: 14px;
        border: 1px solid #ecc99d;
        background: white;
        padding: 12px 14px;
        color: var(--ink);
      }

      .flashcard-field textarea {
        min-height: 180px;
        resize: vertical;
      }

      .flashcard-editor-actions,
      .flashcard-order-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .flashcard-order-actions {
        margin-top: 2px;
      }

      .flashcard-inline-note {
        margin-top: 12px;
        border-radius: 16px;
        background: #fff6ea;
        color: #8d4f19;
        padding: 10px 12px;
        font-size: 13px;
        line-height: 1.45;
      }

      .flashcard-inline-note--success {
        background: var(--success);
        color: #17663e;
      }

      .flashcard-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        color: var(--muted);
        font-size: 12px;
      }

      .flashcard-workspace--study {
        grid-template-columns: minmax(0, 1.5fr) minmax(240px, 0.92fr);
      }

      .flashcard-study-panel {
        justify-content: center;
      }

      .flashcard-study-stage {
        display: grid;
        gap: 16px;
        min-height: 100%;
      }

      .flashcard-study-progress {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      .flashcard-study-card {
        display: grid;
        gap: 14px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background:
          radial-gradient(circle at top right, rgba(255, 214, 160, 0.42), transparent 32%),
          linear-gradient(180deg, #fffdfa 0%, #fff6e9 100%);
        padding: 18px;
        min-height: 320px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
      }

      .flashcard-study-face {
        display: grid;
        gap: 14px;
        align-content: start;
      }

      .flashcard-study-face-label {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--accent);
      }

      .flashcard-study-prompt {
        font-size: clamp(24px, 5vw, 34px);
        font-weight: 800;
        line-height: 1.08;
      }

      .flashcard-study-answer-shell {
        border-radius: 20px;
        border: 1px dashed #e6bf8f;
        background: rgba(255, 255, 255, 0.8);
        padding: 14px 16px;
        min-height: 110px;
      }

      .flashcard-study-answer-shell[data-revealed="true"] {
        border-style: solid;
        background: white;
      }

      .flashcard-study-answer-copy {
        margin: 0;
        color: var(--muted);
        line-height: 1.5;
      }

      .flashcard-study-answer {
        margin: 0;
        color: var(--ink);
        font-size: 16px;
        line-height: 1.55;
      }

      .flashcard-study-actions,
      .flashcard-confidence-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .flashcard-confidence-button[data-confidence="easy"] {
        background: #eef9f1;
        border-color: #9fd0aa;
        color: #1f6a39;
      }

      .flashcard-confidence-button[data-confidence="medium"] {
        background: #fff5de;
        border-color: #efc15f;
        color: #8a5710;
      }

      .flashcard-confidence-button[data-confidence="hard"] {
        background: #fff0eb;
        border-color: #eea48b;
        color: #9b4221;
      }

      .flashcard-study-sidebar {
        gap: 12px;
      }

      .flashcard-study-sidebar-list {
        display: grid;
        gap: 10px;
      }

      .flashcard-study-sidebar-item {
        border-radius: 18px;
        border: 1px solid var(--line);
        background: #fffaf3;
        padding: 12px;
      }

      .flashcard-study-sidebar-item strong {
        display: block;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--accent);
        margin-bottom: 6px;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      @media (max-width: 860px) {
        .flashcard-workspace {
          grid-template-columns: 1fr;
        }

        .flashcard-workspace--study {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div id="reviewed-app-runtime-root"></div>
    <script>
      const launch = ${serializedLaunch};
      const initialSnapshot = ${serializedSnapshot};

      (() => {
        let bridgePort = null;
        let currentEnvelope = null;
        let nextSequence = 2;
        const root = document.getElementById('reviewed-app-runtime-root');
        const state = {
          snapshot: JSON.parse(JSON.stringify(initialSnapshot)),
          editor: {
            prompt: '',
            answer: '',
          },
          validationMessage: '',
        };

        function clone(value) {
          return JSON.parse(JSON.stringify(value));
        }

        function normalizeWhitespace(value) {
          return String(value || '').replace(/\\s+/g, ' ').trim();
        }

        function normalizeOptionalWhitespace(value) {
          const trimmed = normalizeWhitespace(value);
          return trimmed.length > 0 ? trimmed : undefined;
        }

        function clampLabel(value, maxLength) {
          if (value.length <= maxLength) {
            return value;
          }
          return value.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
        }

        function normalizeDeckTitle(value) {
          return clampLabel(normalizeOptionalWhitespace(value) || 'Study deck', 80);
        }

        function summarizeCardPrompt(prompt) {
          return clampLabel(normalizeWhitespace(prompt), 52);
        }

        function escapeHtml(value) {
          return String(value || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
        }

        function normalizeCards(cardsValue) {
          if (!Array.isArray(cardsValue)) {
            return [];
          }

          const seenCardIds = new Set();
          return cardsValue
            .map((card) => {
              if (!card || typeof card !== 'object') {
                return null;
              }

              const cardId = normalizeOptionalWhitespace(card.cardId);
              const prompt = normalizeOptionalWhitespace(card.prompt);
              const answer = normalizeOptionalWhitespace(card.answer);

              if (!cardId || !prompt || !answer || seenCardIds.has(cardId)) {
                return null;
              }

              seenCardIds.add(cardId);
              return {
                cardId,
                prompt,
                answer,
              };
            })
            .filter(Boolean)
            .slice(0, 32);
        }

        function normalizeStudyMarks(cards, marksValue) {
          if (!Array.isArray(marksValue)) {
            return [];
          }

          const availableCardIds = new Set(cards.map((card) => card.cardId));
          const seenCardIds = new Set();

          return marksValue
            .map((mark) => {
              if (!mark || typeof mark !== 'object') {
                return null;
              }

              const cardId = normalizeOptionalWhitespace(mark.cardId);
              const confidence = mark.confidence;

              if (
                !cardId ||
                !availableCardIds.has(cardId) ||
                seenCardIds.has(cardId) ||
                (confidence !== 'easy' && confidence !== 'medium' && confidence !== 'hard')
              ) {
                return null;
              }

              seenCardIds.add(cardId);
              return {
                cardId,
                confidence,
              };
            })
            .filter(Boolean)
            .slice(0, 32);
        }

        function buildStudyCounts(studyMarks) {
          return studyMarks.reduce(
            (counts, mark) => {
              counts[mark.confidence] += 1;
              return counts;
            },
            { easy: 0, medium: 0, hard: 0 }
          );
        }

        function findFirstUnmarkedCardIndex(cards, studyMarks) {
          const markedCardIds = new Set(studyMarks.map((mark) => mark.cardId));
          const firstUnmarkedIndex = cards.findIndex((card) => !markedCardIds.has(card.cardId));
          return firstUnmarkedIndex < 0 ? cards.length : firstUnmarkedIndex;
        }

        function getCards() {
          return normalizeCards(state.snapshot.cards);
        }

        function getStudyMarks() {
          return normalizeStudyMarks(getCards(), state.snapshot.studyMarks);
        }

        function getStudyCounts() {
          return buildStudyCounts(getStudyMarks());
        }

        function getReviewedCount() {
          const counts = getStudyCounts();
          return counts.easy + counts.medium + counts.hard;
        }

        function getRemainingCount() {
          return Math.max(0, getCards().length - getReviewedCount());
        }

        function getSelectedIndex() {
          return getCards().findIndex((card) => card.cardId === state.snapshot.selectedCardId);
        }

        function getSelectedCard() {
          return getCards().find((card) => card.cardId === state.snapshot.selectedCardId) || null;
        }

        function getCurrentStudyCard() {
          const cards = getCards();
          const studyPosition = Number.isInteger(state.snapshot.studyPosition) ? state.snapshot.studyPosition : 0;
          return studyPosition >= 0 && studyPosition < cards.length ? cards[studyPosition] : null;
        }

        function getWeakStudyPrompts(cards, studyMarks) {
          const cardById = new Map(cards.map((card) => [card.cardId, card]));
          const hardPrompts = studyMarks
            .filter((mark) => mark.confidence === 'hard')
            .map((mark) => cardById.get(mark.cardId))
            .filter(Boolean)
            .map((card) => summarizeCardPrompt(card.prompt));

          if (hardPrompts.length > 0) {
            return hardPrompts.slice(0, 3);
          }

          return studyMarks
            .filter((mark) => mark.confidence === 'medium')
            .map((mark) => cardById.get(mark.cardId))
            .filter(Boolean)
            .map((card) => summarizeCardPrompt(card.prompt))
            .slice(0, 3);
        }

        function syncEditorFromSelection() {
          const selectedCard = getSelectedCard();
          if (!selectedCard) {
            state.editor = {
              prompt: '',
              answer: '',
            };
            state.snapshot.selectedCardId = undefined;
            return;
          }

          state.editor = {
            prompt: selectedCard.prompt,
            answer: selectedCard.answer,
          };
        }

        function describeLastAction(action, selectedCard, currentStudyCard, studyCounts, cardCount) {
          const selectedLabel = selectedCard ? '"' + summarizeCardPrompt(selectedCard.prompt) + '"' : 'the selected card';
          const studyLabel = currentStudyCard ? '"' + summarizeCardPrompt(currentStudyCard.prompt) + '"' : 'the current study card';

          if (action === 'created-card') {
            return selectedCard ? 'Latest change: created ' + selectedLabel + '.' : 'Latest change: created a new card.';
          }
          if (action === 'updated-card') {
            return selectedCard ? 'Latest change: updated ' + selectedLabel + '.' : 'Latest change: updated a card.';
          }
          if (action === 'deleted-card') {
            return cardCount > 0
              ? 'Latest change: deleted a card and kept the remaining deck in order.'
              : 'Latest change: deleted the final card from the deck.';
          }
          if (action === 'moved-card-up') {
            return selectedCard ? 'Latest change: moved ' + selectedLabel + ' earlier in the deck.' : 'Latest change: moved a card earlier in the deck.';
          }
          if (action === 'moved-card-down') {
            return selectedCard ? 'Latest change: moved ' + selectedLabel + ' later in the deck.' : 'Latest change: moved a card later in the deck.';
          }
          if (action === 'selected-card') {
            return selectedCard ? 'Current selection: ' + selectedLabel + '.' : 'A card is selected for editing.';
          }
          if (action === 'cleared-selection') {
            return 'Composer reset and ready for a new card.';
          }
          if (action === 'entered-study-mode') {
            return 'Study mode started from the current deck order.';
          }
          if (action === 'returned-to-authoring') {
            return 'Returned to editing so the deck can be revised before more studying.';
          }
          if (action === 'revealed-card') {
            return currentStudyCard
              ? 'Latest change: revealed the answer for ' + studyLabel + '.'
              : 'Latest change: revealed the answer for the current card.';
          }
          if (action === 'marked-easy') {
            return 'Latest change: marked ' + studyLabel + ' as easy.';
          }
          if (action === 'marked-medium') {
            return 'Latest change: marked ' + studyLabel + ' as medium.';
          }
          if (action === 'marked-hard') {
            return 'Latest change: marked ' + studyLabel + ' as hard.';
          }
          if (action === 'completed-study-round') {
            return (
              'Study round finished with ' +
              studyCounts.easy +
              ' easy, ' +
              studyCounts.medium +
              ' medium, and ' +
              studyCounts.hard +
              ' hard cards.'
            );
          }
          return cardCount > 0 ? 'Deck restored and ready for edits.' : 'Deck initialized and ready for the first card.';
        }

        function buildStatusText(snapshot) {
          if (snapshot.status === 'complete') {
            if (snapshot.mode === 'study') {
              return 'Study results returned to chat';
            }
            return snapshot.cardCount > 0 ? 'Deck returned to chat' : 'Empty deck returned';
          }

          if (snapshot.cardCount === 0) {
            return 'No cards yet';
          }

          if (snapshot.mode === 'study') {
            if (snapshot.studyStatus === 'complete') {
              return 'Study round complete';
            }
            if (snapshot.lastAction === 'entered-study-mode') {
              return 'Study mode ready';
            }
            if (snapshot.lastAction === 'revealed-card') {
              return 'Answer revealed';
            }
            if (snapshot.lastAction === 'marked-easy') {
              return 'Marked easy';
            }
            if (snapshot.lastAction === 'marked-medium') {
              return 'Marked medium';
            }
            if (snapshot.lastAction === 'marked-hard') {
              return 'Marked hard';
            }
            if (snapshot.lastAction === 'returned-to-authoring') {
              return 'Back to editing';
            }
            return 'Studying card ' + Math.min(snapshot.studyPosition + 1, snapshot.cardCount) + ' of ' + snapshot.cardCount;
          }

          if (snapshot.lastAction === 'created-card') {
            return 'Card created';
          }
          if (snapshot.lastAction === 'updated-card') {
            return 'Card updated';
          }
          if (snapshot.lastAction === 'deleted-card') {
            return 'Card deleted';
          }
          if (snapshot.lastAction === 'moved-card-up') {
            return 'Card moved up';
          }
          if (snapshot.lastAction === 'moved-card-down') {
            return 'Card moved down';
          }
          if (snapshot.lastAction === 'selected-card') {
            return 'Editing selected card';
          }
          if (snapshot.lastAction === 'cleared-selection') {
            return 'Ready for a new card';
          }
          return 'Deck ready';
        }

        function buildSummary(snapshot) {
          const selectedCard = snapshot.cards.find((card) => card.cardId === snapshot.selectedCardId) || null;
          const currentStudyCard =
            snapshot.studyPosition >= 0 && snapshot.studyPosition < snapshot.cards.length
              ? snapshot.cards[snapshot.studyPosition]
              : null;
          const actionSentence = describeLastAction(
            snapshot.lastAction,
            selectedCard,
            currentStudyCard,
            snapshot.studyCounts,
            snapshot.cardCount
          );

          if (snapshot.cardCount === 0) {
            const base = snapshot.status === 'complete'
              ? 'Flashcard Studio returned the deck "' + snapshot.deckTitle + '" to chat with no cards created.'
              : 'Flashcard Studio is open on the deck "' + snapshot.deckTitle + '" with no cards yet.';
            return normalizeWhitespace(base + ' ' + actionSentence + ' The empty state is explicit so later chat does not imply study progress.');
          }

          if (snapshot.mode === 'study') {
            const reviewedCount = snapshot.studyCounts.easy + snapshot.studyCounts.medium + snapshot.studyCounts.hard;
            const remainingCount = Math.max(0, snapshot.cardCount - reviewedCount);
            const weakPrompts = getWeakStudyPrompts(snapshot.cards, snapshot.studyMarks);
            const base = snapshot.status === 'complete'
              ? 'Flashcard Studio returned study results for "' + snapshot.deckTitle + '" after reviewing ' + reviewedCount + ' of ' + snapshot.cardCount + ' cards.'
              : snapshot.studyStatus === 'complete'
                ? 'Flashcard Studio finished studying "' + snapshot.deckTitle + '" and is holding the results in the thread.'
                : 'Flashcard Studio is actively studying "' + snapshot.deckTitle + '" with ' + reviewedCount + ' of ' + snapshot.cardCount + ' cards reviewed.';
            const progressSentence =
              'Confidence totals: ' +
              snapshot.studyCounts.easy +
              ' easy, ' +
              snapshot.studyCounts.medium +
              ' medium, ' +
              snapshot.studyCounts.hard +
              ' hard. ' +
              remainingCount +
              ' cards remaining.';
            const currentCardSentence =
              currentStudyCard && snapshot.studyStatus !== 'complete'
                ? 'Current card: "' + summarizeCardPrompt(currentStudyCard.prompt) + '".'
                : 'No current study card is waiting.';
            const weakSentence = weakPrompts.length > 0
              ? 'Needs review: ' + weakPrompts.join('; ') + '.'
              : reviewedCount > 0
                ? 'No hard review cards are currently flagged.'
                : 'No confidence marks recorded yet.';

            return normalizeWhitespace(base + ' ' + progressSentence + ' ' + currentCardSentence + ' ' + weakSentence + ' ' + actionSentence);
          }

          const previewCards = snapshot.cards.slice(0, 4).map((card) => summarizeCardPrompt(card.prompt));
          const previewSentence = 'Card preview: ' + previewCards.join('; ') + '.';
          const selectedSentence = selectedCard
            ? 'Selected card: "' + summarizeCardPrompt(selectedCard.prompt) + '".'
            : 'No card is currently selected.';
          const base = snapshot.status === 'complete'
            ? 'Flashcard Studio returned the deck "' + snapshot.deckTitle + '" to chat with ' + snapshot.cardCount + ' cards.'
            : 'Flashcard Studio is actively authoring the deck "' + snapshot.deckTitle + '" with ' + snapshot.cardCount + ' cards.';

          return normalizeWhitespace(base + ' ' + previewSentence + ' ' + selectedSentence + ' ' + actionSentence);
        }

        function buildResumeHint(snapshot) {
          if (snapshot.cardCount === 0) {
            return 'Reopen Flashcard Studio to add the first card to "' + snapshot.deckTitle + '".';
          }
          if (snapshot.mode === 'study') {
            if (snapshot.studyStatus === 'complete') {
              return 'Reopen Flashcard Studio to review the hard cards in "' + snapshot.deckTitle + '" or keep editing the deck.';
            }
            return (
              'Reopen Flashcard Studio to continue studying "' +
              snapshot.deckTitle +
              '" at card ' +
              Math.min(snapshot.studyPosition + 1, snapshot.cardCount) +
              ' of ' +
              snapshot.cardCount +
              '.'
            );
          }
          if (snapshot.studyMarks.length > 0) {
            return 'Reopen Flashcard Studio to keep editing "' + snapshot.deckTitle + '" or resume the current study round later.';
          }
          return 'Reopen Flashcard Studio to keep editing "' + snapshot.deckTitle + '" or start study mode later.';
        }

        function buildSnapshotRecord(options) {
          const cards = normalizeCards(options.cards);
          const studyMarks = normalizeStudyMarks(cards, options.studyMarks);
          const studyCounts = buildStudyCounts(studyMarks);
          const selectedCardId = cards.some((card) => card.cardId === options.selectedCardId)
            ? options.selectedCardId
            : undefined;
          const status =
            options.status === 'complete' || options.status === 'empty' || options.status === 'editing'
              ? options.status
              : cards.length === 0
                ? 'empty'
                : 'editing';
          const deckTitle = normalizeDeckTitle(options.deckTitle);
          const requestedMode = options.mode === 'study' ? 'study' : 'authoring';
          const requestedStudyStatus =
            options.studyStatus === 'complete' || options.studyStatus === 'studying' || options.studyStatus === 'idle'
              ? options.studyStatus
              : requestedMode === 'study'
                ? 'studying'
                : studyMarks.length > 0
                  ? 'studying'
                  : 'idle';

          let mode = requestedMode;
          let studyStatus = requestedStudyStatus;

          if (cards.length === 0) {
            mode = 'authoring';
            studyStatus = 'idle';
          } else {
            if (requestedMode === 'authoring') {
              studyStatus = studyMarks.length > 0 ? 'studying' : 'idle';
            }

            if (requestedMode === 'study' && requestedStudyStatus === 'idle') {
              studyStatus = 'studying';
            }
          }

          const defaultStudyPosition =
            studyStatus === 'complete'
              ? cards.length
              : Math.min(findFirstUnmarkedCardIndex(cards, studyMarks), Math.max(0, cards.length - 1));
          let studyPosition = Number.isInteger(options.studyPosition) ? options.studyPosition : defaultStudyPosition;
          studyPosition = Math.max(0, Math.min(studyPosition, cards.length));

          if (studyStatus === 'complete') {
            studyPosition = cards.length;
          }

          if (mode === 'authoring' && studyStatus === 'complete') {
            mode = 'study';
          }

          const currentStudyCard = studyPosition >= 0 && studyPosition < cards.length ? cards[studyPosition] : null;
          const revealedCardId =
            currentStudyCard && options.revealedCardId === currentStudyCard.cardId ? options.revealedCardId : undefined;
          const lastAction = options.lastAction || 'initialized';

          const nextSnapshot = {
            schemaVersion: 1,
            appId: 'flashcard-studio',
            request: normalizeOptionalWhitespace(options.request) || normalizeOptionalWhitespace(launch.request) || undefined,
            deckTitle,
            status,
            mode,
            studyStatus,
            cardCount: cards.length,
            cards,
            selectedCardId,
            studyPosition,
            revealedCardId,
            studyMarks,
            studyCounts,
            lastAction,
            statusText: '',
            summary: '',
            resumeHint: '',
            lastUpdatedAt: options.lastUpdatedAt || Date.now(),
          };

          if (!selectedCardId) {
            delete nextSnapshot.selectedCardId;
          }

          if (!revealedCardId) {
            delete nextSnapshot.revealedCardId;
          }

          nextSnapshot.statusText = buildStatusText(nextSnapshot);
          nextSnapshot.summary = buildSummary(nextSnapshot);
          nextSnapshot.resumeHint = buildResumeHint(nextSnapshot);

          return nextSnapshot;
        }

        function createSnapshot(status, lastAction, overrides) {
          return buildSnapshotRecord({
            request: state.snapshot.request || launch.request,
            deckTitle: state.snapshot.deckTitle,
            status,
            mode: overrides && overrides.mode !== undefined ? overrides.mode : state.snapshot.mode,
            studyStatus: overrides && overrides.studyStatus !== undefined ? overrides.studyStatus : state.snapshot.studyStatus,
            cards: state.snapshot.cards,
            selectedCardId: state.snapshot.selectedCardId,
            studyPosition:
              overrides && overrides.studyPosition !== undefined ? overrides.studyPosition : state.snapshot.studyPosition,
            revealedCardId:
              overrides && Object.prototype.hasOwnProperty.call(overrides, 'revealedCardId')
                ? overrides.revealedCardId
                : state.snapshot.revealedCardId,
            studyMarks: overrides && overrides.studyMarks !== undefined ? overrides.studyMarks : state.snapshot.studyMarks,
            lastAction,
            lastUpdatedAt: Date.now(),
          });
        }

        function sendBridgeEvent(kind, payload) {
          if (!bridgePort || !currentEnvelope) {
            return;
          }

          bridgePort.postMessage({
            kind,
            bridgeSessionId: currentEnvelope.bridgeSessionId,
            appInstanceId: currentEnvelope.appInstanceId,
            bridgeToken: currentEnvelope.bridgeToken,
            sequence: nextSequence++,
            ...payload,
          });
        }

        function publishSnapshot(status, lastAction, overrides) {
          const nextSnapshot = createSnapshot(status, lastAction, overrides);
          state.snapshot = clone(nextSnapshot);
          syncEditorFromSelection();
          render();
          sendBridgeEvent('app.state', {
            idempotencyKey: lastAction + '-' + nextSnapshot.lastUpdatedAt,
            snapshot: nextSnapshot,
          });
          return nextSnapshot;
        }

        function publishCompletion() {
          const nextSnapshot = createSnapshot(getCards().length === 0 ? 'empty' : 'complete', state.snapshot.lastAction || 'initialized');
          const reviewedCount = nextSnapshot.studyCounts.easy + nextSnapshot.studyCounts.medium + nextSnapshot.studyCounts.hard;
          const weakPrompts = getWeakStudyPrompts(nextSnapshot.cards, nextSnapshot.studyMarks);
          state.snapshot = clone(nextSnapshot);
          render();
          sendBridgeEvent('app.state', {
            idempotencyKey: 'complete-state-' + nextSnapshot.lastUpdatedAt,
            snapshot: nextSnapshot,
          });
          sendBridgeEvent('app.complete', {
            idempotencyKey: 'complete-' + nextSnapshot.lastUpdatedAt,
            completion: {
              schemaVersion: 1,
              status: 'success',
              suggestedSummary: {
                title: nextSnapshot.mode === 'study' ? 'Flashcard study results returned to chat' : 'Flashcard deck returned to chat',
                text: nextSnapshot.summary,
                bullets:
                  nextSnapshot.mode === 'study'
                    ? [
                        'Deck: ' + nextSnapshot.deckTitle,
                        'Reviewed: ' + reviewedCount + ' of ' + nextSnapshot.cardCount,
                        'Confidence: ' + nextSnapshot.studyCounts.easy + ' easy, ' + nextSnapshot.studyCounts.medium + ' medium, ' + nextSnapshot.studyCounts.hard + ' hard',
                        weakPrompts.length > 0 ? 'Needs review: ' + weakPrompts.join(' | ') : 'Needs review: no hard cards flagged',
                      ]
                    : [
                        'Deck: ' + nextSnapshot.deckTitle,
                        'Cards: ' + nextSnapshot.cardCount,
                        nextSnapshot.cardCount > 0
                          ? 'Preview: ' + nextSnapshot.cards.slice(0, 3).map((card) => summarizeCardPrompt(card.prompt)).join(' | ')
                          : 'Preview: no cards yet',
                      ],
              },
              outcomeData: {
                appId: launch.appId,
                deckTitle: nextSnapshot.deckTitle,
                cardCount: nextSnapshot.cardCount,
                selectedCardId: nextSnapshot.selectedCardId || null,
                mode: nextSnapshot.mode,
                reviewedCount,
                studyCounts: nextSnapshot.studyCounts,
              },
              resumability: {
                resumable: true,
                checkpointId: 'flashcard-studio-' + nextSnapshot.lastUpdatedAt,
                resumeHint: nextSnapshot.resumeHint,
              },
            },
          });
        }

        function readComposerFromDom() {
          const deckTitleInput = document.getElementById('deck-title-input');
          const promptInput = document.getElementById('card-prompt-input');
          const answerInput = document.getElementById('card-answer-input');

          state.snapshot.deckTitle = normalizeDeckTitle(deckTitleInput ? deckTitleInput.value : state.snapshot.deckTitle);
          state.editor.prompt = promptInput ? promptInput.value : state.editor.prompt;
          state.editor.answer = answerInput ? answerInput.value : state.editor.answer;
        }

        function setValidationMessage(message) {
          state.validationMessage = message;
          render();
        }

        function requireEditorCard() {
          readComposerFromDom();
          const prompt = normalizeWhitespace(state.editor.prompt);
          const answer = normalizeWhitespace(state.editor.answer);

          if (!prompt || !answer) {
            setValidationMessage('Add both a prompt and an answer before saving this card.');
            return null;
          }

          return { prompt, answer };
        }

        function createCardId() {
          return 'card-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        }

        function clearComposer(publish) {
          state.snapshot.selectedCardId = undefined;
          state.editor = {
            prompt: '',
            answer: '',
          };
          state.validationMessage = '';
          if (publish) {
            publishSnapshot(getCards().length === 0 ? 'empty' : 'editing', 'cleared-selection');
          } else {
            render();
          }
        }

        function selectCard(cardId) {
          readComposerFromDom();
          state.snapshot.selectedCardId = cardId;
          state.validationMessage = '';
          publishSnapshot('editing', 'selected-card');
        }

        function addCard() {
          const editorCard = requireEditorCard();
          if (!editorCard) {
            return;
          }

          const cards = clone(getCards());
          const card = {
            cardId: createCardId(),
            prompt: editorCard.prompt,
            answer: editorCard.answer,
          };
          cards.push(card);
          state.snapshot.cards = cards;
          state.snapshot.selectedCardId = card.cardId;
          state.validationMessage = 'Card created.';
          publishSnapshot('editing', 'created-card');
        }

        function saveSelectedCard() {
          const selectedIndex = getSelectedIndex();
          if (selectedIndex < 0) {
            setValidationMessage('Select a card before saving edits.');
            return;
          }

          const editorCard = requireEditorCard();
          if (!editorCard) {
            return;
          }

          const cards = clone(getCards());
          cards[selectedIndex] = {
            ...cards[selectedIndex],
            prompt: editorCard.prompt,
            answer: editorCard.answer,
          };
          state.snapshot.cards = cards;
          state.validationMessage = 'Card updated.';
          publishSnapshot('editing', 'updated-card');
        }

        function deleteSelectedCard() {
          const selectedIndex = getSelectedIndex();
          if (selectedIndex < 0) {
            setValidationMessage('Select a card before deleting it.');
            return;
          }

          const cards = clone(getCards());
          cards.splice(selectedIndex, 1);
          state.snapshot.cards = cards;
          const nextSelection = cards[selectedIndex] || cards[selectedIndex - 1] || null;
          state.snapshot.selectedCardId = nextSelection ? nextSelection.cardId : undefined;
          state.validationMessage = cards.length > 0 ? 'Card deleted.' : 'The deck is empty again.';
          if (!nextSelection) {
            state.editor = { prompt: '', answer: '' };
          }
          publishSnapshot(cards.length === 0 ? 'empty' : 'editing', 'deleted-card');
        }

        function moveSelected(offset) {
          const selectedIndex = getSelectedIndex();
          if (selectedIndex < 0) {
            setValidationMessage('Select a card before reordering it.');
            return;
          }

          const nextIndex = selectedIndex + offset;
          const cards = clone(getCards());
          if (nextIndex < 0 || nextIndex >= cards.length) {
            setValidationMessage(offset < 0 ? 'That card is already at the top.' : 'That card is already at the bottom.');
            return;
          }

          const [movedCard] = cards.splice(selectedIndex, 1);
          cards.splice(nextIndex, 0, movedCard);
          state.snapshot.cards = cards;
          state.validationMessage = offset < 0 ? 'Card moved up.' : 'Card moved down.';
          publishSnapshot('editing', offset < 0 ? 'moved-card-up' : 'moved-card-down');
        }

        function enterStudyMode() {
          const cards = getCards();
          if (cards.length === 0) {
            setValidationMessage('Add at least one card before starting study mode.');
            return;
          }

          const nextStudyMarks = getStudyMarks();
          const nextIndex = findFirstUnmarkedCardIndex(cards, nextStudyMarks);
          const nextStudyStatus = nextIndex >= cards.length ? 'complete' : 'studying';
          state.validationMessage = nextStudyStatus === 'complete' ? 'Study round already complete.' : 'Study mode ready.';
          publishSnapshot('editing', nextStudyStatus === 'complete' ? 'completed-study-round' : 'entered-study-mode', {
            mode: 'study',
            studyStatus: nextStudyStatus,
            studyPosition: nextStudyStatus === 'complete' ? cards.length : nextIndex,
            revealedCardId: undefined,
            studyMarks: nextStudyMarks,
          });
        }

        function returnToAuthoring() {
          state.validationMessage = 'Returned to editing.';
          publishSnapshot(getCards().length === 0 ? 'empty' : 'editing', 'returned-to-authoring', {
            mode: 'authoring',
            studyPosition: findFirstUnmarkedCardIndex(getCards(), getStudyMarks()),
            revealedCardId: undefined,
            studyMarks: getStudyMarks(),
          });
        }

        function revealStudyCard() {
          const currentStudyCard = getCurrentStudyCard();
          if (state.snapshot.mode !== 'study' || !currentStudyCard) {
            setValidationMessage('Start study mode before revealing an answer.');
            return;
          }

          if (state.snapshot.revealedCardId === currentStudyCard.cardId) {
            setValidationMessage('Answer already revealed.');
            return;
          }

          state.validationMessage = 'Answer revealed.';
          publishSnapshot('editing', 'revealed-card', {
            mode: 'study',
            studyStatus: state.snapshot.studyStatus === 'complete' ? 'complete' : 'studying',
            studyPosition: state.snapshot.studyPosition,
            revealedCardId: currentStudyCard.cardId,
            studyMarks: getStudyMarks(),
          });
        }

        function markStudyConfidence(confidence) {
          const currentStudyCard = getCurrentStudyCard();
          if (state.snapshot.mode !== 'study' || !currentStudyCard) {
            setValidationMessage('Start study mode before recording confidence.');
            return;
          }

          if (state.snapshot.revealedCardId !== currentStudyCard.cardId) {
            setValidationMessage('Reveal the answer before marking confidence.');
            return;
          }

          const nextStudyMarks = getStudyMarks()
            .filter((mark) => mark.cardId !== currentStudyCard.cardId)
            .concat({
              cardId: currentStudyCard.cardId,
              confidence,
            });
          const cards = getCards();
          const nextIndex = findFirstUnmarkedCardIndex(cards, nextStudyMarks);
          const nextStudyStatus = nextIndex >= cards.length ? 'complete' : 'studying';
          const nextAction =
            nextStudyStatus === 'complete'
              ? 'completed-study-round'
              : confidence === 'easy'
                ? 'marked-easy'
                : confidence === 'medium'
                  ? 'marked-medium'
                  : 'marked-hard';

          state.validationMessage =
            nextStudyStatus === 'complete' ? 'Study round complete.' : 'Marked this card as ' + confidence + '.';
          publishSnapshot('editing', nextAction, {
            mode: 'study',
            studyStatus: nextStudyStatus,
            studyPosition: nextStudyStatus === 'complete' ? cards.length : nextIndex,
            revealedCardId: undefined,
            studyMarks: nextStudyMarks,
          });
        }

        function normalizeIncomingSnapshot(snapshot) {
          if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
            return createSnapshot(getCards().length === 0 ? 'empty' : 'editing', state.snapshot.lastAction || 'initialized');
          }

          return buildSnapshotRecord({
            request: snapshot.request || launch.request,
            deckTitle: snapshot.deckTitle,
            status: snapshot.status,
            mode: snapshot.mode,
            studyStatus: snapshot.studyStatus,
            cards: snapshot.cards,
            selectedCardId: snapshot.selectedCardId,
            studyPosition: snapshot.studyPosition,
            revealedCardId: snapshot.revealedCardId,
            studyMarks: snapshot.studyMarks,
            lastAction: snapshot.lastAction,
            lastUpdatedAt: snapshot.lastUpdatedAt,
          });
        }

        function bindControls() {
          const deckTitleInput = document.getElementById('deck-title-input');
          const promptInput = document.getElementById('card-prompt-input');
          const answerInput = document.getElementById('card-answer-input');

          if (deckTitleInput) {
            deckTitleInput.addEventListener('input', () => {
              state.snapshot.deckTitle = normalizeDeckTitle(deckTitleInput.value);
            });
          }

          if (promptInput) {
            promptInput.addEventListener('input', () => {
              state.editor.prompt = promptInput.value;
            });
          }

          if (answerInput) {
            answerInput.addEventListener('input', () => {
              state.editor.answer = answerInput.value;
            });
          }

          root.querySelectorAll('[data-select-card]').forEach((button) => {
            button.addEventListener('click', () => {
              const cardId = button.getAttribute('data-select-card');
              if (cardId) {
                selectCard(cardId);
              }
            });
          });

          const addButton = document.getElementById('flashcard-add-button');
          addButton && addButton.addEventListener('click', addCard);

          const saveButton = document.getElementById('flashcard-save-button');
          saveButton && saveButton.addEventListener('click', saveSelectedCard);

          const deleteButton = document.getElementById('flashcard-delete-button');
          deleteButton && deleteButton.addEventListener('click', deleteSelectedCard);

          const newCardButton = document.getElementById('flashcard-new-button');
          newCardButton && newCardButton.addEventListener('click', () => clearComposer(true));

          const moveUpButton = document.getElementById('flashcard-move-up-button');
          moveUpButton && moveUpButton.addEventListener('click', () => moveSelected(-1));

          const moveDownButton = document.getElementById('flashcard-move-down-button');
          moveDownButton && moveDownButton.addEventListener('click', () => moveSelected(1));

          const completeButton = document.getElementById('flashcard-complete-button');
          completeButton && completeButton.addEventListener('click', publishCompletion);

          const startStudyButton = document.getElementById('flashcard-start-study-button');
          startStudyButton && startStudyButton.addEventListener('click', enterStudyMode);

          const returnToEditingButton = document.getElementById('flashcard-return-editing-button');
          returnToEditingButton && returnToEditingButton.addEventListener('click', returnToAuthoring);

          const revealButton = document.getElementById('flashcard-reveal-button');
          revealButton && revealButton.addEventListener('click', revealStudyCard);

          root.querySelectorAll('[data-mark-confidence]').forEach((button) => {
            button.addEventListener('click', () => {
              const confidence = button.getAttribute('data-mark-confidence');
              if (confidence === 'easy' || confidence === 'medium' || confidence === 'hard') {
                markStudyConfidence(confidence);
              }
            });
          });
        }

        function render() {
          const snapshot = state.snapshot;
          const cards = getCards();
          const selectedIndex = getSelectedIndex();
          const selectedCard = getSelectedCard();
          const studyMarks = getStudyMarks();
          const studyCounts = getStudyCounts();
          const currentStudyCard = getCurrentStudyCard();
          const answerRevealed = currentStudyCard && snapshot.revealedCardId === currentStudyCard.cardId;
          const reviewedCount = getReviewedCount();
          const remainingCount = getRemainingCount();
          const weakPrompts = getWeakStudyPrompts(cards, studyMarks);
          const cardsMarkup = cards
            .map((card, index) =>
              '<button class="flashcard-card-chip" type="button" data-select-card="' +
              escapeHtml(card.cardId) +
              '" data-selected="' +
              String(card.cardId === snapshot.selectedCardId) +
              '">' +
              '<div class="flashcard-card-topline">' +
              '<span class="flashcard-card-index">Card ' + (index + 1) + '</span>' +
              (card.cardId === snapshot.selectedCardId ? '<span class="flashcard-pill">Selected</span>' : '') +
              '</div>' +
              '<div class="flashcard-card-prompt">' + escapeHtml(summarizeCardPrompt(card.prompt)) + '</div>' +
              '<div class="flashcard-card-answer">' + escapeHtml(clampLabel(normalizeWhitespace(card.answer), 84)) + '</div>' +
              '</button>'
            )
            .join('');

          const validationClass = state.validationMessage
            ? (state.validationMessage.includes('created') ||
                state.validationMessage.includes('updated') ||
                state.validationMessage.includes('moved') ||
                state.validationMessage.includes('empty again') ||
                state.validationMessage.includes('Study mode ready') ||
                state.validationMessage.includes('Answer revealed') ||
                state.validationMessage.includes('Marked this card') ||
                state.validationMessage.includes('Study round complete') ||
                state.validationMessage.includes('Returned to editing')
                ? 'flashcard-inline-note flashcard-inline-note--success'
                : 'flashcard-inline-note')
            : 'flashcard-inline-note';

          const subtitle =
            snapshot.mode === 'study'
              ? 'Study one card at a time, reveal the answer, and mark how it felt so later chat stays grounded in bounded progress.'
              : 'Build a study deck directly in the thread, then switch into a simple study loop without leaving the reviewed app shell.';
          const completeButtonLabel =
            snapshot.mode === 'study' ? 'Return study summary to chat' : 'Return deck to chat';

          const authoringWorkspace =
            '<section class="flashcard-workspace">' +
            '<div class="flashcard-panel">' +
            '<h2>Deck order</h2>' +
            '<p class="flashcard-panel-copy">Pick a card to edit it, or start study mode once the deck looks right. Reordering stays visible and button-driven.</p>' +
            (cards.length > 0
              ? '<div class="flashcard-deck-list">' + cardsMarkup + '</div>'
              : '<div class="flashcard-empty">No cards yet. Add a prompt and answer on the right, then create the first card.</div>') +
            '</div>' +
            '<div class="flashcard-panel">' +
            '<h2>' + escapeHtml(selectedCard ? 'Edit selected card' : 'Create a new card') + '</h2>' +
            '<p class="flashcard-panel-copy">' +
            escapeHtml(selectedCard ? 'Update the selected prompt and answer, then save your edits.' : 'Write the front and back of a card, then add it to the deck.') +
            '</p>' +
            '<div class="flashcard-form">' +
            '<div class="flashcard-field">' +
            '<label for="deck-title-input">Deck title</label>' +
            '<input id="deck-title-input" type="text" maxlength="80" value="' + escapeHtml(snapshot.deckTitle) + '" placeholder="Example: Biology review" />' +
            '</div>' +
            '<div class="flashcard-field">' +
            '<label for="card-prompt-input">Prompt</label>' +
            '<input id="card-prompt-input" type="text" maxlength="160" value="' + escapeHtml(state.editor.prompt) + '" placeholder="Example: What does the mitochondria do?" />' +
            '</div>' +
            '<div class="flashcard-field">' +
            '<label for="card-answer-input">Answer</label>' +
            '<textarea id="card-answer-input" maxlength="320" placeholder="Write the answer you want to study.">' + escapeHtml(state.editor.answer) + '</textarea>' +
            '</div>' +
            '<div class="flashcard-editor-actions">' +
            '<button id="flashcard-add-button" class="flashcard-button flashcard-button--primary" type="button">Add card</button>' +
            '<button id="flashcard-save-button" class="flashcard-button" type="button"' + (selectedIndex < 0 ? ' disabled' : '') + '>Save edits</button>' +
            '<button id="flashcard-new-button" class="flashcard-button" type="button">New blank card</button>' +
            '<button id="flashcard-delete-button" class="flashcard-button" type="button"' + (selectedIndex < 0 ? ' disabled' : '') + '>Delete card</button>' +
            '</div>' +
            '<div class="flashcard-order-actions">' +
            '<button id="flashcard-move-up-button" class="flashcard-button" type="button"' + (selectedIndex <= 0 ? ' disabled' : '') + '>Move up</button>' +
            '<button id="flashcard-move-down-button" class="flashcard-button" type="button"' + (selectedIndex < 0 || selectedIndex >= cards.length - 1 ? ' disabled' : '') + '>Move down</button>' +
            '</div>' +
            '<div class="' + validationClass + '">' + escapeHtml(state.validationMessage || snapshot.resumeHint) + '</div>' +
            '</div>' +
            '</div>' +
            '</section>';

          const studyWorkspace =
            '<section class="flashcard-workspace flashcard-workspace--study">' +
            '<div class="flashcard-panel flashcard-study-panel">' +
            '<div class="flashcard-study-stage">' +
            '<div class="flashcard-study-progress">' +
            '<span class="flashcard-pill">' + escapeHtml(snapshot.studyStatus === 'complete' ? 'Study complete' : 'Study mode') + '</span>' +
            '<span>' + escapeHtml(reviewedCount + ' reviewed') + '</span>' +
            '<span>' + escapeHtml(remainingCount + ' remaining') + '</span>' +
            '</div>' +
            '<div class="flashcard-study-card">' +
            (currentStudyCard
              ? '<div class="flashcard-study-face">' +
                  '<div class="flashcard-study-face-label">Prompt</div>' +
                  '<div class="flashcard-study-prompt">' + escapeHtml(currentStudyCard.prompt) + '</div>' +
                  '<div class="flashcard-study-answer-shell" data-revealed="' + String(Boolean(answerRevealed)) + '">' +
                  '<div class="flashcard-study-face-label">' + escapeHtml(answerRevealed ? 'Answer' : 'Reveal first') + '</div>' +
                  (answerRevealed
                    ? '<p class="flashcard-study-answer">' + escapeHtml(currentStudyCard.answer) + '</p>'
                    : '<p class="flashcard-study-answer-copy">Pause and answer in your head first. Reveal only when you want to check yourself.</p>') +
                  '</div>' +
                '</div>'
              : '<div class="flashcard-empty">Study progress is complete for this round. Return the results to chat or keep editing the deck.</div>') +
            '</div>' +
            '<div class="flashcard-study-actions">' +
            '<button id="flashcard-reveal-button" class="flashcard-button flashcard-button--primary" type="button"' +
            (!currentStudyCard || answerRevealed || snapshot.studyStatus === 'complete' ? ' disabled' : '') +
            '>Reveal answer</button>' +
            '<button id="flashcard-return-editing-button" class="flashcard-button" type="button">Keep editing</button>' +
            '</div>' +
            '<div class="flashcard-confidence-row">' +
            '<button class="flashcard-button flashcard-confidence-button" data-mark-confidence="easy" type="button"' +
            (!currentStudyCard || !answerRevealed || snapshot.studyStatus === 'complete' ? ' disabled' : '') +
            ' data-confidence="easy">Easy</button>' +
            '<button class="flashcard-button flashcard-confidence-button" data-mark-confidence="medium" type="button"' +
            (!currentStudyCard || !answerRevealed || snapshot.studyStatus === 'complete' ? ' disabled' : '') +
            ' data-confidence="medium">Medium</button>' +
            '<button class="flashcard-button flashcard-confidence-button" data-mark-confidence="hard" type="button"' +
            (!currentStudyCard || !answerRevealed || snapshot.studyStatus === 'complete' ? ' disabled' : '') +
            ' data-confidence="hard">Hard</button>' +
            '</div>' +
            '<div class="' + validationClass + '">' + escapeHtml(state.validationMessage || snapshot.resumeHint) + '</div>' +
            '</div>' +
            '</div>' +
            '<div class="flashcard-panel flashcard-study-sidebar">' +
            '<h2>Study signal</h2>' +
            '<p class="flashcard-panel-copy">Confidence stays bounded so later chat can focus on what still needs review.</p>' +
            '<div class="flashcard-study-sidebar-list">' +
            '<div class="flashcard-study-sidebar-item"><strong>Progress</strong><span>' +
            escapeHtml('Card ' + Math.min(snapshot.studyPosition + 1, Math.max(1, snapshot.cardCount)) + ' of ' + snapshot.cardCount) +
            '</span></div>' +
            '<div class="flashcard-study-sidebar-item"><strong>Confidence</strong><span>' +
            escapeHtml(studyCounts.easy + ' easy, ' + studyCounts.medium + ' medium, ' + studyCounts.hard + ' hard') +
            '</span></div>' +
            '<div class="flashcard-study-sidebar-item"><strong>Needs review</strong><span>' +
            escapeHtml(weakPrompts.length > 0 ? weakPrompts.join(' | ') : 'No hard cards flagged yet.') +
            '</span></div>' +
            '</div>' +
            '</div>' +
            '</section>';

          root.innerHTML =
            '<article class="flashcard-shell" data-flashcard-runtime="true">' +
            '<div class="flashcard-stack">' +
            '<section class="flashcard-strip">' +
            '<div>' +
            '<p class="flashcard-eyebrow">Reviewed app bridge launch</p>' +
            '<h1 class="flashcard-title">Flashcard Studio</h1>' +
            '<p class="flashcard-subtitle">' + escapeHtml(subtitle) + '</p>' +
            '</div>' +
            '<div class="flashcard-actions">' +
            (snapshot.mode !== 'study'
              ? '<button id="flashcard-start-study-button" class="flashcard-button" type="button"' + (cards.length === 0 ? ' disabled' : '') + '>Start study mode</button>'
              : '') +
            '<button id="flashcard-complete-button" class="flashcard-button flashcard-button--primary" type="button">' + escapeHtml(completeButtonLabel) + '</button>' +
            '</div>' +
            '</section>' +
            '<section class="flashcard-status-strip">' +
            '<div class="flashcard-meta">' +
            '<span class="flashcard-pill">' + escapeHtml(snapshot.statusText) + '</span>' +
            '<span>' + escapeHtml(snapshot.cardCount + ' cards') + '</span>' +
            '<span>' + escapeHtml(snapshot.deckTitle) + '</span>' +
            '<span>' + escapeHtml(snapshot.mode === 'study' ? 'Study mode' : 'Authoring') + '</span>' +
            '</div>' +
            '<div class="flashcard-meta">' +
            '<span>' + escapeHtml(snapshot.summary) + '</span>' +
            '</div>' +
            '</section>' +
            (snapshot.mode === 'study' ? studyWorkspace : authoringWorkspace) +
            '</div>' +
            '</article>' +
            '<p id="runtime-status-live" class="sr-only" aria-live="polite">' + escapeHtml(state.validationMessage || snapshot.statusText) + '</p>';

          bindControls();
        }

        function sendInitialState() {
          render();
          sendBridgeEvent('app.state', {
            idempotencyKey: 'flashcard-ready-' + currentEnvelope.bridgeSessionId,
            snapshot: state.snapshot,
          });
        }

        syncEditorFromSelection();
        render();

        window.addEventListener('message', (event) => {
          const data = event.data;
          if (!data || data.kind !== 'host.bootstrap' || bridgePort) {
            return;
          }
          if (!event.ports || event.ports.length === 0 || !data.envelope) {
            return;
          }

          currentEnvelope = data.envelope;
          if (currentEnvelope.expectedOrigin !== '*' && event.origin !== currentEnvelope.expectedOrigin) {
            return;
          }

          bridgePort = event.ports[0];
          bridgePort.start && bridgePort.start();
          bridgePort.onmessage = (portEvent) => {
            const message = portEvent.data;
            if (!message || message.kind !== 'host.syncContext') {
              return;
            }
            if (
              message.bridgeSessionId !== currentEnvelope.bridgeSessionId ||
              message.appInstanceId !== currentEnvelope.appInstanceId ||
              !message.snapshot ||
              typeof message.snapshot !== 'object' ||
              Array.isArray(message.snapshot)
            ) {
              return;
            }

            state.snapshot = normalizeIncomingSnapshot(message.snapshot);
            state.validationMessage = '';
            syncEditorFromSelection();
            render();
          };

          bridgePort.postMessage({
            kind: 'app.ready',
            bridgeSessionId: currentEnvelope.bridgeSessionId,
            appInstanceId: currentEnvelope.appInstanceId,
            bridgeToken: currentEnvelope.bridgeToken,
            ackNonce: currentEnvelope.bootstrapNonce,
            sequence: 1,
          });

          queueMicrotask(sendInitialState);
        });

        window.addEventListener('error', (event) => {
          sendBridgeEvent('app.error', {
            idempotencyKey: 'window-error-' + nextSequence,
            error: event.message || 'flashcard studio runtime error',
          });
        });

        window.addEventListener('unhandledrejection', (event) => {
          sendBridgeEvent('app.error', {
            idempotencyKey: 'unhandled-rejection-' + nextSequence,
            error: event.reason instanceof Error ? event.reason.message : String(event.reason),
          });
        });
      })();
    </script>
  </body>
</html>`
}

export function createReviewedAppLaunchRuntimeMarkup(
  launch: ChatBridgeReviewedAppLaunch,
  persistedSnapshot?: unknown
) {
  if (launch.appId === DRAWING_KIT_APP_ID) {
    return createDrawingKitRuntimeMarkup(
      launch,
      createInitialDrawingKitAppSnapshot({
        request: launch.request,
        snapshot: persistedSnapshot,
      })
    )
  }

  if (launch.appId === FLASHCARD_STUDIO_APP_ID) {
    return createFlashcardStudioRuntimeMarkup(
      launch,
      parseFlashcardStudioAppSnapshot(persistedSnapshot) ??
        createInitialFlashcardStudioAppSnapshot({
          request: launch.request,
        })
    )
  }

  return createGenericReviewedAppLaunchRuntimeMarkup(launch)
}
