import assert from "node:assert/strict";
import test from "node:test";

import { shouldStartManagedAgentForMention } from "./useMentionSendFlow.helpers.ts";

// ---------------------------------------------------------------------------
// shouldStartManagedAgentForMention — client_only_mode routing
//
// completeSend() treats any error from ensureManagedAgentMentionsReady as
// fatal and aborts the send before the relay publish. Under client_only_mode
// the backend refuses every local spawn (client_only_mode.rs), so the send
// flow must never attempt one — these tests pin that this function always
// returns false when client_only_mode is on, regardless of agent state.
// ---------------------------------------------------------------------------

function localAgent(status) {
  return { status, backend: { type: "local" } };
}

function providerAgent(status) {
  return { status, backend: { type: "provider", id: "p", config: {} } };
}

test("client_only_mode on: never starts a stopped local agent", () => {
  assert.equal(
    shouldStartManagedAgentForMention(localAgent("stopped"), true),
    false,
  );
});

test("client_only_mode on: never starts a not_deployed provider agent", () => {
  assert.equal(
    shouldStartManagedAgentForMention(providerAgent("not_deployed"), true),
    false,
  );
});

test("client_only_mode off: starts a stopped local agent", () => {
  assert.equal(
    shouldStartManagedAgentForMention(localAgent("stopped"), false),
    true,
  );
});

test("client_only_mode off: does not restart an already-running local agent", () => {
  assert.equal(
    shouldStartManagedAgentForMention(localAgent("running"), false),
    false,
  );
});

test("client_only_mode off: deploys a not_deployed provider agent", () => {
  assert.equal(
    shouldStartManagedAgentForMention(providerAgent("not_deployed"), false),
    true,
  );
});

test("client_only_mode off: does not redeploy an already-deployed provider agent", () => {
  assert.equal(
    shouldStartManagedAgentForMention(providerAgent("deployed"), false),
    false,
  );
});
