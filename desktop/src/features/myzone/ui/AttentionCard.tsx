import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Hourglass,
  RotateCcw,
} from "lucide-react";
import * as React from "react";

import type { AttentionItem } from "@/features/myzone/lib/attention";
import { waitingDays } from "@/features/myzone/lib/attention";
import { deriveQuickOptions } from "@/features/myzone/lib/quickOptions";
import { extractTaskLine } from "@/features/myzone/lib/taskExtraction";
import type { AskType } from "@/features/myzone/lib/taskExtraction";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Markdown } from "@/shared/ui/markdown";

export type AttentionCardAction = "done" | "noted" | "waiting";

type AttentionCardProps = {
  expanded: boolean;
  isPending: boolean;
  item: AttentionItem;
  onAction: (item: AttentionItem, action: AttentionCardAction) => void;
  onOpen: (item: AttentionItem) => void;
  onReply: (item: AttentionItem, text: string) => void;
  onRestore: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  selected: boolean;
};

const BADGES: Record<AskType, { label: string; className: string }> = {
  decision: {
    label: "Decision",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  approval: { label: "Approval", className: "bg-primary/10 text-primary" },
  question: {
    label: "Question",
    className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  review: {
    label: "Review",
    className: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  blocked: {
    label: "Blocked",
    className: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  headsUp: { label: "Heads up", className: "bg-muted text-muted-foreground" },
};

const actionRowClassName =
  "ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100";

function cardHeadline(item: AttentionItem): string {
  if (item.ask) {
    return item.ask;
  }
  const extracted = extractTaskLine(item.inboxItem.item.content);
  return extracted || item.inboxItem.preview || item.inboxItem.subject;
}

/**
 * One attention item: a compact two-line card (badge + bold ask, then
 * sender/channel/staleness meta with hover-revealed actions) that expands
 * on click into the full message with quick-select options and a reply box.
 */
export function AttentionCard({
  expanded,
  isPending,
  item,
  onAction,
  onOpen,
  onReply,
  onRestore,
  onToggleExpanded,
  selected,
}: AttentionCardProps) {
  const inboxItem = item.inboxItem;
  const content = inboxItem.item.content;
  const canOpen = Boolean(inboxItem.item.channelId);
  const canPost = canOpen && !isPending;
  const isHeadsUp = item.askType === "headsUp";
  const badge = BADGES[item.askType];
  const days = waitingDays(
    inboxItem.latestActivityAt,
    Math.floor(Date.now() / 1_000),
  );

  const [replyText, setReplyText] = React.useState("");

  const quickOptions = React.useMemo(
    () => deriveQuickOptions(item.askType, item.ask, content),
    [item.askType, item.ask, content],
  );

  const handleBodyClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, textarea, a, input")) {
      return;
    }
    onToggleExpanded(item.id);
  };

  const handleReply = () => {
    const text = replyText.trim();
    if (!text) {
      return;
    }
    onReply(item, text);
    setReplyText("");
  };

  return (
    <article
      className={cn(
        "group rounded-xl border border-border/60 bg-background/80 px-4 py-2.5 transition-colors hover:border-border",
        selected && "ring-2 ring-primary/40",
      )}
      data-selected={selected || undefined}
      data-testid={`myzone-card-${item.id}`}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: card body toggle is a convenience; the expand button and actions are keyboard-reachable */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard expand is handled by the view-level j/k/e bindings */}
      <div className="cursor-pointer" onClick={handleBodyClick}>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium",
              badge.className,
            )}
            data-testid="myzone-card-badge"
          >
            {badge.label}
          </span>
          <span
            className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground"
            data-testid="myzone-card-ask"
          >
            {cardHeadline(item)}
          </span>
          <span className="ml-auto shrink-0 text-2xs text-muted-foreground">
            {inboxItem.timestampLabel}
          </span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-2xs text-muted-foreground">
            {inboxItem.senderLabel}
            {inboxItem.channelLabel ? ` in #${inboxItem.channelLabel}` : ""}
            {days > 0
              ? ` · waiting ${days} ${days === 1 ? "day" : "days"}`
              : inboxItem.timestampLabel
                ? ` · ${inboxItem.timestampLabel}`
                : ""}
          </span>
          {item.reactivated ? (
            <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-2xs font-medium text-amber-600 dark:text-amber-400">
              New activity
            </span>
          ) : null}
          <div className={actionRowClassName}>
            {item.zone === "needsMe" && !isHeadsUp ? (
              <>
                <Button
                  data-testid="myzone-action-waiting"
                  disabled={!canPost}
                  onClick={() => onAction(item, "waiting")}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  <Hourglass />
                  Waiting
                </Button>
                <Button
                  data-testid="myzone-action-done"
                  disabled={!canPost}
                  onClick={() => onAction(item, "done")}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  <Check />
                  Done
                </Button>
              </>
            ) : null}
            {item.zone === "needsMe" && isHeadsUp ? (
              <Button
                data-testid="myzone-action-noted"
                disabled={!canPost}
                onClick={() => onAction(item, "noted")}
                size="xs"
                type="button"
                variant="ghost"
              >
                <Check />
                Noted
              </Button>
            ) : null}
            {item.zone === "waiting" ? (
              <>
                <Button
                  data-testid="myzone-action-done"
                  disabled={!canPost}
                  onClick={() => onAction(item, "done")}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  <Check />
                  Done
                </Button>
                <Button
                  data-testid="myzone-action-restore"
                  disabled={isPending}
                  onClick={() => onRestore(item.id)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  <RotateCcw />
                  Needs me
                </Button>
              </>
            ) : null}
            {item.zone === "done" ? (
              <Button
                data-testid="myzone-action-restore"
                disabled={isPending}
                onClick={() => onRestore(item.id)}
                size="xs"
                type="button"
                variant="ghost"
              >
                <RotateCcw />
                Restore
              </Button>
            ) : null}
            <Button
              data-testid="myzone-action-open"
              disabled={!canOpen}
              onClick={() => onOpen(item)}
              size="xs"
              type="button"
              variant="outline"
            >
              <ArrowUpRight />
              Open
            </Button>
            {item.zone === "needsMe" && !isHeadsUp ? (
              <Button
                aria-label={expanded ? "Collapse" : "Expand"}
                data-testid="myzone-action-expand"
                onClick={() => onToggleExpanded(item.id)}
                size="xs"
                type="button"
                variant="ghost"
              >
                {expanded ? <ChevronUp /> : <ChevronDown />}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {expanded ? (
        <div
          className="mt-3 border-t border-border/60 pt-3"
          data-testid="myzone-card-expanded"
        >
          <div className="text-sm text-foreground/90">
            <Markdown content={content} />
          </div>
          {quickOptions.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {quickOptions.map((option) => (
                <Button
                  data-testid="myzone-quick-option"
                  disabled={!canPost}
                  key={option}
                  onClick={() => onReply(item, option)}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  {option}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex items-end gap-2">
            <textarea
              // biome-ignore lint/a11y/noAutofocus: expanding a card is an explicit intent to reply
              autoFocus
              className="min-h-16 w-full flex-1 resize-y rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
              data-testid="myzone-reply-input"
              onChange={(event) => setReplyText(event.target.value)}
              placeholder={
                canOpen
                  ? "Reply in the source thread…"
                  : "This item has no channel to reply into."
              }
              value={replyText}
            />
            <div className="flex shrink-0 flex-col gap-1">
              <Button
                data-testid="myzone-action-reply"
                disabled={!canPost || replyText.trim().length === 0}
                onClick={handleReply}
                size="xs"
                type="button"
              >
                Reply
              </Button>
              <Button
                disabled={!canOpen}
                onClick={() => onOpen(item)}
                size="xs"
                type="button"
                variant="outline"
              >
                <ArrowUpRight />
                Open
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
