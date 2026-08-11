import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  Flag,
  GitPullRequest,
  MessageCircleQuestion,
  Paperclip,
  Target,
} from "lucide-react";
import { useState } from "react";
import type { MinimapEntry } from "@/features/spine/types";
import { cn } from "@/shared/lib/cn";

type ThreadMinimapProps = {
  entries: MinimapEntry[];
  onJump: (eventId: string) => void;
  activeEventId?: string;
};

const CLASS_ICONS: Record<
  MinimapEntry["class"],
  React.ComponentType<{ className?: string }>
> = {
  decision: CheckCircle2,
  milestone: Flag,
  resolved: CheckCheck,
  answer: MessageCircleQuestion,
  // goal/question/blocker are Goal Threads marker classes (see
  // @/features/goals); the thread minimap doesn't render goal ledger
  // entries in P1, these exist to keep this Record exhaustive.
  goal: Target,
  question: MessageCircleQuestion,
  blocker: AlertTriangle,
  ask: MessageCircleQuestion,
  media: Paperclip,
  artifact: GitPullRequest,
};

/** Rows kept visible at each end when a long minimap is collapsed. */
const COLLAPSE_EDGE = 6;
const COLLAPSE_THRESHOLD = 12;

function MinimapRow({
  entry,
  active,
  onJump,
}: {
  entry: MinimapEntry;
  active: boolean;
  onJump: (eventId: string) => void;
}) {
  const Icon = CLASS_ICONS[entry.class];
  return (
    <button
      type="button"
      data-testid={`minimap-entry-${entry.class}`}
      onClick={() => onJump(entry.eventId)}
      title={entry.label}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs",
        "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent font-medium text-accent-foreground",
      )}
    >
      <Icon className="size-3 shrink-0" />
      <span className="min-w-0 truncate">{entry.label}</span>
    </button>
  );
}

/**
 * Thin vertical jump rail for one thread (Spine Phase 2). Pure render of
 * `buildMinimap` output: one row per entry, click jumps to the source event.
 * Long threads collapse the middle behind a "+N more" expander.
 */
export function ThreadMinimap({
  entries,
  onJump,
  activeEventId,
}: ThreadMinimapProps) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) {
    return null;
  }

  const collapsed = !expanded && entries.length > COLLAPSE_THRESHOLD;
  const head = collapsed ? entries.slice(0, COLLAPSE_EDGE) : entries;
  const tail = collapsed ? entries.slice(-COLLAPSE_EDGE) : [];
  const hiddenCount = collapsed ? entries.length - COLLAPSE_EDGE * 2 : 0;

  const renderRow = (entry: MinimapEntry, index: number) => (
    <MinimapRow
      key={`${entry.eventId}:${entry.class}:${index}`}
      entry={entry}
      active={entry.eventId === activeEventId}
      onJump={onJump}
    />
  );

  return (
    <nav
      data-testid="thread-minimap"
      aria-label="Thread minimap"
      className="flex w-44 shrink-0 flex-col gap-0.5 border-border border-l py-1 pl-1.5"
    >
      {head.map(renderRow)}
      {collapsed ? (
        <button
          type="button"
          data-testid="minimap-expand"
          onClick={() => setExpanded(true)}
          className="rounded px-1.5 py-0.5 text-left text-2xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          +{hiddenCount} more
        </button>
      ) : null}
      {tail.map((entry, index) => renderRow(entry, COLLAPSE_EDGE + index))}
    </nav>
  );
}
