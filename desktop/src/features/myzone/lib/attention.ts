import type { InboxItem } from "@/features/home/lib/inbox";
import { getThreadReference } from "@/features/messages/lib/threading";

export type AttentionZone = "needsMe" | "waiting" | "done";

export type ZoneStateEntry = {
  zone: "waiting" | "done";
  /** Unix seconds when the user parked the item in this zone. */
  changedAt: number;
};

/** Keyed by the inbox item's stable conversation id. */
export type ZoneStateMap = Record<string, ZoneStateEntry>;

export type AttentionItem = {
  /** Stable identity — the inbox conversation id. */
  id: string;
  inboxItem: InboxItem;
  /** Why this needs the user, in one short phrase. */
  reason: string;
  zone: AttentionZone;
  zoneChangedAt: number | null;
  /**
   * True when the item was parked in Waiting or Done but new activity arrived
   * afterwards, pulling it back into Needs Me.
   */
  reactivated: boolean;
};

export type AttentionProjection = {
  needsMe: AttentionItem[];
  waiting: AttentionItem[];
  done: AttentionItem[];
};

export const DONE_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const MAX_ZONE_ENTRIES = 500;

const KIND_WORKFLOW_APPROVAL_REQUESTED = 46010;
const KIND_STREAM_REMINDER = 40007;

/**
 * MyZone only surfaces items that plausibly need the user: action-required
 * feed items and direct mentions. Ambient channel activity stays in the
 * Inbox — the two surfaces answer different questions.
 */
export function isAttentionWorthy(item: InboxItem): boolean {
  return (
    item.isActionRequired ||
    item.categories.includes("mention") ||
    item.categories.includes("needs_action")
  );
}

export function attentionReason(item: InboxItem): string {
  if (item.categories.includes("needs_action")) {
    if (item.item.kind === KIND_WORKFLOW_APPROVAL_REQUESTED) {
      return "Approval requested";
    }
    if (item.item.kind === KIND_STREAM_REMINDER) {
      return "Reminder due";
    }
    return "Action required";
  }
  if (item.categories.includes("mention")) {
    return item.groupItems.length > 1
      ? "Mentioned you in an active thread"
      : "Mentioned you";
  }
  if (item.categories.includes("agent_activity")) {
    return "Agent update";
  }
  return "New activity";
}

/** NIP-10 thread root of the representative event, for deep links. */
export function attentionThreadRootId(item: InboxItem): string | null {
  return getThreadReference(item.item.tags).rootId;
}

function toAttentionItem(
  item: InboxItem,
  zone: AttentionZone,
  entry: ZoneStateEntry | undefined,
  reactivated: boolean,
): AttentionItem {
  return {
    id: item.conversationId,
    inboxItem: item,
    reason: attentionReason(item),
    zone,
    zoneChangedAt: entry?.changedAt ?? null,
    reactivated,
  };
}

/**
 * Split attention-worthy inbox items into the three MyZone views.
 *
 * Rules:
 * - No zone entry → Needs Me.
 * - Activity newer than the zone entry reactivates the item into Needs Me,
 *   whether it was Waiting or Done — the underlying conversation moved, so
 *   the user's park decision is stale.
 * - Waiting and Done otherwise honour the stored zone.
 * - Done items expire from view after DONE_RETENTION_SECONDS.
 */
export function projectAttention(
  items: InboxItem[],
  zoneState: ZoneStateMap,
  nowSeconds: number,
): AttentionProjection {
  const needsMe: AttentionItem[] = [];
  const waiting: AttentionItem[] = [];
  const done: AttentionItem[] = [];

  for (const item of items) {
    if (!isAttentionWorthy(item)) {
      continue;
    }
    const entry = zoneState[item.conversationId];
    if (!entry) {
      needsMe.push(toAttentionItem(item, "needsMe", undefined, false));
      continue;
    }
    if (item.latestActivityAt > entry.changedAt) {
      needsMe.push(toAttentionItem(item, "needsMe", entry, true));
      continue;
    }
    if (entry.zone === "waiting") {
      waiting.push(toAttentionItem(item, "waiting", entry, false));
      continue;
    }
    if (nowSeconds - entry.changedAt <= DONE_RETENTION_SECONDS) {
      done.push(toAttentionItem(item, "done", entry, false));
    }
  }

  needsMe.sort(
    (a, b) => b.inboxItem.latestActivityAt - a.inboxItem.latestActivityAt,
  );
  waiting.sort((a, b) => (b.zoneChangedAt ?? 0) - (a.zoneChangedAt ?? 0));
  done.sort((a, b) => (b.zoneChangedAt ?? 0) - (a.zoneChangedAt ?? 0));

  return { needsMe, waiting, done };
}

/**
 * Drop expired Done entries and cap the map so localStorage stays bounded.
 * Oldest entries fall out first when over the cap.
 */
export function pruneZoneState(
  state: ZoneStateMap,
  nowSeconds: number,
  maxEntries: number = MAX_ZONE_ENTRIES,
): ZoneStateMap {
  const entries = Object.entries(state).filter(
    ([, entry]) =>
      entry.zone !== "done" ||
      nowSeconds - entry.changedAt <= DONE_RETENTION_SECONDS,
  );
  entries.sort(([, a], [, b]) => b.changedAt - a.changedAt);
  return Object.fromEntries(entries.slice(0, maxEntries));
}
