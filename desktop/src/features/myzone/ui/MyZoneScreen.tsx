import * as React from "react";

import { useAppNavigation } from "@/app/navigation/useAppNavigation";
import { useChannelsQuery } from "@/features/channels/hooks";
import { useHomeFeedQuery } from "@/features/home/hooks";
import { buildInboxItems } from "@/features/home/lib/inbox";
import { projectAttention } from "@/features/myzone/lib/attention";
import { MyZoneView } from "@/features/myzone/ui/MyZoneView";
import { useMyZoneState } from "@/features/myzone/useMyZoneState";
import { useIdentityQuery } from "@/shared/api/hooks";
import { useUsersBatchQuery } from "@/features/profile/hooks";
import {
  isRelayUnreachableError,
  RELAY_UNREACHABLE_MESSAGE,
} from "@/shared/lib/relayError";

export function MyZoneScreen() {
  const identityQuery = useIdentityQuery();
  const currentPubkey = identityQuery.data?.pubkey;
  const homeFeedQuery = useHomeFeedQuery();
  const channelsQuery = useChannelsQuery();
  const { goChannel } = useAppNavigation();
  const { markDone, markWaiting, restore, zoneState } =
    useMyZoneState(currentPubkey);

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

  const handleOpen = React.useCallback(
    (channelId: string, messageId: string, threadRootId: string | null) => {
      void goChannel(channelId, { messageId, threadRootId });
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
      onMarkDone={markDone}
      onMarkWaiting={markWaiting}
      onOpen={handleOpen}
      onRestore={restore}
      projection={projection}
    />
  );
}
