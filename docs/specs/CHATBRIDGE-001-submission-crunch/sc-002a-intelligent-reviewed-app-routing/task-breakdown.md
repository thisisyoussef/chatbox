# SC-002A Task Breakdown

1. Extend the shared routing contract to accept semantic hints and emit a
   semantic invoke reason code.
2. Add a model-assisted semantic classifier with timeout, JSON parsing, and
   catalog validation.
3. Wire the classifier into the execution governor without breaking the lexical
   fast path.
4. Extend trace payloads so semantic attempts and lexical fallbacks are visible.
5. Add regression tests for semantic routing and fallback behavior.
6. Add a seeded `Intelligent routing` session for production inspection.
