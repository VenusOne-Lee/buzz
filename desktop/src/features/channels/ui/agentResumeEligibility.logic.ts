/**
 * Resume-a-dropped-thread eligibility.
 *
 * "Interrupted" is a local, session-scoped memory of an owner-issued Stop
 * (`cancel_turn`) signal — `AgentSessionThreadPanel` records the moment the
 * send is confirmed, and this module answers the pure question of whether a
 * Resume control should be offered right now. Keeping the decision here
 * (rather than inline in the component) makes the state machine unit-testable
 * without a DOM, mirroring `decisionCard.logic.ts`.
 *
 * The affordance is intentionally scoped to *this* (agent, channel) session:
 * `stoppedAt` is only ever set for the session whose Stop control was
 * clicked, so Resume can never re-enter a different session's run.
 */

export type ResumeEligibilityInput = {
  /** True while the agent has an active/working turn for this session. */
  isWorking: boolean;
  /**
   * True only when this community can send control frames to this agent
   * (locally managed agents only) — the same gate `canStopCurrentTurn` uses.
   */
  canInterruptTurn: boolean;
  /**
   * Epoch ms the owner's Stop signal was confirmed sent for this exact
   * (agent, channel) session, or `null` if Stop was never sent for it (or
   * the record was cleared by a resume / a fresh turn / a scope change).
   */
  stoppedAt: number | null;
  /**
   * Epoch ms of the latest observer telemetry activity seen for this
   * session, or `null` if there has been none. Used to detect that the
   * session already moved on since Stop was sent (e.g. a new @mention
   * started a fresh turn) — Resume would be stale in that case.
   */
  latestActivityAt: number | null;
};

/**
 * Whether an interrupted work object should currently show Resume.
 *
 * A session is resume-eligible when: control frames can reach it, it is not
 * currently working, a Stop signal was sent for it, and no newer activity
 * has occurred since (which would mean it already moved on without Resume).
 */
export function isResumeEligible(input: ResumeEligibilityInput): boolean {
  if (!input.canInterruptTurn) {
    return false;
  }
  if (input.isWorking) {
    return false;
  }
  if (input.stoppedAt === null) {
    return false;
  }
  if (
    input.latestActivityAt !== null &&
    input.latestActivityAt > input.stoppedAt
  ) {
    return false;
  }
  return true;
}

/**
 * Whether a previously-recorded Stop should be forgotten because the
 * session has since become live again (a new turn started — via Resume, a
 * fresh @mention, or anything else). Once forgotten, `isResumeEligible`
 * naturally returns `false` until the next confirmed Stop.
 */
export function shouldClearStopRecord(input: {
  isWorking: boolean;
  stoppedAt: number | null;
}): boolean {
  return input.stoppedAt !== null && input.isWorking;
}
