import type { RelayEvent } from "@/shared/api/types";
import type { ChannelWindowThreadSummary } from "@/features/messages/lib/channelWindowStore";

/**
 * Spine — layered index over a channel's append-only log.
 *
 * This file is the interface contract between the projection libs, the rail
 * and minimap renderers, and the Phase 3 emitted index. Everything renders
 * from existing relay data: message events, 39005 thread summaries, imeta
 * tags, NIP-34 git objects, and the author-declared marker convention.
 */

/** Lenses shown by the rail toggle. One index, many views. */
export type SpineLens =
  | "all"
  | "decisions"
  | "questions"
  | "threads"
  | "artifacts"
  | "media"
  | "links";

/** Author-declared marker classes, parsed from message content (Layer 1). */
export type MarkerClass = "decision" | "milestone" | "resolved" | "answer";

export type SpineMarker = {
  class: MarkerClass;
  /** The marker text with the prefix stripped, single line. */
  text: string;
  /** Event carrying the marker. */
  eventId: string;
  authorPubkey: string;
  createdAt: number;
  /** Thread root the marker belongs to; equals eventId for top-level messages. */
  threadRootId: string;
};

/** A ranked key-thread entry for the Threads lane. */
export type SpineThreadEntry = {
  rootId: string;
  /** One-line title from summaryLineFor(root content). */
  title: string;
  descendantCount: number;
  lastReplyAt: number | null;
  participantPubkeys: string[];
  createdAt: number;
  score: number;
};

/** Media lane entry, parsed from an imeta tag on a message event. */
export type SpineMediaEntry = {
  eventId: string;
  threadRootId: string;
  url: string;
  mimeType: string | null;
  thumbUrl: string | null;
  blurhash: string | null;
  /** "WxH" when the imeta carried dim. */
  dim: string | null;
  filename: string | null;
  authorPubkey: string;
  createdAt: number;
};

/** Links lane entry. Typed when the provider parser recognises the URL. */
export type SpineLinkEntry = {
  eventId: string;
  threadRootId: string;
  url: string;
  /** SupportedLinkPreviewKind when recognised, null for a plain link. */
  previewKind: string | null;
  authorPubkey: string;
  createdAt: number;
};

/** Artifacts lane entry: native NIP-34 objects bound to the channel. */
export type SpineArtifactEntry = {
  eventId: string;
  kind: number;
  /** "repo" (30617) or "pull-request" (1618). */
  artifactType: "repo" | "pull-request";
  name: string;
  webUrl: string | null;
  authorPubkey: string;
  createdAt: number;
};

/** The full projected index for one channel, input to every renderer. */
export type SpineProjection = {
  channelId: string;
  markers: SpineMarker[];
  threads: SpineThreadEntry[];
  media: SpineMediaEntry[];
  links: SpineLinkEntry[];
  artifacts: SpineArtifactEntry[];
  /** Newest event timestamp the projection saw — rendered as "as of". */
  asOf: number;
};

/** Row shape the projection consumes: a top-level event plus its 39005 summary. */
export type SpineSourceRow = {
  event: RelayEvent;
  thread: ChannelWindowThreadSummary | null;
};

/** Minimap entry: a jump target inside one thread (Phase 2). */
export type MinimapEntry = {
  eventId: string;
  class: MarkerClass | "ask" | "artifact" | "media";
  /** One line rendered next to the dot. */
  label: string;
  authorPubkey: string;
  createdAt: number;
};

/**
 * Phase 3 emitted index payload — the JSON body of the kind 30023 event,
 * d = `channel-digest:<channel-uuid>`, h = channel, single emitter identity.
 */
export type SpineIndexPayload = {
  version: 1;
  channelId: string;
  /** Unix seconds when the emitter produced this index. */
  emittedAt: number;
  threads: Array<{
    rootId: string;
    class: MarkerClass | "thread";
    title: string;
    resolution: string | null;
    participantPubkeys: string[];
    lastReplyAt: number | null;
    descendantCount: number;
    reactionCount: number;
  }>;
  media: SpineMediaEntry[];
  links: SpineLinkEntry[];
  artifacts: SpineArtifactEntry[];
};

/** d-tag for a channel's emitted index. */
export function spineIndexDTag(channelId: string): string {
  return `channel-digest:${channelId}`;
}

export const SPINE_INDEX_KIND = 30023;
