import { toast } from "sonner";

import { useApprovalMutation } from "@/features/workflows/hooks";
import { DecisionCard } from "@/features/workflows/ui/DecisionCard";
import {
  approvalActionForChoice,
  approvalToDecisionRequest,
} from "@/features/workflows/ui/decisionCard.logic";
import type { WorkflowApproval } from "@/shared/api/types";

type WorkflowApprovalCardProps = {
  approval: WorkflowApproval;
};

/**
 * Live approval surface: renders the Team Table decision card for a pending
 * workflow approval and resolves the user's choice through the real relay-backed
 * grant/deny mutation. "Allow once" and "Allow for the mission" both grant; the
 * scope is preserved in the auditable note.
 */
export function WorkflowApprovalCard({ approval }: WorkflowApprovalCardProps) {
  const approvalMutation = useApprovalMutation();

  const isExpired = new Date(approval.expiresAt) < new Date();
  if (approval.status !== "pending" || isExpired) {
    return null;
  }

  const request = approvalToDecisionRequest(approval);

  return (
    <div data-testid="workflow-approval-card">
      <DecisionCard
        onDecide={(choice, note) => {
          const { action, note: composed } = approvalActionForChoice(
            choice,
            note,
          );
          approvalMutation.mutate(
            {
              token: approval.token,
              action,
              note: composed || undefined,
            },
            {
              onError: () => {
                toast.error("Could not submit decision. Please try again.");
              },
            },
          );
        }}
        pending={approvalMutation.isPending}
        request={request}
      />
    </div>
  );
}
