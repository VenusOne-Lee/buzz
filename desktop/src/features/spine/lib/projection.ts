import {
  extractArtifactEntries,
  extractLinkEntries,
  extractMediaEntries,
} from "@/features/spine/lib/lanes";
import { extractSpineMarkers } from "@/features/spine/lib/markers";
import { rankThreads } from "@/features/spine/lib/ranking";
import type { SpineProjection, SpineSourceRow } from "@/features/spine/types";
import type { RelayEvent } from "@/shared/api/types";

/** Default number of ranked threads kept in the projection. */
export const DEFAULT_THREAD_LIMIT = 12;

export type SpineProjectionInput = {
  channelId: string;
  rows: SpineSourceRow[];
  artifactEvents: RelayEvent[];
  /** Snapshot clock in unix seconds — the projection never reads Date.now(). */
  now: number;
  threadLimit?: number;
};

/**
 * Compose the full Spine projection for one channel from a snapshot of its
 * window rows and channel-bound artifact events.
 *
 * Marker-bearing messages appear in `markers` regardless of thread stats —
 * only the Threads lane requires a 39005 summary. `asOf` is the newest
 * created_at consumed from any input event (0 when there are none).
 */
export function buildSpineProjection(
  input: SpineProjectionInput,
): SpineProjection {
  const { channelId, rows, artifactEvents, now } = input;
  let asOf = 0;
  for (const row of rows) {
    asOf = Math.max(asOf, row.event.created_at);
  }
  for (const event of artifactEvents) {
    asOf = Math.max(asOf, event.created_at);
  }
  return {
    channelId,
    markers: extractSpineMarkers(rows),
    threads: rankThreads(rows, {
      now,
      limit: input.threadLimit ?? DEFAULT_THREAD_LIMIT,
    }),
    media: extractMediaEntries(rows),
    links: extractLinkEntries(rows),
    artifacts: extractArtifactEntries(artifactEvents),
    asOf,
  };
}
