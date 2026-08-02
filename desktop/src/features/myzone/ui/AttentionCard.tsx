import { ArrowUpRight, Check, Hourglass, RotateCcw } from "lucide-react";

import {
  attentionThreadRootId,
  type AttentionItem,
} from "@/features/myzone/lib/attention";
import { Button } from "@/shared/ui/button";
import { UserAvatar } from "@/shared/ui/UserAvatar";

type AttentionCardProps = {
  item: AttentionItem;
  onMarkDone: (id: string) => void;
  onMarkWaiting: (id: string) => void;
  onOpen: (
    channelId: string,
    messageId: string,
    threadRootId: string | null,
  ) => void;
  onRestore: (id: string) => void;
};

export function AttentionCard({
  item,
  onMarkDone,
  onMarkWaiting,
  onOpen,
  onRestore,
}: AttentionCardProps) {
  const inboxItem = item.inboxItem;
  const channelId = inboxItem.item.channelId;
  const canOpen = Boolean(channelId);

  const handleOpen = () => {
    if (!channelId) return;
    onOpen(channelId, inboxItem.item.id, attentionThreadRootId(inboxItem));
  };

  return (
    <article
      className="group rounded-xl border border-border/60 bg-background/80 px-4 py-3 transition-colors hover:border-border"
      data-testid={`myzone-card-${item.id}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <UserAvatar
          avatarUrl={inboxItem.avatarUrl}
          displayName={inboxItem.senderLabel}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-foreground">
              {inboxItem.senderLabel}
            </span>
            <span
              className="rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary"
              data-testid="myzone-card-reason"
            >
              {item.reason}
            </span>
            {item.reactivated ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-2xs font-medium text-amber-600 dark:text-amber-400">
                New activity
              </span>
            ) : null}
            <span className="ml-auto shrink-0 text-2xs text-muted-foreground">
              {inboxItem.timestampLabel}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-foreground/90">
            {inboxItem.preview || inboxItem.subject}
          </p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            {inboxItem.channelLabel ? (
              <span className="truncate text-2xs text-muted-foreground">
                #{inboxItem.channelLabel}
              </span>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {item.zone === "needsMe" ? (
                <>
                  <Button
                    data-testid="myzone-action-waiting"
                    onClick={() => onMarkWaiting(item.id)}
                    size="xs"
                    type="button"
                    variant="ghost"
                  >
                    <Hourglass />
                    Waiting
                  </Button>
                  <Button
                    data-testid="myzone-action-done"
                    onClick={() => onMarkDone(item.id)}
                    size="xs"
                    type="button"
                    variant="ghost"
                  >
                    <Check />
                    Done
                  </Button>
                </>
              ) : null}
              {item.zone === "waiting" ? (
                <>
                  <Button
                    data-testid="myzone-action-done"
                    onClick={() => onMarkDone(item.id)}
                    size="xs"
                    type="button"
                    variant="ghost"
                  >
                    <Check />
                    Done
                  </Button>
                  <Button
                    data-testid="myzone-action-restore"
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
                onClick={handleOpen}
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
      </div>
    </article>
  );
}
