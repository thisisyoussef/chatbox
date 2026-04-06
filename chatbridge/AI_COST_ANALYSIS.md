# ChatBridge AI Cost Analysis

Pricing sources in this document were checked on April 5, 2026.

## Scope

This packet separates:

- actual reproducible development and testing spend for the checked-in
  submission proof
- modeled production projections for live user traffic

That split is intentional. The checked-in ChatBridge proof is heavily
fixture-backed, so the reproducible test harness does not incur the same costs
as a live hosted classroom deployment.

## Development & Testing Costs

### Actual reproducible spend for the checked-in proof

The tracked cost for the reproducible submission harness is:

- LLM API costs: `$0.00`
- Input tokens consumed: `0`
- Output tokens consumed: `0`
- Live API calls made: `0`
- Embeddings or vector-search spend: `$0.00`
- Other AI-related costs inside the checked-in proof harness: `$0.00`

Why this is true in this repo:

- ChatBridge integration tests run through mocked renderer and host seams in
  [../test/integration/chatbridge/setup.ts](../test/integration/chatbridge/setup.ts)
  instead of live provider calls.
- LangSmith defaults to a noop sink unless tracing is explicitly enabled, as
  documented in
  [EVALS_AND_OBSERVABILITY.md](./EVALS_AND_OBSERVABILITY.md).
- Reviewer-facing seeded sessions are pre-authored host state from
  [../src/shared/chatbridge/live-seeds.ts](../src/shared/chatbridge/live-seeds.ts),
  not live LLM generations.

### Important caveat

The repo does **not** centrally meter private ad hoc development usage outside
the checked-in harness, such as personal experimentation with external model
UIs or one-off live smoke runs against private keys. Rather than fabricate a
number, this packet reports the actual cost required to reproduce and validate
the checked-in submission proof, then models live production cost separately.

## Reference Pricing Profiles

The production projections use one primary baseline plus two comparison
profiles:

| Profile | Input / 1M tokens | Output / 1M tokens | Source |
| --- | ---: | ---: | --- |
| OpenAI GPT-5.4 mini | $0.75 | $4.50 | [OpenAI API pricing](https://openai.com/api/pricing/) |
| Anthropic Claude Haiku 3.5 | $0.80 | $4.00 | [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Google Gemini 2.5 Flash-Lite | $0.10 | $0.40 | [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) |

Why these three:

- GPT-5.4 mini is the primary projection profile because it represents a
  current high-quality mini reasoning model suitable for host-owned routing and
  follow-up chat.
- Claude Haiku 3.5 is a comparable low-latency tool-use profile.
- Gemini 2.5 Flash-Lite is the low-cost scale floor.

The local model snapshot in
[../src/shared/model-registry/snapshot.generated.ts](../src/shared/model-registry/snapshot.generated.ts)
already mirrors the Claude Haiku 3.5 and Gemini 2.5 Flash-Lite prices used
below.

## Monthly Workload Assumptions Per Active User

These assumptions are stored in
[examples/ai-cost-analysis.reference.json](./examples/ai-cost-analysis.reference.json)
so the packet and tests can share one calculation source.

| Session type | Sessions / user / month | Input tokens / session | Output tokens / session | Monthly input | Monthly output |
| --- | ---: | ---: | ---: | ---: | ---: |
| Route-only clarify or refusal | 10 | 1,200 | 250 | 12,000 | 2,500 |
| Drawing Kit follow-up round | 4 | 2,400 | 550 | 9,600 | 2,200 |
| Chess coaching round | 4 | 3,500 | 900 | 14,000 | 3,600 |
| Flashcard study round | 8 | 2,800 | 700 | 22,400 | 5,600 |
| Flashcard Drive resume/save round | 4 | 1,800 | 350 | 7,200 | 1,400 |
| **Total** | **30** | — | — | **65,200** | **15,300** |

Assumption notes:

- Token budgets already include routing and tool-schema overhead, bounded
  host-owned summaries, and one normal assistant reply for each round.
- The current submission does not require embeddings, retrieval indexes, or
  paid built-in web search, so those costs are excluded from the baseline.
- Google Drive save/load is treated as standard application traffic, not an
  AI-token cost driver.

## Production Cost Projections

### Primary baseline: GPT-5.4 mini

At the workload above, one active user month is approximately:

- Input cost: `65,200 * $0.75 / 1,000,000 = $0.0489`
- Output cost: `15,300 * $4.50 / 1,000,000 = $0.06885`
- Total: `$0.11775` per active user per month

Monthly cost at different scales:

| Users | Monthly cost |
| --- | ---: |
| 100 | $11.77 |
| 1,000 | $117.75 |
| 10,000 | $1,177.50 |
| 100,000 | $11,775.00 |

### Sensitivity check

Using the same workload with two alternate provider profiles:

| Profile | 100 users | 1,000 users | 10,000 users | 100,000 users |
| --- | ---: | ---: | ---: | ---: |
| OpenAI GPT-5.4 mini | $11.77 | $117.75 | $1,177.50 | $11,775.00 |
| Anthropic Claude Haiku 3.5 | $11.34 | $113.36 | $1,133.60 | $11,336.00 |
| Google Gemini 2.5 Flash-Lite | $1.26 | $12.64 | $126.40 | $1,264.00 |

## Exclusions

This packet intentionally excludes fixed non-token platform costs such as:

- Vercel hosting
- Google OAuth project overhead
- ordinary REST traffic to Google Drive
- LangSmith observability subscription costs
- employee or contractor engineering time

Those costs matter operationally, but the spec section is specifically about AI
costs. The tables here isolate the variable model spend.

## Risks And Update Guidance

- If the host starts using paid web search, code execution, or retrieval-heavy
  model tools, per-session cost rises beyond this baseline.
- If Flashcard Studio expands into richer generation flows, output-token cost
  will dominate faster than input-token cost.
- If the review demo begins depending on live multimodal inference instead of
  seeded fixtures, the reproducible development/test spend section must stop
  reporting zero.

To refresh this packet:

1. Re-check provider pricing from the official links above.
2. Update
   [examples/ai-cost-analysis.reference.json](./examples/ai-cost-analysis.reference.json).
3. Refresh this Markdown packet and keep
   [SUBMISSION.md](./SUBMISSION.md) linked to it.
