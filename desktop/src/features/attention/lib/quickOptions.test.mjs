import assert from "node:assert/strict";
import test from "node:test";

import { deriveQuickOptions } from "./quickOptions.ts";

const BACKUPS_ASK =
  "Does the Backups list show any backup dated today, or is the newest one still the 30 July entry?";

test("approve/reject pair only for declared approvals", () => {
  assert.deepEqual(
    deriveQuickOptions("approval", "Approve the staging deploy.", ""),
    ["Approve", "Reject"],
  );
  // Approval-sounding prose without the declared type never gets the pair.
  assert.deepEqual(
    deriveQuickOptions("review", "Approve the staging deploy.", ""),
    [],
  );
});

test("polar questions get yes/no", () => {
  assert.deepEqual(
    deriveQuickOptions("question", "Is the backup scheduled?", ""),
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
  // Polar questions must end with "?".
  assert.deepEqual(
    deriveQuickOptions("question", "Can you ship this today.", ""),
    [],
  );
});

test("regression: a which-of-two question never yields yes/no", () => {
  const options = deriveQuickOptions("question", BACKUPS_ASK, "");
  assert.notDeepEqual(options, ["Yes", "No"]);
  assert.deepEqual(options, [
    "the Backups list show any backup dated today",
    "is the newest one still the 30 July entry",
  ]);
});

test("A-or-B asks become their two alternatives", () => {
  assert.deepEqual(
    deriveQuickOptions(
      "decision",
      "Should we ship Tuesday or wait for QA?",
      "",
    ),
    ["ship Tuesday", "wait for QA"],
  );
});

test("A-or-B outranks yes/no and approval", () => {
  assert.deepEqual(
    deriveQuickOptions("question", "Do we ship now or hold the release?", ""),
    ["ship now", "hold the release"],
  );
  assert.deepEqual(
    deriveQuickOptions("approval", "Approve the deploy or roll it back?", ""),
    ["Approve the deploy", "roll it back"],
  );
});

test("A-or-B requires exactly one or with two short sides", () => {
  const longSide =
    "keep the current onboarding flow exactly as designed in the last review cycle";
  assert.deepEqual(
    deriveQuickOptions("question", `Should we ship now or ${longSide}?`, ""),
    [],
  );
  assert.deepEqual(
    deriveQuickOptions("question", "Tea or coffee or juice?", ""),
    [],
  );
});

test("regression: numbered lists are context, not answers", () => {
  const content = [
    "Decisions pending:",
    "1. Ship now",
    "2. Wait for QA",
    "3. Cancel the launch",
  ].join("\n");
  assert.deepEqual(deriveQuickOptions("headsUp", null, content), []);
  assert.deepEqual(
    deriveQuickOptions("question", "Which option do we take?", content),
    [],
  );
});

test("no rule matching yields no options", () => {
  assert.deepEqual(
    deriveQuickOptions(
      "review",
      "Please review your plan.",
      "Please review your plan.",
    ),
    [],
  );
  assert.deepEqual(deriveQuickOptions("headsUp", null, "hello"), []);
});
