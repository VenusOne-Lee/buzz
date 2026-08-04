import * as React from "react";

import { formatInboxTimestamp } from "@/features/home/lib/inbox";
import type { SpineLens, SpineProjection } from "@/features/spine/types";
import { SpineCard, type SpineCardItem } from "@/features/spine/ui/SpineCard";
import { SpineLensToggle } from "@/features/spine/ui/SpineLensToggle";

type SpineRailProps = {
  projection: SpineProjection;
  lens: SpineLens;
  onLensChange: (lens: SpineLens) => void;
  onOpenThread: (rootId: string, eventId?: string) => void;
  onOpenUrl: (url: string) => void;
  profileNameFor?: (pubkey: string) => string | undefined;
};

function itemKey(item: SpineCardItem): string {
  if (item.variant === "thread") {
    return `thread-${item.entry.rootId}`;
  }
  return `${item.variant}-${item.entry.eventId}`;
}

function itemTime(item: SpineCardItem): number {
  if (item.variant === "thread") {
    return item.entry.lastReplyAt ?? item.entry.createdAt;
  }
  return item.entry.createdAt;
}

function byRecency(a: SpineCardItem, b: SpineCardItem): number {
  return itemTime(b) - itemTime(a);
}

/** Round-robin across lanes: top entry of each lane, then the next, etc. */
function interleave(lanes: SpineCardItem[][]): SpineCardItem[] {
  const out: SpineCardItem[] = [];
  const max = Math.max(0, ...lanes.map((lane) => lane.length));
  for (let index = 0; index < max; index += 1) {
    for (const lane of lanes) {
      const item = lane[index];
      if (item) {
        out.push(item);
      }
    }
  }
  return out;
}

/**
 * The Spine rail: lens toggle on the left, a horizontally scrollable strip
 * of lane cards in the middle, and a subtle "as of" freshness stamp on the
 * right. Pure projection renderer — no fetching, no relay access.
 */
export function SpineRail({
  projection,
  lens,
  onLensChange,
  onOpenThread,
  onOpenUrl,
  profileNameFor,
}: SpineRailProps) {
  const items = React.useMemo<SpineCardItem[]>(() => {
    const markers = projection.markers
      .map((entry): SpineCardItem => ({ variant: "marker", entry }))
      .sort(byRecency);
    const threads = projection.threads
      .map((entry): SpineCardItem => ({ variant: "thread", entry }))
      .sort(byRecency);
    const media = projection.media
      .map((entry): SpineCardItem => ({ variant: "media", entry }))
      .sort(byRecency);
    const links = projection.links
      .map((entry): SpineCardItem => ({ variant: "link", entry }))
      .sort(byRecency);
    const artifacts = projection.artifacts
      .map((entry): SpineCardItem => ({ variant: "artifact", entry }))
      .sort(byRecency);

    switch (lens) {
      case "all":
        return interleave([markers, threads, media, links, artifacts]);
      case "decisions":
        return markers.filter(
          (item) =>
            item.variant === "marker" &&
            (item.entry.class === "decision" ||
              item.entry.class === "resolved"),
        );
      case "questions":
        return markers.filter(
          (item) => item.variant === "marker" && item.entry.class === "answer",
        );
      case "threads":
        return threads;
      case "artifacts":
        return artifacts;
      case "media":
        return media;
      case "links":
        return links;
      default:
        return [];
    }
  }, [projection, lens]);

  const handleOpen = (item: SpineCardItem) => {
    switch (item.variant) {
      case "thread":
        onOpenThread(item.entry.rootId);
        break;
      case "marker":
      case "media":
        onOpenThread(item.entry.threadRootId, item.entry.eventId);
        break;
      case "link":
        onOpenUrl(item.entry.url);
        break;
      case "artifact":
        if (item.entry.webUrl) {
          onOpenUrl(item.entry.webUrl);
        } else {
          onOpenThread(item.entry.eventId);
        }
        break;
    }
  };

  return (
    <div
      className="flex min-w-0 items-center gap-2 px-2 py-1.5"
      data-testid="spine-rail"
    >
      <SpineLensToggle
        lens={lens}
        onLensChange={onLensChange}
        projection={projection}
      />
      <div className="flex min-w-0 flex-1 items-stretch gap-2 overflow-x-auto pb-1">
        {items.length === 0 ? (
          <p className="self-center px-1 text-xs text-muted-foreground">
            Nothing here yet.
          </p>
        ) : (
          items.map((item) => (
            <SpineCard
              item={item}
              key={itemKey(item)}
              onOpen={() => handleOpen(item)}
              profileNameFor={profileNameFor}
            />
          ))
        )}
      </div>
      {projection.asOf > 0 ? (
        <span className="shrink-0 whitespace-nowrap text-2xs text-muted-foreground/80">
          as of {formatInboxTimestamp(projection.asOf)}
        </span>
      ) : null}
    </div>
  );
}
