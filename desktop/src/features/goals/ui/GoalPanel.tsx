import type {
  GoalLedgerEntry,
  GoalProjection,
  GoalState,
} from "@/features/goals/types";
import { formatInboxTimestamp } from "@/features/home/lib/inbox";
import { cn } from "@/shared/lib/cn";
import { truncatePubkey } from "@/shared/lib/pubkey";

type GoalPanelProps = {
  projection: GoalProjection;
  onOpenSource: (eventId: string) => void;
  profileNameFor?: (pubkey: string) => string | undefined;
};

/**
 * State badge palette, kept in the same hue family as Spine's MARKER_BADGES
 * (see @/features/spine/ui/SpineCard): `done` reuses Resolved's emerald,
 * `blocked` reuses Blocker's red, and `open` stays neutral so an in-flight
 * goal reads as calm rather than as an alert.
 */
const STATE_BADGES: Record<GoalState, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-muted text-muted-foreground",
  },
  blocked: {
    label: "Blocked",
    className: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  done: {
    label: "Done",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
};

const sectionHeaderClassName =
  "flex items-center gap-1.5 px-1.5 pb-0.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground";

const entryClassName =
  "flex w-full min-w-0 items-baseline gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

function authorLabel(
  pubkey: string,
  profileNameFor?: (pubkey: string) => string | undefined,
): string {
  return profileNameFor?.(pubkey) ?? truncatePubkey(pubkey);
}

type LedgerSectionProps = {
  label: string;
  entries: GoalLedgerEntry[];
  testId: string;
  onOpenSource: (eventId: string) => void;
  profileNameFor?: (pubkey: string) => string | undefined;
};

/**
 * One ledger lane: a label + count header, then one line per entry that
 * deep-links to the message that set it (same open-the-source affordance as
 * a Spine card).
 */
function LedgerSection({
  label,
  entries,
  testId,
  onOpenSource,
  profileNameFor,
}: LedgerSectionProps) {
  return (
    <section className="min-w-0" data-testid={testId}>
      <h3 className={sectionHeaderClassName}>
        {label}
        <span className="rounded-full bg-muted px-1.5 text-3xs font-medium text-muted-foreground">
          {entries.length}
        </span>
      </h3>
      {entries.length === 0 ? (
        <p className="px-1.5 py-1 text-2xs text-muted-foreground">None yet</p>
      ) : (
        <ul className="flex min-w-0 flex-col">
          {entries.map((entry) => (
            <li className="min-w-0" key={entry.eventId}>
              <button
                aria-label={`Open source message for ${label.toLowerCase()}: ${entry.text}`}
                className={entryClassName}
                onClick={() => onOpenSource(entry.eventId)}
                type="button"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {entry.text}
                </span>
                <span className="shrink-0 whitespace-nowrap text-2xs text-muted-foreground">
                  {authorLabel(entry.authorPubkey, profileNameFor)} ·{" "}
                  {formatInboxTimestamp(entry.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The Goal Thread panel: the pinned goal header (outcome, state badge, as-of
 * time) over the live ledger (Decisions, Open questions, Blockers). Pure
 * projection renderer — no fetching, no relay access, and no transcript; the
 * thread transcript renders unchanged below this panel.
 */
export function GoalPanel({
  projection,
  onOpenSource,
  profileNameFor,
}: GoalPanelProps) {
  const badge = STATE_BADGES[projection.state];

  return (
    <section
      className="flex min-w-0 flex-col gap-2 border-b border-border/80 bg-background/95 px-5 py-3"
      data-testid="goal-panel"
    >
      <header className="flex min-w-0 items-center gap-2">
        <h2
          className="min-w-0 flex-1 truncate text-base font-semibold text-foreground"
          data-testid="goal-panel-outcome"
          title={projection.outcome}
        >
          {projection.outcome}
        </h2>
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-medium",
            badge.className,
          )}
          data-testid="goal-panel-state"
        >
          {badge.label}
        </span>
        {projection.asOf > 0 ? (
          <span className="shrink-0 whitespace-nowrap text-2xs text-muted-foreground/80">
            as of {formatInboxTimestamp(projection.asOf)}
          </span>
        ) : null}
      </header>
      <div className="flex min-w-0 flex-col gap-1.5" data-testid="goal-ledger">
        <LedgerSection
          entries={projection.decisions}
          label="Decisions"
          onOpenSource={onOpenSource}
          profileNameFor={profileNameFor}
          testId="goal-ledger-decisions"
        />
        <LedgerSection
          entries={projection.questions}
          label="Open questions"
          onOpenSource={onOpenSource}
          profileNameFor={profileNameFor}
          testId="goal-ledger-questions"
        />
        <LedgerSection
          entries={projection.blockers}
          label="Blockers"
          onOpenSource={onOpenSource}
          profileNameFor={profileNameFor}
          testId="goal-ledger-blockers"
        />
      </div>
    </section>
  );
}
