# CB-512 Design Research

## Repo Findings

### Current surface evidence

- `src/renderer/packages/chatbridge/bridge/reviewed-app-runtime.ts`
  currently renders Drawing Kit with:
  a large title stack,
  a prompt card,
  a top tool row,
  and a right-side support rail for bank plus chat handoff.
- The board is already the core interaction surface, but it competes with
  stacked helper blocks and a secondary reading column.

### Adjacent UI evidence

- `docs/specs/CHATBRIDGE-001-post-rebuild-agent-productization/i001-03-app-surface-only-runtime-presentation/`
  establishes the repo direction for real app surfaces:
  remove wrapper chrome before inventing replacement chrome.
- Other ChatBridge work already treats visible surfaces as the primary object
  once an app is open; this supports a subtraction-first approach for Drawing
  Kit.

### Continuity evidence

- `src/renderer/packages/chatbridge/reviewed-app-launch.ts`
  already stores app-linked screenshots.
- `src/shared/chatbridge/apps/drawing-kit.ts`
  already computes bounded summaries and preview marks.
- `src/renderer/packages/model-calls/message-utils.ts`
  already attaches app screenshots to model messages when available.
- This means the new visual grounding path should extend current continuity
  seams rather than invent a separate media subsystem.

## External Findings

No external design research was required for the UI direction itself because:

- the user’s request is explicit about the desired posture
- the repo already has an established subtraction-first app-surface direction
- the main challenge is fitting the requested layout into the existing
  ChatBridge reviewed-app runtime

If implementation requires a new model/API path for image-to-text beyond the
repo’s current OCR/vision seam, official API research will be added before
coding that portion.

## Design Implications

- The right-side support rail should be removed rather than compressed.
- Prompt, status, and actions should be reorganized into one compact top band
  or small board-adjacent chips.
- The board should remain visually dominant at both inline and constrained
  widths.
- The UI should preserve current actions, but the visual emphasis should shift
  from "explain the round" to "draw the round."

## Risks

- Over-simplifying the header could hide the prompt or make bank/handoff too
  easy to miss.
- Over-stylizing the top controls could reduce scannability or keyboard
  discoverability.
- If runtime screenshots are captured too often, the underlying continuity
  improvement could hurt interaction performance even if the UI looks cleaner.
