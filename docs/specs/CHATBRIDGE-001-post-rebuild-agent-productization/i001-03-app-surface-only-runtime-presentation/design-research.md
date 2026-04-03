# I001-03 Design Research

## Scope

- Story: I001-03
- Question:
  how should ChatBridge render active app surfaces so users see the app itself
  instead of host-owned framing and explanatory chrome?
- Research mode:
  repo-first only

## Repo Evidence

### Shared inline shell currently wraps every app surface

- `src/renderer/components/chatbridge/ChatBridgeMessagePart.tsx`
  always routes non-anchor inline and tray presentations through
  `ChatBridgeShell`.
- `src/renderer/components/chatbridge/ChatBridgeShell.tsx`
  adds:
  - host title and description block
  - status badge
  - a second "surface card" with host-written `surfaceTitle` and
    `surfaceDescription`
  - fallback and degraded trust-panel chrome

Implication:
even when a real renderable app already exists, the user first sees host copy
about the app before the app.

### Floating runtime tray adds another host-owned header

- `src/renderer/components/chatbridge/FloatingChatBridgeRuntimeShell.tsx`
  adds:
  - "App tray" / "App sheet"
  - app name repeat
  - explanatory copy about why the runtime is pinned
  - source and minimize controls above the app surface

Implication:
the floated runtime gets narrated twice: once by the tray and again by the
shared shell inside it.

### Chess has app-specific host rails inside the app itself

- `src/renderer/components/chatbridge/apps/chess/ChessRuntime.tsx`
  renders a board plus a right rail with:
  - `Latest update`
  - `Selection`
  - `Move ledger`
  - `Host sync`
  - `Latest legal move`
  - `FEN`
  - `Updated at`
  - session-reload persistence copy

Implication:
even if the shared shell is removed, chess still reads as "board plus host
dashboard" instead of "board first."

### Reviewed app surfaces are closer to app-first but still keep host detail blocks

- `src/renderer/components/chatbridge/apps/weather/WeatherDashboardPanel.tsx`
  already renders as a strong dashboard, but still includes:
  - `Host status`
  - `Source`
  - `Saved for follow-up chat`

Implication:
the weather surface is already near the target; it mainly needs subtraction of
host-reporting blocks rather than a redesign.

### Route, refusal, degraded, and fallback artifacts are different

- `src/renderer/components/chatbridge/chatbridge.ts`
  builds explicit host view models for:
  - route clarify/refuse artifacts
  - degraded completions
  - fallback/error states
- These states do not represent a live app surface. They are host receipts,
  recovery, or safety artifacts.

Implication:
they should keep explicit host framing. The subtraction rule should only apply
to real renderable app views.

## Existing Pattern Fit

Chatbox already supports strong self-contained panels inside app content:

- chess board area
- weather dashboard hero card
- story builder writing desk
- debate arena summary panels

That means the repo already has enough surface vocabulary to make the app the
main event without inventing a new design system.

## External Research Requirement

External research was not required.

Reason:

- the change is subtractive, not a new interaction model
- the repo already contains the relevant app surfaces and tokens
- the user direction is explicit: remove surrounding UI and show only the app
  view

## Design Axes

### Axis 1: How much host chrome remains around active app surfaces?

- Option A: none
- Option B: tiny utility controls only
- Option C: reduced card framing with labels

### Axis 2: Where do necessary tray controls live?

- outside the main eye path
- edge-attached and recessive
- never as a headline block

### Axis 3: Which states keep the host shell?

- keep shell:
  route clarify/refuse, degraded, fallback/error, non-renderable states
- remove shell:
  real renderable app surfaces in inline or tray presentation

## Constraints Confirmed By Research

- Do not special-case chess only.
- Do not silently remove degraded or recovery context.
- Keep minimized tray recovery discoverable.
- Preserve operable source/minimize controls for the floating tray.
- Prefer subtraction over replacement; avoid swapping one explanatory header
  for another.
