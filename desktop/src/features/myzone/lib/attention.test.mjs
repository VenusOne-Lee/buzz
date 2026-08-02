import assert from "node:assert/strict";
import test from "node:test";

import {
  attentionReason,
  DONE_RETENTION_SECONDS,
  isAttentionWorthy,
  projectAttention,
  pruneZoneState,
} from "./attention.ts";

const NOW = 1_700_000_000;

function makeInboxItem(overrides = {}) {
  const {
    conversationId = "conv-1",
    categories = ["mention"],
    isActionRequired = false,
    latestActivityAt = NOW - 600,
    kind = 9,
    groupItems,
    tags = [],
  } = overrides;
  const item = {
    id: `${conversationId}-latest`,
    kind,
    pubkey: "a".repeat(64),
    content: "hello",
    createdAt: latestActivityAt,
    channelId: "channel-1",
    channelName: "general",
    tags,
    category: categories[0] ?? "mention",
  };
  return {
    avatarUrl: null,
    conversationId,
    id: item.id,
    item,
    categories,
    categoryLabel: "Mention",
    channelLabel: "general",
    fullTimestampLabel: "",
    groupItems: groupItems ?? [item],
    isActionRequired,
    latestActivityAt,
    mentionNames: [],
    preview: "hello",
    senderLabel: "Alice",
    subject: "hello",
    timestampLabel: "",
    unreadCount: 1,
  };
}

test("mention and needs_action items are attention-worthy, plain activity is not", () => {
  assert.equal(
    isAttentionWorthy(makeInboxItem({ categories: ["mention"] })),
    true,
  );
  assert.equal(
    isAttentionWorthy(
      makeInboxItem({ categories: ["needs_action"], isActionRequired: true }),
    ),
    true,
  );
  assert.equal(
    isAttentionWorthy(makeInboxItem({ categories: ["activity"] })),
    false,
  );
  assert.equal(
    isAttentionWorthy(makeInboxItem({ categories: ["agent_activity"] })),
    false,
  );
});

test("items with no zone entry land in Needs Me", () => {
  const projection = projectAttention([makeInboxItem()], {}, NOW);
  assert.equal(projection.needsMe.length, 1);
  assert.equal(projection.waiting.length, 0);
  assert.equal(projection.done.length, 0);
  assert.equal(projection.needsMe[0].zone, "needsMe");
  assert.equal(projection.needsMe[0].reactivated, false);
});

test("plain activity items are excluded from every view", () => {
  const projection = projectAttention(
    [makeInboxItem({ categories: ["activity"] })],
    {},
    NOW,
  );
  assert.equal(projection.needsMe.length, 0);
  assert.equal(projection.waiting.length, 0);
  assert.equal(projection.done.length, 0);
});

test("a parked waiting item stays in Waiting while activity is older than the park", () => {
  const item = makeInboxItem({ latestActivityAt: NOW - 3_600 });
  const projection = projectAttention(
    [item],
    { "conv-1": { zone: "waiting", changedAt: NOW - 60 } },
    NOW,
  );
  assert.equal(projection.waiting.length, 1);
  assert.equal(projection.needsMe.length, 0);
  assert.equal(projection.waiting[0].zoneChangedAt, NOW - 60);
});

test("new activity after parking reactivates the item into Needs Me", () => {
  const item = makeInboxItem({ latestActivityAt: NOW - 10 });
  for (const zone of ["waiting", "done"]) {
    const projection = projectAttention(
      [item],
      { "conv-1": { zone, changedAt: NOW - 3_600 } },
      NOW,
    );
    assert.equal(projection.needsMe.length, 1, `${zone} should reactivate`);
    assert.equal(projection.needsMe[0].reactivated, true);
    assert.equal(projection.waiting.length, 0);
    assert.equal(projection.done.length, 0);
  }
});

test("done items show in Done until retention expires, then disappear", () => {
  const item = makeInboxItem({ latestActivityAt: NOW - 100_000 });
  const fresh = projectAttention(
    [item],
    { "conv-1": { zone: "done", changedAt: NOW - 3_600 } },
    NOW,
  );
  assert.equal(fresh.done.length, 1);

  const staleItem = makeInboxItem({
    latestActivityAt: NOW - DONE_RETENTION_SECONDS - 100,
  });
  const expired = projectAttention(
    [staleItem],
    {
      "conv-1": {
        zone: "done",
        changedAt: NOW - DONE_RETENTION_SECONDS - 10,
      },
    },
    NOW,
  );
  assert.equal(expired.done.length, 0);
  assert.equal(expired.needsMe.length, 0);
  assert.equal(expired.waiting.length, 0);
});

test("needs me sorts by latest activity, waiting and done by park time", () => {
  const older = makeInboxItem({
    conversationId: "conv-old",
    latestActivityAt: NOW - 5_000,
  });
  const newer = makeInboxItem({
    conversationId: "conv-new",
    latestActivityAt: NOW - 100,
  });
  const needsMe = projectAttention([older, newer], {}, NOW).needsMe;
  assert.deepEqual(
    needsMe.map((entry) => entry.id),
    ["conv-new", "conv-old"],
  );

  const waiting = projectAttention(
    [older, newer],
    {
      "conv-old": { zone: "waiting", changedAt: NOW - 50 },
      "conv-new": { zone: "waiting", changedAt: NOW - 10 },
    },
    NOW,
  ).waiting;
  assert.deepEqual(
    waiting.map((entry) => entry.id),
    ["conv-new", "conv-old"],
  );
});

test("attentionReason maps categories and kinds to short phrases", () => {
  assert.equal(
    attentionReason(
      makeInboxItem({
        categories: ["needs_action"],
        isActionRequired: true,
        kind: 46010,
      }),
    ),
    "Approval requested",
  );
  assert.equal(
    attentionReason(
      makeInboxItem({
        categories: ["needs_action"],
        isActionRequired: true,
        kind: 40007,
      }),
    ),
    "Reminder due",
  );
  assert.equal(
    attentionReason(makeInboxItem({ categories: ["mention"] })),
    "Mentioned you",
  );
  const item = makeInboxItem({ categories: ["mention"] });
  const threaded = {
    ...item,
    groupItems: [item.item, { ...item.item, id: "second" }],
  };
  assert.equal(attentionReason(threaded), "Mentioned you in an active thread");
});

test("pruneZoneState drops expired done entries and caps the map", () => {
  const state = {
    "conv-live": { zone: "waiting", changedAt: NOW - 10 },
    "conv-done-fresh": { zone: "done", changedAt: NOW - 60 },
    "conv-done-stale": {
      zone: "done",
      changedAt: NOW - DONE_RETENTION_SECONDS - 60,
    },
  };
  const pruned = pruneZoneState(state, NOW);
  assert.deepEqual(Object.keys(pruned).sort(), [
    "conv-done-fresh",
    "conv-live",
  ]);

  const crowded = Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [
      `conv-${index}`,
      { zone: "waiting", changedAt: NOW - index },
    ]),
  );
  const capped = pruneZoneState(crowded, NOW, 3);
  assert.deepEqual(Object.keys(capped).sort(), ["conv-0", "conv-1", "conv-2"]);
});
