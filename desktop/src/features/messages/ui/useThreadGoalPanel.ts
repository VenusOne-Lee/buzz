import * as React from "react";

import { useGoalProjection } from "@/features/goals/useGoalProjection";
import type { TimelineMessage } from "@/features/messages/types";
import type { UserProfileLookup } from "@/features/profile/lib/identity";
import type { RelayEvent } from "@/shared/api/types";

/**
 * Goal Threads' `useGoalProjection` takes `RelayEvent`-shaped input (see
 * `@/features/goals/useGoalProjection`), but the thread panel only holds
 * `TimelineMessage` — the timeline's post-processed render model. Every field
 * `buildGoalProjection` reads (id/pubkey/created_at/content/tags) has a
 * `TimelineMessage` equivalent, so this is a field rename over data the panel
 * already has in scope, not a new fetch.
 */
function toGoalRelayEvent(message: TimelineMessage): RelayEvent {
  return {
    id: message.id,
    pubkey: message.signerPubkey ?? message.pubkey ?? "",
    created_at: message.createdAt,
    kind: message.kind ?? 0,
    tags: message.tags ?? [],
    content: message.body,
    sig: "",
  };
}

/**
 * Wires `MessageThreadPanel`'s already-loaded root/reply messages into the
 * Goal Threads projection (P1: no extra fetch — see
 * `@/features/goals/types`), and provides the panel's two callbacks. Split
 * out of `MessageThreadPanel.tsx` to keep that file under the desktop
 * file-size ratchet.
 */
export function useThreadGoalPanel({
  threadHead,
  threadMessages,
  isHuddleTranscript,
  profiles,
  threadBodyRef,
}: {
  threadHead: TimelineMessage | null;
  threadMessages: TimelineMessage[];
  isHuddleTranscript: boolean;
  profiles?: UserProfileLookup;
  threadBodyRef: React.RefObject<HTMLDivElement | null>;
}) {
  const goalRootEvent = React.useMemo(
    () => (threadHead ? toGoalRelayEvent(threadHead) : null),
    [threadHead],
  );
  const goalReplyEvents = React.useMemo(
    () => threadMessages.map(toGoalRelayEvent),
    [threadMessages],
  );
  // Disabled for huddle transcripts, which aren't author-declared threads.
  const goalProjection = useGoalProjection(
    goalRootEvent,
    goalReplyEvents,
    !isHuddleTranscript,
  );
  const handleOpenGoalSource = React.useCallback(
    (eventId: string) => {
      const container = threadBodyRef.current;
      if (!container) return;
      // No scroll-to-message helper is exposed by this panel today (the
      // existing `scrollTargetId`/`useAnchoredScroll` plumbing is driven
      // from outside, by the channel pane's own navigation state) — a
      // direct querySelector + scrollIntoView against the row's
      // `data-message-id` (see MessageRow) is the simplest P1-correct
      // jump-to-source.
      const target = container.querySelector<HTMLElement>(
        `[data-message-id="${eventId}"]`,
      );
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [threadBodyRef],
  );
  const goalPanelProfileNameFor = React.useCallback(
    (pubkey: string) =>
      profiles?.[pubkey]?.displayName ?? profiles?.[pubkey]?.name ?? undefined,
    [profiles],
  );

  return { goalProjection, handleOpenGoalSource, goalPanelProfileNameFor };
}
