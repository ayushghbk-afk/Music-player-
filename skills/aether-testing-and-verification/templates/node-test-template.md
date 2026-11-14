# Starter `node:test` Template for Aether

Adapt this pattern when adding a new test file under `tests/<feature>.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

test("describes invariant and expected boundary behavior", async () => {
  // 1. Arrange deterministic inputs (no real network, no arbitrary setTimeout sleeps)
  const sampleRate = 48000;

  // 2. Act on pure service / schema / SSR component
  const actual = sampleRate * 0.45;

  // 3. Assert exact numeric tolerances, rejection of NaN/invalid inputs, and safe defaults
  assert.equal(actual, 21600);
  assert.ok(Number.isFinite(actual));
});
```

Guidelines:
- Import `fake-indexeddb/auto` at the top of the file only when testing `src/services/db.ts` or `androidLibrary.ts`.
- Use `React.createElement` + `renderToStaticMarkup` from `react-dom/server` to verify accessible attributes (`aria-label`, `role`, `disabled`) without requiring a full browser DOM.
