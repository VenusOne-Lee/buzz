import * as React from "react";
import { toast } from "sonner";

import { useApprovalMutation } from "@/features/workflows/hooks";
import { DecisionCard } from "@/features/workflows/ui/DecisionCard";
import {
  type DecisionChoice,
  type DecisionResolution,
  approvalActionForChoice,
  channelApprovalFromEvent,
} from "@/features/workflows/ui/decisionCard.logic";

type ChannelApprovalCardProps = {
  /** The raw approval-requested (kind:46010) event from the channel timeline. */
  event: {
    content?: string | null;
    tags?: ReadonlyArray<ReadonlyArray<string>>;
  };
};

/**
 * In-channel approval surface: renders the same functional Team Table decision
 * card that the workflow-run panel uses, but sourced from a raw
 * approval-requested (kind:46010) timeline event, so an agent's
 * return-only-for-approval request is actionable inline in the room. The user's
 * choice resolves through the existing relay-backed grant/deny mutation
 * (kind:46030 / :46031) — the same signed action `WorkflowApprovalCard` uses —
 * keyed by the event's `["t", token]` tag.
 *
 * Once the user resolves it, the card condenses to its resolved state. If the
 * event carries no usable token it returns `null` so the caller can fall back
 * to plain rendering rather than show an unactionable control.
 */
export function ChannelApprovalCard({ event }: ChannelApprovalCardProps) {
  const approvalMutation = useApprovalMutation();
  const [resolution, setResolution] = React.useState<DecisionResolution | null>(
    null,
  );

  const descriptor = React.useMemo(
    () => channelApprovalFromEvent(event),
    [event],
  );

  if (!descriptor) {
    return null;
  }

  const decide = (choice: DecisionChoice, note: string) => {
    const { action, note: composed } = approvalActionForChoice(choice, note);
    approvalMutation.mutate(
      {
        token: descriptor.token,
        action,
        note: composed || undefined,
      },
      {
        onSuccess: () => {
          setResolution({ choice, at: Date.now() });
        },
        onError: () => {
          toast.error("Could not submit decision. Please try again.");
        },
      },
    );
  };

  return (
    <div className="mt-2" data-testid="channel-approval-card">
      <DecisionCard
        onDecide={decide}
        pending={approvalMutation.isPending}
        request={descriptor.request}
        resolution={resolution}
      />
    </div>
  );
}
