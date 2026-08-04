import assert from "node:assert/strict";
import test from "node:test";

import { buildSpineProjection, DEFAULT_THREAD_LIMIT } from "./projection.ts";

const NOW = 1_700_000_000;

function makeEvent(overrides = {}) {
  return {
    id: "event-1",
    pubkey: "author-1",
    created_at: NOW - 100,
    kind: 9,
    tags: [],
    content: "Hello there.",
    sig: "",
    ...overrides,
  };
}

function row(eventOverrides = {}, thread = null) {
  return { event: makeEvent(eventOverrides), thread };
}

const THREAD = {
  replyCount: 2,
  descendantCount: 5,
  lastReplyAt: NOW - 50,
  participantPubkeys: ["a", "b"],
};

test("buildSpineProjection composes all lanes for one channel", () => {
  const rows = [
    row(
      {
        id: "root-1",
        created_at: NOW - 300,
        content:
          "Decision: adopt spine\nSee https://github.com/block/buzz/pull/1",
        tags: [["imeta", "url https://cdn.example/pic.png", "m image/png"]],
      },
      THREAD,
    ),
  ];
  const artifactEvents = [
    makeEvent({
      id: "repo-1",
      kind: 30617,
      created_at: NOW - 200,
      tags: [["name", "block/buzz"]],
    }),
  ];
  const projection = buildSpineProjection({
    channelId: "chan-1",
    rows,
    artifactEvents,
    now: NOW,
  });
  assert.equal(projection.channelId, "chan-1");
  assert.equal(projection.markers.length, 1);
  assert.equal(projection.markers[0].class, "decision");
  assert.equal(projection.threads.length, 1);
  assert.equal(projection.threads[0].rootId, "root-1");
  assert.equal(projection.media.length, 1);
  assert.equal(projection.links.length, 1);
  assert.equal(projection.artifacts.length, 1);
  assert.equal(projection.asOf, NOW - 200);
});

test("asOf is the max created_at across rows and artifact events", () => {
  const projection = buildSpineProjection({
    channelId: "chan-2",
    rows: [row({ created_at: 900 }), row({ id: "e2", created_at: 1200 })],
    artifactEvents: [makeEvent({ id: "a1", kind: 1618, created_at: 1100 })],
    now: NOW,
  });
  assert.equal(projection.asOf, 1200);
});

test("asOf is 0 when there is no input at all", () => {
  const projection = buildSpineProjection({
    channelId: "chan-empty",
    rows: [],
    artifactEvents: [],
    now: NOW,
  });
  assert.equal(projection.asOf, 0);
  assert.deepEqual(projection.markers, []);
  assert.deepEqual(projection.threads, []);
  assert.deepEqual(projection.media, []);
  assert.deepEqual(projection.links, []);
  assert.deepEqual(projection.artifacts, []);
});

test("marker-bearing messages appear even without thread stats", () => {
  const projection = buildSpineProjection({
    channelId: "chan-3",
    rows: [row({ id: "solo", content: "Milestone: shipped it" }, null)],
    artifactEvents: [],
    now: NOW,
  });
  assert.equal(projection.markers.length, 1);
  assert.equal(projection.markers[0].eventId, "solo");
  // No 39005 summary means no Threads lane entry — markers are independent.
  assert.deepEqual(projection.threads, []);
});

test("threadLimit caps the threads lane and defaults sensibly", () => {
  const rows = Array.from({ length: DEFAULT_THREAD_LIMIT + 3 }, (_, i) =>
    row(
      { id: `root-${String(i).padStart(2, "0")}`, created_at: NOW - i },
      { ...THREAD, descendantCount: i },
    ),
  );
  const capped = buildSpineProjection({
    channelId: "chan-4",
    rows,
    artifactEvents: [],
    now: NOW,
    threadLimit: 2,
  });
  assert.equal(capped.threads.length, 2);
  const defaulted = buildSpineProjection({
    channelId: "chan-4",
    rows,
    artifactEvents: [],
    now: NOW,
  });
  assert.equal(defaulted.threads.length, DEFAULT_THREAD_LIMIT);
});
