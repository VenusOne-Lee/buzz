import {
  SPINE_INDEX_KIND,
  type SpineIndexPayload,
  spineIndexDTag,
} from "@/features/spine/types";
import type { RelayEvent } from "@/shared/api/types";

/**
 * Phase 3 emitted-index reader/writer.
 *
 * The emitter publishes one kind 30023 parameterized-replaceable event per
 * channel (`d = channel-digest:<uuid>`). These helpers parse and validate
 * received index events, serialize payloads for publishing, and fold a set of
 * per-channel indexes into workspace-level views.
 */

type ThreadEntry = SpineIndexPayload["threads"][number];

/** A thread entry annotated with its source channel, for the workspace log. */
export type WorkspaceLogEntry = { channelId: string } & ThreadEntry;

const THREAD_CLASSES = new Set([
  "decision",
  "milestone",
  "resolved",
  "answer",
  "thread",
]);

const ARTIFACT_TYPES = new Set(["repo", "pull-request"]);

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isThreadEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isString(value.rootId) &&
    isString(value.class) &&
    THREAD_CLASSES.has(value.class) &&
    isString(value.title) &&
    isStringOrNull(value.resolution) &&
    isStringArray(value.participantPubkeys) &&
    isNumberOrNull(value.lastReplyAt) &&
    isFiniteNumber(value.descendantCount) &&
    isFiniteNumber(value.reactionCount)
  );
}

function isMediaEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isString(value.eventId) &&
    isString(value.threadRootId) &&
    isString(value.url) &&
    isStringOrNull(value.mimeType) &&
    isStringOrNull(value.thumbUrl) &&
    isStringOrNull(value.blurhash) &&
    isStringOrNull(value.dim) &&
    isStringOrNull(value.filename) &&
    isString(value.authorPubkey) &&
    isFiniteNumber(value.createdAt)
  );
}

function isLinkEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isString(value.eventId) &&
    isString(value.threadRootId) &&
    isString(value.url) &&
    isStringOrNull(value.previewKind) &&
    isString(value.authorPubkey) &&
    isFiniteNumber(value.createdAt)
  );
}

function isArtifactEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isString(value.eventId) &&
    isFiniteNumber(value.kind) &&
    isString(value.artifactType) &&
    ARTIFACT_TYPES.has(value.artifactType) &&
    isString(value.name) &&
    isStringOrNull(value.webUrl) &&
    isString(value.authorPubkey) &&
    isFiniteNumber(value.createdAt)
  );
}

function isSpineIndexPayload(value: unknown): value is SpineIndexPayload {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    isString(value.channelId) &&
    value.channelId.length > 0 &&
    isFiniteNumber(value.emittedAt) &&
    Array.isArray(value.threads) &&
    value.threads.every(isThreadEntry) &&
    Array.isArray(value.media) &&
    value.media.every(isMediaEntry) &&
    Array.isArray(value.links) &&
    value.links.every(isLinkEntry) &&
    Array.isArray(value.artifacts) &&
    value.artifacts.every(isArtifactEntry)
  );
}

/**
 * Parse a relay event into a validated `SpineIndexPayload`.
 *
 * Returns `null` (never throws) when the event is not a well-formed index:
 * wrong kind, unparseable/invalid JSON content, wrong payload version, or a
 * `d` tag inconsistent with the payload's `channelId`.
 */
export function parseSpineIndexEvent(
  event: RelayEvent,
): SpineIndexPayload | null {
  if (event.kind !== SPINE_INDEX_KIND) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(event.content);
  } catch {
    return null;
  }
  if (!isSpineIndexPayload(parsed)) return null;

  const expectedDTag = spineIndexDTag(parsed.channelId);
  const hasMatchingDTag =
    Array.isArray(event.tags) &&
    event.tags.some(
      (tag) => Array.isArray(tag) && tag[0] === "d" && tag[1] === expectedDTag,
    );
  if (!hasMatchingDTag) return null;

  return parsed;
}

/**
 * Serialize a payload into the content and tags of its kind 30023 event.
 *
 * Tags follow the emitter convention: `d` for parameterized replacement,
 * `h` for NIP-29 channel scoping, `client` identifying the emitter.
 */
export function serializeSpineIndex(payload: SpineIndexPayload): {
  content: string;
  tags: string[][];
} {
  return {
    content: JSON.stringify(payload),
    tags: [
      ["d", spineIndexDTag(payload.channelId)],
      ["h", payload.channelId],
      ["client", "spine-emitter"],
    ],
  };
}

/**
 * Flatten per-channel indexes into one workspace-level thread log.
 *
 * Ordering: `lastReplyAt` descending with nulls last, then `(channelId,
 * rootId)` ascending as a stable tie-break.
 */
export function mergeWorkspaceLog(
  indexes: SpineIndexPayload[],
): WorkspaceLogEntry[] {
  const entries: WorkspaceLogEntry[] = indexes.flatMap((index) =>
    index.threads.map((thread) => ({ channelId: index.channelId, ...thread })),
  );
  entries.sort((a, b) => {
    if (a.lastReplyAt !== b.lastReplyAt) {
      if (a.lastReplyAt === null) return 1;
      if (b.lastReplyAt === null) return -1;
      return b.lastReplyAt - a.lastReplyAt;
    }
    if (a.channelId !== b.channelId) {
      return a.channelId < b.channelId ? -1 : 1;
    }
    if (a.rootId !== b.rootId) {
      return a.rootId < b.rootId ? -1 : 1;
    }
    return 0;
  });
  return entries;
}

/**
 * Reduce a batch of relay events to the newest valid index per channel.
 *
 * Client-side latest-wins guard: relays replace parameterized-replaceable
 * events, but a live subscription can still deliver stale copies out of
 * order. Only a strictly newer `created_at` displaces a kept index.
 */
export function latestIndexPerChannel(
  events: RelayEvent[],
): Map<string, SpineIndexPayload> {
  const latest = new Map<string, SpineIndexPayload>();
  const latestCreatedAt = new Map<string, number>();
  for (const event of events) {
    const payload = parseSpineIndexEvent(event);
    if (!payload) continue;
    const kept = latestCreatedAt.get(payload.channelId);
    if (kept !== undefined && event.created_at <= kept) continue;
    latest.set(payload.channelId, payload);
    latestCreatedAt.set(payload.channelId, event.created_at);
  }
  return latest;
}
