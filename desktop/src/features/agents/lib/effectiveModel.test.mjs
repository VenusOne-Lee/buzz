import assert from "node:assert/strict";
import test from "node:test";

import { resolveEffectiveModelLabel } from "./effectiveModel.ts";

test("resolveEffectiveModelLabel: returns the explicit model when set", () => {
  assert.equal(
    resolveEffectiveModelLabel({ model: "claude-opus-4" }),
    "claude-opus-4",
  );
});

test("resolveEffectiveModelLabel: falls back to Auto when null", () => {
  assert.equal(resolveEffectiveModelLabel({ model: null }), "Auto");
});

test("resolveEffectiveModelLabel: falls back to Auto when blank/whitespace", () => {
  assert.equal(resolveEffectiveModelLabel({ model: "" }), "Auto");
  assert.equal(resolveEffectiveModelLabel({ model: "   " }), "Auto");
});

test("resolveEffectiveModelLabel: trims surrounding whitespace", () => {
  assert.equal(
    resolveEffectiveModelLabel({ model: "  claude-sonnet-4  " }),
    "claude-sonnet-4",
  );
});
