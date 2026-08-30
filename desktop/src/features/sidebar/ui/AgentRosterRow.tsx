import { Bot } from "lucide-react";
import type { ReactNode } from "react";

import { useAppNavigation } from "@/app/navigation/useAppNavigation";
import { isManagedAgentActive } from "@/features/agents/lib/managedAgentControlActions";
import { useStopManagedAgentMutation } from "@/features/agents/hooks";
import { useOpenAgentActivity } from "@/features/agents/useOpenAgentActivity";
import { EffectiveModelChip } from "@/features/agents/ui/EffectiveModelChip";
import {
  agentRosterStatusDotClassName,
  agentRosterStatusLabel,
  agentRosterStatusTextClassName,
  type AgentRosterStatus,
} from "@/features/sidebar/lib/agentRosterPresence";
import {
  buildAgentRosterMenuItems,
  type AgentRosterMenuActionId,
} from "@/features/sidebar/lib/agentRosterMenuActions";
import type { ManagedAgent } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/shared/ui/sidebar";
import { UserAvatar } from "@/shared/ui/UserAvatar";

/** Run a menu action next tick — mirrors the sidebar's channel context menu
 * (`deferMenuAction` in sidebarMenuHelpers.tsx): avoids acting while Radix is
 * still tearing the menu down. */
function deferMenuAction(action: () => void) {
  globalThis.setTimeout(action, 0);
}

export function AgentRosterRow({
  agent,
  isMuted,
  isPinned,
  muteAgent,
  pinAgent,
  status,
  unmuteAgent,
  unpinAgent,
}: {
  agent: ManagedAgent;
  isMuted: boolean;
  isPinned: boolean;
  muteAgent: (pubkey: string) => void;
  pinAgent: (pubkey: string) => void;
  status: AgentRosterStatus;
  unmuteAgent: (pubkey: string) => void;
  unpinAgent: (pubkey: string) => void;
}) {
  const { openAgentActivity } = useOpenAgentActivity();
  const { goAgentProfile } = useAppNavigation();
  const stopAgentMutation = useStopManagedAgentMutation();

  const canPause = isManagedAgentActive(agent) && !stopAgentMutation.isPending;
  const menuItems = buildAgentRosterMenuItems({
    isPinned,
    isMuted,
    canPause,
  });

  const handleAction = (id: AgentRosterMenuActionId) => {
    switch (id) {
      case "pin":
        pinAgent(agent.pubkey);
        return;
      case "unpin":
        unpinAgent(agent.pubkey);
        return;
      case "mute":
        muteAgent(agent.pubkey);
        return;
      case "unmute":
        unmuteAgent(agent.pubkey);
        return;
      case "pause":
        stopAgentMutation.mutate(agent.pubkey);
        return;
      case "openWork":
        openAgentActivity(agent.pubkey);
        return;
      case "settings":
        void goAgentProfile(agent.pubkey);
        return;
    }
  };

  const statusLabel = agentRosterStatusLabel(status);
  const rowTooltip = `${agent.name} — ${statusLabel}`;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <SidebarMenuItem className="content-visibility-auto-row">
          <SidebarMenuButton
            className={cn(
              "h-auto min-h-11 items-start gap-2 py-1.5",
              isMuted && "opacity-60",
            )}
            data-testid={`agent-roster-row-${agent.pubkey}`}
            onClick={() => openAgentActivity(agent.pubkey)}
            size="lg"
            tooltip={rowTooltip}
            type="button"
          >
            <span className="relative mt-0.5 shrink-0">
              <UserAvatar
                avatarUrl={agent.avatarUrl}
                displayName={agent.name}
                size="sm"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-sidebar",
                  agentRosterStatusDotClassName(status),
                )}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {agent.name}
                </span>
                <Bot
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
                />
              </div>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    "shrink-0 text-2xs font-medium",
                    agentRosterStatusTextClassName(status),
                  )}
                >
                  {statusLabel}
                </span>
                <EffectiveModelChip agent={agent} className="shrink" />
              </div>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </ContextMenuTrigger>
      <ContextMenuContent data-testid={`agent-roster-menu-${agent.pubkey}`}>
        {menuItems.flatMap((item): ReactNode[] => {
          const nodes: ReactNode[] = [];
          if (item.id === "pause" || item.id === "openWork") {
            nodes.push(<ContextMenuSeparator key={`sep-${item.id}`} />);
          }
          nodes.push(
            <ContextMenuItem
              data-testid={`agent-roster-menu-${agent.pubkey}-${item.id}`}
              disabled={item.disabled}
              key={item.id}
              onSelect={() => deferMenuAction(() => handleAction(item.id))}
            >
              {item.label}
            </ContextMenuItem>,
          );
          return nodes;
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
}
