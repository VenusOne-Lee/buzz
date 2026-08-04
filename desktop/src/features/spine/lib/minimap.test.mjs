import assert from "node:assert/strict";
import test from "node:test";

import { buildMinimap } from "./minimap.ts";

function makeEvent(overrides = {}) {
  return {
    id: "aaaa",
    pubkey: "author-1",
    created_at: 1000,
    kind: 9,
    tags: [],
    content: "",
    sig: "",
    ...overrides,
  };
}

test("markers in root and replies become classed entries", () => {
  const entries = buildMinimap({
    rootEvent: makeEvent({
      id: "root",
      created_at: 100,
      content: "Kickoff.\nDecision: ship the rail first",
    }),
    replies: [
      makeEvent({
        id: "r1",
        created_at: 200,
        content: "- **Milestone:** rail merged\nResolved: flicker fixed",
      }),
      makeEvent({
        id: "r2",
        created_at: 300,
        content: "**Answer: use the h tag**",
      }),
    ],
  });
  assert.deepEqual(
    entries.map((entry) => [entry.class, entry.label, entry.eventId]),
    [
      ["decision", "ship the rail first", "root"],
      ["milestone", "rail merged", "r1"],
      ["resolved", "flicker fixed", "r1"],
      ["answer", "use the h tag", "r2"],
    ],
  );
  assert.equal(entries[0].authorPubkey, "author-1");
  assert.equal(entries[0].createdAt, 100);
});

test("declared asks emit class ask with the ask sentence", () => {
  const entries = buildMinimap({
    rootEvent: makeEvent({
      id: "root",
      content:
        "**Needs Lee, decision:** Pick the relay region.\n- Keep us-east.\n- Move to eu-west.",
    }),
    replies: [],
  });
  assert.deepEqual(
    entries.map((entry) => [entry.class, entry.label]),
    [["ask", "Pick the relay region."]],
  );
});

test("imeta tags emit media entries labelled filename or attachment", () => {
  const entries = buildMinimap({
    rootEvent: makeEvent({
      id: "root",
      tags: [
        [
          "imeta",
          "url https://relay/media/spec.pdf",
          "m application/pdf",
          "filename spec.pdf",
        ],
        ["imeta", "url https://relay/media/blob", "m image/png"],
      ],
    }),
    replies: [],
  });
  assert.deepEqual(
    entries.map((entry) => [entry.class, entry.label]),
    [
      ["media", "spec.pdf"],
      ["media", "attachment"],
    ],
  );
});

test("kind 1618 and 30617 events are artifacts labelled from subject/name", () => {
  const entries = buildMinimap({
    rootEvent: makeEvent({ id: "root", content: "Thread start." }),
    replies: [
      makeEvent({
        id: "pr",
        created_at: 1100,
        kind: 1618,
        tags: [["subject", "Add spine rail"]],
        // Content of artifact kinds is not scanned for markers.
        content: "Decision: should not surface",
      }),
      makeEvent({
        id: "repo",
        created_at: 1200,
        kind: 30617,
        tags: [["name", "buzz-spine"]],
      }),
      makeEvent({ id: "bare", created_at: 1300, kind: 1618, tags: [] }),
    ],
  });
  assert.deepEqual(
    entries.map((entry) => [entry.class, entry.label]),
    [
      ["artifact", "Add spine rail"],
      ["artifact", "buzz-spine"],
      ["artifact", "artifact"],
    ],
  );
});

test("entries sort createdAt asc with event id asc tie-break", () => {
  const entries = buildMinimap({
    rootEvent: makeEvent({
      id: "zz-root",
      created_at: 500,
      content: "Decision: root marker",
    }),
    replies: [
      makeEvent({
        id: "bb",
        created_at: 500,
        content: "Milestone: same second",
      }),
      makeEvent({ id: "aa", created_at: 400, content: "Resolved: earliest" }),
    ],
  });
  assert.deepEqual(
    entries.map((entry) => entry.eventId),
    ["aa", "bb", "zz-root"],
  );
});

test("marker lines inside fenced code blocks are ignored", () => {
  const entries = buildMinimap({
    rootEvent: makeEvent({
      id: "root",
      content:
        "Decision: real marker\n```\nDecision: fenced, ignore\nMilestone: also ignore\n```\nMilestone: after the fence",
    }),
    replies: [],
  });
  assert.deepEqual(
    entries.map((entry) => [entry.class, entry.label]),
    [
      ["decision", "real marker"],
      ["milestone", "after the fence"],
    ],
  );
});

test("thread with no markers, asks, media, or artifacts is empty", () => {
  const entries = buildMinimap({
    rootEvent: makeEvent({ id: "root", content: "Plain chatter." }),
    replies: [makeEvent({ id: "r1", content: "More chatter, no markers." })],
  });
  assert.deepEqual(entries, []);
});
