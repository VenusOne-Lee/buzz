import { sendAgentObserverControl } from "@/shared/api/observerRelay";
import type { CancelManagedAgentTurnResult } from "@/shared/api/types";

/**
 * Result of sending a `resume_turn` observer control frame — the harness's
 * synchronous acknowledgement that the send landed, not proof the turn is
 * running again (that arrives later via the transcript).
 */
export type ResumeManagedAgentSessionResult = {
  status: "resumed" | "no_interrupted_turn";
};

export async function cancelManagedAgentTurn(
  pubkey: string,
  channelId: string,
): Promise<CancelManagedAgentTurnResult> {
  await sendAgentObserverControl(pubkey, {
    type: "cancel_turn",
    channelId,
  });
  return { status: "sent" };
}

/**
 * Send a `resume_turn` control frame to re-enter an interrupted (Stop'd)
 * turn — the continuity affordance for a dropped work object. `channelId` is
 * the same correlation id `cancelManagedAgentTurn` uses, so the harness re-
 * enters only the correlated channel's cancelled run; no other channel's
 * work is touched. Fire-and-forget on the send side, mirroring
 * `cancelManagedAgentTurn`: this resolves once the frame is sent, not once
 * the turn has actually resumed.
 */
export async function resumeManagedAgentSession(
  pubkey: string,
  channelId: string,
): Promise<ResumeManagedAgentSessionResult> {
  await sendAgentObserverControl(pubkey, {
    type: "resume_turn",
    channelId,
  });
  return { status: "resumed" };
}

/**
 * Send a live model-switch control frame to a running agent. The switch rides
 * the harness's cancel-switch-requeue path (busy turn) or invalidate-and-reapply
 * (idle); the outcome arrives asynchronously as a `control_result` observer
 * frame, not as the return value here. This is fire-and-forget on the send side.
 */
export async function switchManagedAgentModel(
  pubkey: string,
  channelId: string,
  modelId: string,
): Promise<void> {
  await sendAgentObserverControl(pubkey, {
    type: "switch_model",
    channelId,
    modelId,
  });
}
