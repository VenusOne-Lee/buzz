import { File, FolderGit2, GitPullRequest, Link2 } from "lucide-react";

import { formatInboxTimestamp } from "@/features/home/lib/inbox";
import type {
  MarkerClass,
  SpineArtifactEntry,
  SpineLinkEntry,
  SpineMarker,
  SpineMediaEntry,
  SpineThreadEntry,
} from "@/features/spine/types";
import { cn } from "@/shared/lib/cn";
import { truncatePubkey } from "@/shared/lib/pubkey";

/** Discriminated card payload — one shape per rail lane. */
export type SpineCardItem =
  | { variant: "thread"; entry: SpineThreadEntry }
  | { variant: "marker"; entry: SpineMarker }
  | { variant: "media"; entry: SpineMediaEntry }
  | { variant: "link"; entry: SpineLinkEntry }
  | { variant: "artifact"; entry: SpineArtifactEntry };

type SpineCardProps = {
  item: SpineCardItem;
  onOpen: () => void;
  profileNameFor?: (pubkey: string) => string | undefined;
};

const MARKER_BADGES: Record<MarkerClass, { label: string; className: string }> =
  {
    decision: {
      label: "Decision",
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
    milestone: {
      label: "Milestone",
      className: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    },
    resolved: {
      label: "Resolved",
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    answer: {
      label: "Answer",
      className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    // goal/question/blocker are Goal Threads marker classes (see
    // @/features/goals). Spine's own lanes never select them — decisions
    // filters decision|resolved, questions filters answer — so these three
    // exist only to keep this Record exhaustive over MarkerClass; if the
    // rail ever surfaces a raw marker of one of these classes, it renders
    // with a badge rather than crashing on a missing lookup.
    goal: {
      label: "Goal",
      className: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    },
    question: {
      label: "Question",
      className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    blocker: {
      label: "Blocker",
      className: "bg-red-500/15 text-red-600 dark:text-red-400",
    },
  };

const cardClassName =
  "relative flex min-h-[72px] w-full min-w-[200px] max-w-[260px] shrink-0 flex-col justify-center overflow-hidden rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-left transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

function authorLabel(
  pubkey: string,
  profileNameFor?: (pubkey: string) => string | undefined,
): string {
  return profileNameFor?.(pubkey) ?? truncatePubkey(pubkey);
}

function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * One compact rail card: a truncated title line plus one metadata line,
 * variant-shaped for threads, markers, media, links, and NIP-34 artifacts.
 */
export function SpineCard({ item, onOpen, profileNameFor }: SpineCardProps) {
  if (item.variant === "thread") {
    const entry = item.entry;
    const replies = `${entry.descendantCount} ${entry.descendantCount === 1 ? "reply" : "replies"}`;
    const people = `${entry.participantPubkeys.length} ${entry.participantPubkeys.length === 1 ? "person" : "people"}`;
    const time = formatInboxTimestamp(entry.lastReplyAt ?? entry.createdAt);
    return (
      <button
        aria-label={`Open thread: ${entry.title}`}
        className={cardClassName}
        data-testid="spine-card-thread"
        onClick={onOpen}
        type="button"
      >
        <p className="truncate text-sm font-medium text-foreground">
          {entry.title}
        </p>
        <p className="mt-0.5 truncate text-2xs text-muted-foreground">
          {replies} · {people} · {time}
        </p>
      </button>
    );
  }

  if (item.variant === "marker") {
    const entry = item.entry;
    const badge = MARKER_BADGES[entry.class];
    return (
      <button
        aria-label={`Open ${badge.label.toLowerCase()} marker: ${entry.text}`}
        className={cardClassName}
        data-testid="spine-card-marker"
        onClick={onOpen}
        type="button"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-medium",
              badge.className,
            )}
          >
            {badge.label}
          </span>
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {entry.text}
          </span>
        </div>
        <p className="mt-0.5 truncate text-2xs text-muted-foreground">
          {authorLabel(entry.authorPubkey, profileNameFor)} ·{" "}
          {formatInboxTimestamp(entry.createdAt)}
        </p>
      </button>
    );
  }

  if (item.variant === "media") {
    const entry = item.entry;
    const name = entry.filename ?? linkHost(entry.url);
    return (
      <button
        aria-label={`Open media: ${name}`}
        className={cn(cardClassName, "justify-end p-0")}
        data-testid="spine-card-media"
        onClick={onOpen}
        type="button"
      >
        {entry.thumbUrl ? (
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            src={entry.thumbUrl}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <File className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="relative w-full bg-gradient-to-t from-black/70 to-transparent px-3 pb-1.5 pt-4">
          <p className="truncate text-2xs font-medium text-white">{name}</p>
        </div>
      </button>
    );
  }

  if (item.variant === "link") {
    const entry = item.entry;
    return (
      <button
        aria-label={`Open link: ${entry.url}`}
        className={cardClassName}
        data-testid="spine-card-link"
        onClick={onOpen}
        type="button"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {linkHost(entry.url)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-2xs text-muted-foreground">
          {entry.previewKind ? `${entry.previewKind} · ` : ""}
          {authorLabel(entry.authorPubkey, profileNameFor)} ·{" "}
          {formatInboxTimestamp(entry.createdAt)}
        </p>
      </button>
    );
  }

  const entry = item.entry;
  const isRepo = entry.artifactType === "repo";
  const ArtifactIcon = isRepo ? FolderGit2 : GitPullRequest;
  return (
    <button
      aria-label={`Open ${isRepo ? "repository" : "pull request"}: ${entry.name}`}
      className={cardClassName}
      data-testid="spine-card-artifact"
      onClick={onOpen}
      type="button"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <ArtifactIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {entry.name}
        </span>
      </div>
      <p className="mt-0.5 truncate text-2xs text-muted-foreground">
        {isRepo ? "Repo" : "Pull request"} ·{" "}
        {authorLabel(entry.authorPubkey, profileNameFor)} ·{" "}
        {formatInboxTimestamp(entry.createdAt)}
      </p>
    </button>
  );
}
