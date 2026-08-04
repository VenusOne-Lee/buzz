import { ListTree } from "lucide-react";
import * as React from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

import { useAppNavigation } from "@/app/navigation/useAppNavigation";
import type { SpineLens } from "@/features/spine/types";
import { SpineRail } from "@/features/spine/ui/SpineRail";
import { useSpineProjection } from "@/features/spine/useSpineProjection";
import { useFeatureEnabled } from "@/shared/features";
import { channelChrome } from "@/shared/layout/chromeLayout";
import { cn } from "@/shared/lib/cn";

type ChannelSpineStripProps = {
  channelId: string | null;
};

/**
 * Channel-top Spine mount: the toggle button and, when open, the rail —
 * self-contained behind the `spine` preview flag so the channel pane
 * carries a single-line mount.
 */
export function ChannelSpineStrip({ channelId }: ChannelSpineStripProps) {
  const enabled = useFeatureEnabled("spine");
  const { goChannel } = useAppNavigation();
  const [open, setOpen] = React.useState(false);
  const [lens, setLens] = React.useState<SpineLens>("all");
  const projection = useSpineProjection(enabled ? channelId : null);

  const handleOpenThread = React.useCallback(
    (rootId: string, eventId?: string) => {
      if (!channelId) return;
      void goChannel(channelId, {
        messageId: eventId ?? rootId,
        threadRootId: rootId,
      });
    },
    [channelId, goChannel],
  );
  const handleOpenUrl = React.useCallback((url: string) => {
    void openUrl(url);
  }, []);

  if (!enabled || !channelId) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-30 flex flex-col",
        channelChrome.top,
      )}
    >
      <div className="flex justify-end px-5 pt-1">
        <button
          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          data-testid="spine-toggle"
          onClick={() => setOpen((value) => !value)}
          title="Spine"
          type="button"
        >
          <ListTree className="h-4 w-4" />
        </button>
      </div>
      {open && projection ? (
        <div className="pointer-events-auto border-b border-border/80 bg-background/95 backdrop-blur-md">
          <SpineRail
            lens={lens}
            onLensChange={setLens}
            onOpenThread={handleOpenThread}
            onOpenUrl={handleOpenUrl}
            projection={projection}
          />
        </div>
      ) : null}
    </div>
  );
}
