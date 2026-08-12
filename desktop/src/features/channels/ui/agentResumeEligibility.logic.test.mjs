import assert from "node:assert/strict";
import test from "node:test";

import {
  isResumeEligible,
  shouldClearStopRecord,
} from "./agentResumeEligibility.logic.ts";

const BASE = {
  isWorking: false,
  canInterruptTurn: true,
  stoppedAt: 1_000,
  latestActivityAt: null,
};

test("isResumeEligible is true once a Stop has landed and the turn is idle", () => {
  assert.equal(isResumeEligible(BASE), true);
});

test("isResumeEligible is false while the turn is still working", () => {
  assert.equal(isResumeEligible({ ...BASE, isWorking: true }), false);
});

test("isResumeEligible is false when control frames cannot reach this agent", () => {
  assert.equal(isResumeEligible({ ...BASE, canInterruptTurn: false }), false);
});

test("isResumeEligible is false when Stop was never sent for this session", () => {
  assert.equal(isResumeEligible({ ...BASE, stoppedAt: null }), false);
});

test("isResumeEligible is false once newer activity supersedes the Stop", () => {
  assert.equal(
    isResumeEligible({ ...BASE, latestActivityAt: BASE.stoppedAt + 1 }),
    false,
    "activity after the stop means the session already moved on",
  );
});

test("isResumeEligible tolerates activity at or before the stop timestamp", () => {
  assert.equal(
    isResumeEligible({ ...BASE, latestActivityAt: BASE.stoppedAt }),
    true,
  );
  assert.equal(
    isResumeEligible({ ...BASE, latestActivityAt: BASE.stoppedAt - 1 }),
    true,
  );
});

test("isResumeEligible never fires for a different session's stop signal", () => {
  // Two sessions, only one interrupted: the other's absent stoppedAt keeps
  // it ineligible even though a Stop landed elsewhere at the same instant.
  const otherSession = { ...BASE, stoppedAt: null };
  assert.equal(isResumeEligible(otherSession), false);
});

test("shouldClearStopRecord fires once the session goes live again", () => {
  assert.equal(
    shouldClearStopRecord({ isWorking: true, stoppedAt: 1_000 }),
    true,
  );
});

test("shouldClearStopRecord is a no-op with nothing recorded or still idle", () => {
  assert.equal(
    shouldClearStopRecord({ isWorking: false, stoppedAt: 1_000 }),
    false,
  );
  assert.equal(
    shouldClearStopRecord({ isWorking: true, stoppedAt: null }),
    false,
  );
  assert.equal(
    shouldClearStopRecord({ isWorking: false, stoppedAt: null }),
    false,
  );
});
