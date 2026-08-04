import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  emptyChannelWindowStore,
  type ChannelWindowStore,
} from "@/features/messages/lib/channelWindowStore";
import { channelWindowKey } from "@/features/messages/lib/messageQueryKeys";
import { buildSpineProjection } from "@/features/spine/lib/projection";
import type { SpineProjection, SpineSourceRow } from "@/features/spine/types";
import type { RelayEvent } from "@/shared/api/types";
import {
  KIND_GIT_PULL_REQUEST,
  KIND_REPO_ANNOUNCEMENT,
} from "@/shared/constants/kinds";
import { useFeatureEnabled } from "@/shared/features";

const SPINE_THREAD_LIMIT = 20;

function hasTag(event: RelayEvent, name: string, value: string): boolean {
  return event.tags.some((tag) => tag[0] === name && tag[1] === value);
}

/**
 * NIP-34 objects bound to this channel: pull requests carry the NIP-29
 * `["h", channelId]` group tag, repo announcements the
 * `["buzz-channel", channelId]` binding tag.
 */
function isChannelArtifactEvent(event: RelayEvent, channelId: string): boolean {
  if (event.kind === KIND_GIT_PULL_REQUEST) {
    return hasTag(event, "h", channelId);
  }
  if (event.kind === KIND_REPO_ANNOUNCEMENT) {
    return hasTag(event, "buzz-channel", channelId);
  }
  return false;
}

/**
 * One pass over a window-store snapshot: top-level rows (page rows plus the
 * live overlay, with fresher relay-pushed 39005 summaries filling rows that
 * lack one) and the channel-bound artifact events held anywhere in the
 * window (rows, page aux, live aux).
 */
function collectSpineInputs(
  store: ChannelWindowStore,
  channelId: string,
): { rows: SpineSourceRow[]; artifactEvents: RelayEvent[] } {
  const rows: SpineSourceRow[] = [];
  const seenRowIds = new Set<string>();
  const artifactEvents: RelayEvent[] = [];
  const seenArtifactIds = new Set<string>();
  const addArtifact = (event: RelayEvent) => {
    if (seenArtifactIds.has(event.id)) return;
    if (!isChannelArtifactEvent(event, channelId)) return;
    seenArtifactIds.add(event.id);
    artifactEvents.push(event);
  };
  const addRow = (
    event: RelayEvent,
    thread: SpineSourceRow["thread"],
  ): void => {
    if (seenRowIds.has(event.id)) return;
    seenRowIds.add(event.id);
    rows.push({
      event,
      thread: thread ?? store.liveSummaries[event.id]?.summary ?? null,
    });
    addArtifact(event);
  };
  for (const page of store.pages) {
    for (const row of page.rows) addRow(row.event, row.thread);
    for (const event of page.aux) addArtifact(event);
  }
  for (const event of store.liveOverlay) addRow(event, null);
  for (const event of store.liveAux) addArtifact(event);
  return { rows, artifactEvents };
}

/**
 * Spine projection for the active channel, derived from the channel window
 * store held in the React Query cache (same key/read pattern as
 * `useChannelWindowQuery`). Recomputes only when the store snapshot identity
 * changes — every merge replaces the store immutably, so memoizing on the
 * reference keeps ranking stable across unrelated re-renders (rank-stability
 * rule). Returns null when no channel is active or the "spine" preview
 * feature is off.
 */
export function useSpineProjection(
  channelId: string | null,
): SpineProjection | null {
  const enabled = useFeatureEnabled("spine");
  const queryClient = useQueryClient();
  const queryKey = channelWindowKey(channelId ?? "none");
  const windowQuery = useQuery({
    enabled: enabled && channelId !== null,
    queryKey,
    queryFn: () =>
      queryClient.getQueryData<ChannelWindowStore>(queryKey) ??
      emptyChannelWindowStore(),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const store = windowQuery.data ?? null;
  return React.useMemo(() => {
    if (!enabled || !channelId || !store) return null;
    const { rows, artifactEvents } = collectSpineInputs(store, channelId);
    return buildSpineProjection({
      channelId,
      rows,
      artifactEvents,
      now: Math.floor(Date.now() / 1_000),
      threadLimit: SPINE_THREAD_LIMIT,
    });
  }, [channelId, enabled, store]);
}
