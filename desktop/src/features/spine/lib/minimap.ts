import { parseDeclaredAsks } from "@/features/attention/lib/declaredAsks";
import type { MarkerClass, MinimapEntry } from "@/features/spine/types";
import type { RelayEvent } from "@/shared/api/types";
import {
  KIND_GIT_PULL_REQUEST,
  KIND_REPO_ANNOUNCEMENT,
} from "@/shared/constants/kinds";

/**
 * Phase 2 thread minimap projection: reduce one thread (root + replies) to a
 * chronological list of jump targets — author-declared markers, declared
 * asks, media attachments, and NIP-34 artifacts.
 *
 * Pure: no clock, no fetching. Renders via ThreadMinimap.
 */

/**
 * Local marker-line parser following the shared marker convention
 * (see the concurrently-built spine markers lib): a line starting
 * `Decision:` / `Milestone:` / `Resolved:` / `Answer:`, optionally
 * bold-wrapped (`**Decision:** …`) or after a `- ` bullet, declares a
 * marker. Lines inside fenced code blocks never count.
 */
const MARKER_LINE =
  /^(?:-\s+)?(?:\*\*)?(Decision|Milestone|Resolved|Answer)\s*:(?:\*\*)?\s*(.+?)(?:\*\*)?$/;

const FENCE = /^(?:```|~~~)/;

type ParsedMarker = { class: MarkerClass; text: string };

function parseMarkerLines(content: string): ParsedMarker[] {
  const markers: ParsedMarker[] = [];
  let inFence = false;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const match = line.match(MARKER_LINE);
    if (!match) {
      continue;
    }
    const text = match[2].trim();
    if (!text) {
      continue;
    }
    markers.push({ class: match[1].toLowerCase() as MarkerClass, text });
  }
  return markers;
}

/** The `filename` field of one imeta tag, or null when absent. */
function imetaFilename(tag: string[]): string | null {
  for (const part of tag.slice(1)) {
    if (part.startsWith("filename ")) {
      const filename = part.slice("filename ".length).trim();
      if (filename) {
        return filename;
      }
    }
  }
  return null;
}

function tagValue(event: RelayEvent, name: string): string | null {
  const tag = event.tags.find((entry) => entry[0] === name && entry[1]);
  return tag ? tag[1] : null;
}

function artifactLabel(event: RelayEvent): string {
  return tagValue(event, "subject") ?? tagValue(event, "name") ?? "artifact";
}

function entriesForEvent(event: RelayEvent): MinimapEntry[] {
  const base = {
    eventId: event.id,
    authorPubkey: event.pubkey,
    createdAt: event.created_at,
  };

  // NIP-34 objects are jump targets themselves, not chat prose to parse.
  if (
    event.kind === KIND_GIT_PULL_REQUEST ||
    event.kind === KIND_REPO_ANNOUNCEMENT
  ) {
    return [{ ...base, class: "artifact", label: artifactLabel(event) }];
  }

  const entries: MinimapEntry[] = [];
  for (const marker of parseMarkerLines(event.content)) {
    entries.push({ ...base, class: marker.class, label: marker.text });
  }
  for (const ask of parseDeclaredAsks(event.content)) {
    entries.push({ ...base, class: "ask", label: ask.ask });
  }
  for (const tag of event.tags) {
    if (tag[0] === "imeta") {
      entries.push({
        ...base,
        class: "media",
        label: imetaFilename(tag) ?? "attachment",
      });
    }
  }
  return entries;
}

/**
 * Build the minimap for one thread: walk the root and its replies, emit one
 * entry per marker line, declared ask, imeta attachment, and NIP-34
 * artifact event, sorted createdAt asc with event id asc as tie-break.
 */
export function buildMinimap(input: {
  rootEvent: RelayEvent;
  replies: RelayEvent[];
}): MinimapEntry[] {
  const entries: MinimapEntry[] = [];
  for (const event of [input.rootEvent, ...input.replies]) {
    entries.push(...entriesForEvent(event));
  }
  return entries.sort(
    (a, b) =>
      a.createdAt - b.createdAt ||
      (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0),
  );
}
