import * as React from "react";

import type { SpineLens, SpineProjection } from "@/features/spine/types";
import { cn } from "@/shared/lib/cn";

type SpineLensToggleProps = {
  lens: SpineLens;
  onLensChange: (lens: SpineLens) => void;
  projection: SpineProjection;
};

const LENSES: Array<{ lens: SpineLens; label: string }> = [
  { lens: "all", label: "All" },
  { lens: "decisions", label: "Decisions" },
  { lens: "questions", label: "Questions" },
  { lens: "threads", label: "Threads" },
  { lens: "artifacts", label: "Artifacts" },
  { lens: "media", label: "Media" },
  { lens: "links", label: "Links" },
];

/**
 * Segmented lens control for the Spine rail. Counts are derived from the
 * projection with the same lane mapping the rail uses to filter cards.
 */
export function SpineLensToggle({
  lens,
  onLensChange,
  projection,
}: SpineLensToggleProps) {
  const counts = React.useMemo<Record<SpineLens, number>>(() => {
    const decisions = projection.markers.filter(
      (marker) => marker.class === "decision" || marker.class === "resolved",
    ).length;
    const questions = projection.markers.filter(
      (marker) => marker.class === "answer",
    ).length;
    return {
      all:
        projection.markers.length +
        projection.threads.length +
        projection.media.length +
        projection.links.length +
        projection.artifacts.length,
      decisions,
      questions,
      threads: projection.threads.length,
      artifacts: projection.artifacts.length,
      media: projection.media.length,
      links: projection.links.length,
    };
  }, [projection]);

  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-muted/50 p-0.5">
      {LENSES.map(({ lens: value, label }) => {
        const active = lens === value;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            data-testid={`spine-lens-${value}`}
            key={value}
            onClick={() => onLensChange(value)}
            type="button"
          >
            {label}
            {counts[value] > 0 ? (
              <span className="text-2xs text-muted-foreground">
                {counts[value]}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
