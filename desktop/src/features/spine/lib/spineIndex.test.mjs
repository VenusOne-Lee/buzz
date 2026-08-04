import assert from "node:assert/strict";
import test from "node:test";

import { SPINE_INDEX_KIND, spineIndexDTag } from "../types.ts";
import {
  latestIndexPerChannel,
  mergeWorkspaceLog,
  parseSpineIndexEvent,
  serializeSpineIndex,
} from "./spineIndex.ts";

const CHANNEL_A = "11111111-1111-4111-8111-111111111111";
const CHANNEL_B = "22222222-2222-4222-8222-222222222222";

function threadEntry(overrides = {}) {
  return {
    rootId: "root-1",
    class: "thread",
    title: "Relay retention change",
    resolution: null,
    participantPubkeys: ["a".repeat(64)],
    lastReplyAt: 1700000100,
    descendantCount: 4,
    reactionCount: 2,
    ...overrides,
  };
}

function payload(overrides = {}) {
  return {
    version: 1,
    channelId: CHANNEL_A,
    emittedAt: 1700000200,
    threads: [
      threadEntry(),
      threadEntry({
        rootId: "root-2",
        class: "decision",
        title: "Ship now",
        resolution: "Shipped.",
        lastReplyAt: null,
      }),
    ],
    media: [
      {
        eventId: "m1",
        threadRootId: "root-1",
        url: "https://relay.example/media/1.png",
        mimeType: "image/png",
        thumbUrl: null,
        blurhash: null,
        dim: "640x480",
        filename: "shot.png",
        authorPubkey: "a".repeat(64),
        createdAt: 1700000050,
      },
    ],
    links: [
      {
        eventId: "l1",
        threadRootId: "root-1",
        url: "https://github.com/block/buzz/pull/1",
        previewKind: "github-pr",
        authorPubkey: "b".repeat(64),
        createdAt: 1700000060,
      },
    ],
    artifacts: [
      {
        eventId: "g1",
        kind: 30617,
        artifactType: "repo",
        name: "buzz",
        webUrl: null,
        authorPubkey: "c".repeat(64),
        createdAt: 1700000070,
      },
    ],
    ...overrides,
  };
}

function eventFor(p, overrides = {}) {
  const { content, tags } = serializeSpineIndex(p);
  return {
    id: "e".repeat(64),
    pubkey: "f".repeat(64),
    created_at: p.emittedAt,
    kind: SPINE_INDEX_KIND,
    tags,
    content,
    sig: "",
    ...overrides,
  };
}

test("serialize/parse round-trips a full payload", () => {
  const p = payload();
  const parsed = parseSpineIndexEvent(eventFor(p));
  assert.deepEqual(parsed, p);
});

test("serializeSpineIndex emits the d/h/client tags", () => {
  const { tags } = serializeSpineIndex(payload());
  assert.deepEqual(tags, [
    ["d", spineIndexDTag(CHANNEL_A)],
    ["h", CHANNEL_A],
    ["client", "spine-emitter"],
  ]);
});

test("rejects events with the wrong kind", () => {
  assert.equal(parseSpineIndexEvent(eventFor(payload(), { kind: 9 })), null);
});

test("rejects a missing or mismatched d tag", () => {
  const p = payload();
  assert.equal(parseSpineIndexEvent(eventFor(p, { tags: [] })), null);
  assert.equal(
    parseSpineIndexEvent(
      eventFor(p, {
        tags: [
          ["d", spineIndexDTag(CHANNEL_B)],
          ["h", CHANNEL_A],
        ],
      }),
    ),
    null,
  );
});

test("rejects invalid JSON content without throwing", () => {
  assert.equal(
    parseSpineIndexEvent(eventFor(payload(), { content: "{not json" })),
    null,
  );
});

test("rejects wrong version and structural mismatches", () => {
  const wrongVersion = payload({ version: 2 });
  assert.equal(
    parseSpineIndexEvent(
      eventFor(wrongVersion, {
        tags: serializeSpineIndex(payload()).tags,
      }),
    ),
    null,
  );
  // Non-array threads.
  assert.equal(parseSpineIndexEvent(eventFor(payload({ threads: {} }))), null);
  // Thread entry with a bad class.
  assert.equal(
    parseSpineIndexEvent(
      eventFor(payload({ threads: [threadEntry({ class: "vibes" })] })),
    ),
    null,
  );
  // Thread entry with a non-numeric count.
  assert.equal(
    parseSpineIndexEvent(
      eventFor(payload({ threads: [threadEntry({ descendantCount: "4" })] })),
    ),
    null,
  );
  // Non-object content (valid JSON, wrong shape).
  assert.equal(
    parseSpineIndexEvent(eventFor(payload(), { content: '"hello"' })),
    null,
  );
});

test("mergeWorkspaceLog sorts lastReplyAt desc, nulls last, ties by (channelId, rootId)", () => {
  const a = payload({
    channelId: CHANNEL_B,
    threads: [
      threadEntry({ rootId: "b-old", lastReplyAt: 100 }),
      threadEntry({ rootId: "b-null", lastReplyAt: null }),
      threadEntry({ rootId: "tie", lastReplyAt: 500 }),
    ],
  });
  const b = payload({
    channelId: CHANNEL_A,
    threads: [
      threadEntry({ rootId: "a-new", lastReplyAt: 900 }),
      threadEntry({ rootId: "tie", lastReplyAt: 500 }),
      threadEntry({ rootId: "a-null", lastReplyAt: null }),
    ],
  });
  const merged = mergeWorkspaceLog([a, b]);
  assert.deepEqual(
    merged.map((e) => [e.channelId, e.rootId]),
    [
      [CHANNEL_A, "a-new"],
      [CHANNEL_A, "tie"],
      [CHANNEL_B, "tie"],
      [CHANNEL_B, "b-old"],
      [CHANNEL_A, "a-null"],
      [CHANNEL_B, "b-null"],
    ],
  );
});

test("latestIndexPerChannel keeps the newest created_at per channel", () => {
  const older = payload({ emittedAt: 1000, threads: [] });
  const newer = payload({ emittedAt: 2000 });
  const other = payload({ channelId: CHANNEL_B, emittedAt: 1500 });
  // Deliver newest first, then a stale copy — the stale one must not win.
  const map = latestIndexPerChannel([
    eventFor(newer),
    eventFor(older),
    eventFor(other),
  ]);
  assert.equal(map.size, 2);
  assert.equal(map.get(CHANNEL_A).emittedAt, 2000);
  assert.equal(map.get(CHANNEL_B).emittedAt, 1500);
});

test("latestIndexPerChannel skips invalid events entirely", () => {
  const valid = payload({ emittedAt: 1000 });
  const map = latestIndexPerChannel([
    eventFor(valid),
    eventFor(payload({ emittedAt: 3000 }), { kind: 1 }),
    eventFor(payload({ emittedAt: 3000, version: 9 })),
  ]);
  assert.equal(map.get(CHANNEL_A).emittedAt, 1000);
});
