import * as React from "react";

import type {
  AttentionItem,
  AttentionProjection,
  AttentionZone,
} from "@/features/myzone/lib/attention";
import { AttentionCard } from "@/features/myzone/ui/AttentionCard";
import { cn } from "@/shared/lib/cn";
import { TopChromeInsetHeader } from "@/shared/layout/TopChromeInsetHeader";

type MyZoneViewProps = {
  errorMessage?: string;
  isLoading: boolean;
  onMarkDone: (id: string) => void;
  onMarkWaiting: (id: string) => void;
  onOpen: (
    channelId: string,
    messageId: string,
    threadRootId: string | null,
  ) => void;
  onRestore: (id: string) => void;
  projection: AttentionProjection;
};

const ZONE_TABS: Array<{ zone: AttentionZone; label: string }> = [
  { zone: "needsMe", label: "Needs Me" },
  { zone: "waiting", label: "Waiting" },
  { zone: "done", label: "Done" },
];

const EMPTY_COPY: Record<AttentionZone, string> = {
  needsMe: "You're all caught up. Nothing needs you right now.",
  waiting: "Nothing is parked as waiting on someone else.",
  done: "Nothing resolved in the last 7 days.",
};

const tabButtonClassName =
  "h-7 rounded-full border border-transparent px-2.5 text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-border/70 data-[active=true]:bg-background/80 data-[active=true]:text-foreground data-[active=true]:shadow-xs";

export function MyZoneView({
  errorMessage,
  isLoading,
  onMarkDone,
  onMarkWaiting,
  onOpen,
  onRestore,
  projection,
}: MyZoneViewProps) {
  const [activeZone, setActiveZone] = React.useState<AttentionZone>("needsMe");

  const itemsByZone: Record<AttentionZone, AttentionItem[]> = {
    needsMe: projection.needsMe,
    waiting: projection.waiting,
    done: projection.done,
  };
  const activeItems = itemsByZone[activeZone];

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      data-testid="myzone-view"
    >
      <TopChromeInsetHeader data-tauri-drag-region flush>
        <header className="min-w-0 cursor-default select-none px-5 py-2">
          <div className="flex h-9 min-w-0 items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold text-foreground">
                MyZone
              </h1>
              <p className="truncate text-2xs text-muted-foreground">
                What needs you right now, across every channel and agent
              </p>
            </div>
          </div>
        </header>
      </TopChromeInsetHeader>
      <div className="flex items-center gap-1 px-5 py-2">
        {ZONE_TABS.map((tab) => (
          <button
            className={tabButtonClassName}
            data-active={activeZone === tab.zone}
            data-testid={`myzone-tab-${tab.zone}`}
            key={tab.zone}
            onClick={() => setActiveZone(tab.zone)}
            type="button"
          >
            {tab.label}
            <span
              className={cn(
                "ml-1.5 rounded-full px-1.5 text-3xs",
                activeZone === tab.zone
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {itemsByZone[tab.zone].length}
            </span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {errorMessage ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : isLoading ? (
          <p className="px-1 py-8 text-sm text-muted-foreground">
            Loading your attention items…
          </p>
        ) : activeItems.length === 0 ? (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 px-4 py-12 text-center"
            data-testid="myzone-empty-state"
          >
            <p className="text-sm text-muted-foreground">
              {EMPTY_COPY[activeZone]}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2" data-testid="myzone-card-list">
            {activeItems.map((item) => (
              <AttentionCard
                item={item}
                key={item.id}
                onMarkDone={onMarkDone}
                onMarkWaiting={onMarkWaiting}
                onOpen={onOpen}
                onRestore={onRestore}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
