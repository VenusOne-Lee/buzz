import assert from "node:assert/strict";
import test from "node:test";

import { deriveQuickOptions } from "./quickOptions.ts";

test("approval asks get the approve/reject pair", () => {
  assert.deepEqual(
    deriveQuickOptions("approval", "Approve the staging deploy.", ""),
    ["Approve", "Reject"],
  );
});

test("polar questions get yes/no", () => {
  assert.deepEqual(
    deriveQuickOptions("question", "Can you ship this today?", ""),
    ["Yes", "No"],
  );
  assert.deepEqual(
    deriveQuickOptions("question", "did the migration finish?", ""),
    ["Yes", "No"],
  );
  // Word boundary: "Done" is not "Do".
  assert.deepEqual(
    deriveQuickOptions("question", "Done with the review yet?", ""),
    [],
  );
  // Yes/no is scoped to derived questions, not other ask types.
  assert.deepEqual(
    deriveQuickOptions("review", "Could you look at the plan?", ""),
    [],
  );
});

test("A-or-B asks become their two alternatives", () => {
  assert.deepEqual(
    deriveQuickOptions(
      "decision",
      "Should we ship Tuesday or wait for QA?",
      "",
    ),
    ["Should we ship Tuesday", "wait for QA"],
  );
});

test("A-or-B outranks yes/no and approval", () => {
  assert.deepEqual(
    deriveQuickOptions("question", "Do we ship now or hold the release?", ""),
    ["Do we ship now", "hold the release"],
  );
  assert.deepEqual(
    deriveQuickOptions("approval", "Approve the deploy or roll it back?", ""),
    ["Approve the deploy", "roll it back"],
  );
});

test("A-or-B is skipped when either side is too long", () => {
  const longSide =
    "keep the current onboarding flow exactly as designed in the last review cycle";
  assert.deepEqual(
    deriveQuickOptions("question", `Should we ship now or ${longSide}?`, ""),
    ["Yes", "No"],
  );
});

test("numbered lists become their item texts, capped at four", () => {
  const content = [
    "Pick a launch plan:",
    "1. **Ship now**",
    "2. Wait for QA",
    "3) Cancel the [launch](https://example.com)",
    "4. Ship silently",
    "5. Never ship",
  ].join("\n");
  assert.deepEqual(deriveQuickOptions("headsUp", null, content), [
    "Ship now",
    "Wait for QA",
    "Cancel the launch",
    "Ship silently",
  ]);
});

test("numbered list items are capped at 60 characters", () => {
  const long = `1. ${"a".repeat(80)}\n2. short`;
  const options = deriveQuickOptions("headsUp", null, long);
  assert.equal(options.length, 2);
  assert.equal(options[0].length, 60);
});

test("a single numbered line is not a list", () => {
  assert.deepEqual(deriveQuickOptions("headsUp", null, "1. lonely item"), []);
});

test("no rule matching yields no options", () => {
  assert.deepEqual(
    deriveQuickOptions(
      "review",
      "Please review the plan.",
      "Please review the plan.",
    ),
    [],
  );
  assert.deepEqual(deriveQuickOptions("headsUp", null, "hello"), []);
});
