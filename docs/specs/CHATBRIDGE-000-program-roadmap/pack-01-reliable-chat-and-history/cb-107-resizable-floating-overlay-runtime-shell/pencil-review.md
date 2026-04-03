# CB-107 Pencil Review

## Metadata

- Story ID: CB-107
- Story Title: Resizable floating overlay runtime shell
- Author: Codex
- Date: 2026-04-02

## Spec References

- Design brief:
  `docs/specs/CHATBRIDGE-000-program-roadmap/pack-01-reliable-chat-and-history/cb-107-resizable-floating-overlay-runtime-shell/design-brief.md`
- Feature spec:
  `docs/specs/CHATBRIDGE-000-program-roadmap/pack-01-reliable-chat-and-history/cb-107-resizable-floating-overlay-runtime-shell/feature-spec.md`
- Technical plan:
  `docs/specs/CHATBRIDGE-000-program-roadmap/pack-01-reliable-chat-and-history/cb-107-resizable-floating-overlay-runtime-shell/technical-plan.md`
- Design research:
  `docs/specs/CHATBRIDGE-000-program-roadmap/pack-01-reliable-chat-and-history/cb-107-resizable-floating-overlay-runtime-shell/design-research.md`

## Pencil Prerequisites

- Pencil docs sync attempted: yes
- Sync result: success, via isolated local virtualenv bootstrap for the helper
  script
- `.pen` schema/layout guardrails reviewed: yes
- Pencil running: yes
- Pencil visible in MCP: yes
- Design library file: `design/system/design-system.lib.pen`
- Story design file: `design/stories/CB-107.pen`
- Existing code imported first:
  no automated import; the current renderer/session shell was reviewed directly
  from:
  - `src/renderer/routes/session/$sessionId.tsx`
  - `src/renderer/components/chatbridge/FloatingChatBridgeRuntimeShell.tsx`
  - `src/renderer/components/chatbridge/ChatBridgeMessagePart.tsx`
  - `src/renderer/stores/uiStore.ts`

## Foundation Reuse

- Design-system maturity: working
- Reused design system:
  - existing `CB-106` shell canvas as the structural scaffold
  - Chatbox neutral surfaces and border tokens already present in the file
  - shared button, badge, action-chip, and session-row components
- New story-specific work:
  - reshaped the prior docked/tray concepts into true overlay-focused desktop
    variants
  - preserved the message-anchor and mobile-fallback concepts where relevant

## Variations

### Variation A

- Name: PiP Overlay
- Fidelity level: design-grade
- Copy fidelity: draft
- Summary:
  the strictest translation of the request: a lower-corner picture-in-picture
  overlay floating over the thread, with the source message retained as a
  compact receipt card inside the conversation.
- Strengths:
  - best match to the “YouTube mini-player” mental model
  - makes the overlay obviously separate from layout, not just another dock
  - keeps the app visible without turning the whole session into a workspace UI
- Tradeoffs:
  - gives the least room to app-heavy surfaces like Drawing Kit
- Screenshot reference:
  `docs/specs/CHATBRIDGE-000-program-roadmap/pack-01-reliable-chat-and-history/cb-107-resizable-floating-overlay-runtime-shell/artifacts/pencil/variation-a-pip-overlay.png`

### Variation B

- Name: Workspace Overlay
- Fidelity level: design-grade
- Copy fidelity: draft
- Summary:
  a wider floating overlay panel with a control rail and a broader app viewport,
  intended for runtimes that need more persistent utility chrome while still
  remaining visually on top of the thread.
- Strengths:
  - strongest fit for richer apps like drawing, dashboards, or multi-step tools
  - still clearly an overlay, not a bottom tray
  - leaves room for more host-owned state and control affordances
- Tradeoffs:
  - drifts furthest from the lightweight mini-player metaphor
  - risks feeling like a workstation if the implementation gets too heavy
- Screenshot reference:
  `docs/specs/CHATBRIDGE-000-program-roadmap/pack-01-reliable-chat-and-history/cb-107-resizable-floating-overlay-runtime-shell/artifacts/pencil/variation-b-workspace-overlay.png`

### Variation C

- Name: Minimized First
- Fidelity level: design-grade
- Copy fidelity: draft
- Summary:
  defaults to a compact mini-player chip and treats expansion as an on-demand
  state, while also making the small-screen bottom-sheet fallback more explicit.
- Strengths:
  - lightest visual footprint
  - strongest minimized-state story
  - clearest desktop/mobile split
- Tradeoffs:
  - weakest choice when the user expects the app to be visibly active by
    default
  - too glanceable for app-heavy surfaces or games that need immediate board
    visibility
- Screenshot reference:
  `docs/specs/CHATBRIDGE-000-program-roadmap/pack-01-reliable-chat-and-history/cb-107-resizable-floating-overlay-runtime-shell/artifacts/pencil/variation-c-minimized-first.png`

## Recommendation

- Recommended option: Variation A
- Why:
  it is the cleanest and most direct answer to the new product request. It
  clearly breaks from the old docked-tray pattern, keeps the chat height
  intact, and aligns best with the requested “overlay / mini-player” behavior
  without overbuilding the shell chrome.

## Implementation Notes

- Preferred implementation mode: manual
- Stack constraints to preserve:
  - renderer-level portal overlay, not a native OS window
  - in-thread anchor remains durable history
  - small-screen stays constrained rather than imitating desktop drag behavior
- Primary code surfaces after approval:
  - `src/renderer/routes/session/$sessionId.tsx`
  - `src/renderer/components/chatbridge/FloatingChatBridgeRuntimeShell.tsx`
  - `src/renderer/components/chatbridge/ChatBridgeMessagePart.tsx`
  - `src/renderer/stores/uiStore.ts`

## Approval

- Status: approved
- Approved option: Variation A · PiP Overlay
- Approval date: 2026-04-02
