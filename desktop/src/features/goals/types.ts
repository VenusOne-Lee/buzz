import type { SpineMarker } from "@/features/spine/types";

/**
 * Goal Threads (Phase 1) — a target-first partner to Spine.
 *
 * A thread becomes a Goal Thread when its root message carries a `Goal:`
 * marker line (same author-declared marker convention as Spine). Phase 1 is
 * a pure client-side projection: no relay write, no new event kind, no
 * fetch beyond the thread's already-loaded messages. The kind 30023 goal
 * object referenced in the PRD is Phase 3 (the Spine emitter) — out of
 * scope here.
 *
 * See OUTBOX/GOAL_THREADS_PRD.md for the full spec.
 */

/** The goal's lifecycle state, always rendered with an as-of time. */
export type GoalState = "open" | "blocked" | "done";

/**
 * One ledger entry (a Decision, Open question, or Blocker), sourced from an
 * author-declared marker on the thread. Reuses Spine's marker shape as-is —
 * same fields, same provenance (eventId/authorPubkey/createdAt), so a ledger
 * entry deep-links exactly like a Spine card does.
 */
export type GoalLedgerEntry = SpineMarker;

/**
 * The full Goal Thread projection for one thread root, input to the Goal
 * panel. `declared: false` (returned as `null` by `buildGoalProjection`,
 * see goal.ts) means the thread has no `Goal:` marker — not a Goal Thread.
 */
export type GoalProjection = {
  threadRootId: string;
  /** One-line outcome, the `Goal:` marker's text. Full statement + definition
   *  of done live in channel canvas per the PRD; P1 renders this line only,
   *  to keep the zero-extra-fetch acceptance criterion. */
  outcome: string;
  state: GoalState;
  /** Newest created_at among the root and every reply considered. */
  asOf: number;
  decisions: GoalLedgerEntry[];
  questions: GoalLedgerEntry[];
  blockers: GoalLedgerEntry[];
};
