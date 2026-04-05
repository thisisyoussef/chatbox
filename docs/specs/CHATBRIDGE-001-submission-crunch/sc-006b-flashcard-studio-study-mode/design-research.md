# SC-006B Design Research

## Repo Findings

- `SC-006A` already established the right Flashcard Studio visual language:
  warm paper surfaces, a strong status strip, and explicit button-driven
  controls instead of gesture-heavy interactions.
- The reviewed runtime generator in
  `src/renderer/packages/chatbridge/bridge/reviewed-app-runtime.ts` is the
  correct surface to extend because it already owns bootstrap, persistence, and
  completion behavior.
- Drawing Kit proves the runtime can support richer mode-specific controls and
  completion without leaving the reviewed app container.

## External Findings

- Retrieval Practice guidance recommends pairing retrieval with feedback, which
  supports a study loop that reveals the answer and then asks the learner to
  reflect on how it went rather than just flipping cards passively.
  Source: <https://www.retrievalpractice.org/strategies/2018/5/25/feedback>
- Retrieval Practice metacognition guidance explains that confidence judgments
  are useful because they guide what a learner should study next, which supports
  capturing simple confidence buckets (`easy`, `medium`, `hard`) in host-owned
  state.
  Source: <https://pdf.retrievalpractice.org/MetacognitionGuide.pdf>

## Implications

- The runtime should enforce `reveal -> confidence mark -> next card` as the
  basic cadence.
- Confidence UI should be lightweight and non-judgmental, with language that
  signals self-reflection rather than grading.
- The completion summary should emphasize counts and weak prompts, because those
  are the pieces that help later chat continue the study conversation.
