import assert from "node:assert/strict";
import test from "node:test";

import { extractSpineMarkers, parseMarkers } from "./markers.ts";

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

test("parseMarkers maps each prefix to its class", () => {
  const markers = parseMarkers(
    [
      "Decision: ship the rail behind a flag",
      "Milestone: phase 1 merged",
      "Resolved: flaky test was a stale server",
      "Answer: use the h tag",
    ].join("\n"),
  );
  assert.deepEqual(markers, [
    { class: "decision", text: "ship the rail behind a flag" },
    { class: "milestone", text: "phase 1 merged" },
    { class: "resolved", text: "flaky test was a stale server" },
    { class: "answer", text: "use the h tag" },
  ]);
});

test("parseMarkers handles bold wrapping and list bullets", () => {
  assert.deepEqual(parseMarkers("**Decision:** go with option B"), [
    { class: "decision", text: "go with option B" },
  ]);
  assert.deepEqual(parseMarkers("- Milestone: relay deployed"), [
    { class: "milestone", text: "relay deployed" },
  ]);
  assert.deepEqual(parseMarkers("- **Resolved:** root cause found"), [
    { class: "resolved", text: "root cause found" },
  ]);
});

test("parseMarkers is case-sensitive and requires line start", () => {
  assert.deepEqual(parseMarkers("decision: lowercase does not count"), []);
  assert.deepEqual(parseMarkers("DECISION: shouting does not count"), []);
  assert.deepEqual(parseMarkers("We made a Decision: mid-line ignored"), []);
});

test("parseMarkers ignores fenced code blocks", () => {
  const content = [
    "Decision: keep this one",
    "```",
    "Decision: this is code, not a marker",
    "```",
    "Answer: and this one",
  ].join("\n");
  assert.deepEqual(parseMarkers(content), [
    { class: "decision", text: "keep this one" },
    { class: "answer", text: "and this one" },
  ]);
});

test("parseMarkers allows multiple markers and trims text", () => {
  const markers = parseMarkers(
    "Some intro prose.\nDecision:   spaces trimmed   \nAnswer: second marker",
  );
  assert.deepEqual(markers, [
    { class: "decision", text: "spaces trimmed" },
    { class: "answer", text: "second marker" },
  ]);
});

test("parseMarkers returns empty for marker-free content", () => {
  assert.deepEqual(parseMarkers("Just a normal message.\nNothing here."), []);
  assert.deepEqual(parseMarkers(""), []);
});

test("extractSpineMarkers carries event identity and defaults root to id", () => {
  const rows = [
    {
      event: makeEvent({
        id: "root-a",
        pubkey: "pk-a",
        created_at: 111,
        content: "Decision: adopt the marker convention",
      }),
      thread: null,
    },
    { event: makeEvent({ id: "root-b", content: "no markers" }), thread: null },
  ];
  const markers = extractSpineMarkers(rows);
  assert.deepEqual(markers, [
    {
      class: "decision",
      text: "adopt the marker convention",
      eventId: "root-a",
      authorPubkey: "pk-a",
      createdAt: 111,
      threadRootId: "root-a",
    },
  ]);
});

test("extractSpineMarkers uses rootFor when provided", () => {
  const rows = [
    {
      event: makeEvent({ id: "reply-1", content: "Resolved: fixed upstream" }),
      thread: null,
    },
  ];
  const markers = extractSpineMarkers(rows, () => "thread-root");
  assert.equal(markers[0].threadRootId, "thread-root");
  assert.equal(markers[0].eventId, "reply-1");
});

test("extractSpineMarkers emits multiple markers from one message", () => {
  const rows = [
    {
      event: makeEvent({
        content: "Decision: pick A\nMilestone: shipped\nResolved: done",
      }),
      thread: null,
    },
  ];
  assert.deepEqual(
    extractSpineMarkers(rows).map((m) => m.class),
    ["decision", "milestone", "resolved"],
  );
});
