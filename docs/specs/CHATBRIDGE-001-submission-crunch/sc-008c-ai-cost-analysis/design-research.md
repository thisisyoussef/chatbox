# SC-008C Design Research

## Local findings

- The reproducible ChatBridge proof is mock-heavy and fixture-backed:
  `test/integration/chatbridge/setup.ts`,
  `src/shared/chatbridge/live-seeds.ts`
- LangSmith tracing defaults to a noop sink unless explicitly enabled:
  `chatbridge/EVALS_AND_OBSERVABILITY.md`
- `src/shared/model-registry/snapshot.generated.ts` already carries normalized
  per-1M-token prices for several current models, including Gemini 2.5
  Flash-Lite and Claude Haiku 3.5.

## External findings

- OpenAI official pricing page lists GPT-5.4 mini at `$0.75 / 1M` input and
  `$4.50 / 1M` output:
  https://openai.com/api/pricing/
- Anthropic official pricing page lists Claude Haiku 3.5 at `$0.80 / MTok`
  input and `$4 / MTok` output:
  https://platform.claude.com/docs/en/about-claude/pricing
- Google official pricing page lists Gemini 2.5 Flash-Lite at `$0.10 / 1M`
  input and `$0.40 / 1M` output:
  https://ai.google.dev/gemini-api/docs/pricing

## Implications

- The submission packet can show one premium-mini baseline and one low-cost
  sensitivity band without inventing unpublished pricing.
- The “actual spend” section must be framed as the reproducible harness spend,
  not as an unverifiable total of every private development experiment.
