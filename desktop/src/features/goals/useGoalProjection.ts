import * as React from "react";
import { buildGoalProjection } from "@/features/goals/lib/goal";
import type { GoalProjection } from "@/features/goals/types";
import type { RelayEvent } from "@/shared/api/types";
import { useFeatureEnabled } from "@/shared/features";

/**
 * Goal Thread projection for one already-open thread panel.
 *
 * Unlike `useSpineProjection`, this is pure derivation, not a query: it does
 * not run a `useQuery` against the channel-window-store cache. The Goal
 * Threads PRD's Phase 1 acceptance criterion is "no extra per-message fetch
 * beyond the normal thread load" (see `@/features/goals/types`) — the thread
 * panel already holds the root event and reply events it needs to render the
 * transcript, so this hook just re-derives the projection from that same
 * data with `React.useMemo`, gated on the "goals" preview flag.
 */
export function useGoalProjection(
  rootEvent: RelayEvent | null,
  replies: RelayEvent[],
  enabled: boolean,
): GoalProjection | null {
  const goalsFeatureEnabled = useFeatureEnabled("goals");

  return React.useMemo(() => {
    if (!enabled || !goalsFeatureEnabled || !rootEvent) {
      return null;
    }
    return buildGoalProjection({
      threadRootId: rootEvent.id,
      rootEvent,
      replies,
      now: Math.floor(Date.now() / 1_000),
    });
  }, [enabled, goalsFeatureEnabled, rootEvent, replies]);
}
