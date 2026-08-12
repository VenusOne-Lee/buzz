import { resolveEffectiveModelLabel } from "@/features/agents/lib/effectiveModel";
import type { ManagedAgent } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";

/**
 * Small pill surfacing the resolved/effective model for a managed agent —
 * "a reviewer should always know what produced a result" (grok-bot-feature-map
 * "Per-agent model chip"). Styled to match `ModelPicker`'s own trigger pill
 * (rounded-full, muted fill, border) so the same model reads the same way in
 * both places.
 */
export function EffectiveModelChip({
  agent,
  className,
}: {
  agent: Pick<ManagedAgent, "model">;
  className?: string;
}) {
  const label = resolveEffectiveModelLabel(agent);
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink items-center truncate rounded-full border border-border/50 bg-muted/45 px-2 py-0.5 text-2xs font-medium text-muted-foreground",
        className,
      )}
      data-testid="effective-model-chip"
      title={label}
    >
      {label}
    </span>
  );
}
