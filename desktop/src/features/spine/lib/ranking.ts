import { summaryLineFor } from "@/features/home/lib/summaryLine";
import type { SpineSourceRow, SpineThreadEntry } from "@/features/spine/types";
import type { ChannelWindowThreadSummary } from "@/features/messages/lib/channelWindowStore";

/**
 * Key-thread ranking for the Threads lane.
 *
 * Pure, snapshot-based: `now` is always a parameter, never Date.now(). Only
 * rows carrying a non-null 39005 thread summary participate.
 */

/** Fixed recency half-life: 72 hours, in unix seconds. */
const HALF_LIFE_SECONDS = 72 * 60 * 60;

const VOLUME_WEIGHT = 0.5;
const BREADTH_WEIGHT = 0.2;
const RECENCY_WEIGHT = 0.3;

/**
 * Weighted blend of volume (log-scaled descendant count — replyCount is
 * intentionally unused), breadth (distinct participants) and recency
 * (exponential decay on lastReplyAt with a fixed 72h half-life).
 */
export function scoreThread(
  thread: ChannelWindowThreadSummary,
  now: number,
): number {
  const volume = Math.log1p(Math.max(0, thread.descendantCount));
  const breadth = Math.log1p(thread.participantPubkeys.length);
  const recency =
    thread.lastReplyAt === null
      ? 0
      : 2 ** (-Math.max(0, now - thread.lastReplyAt) / HALF_LIFE_SECONDS);
  return (
    VOLUME_WEIGHT * volume + BREADTH_WEIGHT * breadth + RECENCY_WEIGHT * recency
  );
}

/**
 * Rank a channel window's threads. Deterministic ordering: score desc, then
 * root created_at desc, then event id asc.
 */
export function rankThreads(
  rows: SpineSourceRow[],
  opts: { now: number; limit: number },
): SpineThreadEntry[] {
  const entries: SpineThreadEntry[] = [];
  for (const row of rows) {
    if (row.thread === null) {
      continue;
    }
    entries.push({
      rootId: row.event.id,
      title: summaryLineFor(row.event.content),
      descendantCount: row.thread.descendantCount,
      lastReplyAt: row.thread.lastReplyAt,
      participantPubkeys: row.thread.participantPubkeys,
      createdAt: row.event.created_at,
      score: scoreThread(row.thread, opts.now),
    });
  }
  entries.sort(
    (a, b) =>
      b.score - a.score ||
      b.createdAt - a.createdAt ||
      (a.rootId < b.rootId ? -1 : a.rootId > b.rootId ? 1 : 0),
  );
  return entries.slice(0, Math.max(0, opts.limit));
}
