import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAgentRosterPreferences,
  toggleAgentRosterSetMember,
} from "./agentRosterPreferencesStorage.ts";

// ── parseAgentRosterPreferences ─────────────────────────────────────────────

test("parseAgentRosterPreferences: valid payload returns store", () => {
  const result = parseAgentRosterPreferences({
    version: 1,
    pinned: ["a", "b"],
    muted: ["c"],
  });
  assert.deepEqual(result, { version: 1, pinned: ["a", "b"], muted: ["c"] });
});

test("parseAgentRosterPreferences: missing version returns null", () => {
  assert.equal(parseAgentRosterPreferences({ pinned: ["a"], muted: [] }), null);
});

test("parseAgentRosterPreferences: wrong version returns null", () => {
  assert.equal(
    parseAgentRosterPreferences({ version: 2, pinned: [], muted: [] }),
    null,
  );
});

test("parseAgentRosterPreferences: null/non-object input returns null", () => {
  assert.equal(parseAgentRosterPreferences(null), null);
  assert.equal(parseAgentRosterPreferences("string"), null);
  assert.equal(parseAgentRosterPreferences(42), null);
});

test("parseAgentRosterPreferences: non-string entries are filtered out", () => {
  const result = parseAgentRosterPreferences({
    version: 1,
    pinned: ["a", 1, null, "b"],
    muted: [true, "c"],
  });
  assert.deepEqual(result, { version: 1, pinned: ["a", "b"], muted: ["c"] });
});

test("parseAgentRosterPreferences: missing pinned/muted default to empty arrays", () => {
  const result = parseAgentRosterPreferences({ version: 1 });
  assert.deepEqual(result, { version: 1, pinned: [], muted: [] });
});

// ── toggleAgentRosterSetMember ──────────────────────────────────────────────

test("toggleAgentRosterSetMember: adds a value not already present", () => {
  assert.deepEqual(toggleAgentRosterSetMember(["a"], "b", true), ["a", "b"]);
});

test("toggleAgentRosterSetMember: adding an existing value is a no-op", () => {
  assert.deepEqual(toggleAgentRosterSetMember(["a", "b"], "a", true), [
    "a",
    "b",
  ]);
});

test("toggleAgentRosterSetMember: removes a present value", () => {
  assert.deepEqual(toggleAgentRosterSetMember(["a", "b"], "a", false), ["b"]);
});

test("toggleAgentRosterSetMember: removing an absent value is a no-op", () => {
  assert.deepEqual(toggleAgentRosterSetMember(["a"], "z", false), ["a"]);
});
