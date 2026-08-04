import assert from "node:assert/strict";
import test from "node:test";

import { rankThreads, scoreThread } from "./ranking.ts";

const NOW = 1_700_000_000;
const HOUR = 60 * 60;

function makeRow(id, threadOverrides = {}, eventOverrides = {}) {
  return {
    event: {
      id,
      pubkey: "author-1",
      created_at: NOW - 10 * HOUR,
      kind: 9,
      tags: [],
      content: `Thread ${id} root message.`,
      sig: "",
      ...eventOverrides,
    },
    thread: {
      replyCount: 0,
      descendantCount: 4,
      lastReplyAt: NOW - HOUR,
      participantPubkeys: ["a", "b"],
      ...threadOverrides,
    },
  };
}

test("rankThreads only ranks rows with a thread summary", () => {
  const rows = [
    makeRow("with-thread"),
    { event: makeRow("no-thread").event, thread: null },
  ];
  const ranked = rankThreads(rows, { now: NOW, limit: 10 });
  assert.deepEqual(
    ranked.map((entry) => entry.rootId),
    ["with-thread"],
  );
});

test("scoreThread rewards volume, breadth and recency", () => {
  const base = {
    replyCount: 0,
    descendantCount: 2,
    lastReplyAt: NOW - HOUR,
    participantPubkeys: ["a"],
  };
  const bigger = scoreThread({ ...base, descendantCount: 40 }, NOW);
  const wider = scoreThread(
    { ...base, participantPubkeys: ["a", "b", "c", "d"] },
    NOW,
  );
  const stale = scoreThread({ ...base, lastReplyAt: NOW - 500 * HOUR }, NOW);
  const small = scoreThread(base, NOW);
  assert.ok(bigger > small);
  assert.ok(wider > small);
  assert.ok(stale < small);
});

test("scoreThread decay: 72h halves the recency component", () => {
  const thread = (lastReplyAt) => ({
    replyCount: 0,
    descendantCount: 0,
    lastReplyAt,
    participantPubkeys: [],
  });
  const fresh = scoreThread(thread(NOW), NOW);
  const halfLife = scoreThread(thread(NOW - 72 * HOUR), NOW);
  assert.ok(Math.abs(halfLife - fresh / 2) < 1e-9);
  // No replies at all contributes zero recency.
  assert.equal(scoreThread(thread(null), NOW), 0);
});

test("scoreThread ignores replyCount entirely", () => {
  const base = {
    replyCount: 0,
    descendantCount: 3,
    lastReplyAt: NOW - HOUR,
    participantPubkeys: ["a", "b"],
  };
  assert.equal(
    scoreThread(base, NOW),
    scoreThread({ ...base, replyCount: 999 }, NOW),
  );
});

test("rankThreads sorts by score desc and applies the limit", () => {
  const rows = [
    makeRow("small", { descendantCount: 1, participantPubkeys: ["a"] }),
    makeRow("big", {
      descendantCount: 50,
      participantPubkeys: ["a", "b", "c"],
    }),
    makeRow("mid", { descendantCount: 8 }),
  ];
  const ranked = rankThreads(rows, { now: NOW, limit: 2 });
  assert.deepEqual(
    ranked.map((entry) => entry.rootId),
    ["big", "mid"],
  );
});

test("rankThreads tie-breaks on created_at desc then id asc", () => {
  const thread = { descendantCount: 5, lastReplyAt: null };
  const rows = [
    makeRow("bbb", thread, { created_at: 100 }),
    makeRow("aaa", thread, { created_at: 200 }),
    makeRow("zzz", thread, { created_at: 200 }),
  ];
  const ranked = rankThreads(rows, { now: NOW, limit: 10 });
  assert.deepEqual(
    ranked.map((entry) => entry.rootId),
    ["aaa", "zzz", "bbb"],
  );
});

test("rankThreads is deterministic across input order", () => {
  const rows = [
    makeRow("a", { descendantCount: 3 }),
    makeRow("b", { descendantCount: 3 }),
    makeRow("c", { descendantCount: 9 }),
  ];
  const forward = rankThreads(rows, { now: NOW, limit: 10 });
  const reversed = rankThreads([...rows].reverse(), { now: NOW, limit: 10 });
  assert.deepEqual(
    forward.map((entry) => entry.rootId),
    reversed.map((entry) => entry.rootId),
  );
});

test("rankThreads titles come from summaryLineFor on the root content", () => {
  const rows = [
    makeRow(
      "titled",
      {},
      { content: "**Bold lead** sentence here. Second sentence ignored." },
    ),
  ];
  const [entry] = rankThreads(rows, { now: NOW, limit: 1 });
  assert.equal(entry.title, "Bold lead sentence here.");
});

test("rankThreads carries summary fields through to the entry", () => {
  const rows = [
    makeRow("carry", {
      descendantCount: 7,
      lastReplyAt: NOW - 2 * HOUR,
      participantPubkeys: ["x", "y", "z"],
    }),
  ];
  const [entry] = rankThreads(rows, { now: NOW, limit: 5 });
  assert.equal(entry.descendantCount, 7);
  assert.equal(entry.lastReplyAt, NOW - 2 * HOUR);
  assert.deepEqual(entry.participantPubkeys, ["x", "y", "z"]);
  assert.equal(entry.createdAt, NOW - 10 * HOUR);
  assert.ok(entry.score > 0);
});
