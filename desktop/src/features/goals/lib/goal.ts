import {
  extractSpineMarkers,
  parseMarkers,
} from "@/features/spine/lib/markers";
import type { GoalProjection } from "@/features/goals/types";
import type { RelayEvent } from "@/shared/api/types";

/**
 * Goal Threads projection builder (Phase 1).
 *
 * See `@/features/goals/types` for the frozen `GoalProjection` contract and
 * `OUTBOX/GOAL_THREADS_PRD.md` for the full spec. Reuses Spine's marker
 * parsing (`parseMarkers`/`extractSpineMarkers`) as-is — no new grammar.
 */

/**
 * Parse the thread root's `Goal:` marker, if any. A thread is a Goal Thread
 * iff its root event carries a `Goal:` marker line. Multiple `Goal:` markers
 * on the root shouldn't normally occur; the first one wins.
 */
export function parseGoalDeclaration(
  rootEvent: RelayEvent,
): { outcome: string } | null {
  const markers = parseMarkers(rootEvent.content);
  const goalMarker = markers.find((marker) => marker.class === "goal");
  if (!goalMarker) {
    return null;
  }
  return { outcome: goalMarker.text };
}

export type BuildGoalProjectionInput = {
  threadRootId: string;
  rootEvent: RelayEvent;
  replies: RelayEvent[];
  /** Snapshot clock in unix seconds — unused today (asOf derives from event
   *  timestamps) but kept for parity with buildSpineProjection's input shape
   *  and for any future now-relative state P2 might add. */
  now: number;
};

/**
 * Compose the Goal Thread projection for one thread root, from a snapshot of
 * its root event and replies already loaded by the channel window. Returns
 * `null` when the root has no `Goal:` marker — not a Goal Thread.
 */
export function buildGoalProjection(
  input: BuildGoalProjectionInput,
): GoalProjection | null {
  const { threadRootId, rootEvent, replies } = input;
  const declaration = parseGoalDeclaration(rootEvent);
  if (!declaration) {
    return null;
  }

  const rows = [
    { event: rootEvent, thread: null },
    ...replies.map((event) => ({ event, thread: null })),
  ];
  const markers = extractSpineMarkers(rows, () => threadRootId);

  const decisions = markers.filter((marker) => marker.class === "decision");
  const questions = markers.filter((marker) => marker.class === "question");
  const blockers = markers.filter((marker) => marker.class === "blocker");
  const hasResolved = markers.some((marker) => marker.class === "resolved");

  const state = hasResolved ? "done" : blockers.length > 0 ? "blocked" : "open";

  let asOf = rootEvent.created_at;
  for (const reply of replies) {
    asOf = Math.max(asOf, reply.created_at);
  }

  return {
    threadRootId,
    outcome: declaration.outcome,
    state,
    asOf,
    decisions,
    questions,
    blockers,
  };
}
