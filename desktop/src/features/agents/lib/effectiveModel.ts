import type { ManagedAgent } from "@/shared/api/types";

/**
 * The model chip's label: the resolved/effective model for a managed agent.
 * Mirrors `ModelPicker`'s own resolution rule for the persisted default
 * (`agent.model ?? ... "Auto"`), but reads only the field already present on
 * `ManagedAgent` — no `getAgentModels()` fetch — so it's cheap to render on
 * every roster row. `ModelPicker`'s `updateManagedAgent` persists straight to
 * `agent.model` and invalidates `managedAgentsQueryKey`, so once that
 * mutation settles this label updates on the next render for free.
 */
export function resolveEffectiveModelLabel(
  agent: Pick<ManagedAgent, "model">,
): string {
  const trimmed = agent.model?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Auto";
}
