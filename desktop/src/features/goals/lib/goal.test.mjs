import assert from "node:assert/strict";
import test from "node:test";

import { buildGoalProjection, parseGoalDeclaration } from "./goal.ts";

function makeEvent(overrides = {}) {
  return {
    id: "event-1",
    pubkey: "author-1",
    created_at: 1_700_000_000,
    kind: 9,
    tags: [],
    content: "",
    sig: "",
    ...overrides,
  };
}

test("parseGoalDeclaration returns null when the root has no Goal: marker", () => {
  const root = makeEvent({ content: "Just a normal thread root." });
  assert.equal(parseGoalDeclaration(root), null);
});

test("parseGoalDeclaration returns the Goal: marker text, trimmed", () => {
  const root = makeEvent({ content: "Goal:   ship the goals panel   " });
  assert.deepEqual(parseGoalDeclaration(root), {
    outcome: "ship the goals panel",
  });
});

test("buildGoalProjection returns null for a thread with no Goal: marker", () => {
  const root = makeEvent({ id: "root-1", content: "Just chatting." });
  const projection = buildGoalProjection({
    threadRootId: "root-1",
    rootEvent: root,
    replies: [],
    now: 1_700_000_100,
  });
  assert.equal(projection, null);
});

test("buildGoalProjection: declared root, no replies -> open state, empty ledgers", () => {
  const root = makeEvent({
    id: "root-2",
    content: "Goal: ship the goals panel",
    created_at: 200,
  });
  const projection = buildGoalProjection({
    threadRootId: "root-2",
    rootEvent: root,
    replies: [],
    now: 300,
  });
  assert.deepEqual(projection, {
    threadRootId: "root-2",
    outcome: "ship the goals panel",
    state: "open",
    asOf: 200,
    decisions: [],
    questions: [],
    blockers: [],
  });
});

test("buildGoalProjection: replies populate decisions/questions/blockers with threadRootId equal to the passed-in root", () => {
  const root = makeEvent({
    id: "root-3",
    content: "Goal: launch the beta",
    created_at: 100,
  });
  const replies = [
    makeEvent({
      id: "reply-decision",
      pubkey: "pk-decision",
      created_at: 110,
      content: "Decision: go with plan A",
    }),
    makeEvent({
      id: "reply-question",
      pubkey: "pk-question",
      created_at: 120,
      content: "Question: who owns rollout?",
    }),
    makeEvent({
      id: "reply-blocker",
      pubkey: "pk-blocker",
      created_at: 130,
      content: "Blocker: waiting on infra",
    }),
  ];
  const projection = buildGoalProjection({
    threadRootId: "root-3",
    rootEvent: root,
    replies,
    now: 200,
  });

  assert.deepEqual(projection.decisions, [
    {
      class: "decision",
      text: "go with plan A",
      eventId: "reply-decision",
      authorPubkey: "pk-decision",
      createdAt: 110,
      threadRootId: "root-3",
    },
  ]);
  assert.deepEqual(projection.questions, [
    {
      class: "question",
      text: "who owns rollout?",
      eventId: "reply-question",
      authorPubkey: "pk-question",
      createdAt: 120,
      threadRootId: "root-3",
    },
  ]);
  assert.deepEqual(projection.blockers, [
    {
      class: "blocker",
      text: "waiting on infra",
      eventId: "reply-blocker",
      authorPubkey: "pk-blocker",
      createdAt: 130,
      threadRootId: "root-3",
    },
  ]);
  assert.equal(projection.asOf, 130);
});

test("buildGoalProjection: a Blocker: marker with no Resolved: -> state blocked", () => {
  const root = makeEvent({
    id: "root-4",
    content: "Goal: launch the beta",
    created_at: 100,
  });
  const replies = [
    makeEvent({
      id: "reply-blocker",
      created_at: 110,
      content: "Blocker: waiting on infra",
    }),
  ];
  const projection = buildGoalProjection({
    threadRootId: "root-4",
    rootEvent: root,
    replies,
    now: 200,
  });
  assert.equal(projection.state, "blocked");
});

test("buildGoalProjection: a Resolved: marker -> state done, even alongside a Blocker: marker", () => {
  const root = makeEvent({
    id: "root-5",
    content: "Goal: launch the beta",
    created_at: 100,
  });
  const replies = [
    makeEvent({
      id: "reply-blocker",
      created_at: 110,
      content: "Blocker: waiting on infra",
    }),
    makeEvent({
      id: "reply-resolved",
      created_at: 120,
      content: "Resolved: infra unblocked, shipped",
    }),
  ];
  const projection = buildGoalProjection({
    threadRootId: "root-5",
    rootEvent: root,
    replies,
    now: 200,
  });
  assert.equal(projection.state, "done");
});

test("buildGoalProjection: Resolved: marker on the root itself also flips state to done", () => {
  const root = makeEvent({
    id: "root-6",
    content:
      "Goal: launch the beta\nResolved: already done at declaration time",
    created_at: 100,
  });
  const projection = buildGoalProjection({
    threadRootId: "root-6",
    rootEvent: root,
    replies: [],
    now: 200,
  });
  assert.equal(projection.state, "done");
});

test("buildGoalProjection: markers inside a fenced code block never count", () => {
  const root = makeEvent({
    id: "root-7",
    content: "Goal: launch the beta",
    created_at: 100,
  });
  const replies = [
    makeEvent({
      id: "reply-fenced",
      created_at: 110,
      content: ["```", "Decision: this is code, not a marker", "```"].join(
        "\n",
      ),
    }),
  ];
  const projection = buildGoalProjection({
    threadRootId: "root-7",
    rootEvent: root,
    replies,
    now: 200,
  });
  assert.deepEqual(projection.decisions, []);
  assert.equal(projection.state, "open");
});
