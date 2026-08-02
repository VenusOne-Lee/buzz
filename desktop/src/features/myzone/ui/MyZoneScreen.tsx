import * as React from "react";

import { useAppNavigation } from "@/app/navigation/useAppNavigation";
import { useChannelsQuery } from "@/features/channels/hooks";
import { useHomeFeedQuery } from "@/features/home/hooks";
import { buildInboxItems } from "@/features/home/lib/inbox";
import { useSendMessageMutation } from "@/features/messages/hooks";
import {
  type AttentionItem,
  attentionThreadRootId,
  projectAttention,
} from "@/features/myzone/lib/attention";
import type { AttentionCardAction } from "@/features/myzone/ui/AttentionCard";
import { MyZoneView } from "@/features/myzone/ui/MyZoneView";
import { useActionQueue } from "@/features/myzone/useActionQueue";
import { useMyZoneState } from "@/features/myzone/useMyZoneState";
import { useUsersBatchQuery } from "@/features/profile/hooks";
import { useIdentityQuery } from "@/shared/api/hooks";
import {
  isRelayUnreachableError,
  RELAY_UNREACHABLE_MESSAGE,
} from "@/shared/lib/relayError";

/** Canned prose for the three park actions. Replies stay human-readable. */
const ACTION_CONFIG: Record<
  AttentionCardAction,
  { reply: string; toast: string; zone: "done" | "waiting" }
> = {
  done: {
    reply: "Done. The manual step you needed from me is complete.",
    toast: "Marked done — reply posts in 5s",
    zone: "done",
  },
  noted: {
    reply: "Noted. No answer needed from me, carry on.",
    toast: "Noted — reply posts in 5s",
    zone: "done",
  },
  waiting: {
    reply: "I have this. I am waiting on someone else before I can respond.",
    toast: "Parked as waiting — reply posts in 5s",
    zone: "waiting",
  },
};

export function MyZoneScreen() {
  const identityQuery = useIdentityQuery();
  const currentPubkey = identityQuery.data?.pubkey;
  const homeFeedQuery = useHomeFeedQuery();
  const channelsQuery = useChannelsQuery();
  const { goChannel } = useAppNavigation();
  const { markDone, markWaiting, restore, zoneState } =
    useMyZoneState(currentPubkey);
  const sendMutation = useSendMessageMutation(null, identityQuery.data);
  const { mutateAsync: sendMessage } = sendMutation;
  const { pendingIds, queueAction } = useActionQueue();

  const feed = homeFeedQuery.data;
  const profilePubkeys = React.useMemo(() => {
    if (!feed) return [];
    return [
      ...new Set(
        [
          ...feed.feed.mentions,
          ...feed.feed.needsAction,
          ...feed.feed.activity,
          ...feed.feed.agentActivity,
        ].map((item) => item.pubkey),
      ),
    ];
  }, [feed]);
  const profilesQuery = useUsersBatchQuery(profilePubkeys, {
    enabled: profilePubkeys.length > 0,
  });

  const inboxItems = React.useMemo(
    () =>
      buildInboxItems({
        channels: channelsQuery.data,
        currentPubkey,
        feed,
        profiles: profilesQuery.data?.profiles,
      }),
    [channelsQuery.data, currentPubkey, feed, profilesQuery.data?.profiles],
  );

  const projection = React.useMemo(
    () =>
      projectAttention(inboxItems, zoneState, Math.floor(Date.now() / 1_000)),
    [inboxItems, zoneState],
  );

  // Snapshot for undo/revert closures: reading via ref avoids rebinding the
  // action handlers (and re-rendering every card) on each zone change.
  const zoneStateRef = React.useRef(zoneState);
  zoneStateRef.current = zoneState;

  const buildRevert = React.useCallback(
    (id: string) => {
      const previous = zoneStateRef.current[id];
      return () => {
        if (!previous) {
          restore(id);
        } else if (previous.zone === "waiting") {
          markWaiting(id);
        } else {
          markDone(id);
        }
      };
    },
    [markDone, markWaiting, restore],
  );

  const sendThreadReply = React.useCallback(
    (item: AttentionItem, content: string) => {
      const channelId = item.inboxItem.item.channelId;
      if (!channelId) {
        return Promise.reject(new Error("This item has no source channel."));
      }
      return sendMessage({
        channelId,
        content,
        parentEventId: item.inboxItem.item.id,
        mentionPubkeys: [item.inboxItem.item.pubkey],
      });
    },
    [sendMessage],
  );

  const handleAction = React.useCallback(
    (item: AttentionItem, action: AttentionCardAction) => {
      const config = ACTION_CONFIG[action];
      queueAction({
        itemId: item.id,
        toastLabel: config.toast,
        apply: () =>
          config.zone === "waiting" ? markWaiting(item.id) : markDone(item.id),
        revert: buildRevert(item.id),
        send: () => sendThreadReply(item, config.reply),
      });
    },
    [buildRevert, markDone, markWaiting, queueAction, sendThreadReply],
  );

  const handleReply = React.useCallback(
    (item: AttentionItem, text: string) => {
      queueAction({
        itemId: item.id,
        toastLabel: "Reply queued — posts in 5s",
        apply: () => markDone(item.id),
        revert: buildRevert(item.id),
        send: () => sendThreadReply(item, text),
      });
    },
    [buildRevert, markDone, queueAction, sendThreadReply],
  );

  const handleOpen = React.useCallback(
    (item: AttentionItem) => {
      const channelId = item.inboxItem.item.channelId;
      if (!channelId) return;
      void goChannel(channelId, {
        messageId: item.inboxItem.item.id,
        threadRootId: attentionThreadRootId(item.inboxItem),
      });
    },
    [goChannel],
  );

  return (
    <MyZoneView
      errorMessage={
        homeFeedQuery.error !== null && homeFeedQuery.error !== undefined
          ? isRelayUnreachableError(homeFeedQuery.error)
            ? RELAY_UNREACHABLE_MESSAGE
            : homeFeedQuery.error instanceof Error
              ? homeFeedQuery.error.message
              : undefined
          : undefined
      }
      isLoading={homeFeedQuery.isLoading}
      onAction={handleAction}
      onOpen={handleOpen}
      onReply={handleReply}
      onRestore={restore}
      pendingIds={pendingIds}
      projection={projection}
    />
  );
}
