import type {
  MarkerClass,
  SpineMarker,
  SpineSourceRow,
} from "@/features/spine/types";
import type { RelayEvent } from "@/shared/api/types";

/**
 * Author-declared marker convention (Spine Layer 1).
 *
 * A marker is a line beginning with `Decision:`, `Milestone:`, `Resolved:`,
 * `Answer:`, `Goal:`, `Question:` or `Blocker:` (case-sensitive), optionally
 * wrapped in markdown bold (`**Decision:**`) and/or preceded by a list
 * bullet (`- `). Lines inside fenced code blocks never declare markers.
 *
 * `Goal:`, `Question:` and `Blocker:` are Goal Threads additions (see
 * `@/features/goals`) — same convention, same parser, no separate grammar.
 */

const MARKER_CLASS_BY_PREFIX: Record<string, MarkerClass> = {
  Decision: "decision",
  Milestone: "milestone",
  Resolved: "resolved",
  Answer: "answer",
  Goal: "goal",
  Question: "question",
  Blocker: "blocker",
};

/**
 * Optional bullet, optional bold wrapping (colon inside or outside the bold
 * span), a case-sensitive prefix, then the marker text. Case sensitivity is
 * enforced by the alternation itself — no `i` flag.
 */
const MARKER_LINE_RE =
  /^\s*(?:-\s+)?(?:\*\*)?(Decision|Milestone|Resolved|Answer|Goal|Question|Blocker):(?:\*\*)?\s*(.*)$/;

const FENCE_RE = /^\s*(?:```|~~~)/;

/**
 * Parse all author-declared markers in a message body. Multiple markers per
 * message are allowed; text inside fenced code blocks is ignored.
 */
export function parseMarkers(
  content: string,
): Array<{ class: MarkerClass; text: string }> {
  const markers: Array<{ class: MarkerClass; text: string }> = [];
  let inFence = false;
  for (const line of content.split("\n")) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const match = line.match(MARKER_LINE_RE);
    if (!match) {
      continue;
    }
    const markerClass = MARKER_CLASS_BY_PREFIX[match[1]];
    if (!markerClass) {
      continue;
    }
    markers.push({ class: markerClass, text: match[2].trim() });
  }
  return markers;
}

/**
 * Project marker rows out of a channel window. `rootFor` maps an event to
 * its thread root id; the default treats every event as its own root.
 */
export function extractSpineMarkers(
  rows: SpineSourceRow[],
  rootFor: (event: RelayEvent) => string = (event) => event.id,
): SpineMarker[] {
  const markers: SpineMarker[] = [];
  for (const row of rows) {
    const { event } = row;
    for (const parsed of parseMarkers(event.content)) {
      markers.push({
        class: parsed.class,
        text: parsed.text,
        eventId: event.id,
        authorPubkey: event.pubkey,
        createdAt: event.created_at,
        threadRootId: rootFor(event),
      });
    }
  }
  return markers;
}
