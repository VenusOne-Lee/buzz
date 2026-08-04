import assert from "node:assert/strict";
import test from "node:test";

import {
  extractArtifactEntries,
  extractLinkEntries,
  extractMediaEntries,
} from "./lanes.ts";

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

function row(eventOverrides = {}) {
  return { event: makeEvent(eventOverrides), thread: null };
}

test("extractMediaEntries parses a full imeta tag in any field order", () => {
  const rows = [
    row({
      id: "m1",
      tags: [
        [
          "imeta",
          "blurhash Lk9",
          "m image/png",
          "url https://cdn.example/a.png",
          "dim 800x600",
          "thumb https://cdn.example/a-thumb.png",
          "filename a.png",
        ],
      ],
    }),
  ];
  assert.deepEqual(extractMediaEntries(rows), [
    {
      eventId: "m1",
      threadRootId: "m1",
      url: "https://cdn.example/a.png",
      mimeType: "image/png",
      thumbUrl: "https://cdn.example/a-thumb.png",
      blurhash: "Lk9",
      dim: "800x600",
      filename: "a.png",
      authorPubkey: "author-1",
      createdAt: 1_700_000_000,
    },
  ]);
});

test("extractMediaEntries: missing optional fields become null, missing url skips", () => {
  const rows = [
    row({
      id: "m2",
      tags: [
        ["imeta", "url https://cdn.example/b.mp4"],
        ["imeta", "m image/jpeg", "dim 10x10"],
      ],
    }),
  ];
  const media = extractMediaEntries(rows);
  assert.equal(media.length, 1);
  assert.equal(media[0].url, "https://cdn.example/b.mp4");
  assert.equal(media[0].mimeType, null);
  assert.equal(media[0].thumbUrl, null);
  assert.equal(media[0].blurhash, null);
  assert.equal(media[0].dim, null);
  assert.equal(media[0].filename, null);
});

test("extractMediaEntries emits one entry per imeta tag and honours rootFor", () => {
  const rows = [
    row({
      id: "m3",
      tags: [
        ["imeta", "url https://cdn.example/1.png"],
        ["imeta", "url https://cdn.example/2.png"],
        ["e", "unrelated"],
      ],
    }),
  ];
  const media = extractMediaEntries(rows, () => "root-x");
  assert.deepEqual(
    media.map((entry) => entry.url),
    ["https://cdn.example/1.png", "https://cdn.example/2.png"],
  );
  assert.deepEqual(
    media.map((entry) => entry.threadRootId),
    ["root-x", "root-x"],
  );
});

test("extractLinkEntries: typed previews get previewKind, plain links get null", () => {
  const rows = [
    row({
      id: "l1",
      content:
        "See https://github.com/block/buzz/pull/42 and https://example.com/doc for details.",
    }),
  ];
  const links = extractLinkEntries(rows);
  assert.equal(links.length, 2);
  const typed = links.find((l) => l.previewKind !== null);
  const plain = links.find((l) => l.previewKind === null);
  assert.equal(typed.url, "https://github.com/block/buzz/pull/42");
  assert.equal(typed.previewKind, "github-pull-request");
  assert.equal(plain.url, "https://example.com/doc");
});

test("extractLinkEntries dedups by (eventId, url) but keeps cross-event repeats", () => {
  const rows = [
    row({
      id: "l2",
      content: "https://example.com/x and again https://example.com/x",
    }),
    row({ id: "l3", content: "https://example.com/x" }),
  ];
  const links = extractLinkEntries(rows);
  assert.deepEqual(
    links.map((l) => [l.eventId, l.url]),
    [
      ["l2", "https://example.com/x"],
      ["l3", "https://example.com/x"],
    ],
  );
});

test("extractLinkEntries does not duplicate a typed URL as a generic link", () => {
  const rows = [
    row({ id: "l4", content: "https://github.com/block/buzz/pull/7" }),
  ];
  const links = extractLinkEntries(rows);
  assert.equal(links.length, 1);
  assert.equal(links[0].previewKind, "github-pull-request");
});

test("extractLinkEntries skips URLs inside fenced code blocks", () => {
  const rows = [
    row({
      id: "l5",
      content:
        "Check https://example.com/keep\n```\ncurl https://example.com/code-only\n```\ndone",
    }),
  ];
  const links = extractLinkEntries(rows);
  assert.deepEqual(
    links.map((l) => l.url),
    ["https://example.com/keep"],
  );
});

test("extractLinkEntries strips trailing punctuation from generic URLs", () => {
  const rows = [row({ id: "l6", content: "Look at https://example.com/a." })];
  assert.equal(extractLinkEntries(rows)[0].url, "https://example.com/a");
});

test("extractArtifactEntries maps 30617 repos and 1618 pull requests", () => {
  const events = [
    makeEvent({
      id: "repo-1",
      kind: 30617,
      pubkey: "pk-repo",
      created_at: 500,
      tags: [
        ["d", "buzz"],
        ["name", "block/buzz"],
        ["web", "https://github.com/block/buzz"],
      ],
    }),
    makeEvent({
      id: "pr-1",
      kind: 1618,
      pubkey: "pk-pr",
      created_at: 600,
      tags: [["subject", "Add spine projection"]],
    }),
    makeEvent({ id: "other", kind: 9 }),
  ];
  assert.deepEqual(extractArtifactEntries(events), [
    {
      eventId: "repo-1",
      kind: 30617,
      artifactType: "repo",
      name: "block/buzz",
      webUrl: "https://github.com/block/buzz",
      authorPubkey: "pk-repo",
      createdAt: 500,
    },
    {
      eventId: "pr-1",
      kind: 1618,
      artifactType: "pull-request",
      name: "Add spine projection",
      webUrl: null,
      authorPubkey: "pk-pr",
      createdAt: 600,
    },
  ]);
});

test("extractArtifactEntries tolerates missing name/web tags", () => {
  const events = [
    makeEvent({ id: "repo-bare", kind: 30617, tags: [] }),
    makeEvent({ id: "pr-bare", kind: 1618, tags: [] }),
  ];
  const [repo, pr] = extractArtifactEntries(events);
  assert.equal(repo.name, "");
  assert.equal(repo.webUrl, null);
  assert.equal(pr.name, "");
  assert.equal(pr.webUrl, null);
});
