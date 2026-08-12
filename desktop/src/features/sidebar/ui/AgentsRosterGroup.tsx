import * as React from "react";
import { ChevronDown } from "lucide-react";

import { useManagedAgentsQuery } from "@/features/agents/hooks";
import { useWorkingChannels } from "@/features/agents/agentWorkingSignal";
import { usePresenceQuery } from "@/features/presence/hooks";
import {
  classifyAgentRosterStatus,
  sortAgentRosterRows,
  type AgentRosterStatus,
} from "@/features/sidebar/lib/agentRosterPresence";
import { useAgentRosterPreferences } from "@/features/sidebar/lib/useAgentRosterPreferences";
import { AgentRosterRow } from "@/features/sidebar/ui/AgentRosterRow";
import type { ManagedAgent } from "@/shared/api/types";
import { normalizePubkey } from "@/shared/lib/pubkey";
import { cn } from "@/shared/lib/cn";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/shared/ui/sidebar";

const SECTION_LABEL_BUTTON_CLASS =
  "group/section-label flex w-fit max-w-[calc(100%-3rem)] cursor-pointer appearance-none items-center gap-1 text-left transition-colors hover:text-sidebar-foreground focus-visible:text-sidebar-foreground";
const SECTION_LABEL_CHEVRON_CLASS =
  "relative size-2.5 shrink-0 text-current opacity-0 transition-[color,opacity] group-hover/sidebar-section:opacity-100 group-hover/section-label:opacity-100 group-focus-within/sidebar-section:opacity-100 group-focus-visible/section-label:opacity-100";
const SECTION_LABEL_CHEVRON_ICON_CLASS =
  "absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2";

type AgentRosterEntry = {
  agent: ManagedAgent;
  status: AgentRosterStatus;
  isWorking: boolean;
};

/**
 * The sidebar "Agents" group (feature map: "Agent roster group with
 * presence"). Self-contained — fetches managed agents, presence
 * (`KIND_PRESENCE_UPDATE` / `_SNAPSHOT`, via `usePresenceQuery`), and the
 * unified working signal (`useWorkingChannels`, the same aggregate
 * `BotActivityBar` derives its working set from) directly, so no new props
 * thread through `AppSidebarProps` / `AppShell`.
 */
export function AgentsRosterGroup({
  currentPubkey,
  isCollapsed,
  onToggleCollapsed,
}: {
  currentPubkey?: string;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const managedAgentsQuery = useManagedAgentsQuery();
  const agents = managedAgentsQuery.data ?? [];
  const agentPubkeys = React.useMemo(
    () => agents.map((agent) => agent.pubkey),
    [agents],
  );
  const presenceQuery = usePresenceQuery(agentPubkeys, {
    enabled: agents.length > 0,
  });
  const presenceLookup = presenceQuery.data ?? {};
  const workingChannels = useWorkingChannels();
  const workingAgentPubkeys = React.useMemo(() => {
    const set = new Set<string>();
    for (const summary of workingChannels) {
      for (const pubkey of summary.agentPubkeys) {
        set.add(normalizePubkey(pubkey));
      }
    }
    return set;
  }, [workingChannels]);

  const {
    pinnedAgentPubkeys,
    mutedAgentPubkeys,
    pinAgent,
    unpinAgent,
    muteAgent,
    unmuteAgent,
  } = useAgentRosterPreferences(currentPubkey);

  const entries = React.useMemo<AgentRosterEntry[]>(() => {
    return agents.map((agent) => {
      const key = normalizePubkey(agent.pubkey);
      const isWorking = workingAgentPubkeys.has(key);
      const status = classifyAgentRosterStatus({
        presenceStatus: presenceLookup[key],
        isWorking,
        hasError: Boolean(agent.lastError),
        needsRestart: agent.needsRestart,
        personaOrphaned: agent.personaOrphaned,
      });
      return { agent, status, isWorking };
    });
  }, [agents, presenceLookup, workingAgentPubkeys]);

  const sortedEntries = React.useMemo(
    () =>
      sortAgentRosterRows(
        entries.map((entry) => ({
          pubkey: entry.agent.pubkey,
          name: entry.agent.name,
          status: entry.status,
          entry,
        })),
        (pubkey) => pinnedAgentPubkeys.has(pubkey),
      ).map((row) => row.entry),
    [entries, pinnedAgentPubkeys],
  );

  const needsYouCount = entries.filter(
    (entry) => entry.status === "needs-you",
  ).length;

  if (agents.length === 0) {
    return null;
  }

  return (
    <SidebarGroup className="group/sidebar-section select-none">
      <div className="relative">
        <SidebarGroupLabel asChild>
          <button
            aria-controls="sidebar-agents-roster"
            aria-expanded={!isCollapsed}
            className={SECTION_LABEL_BUTTON_CLASS}
            data-testid="agents-roster-section-label"
            onClick={onToggleCollapsed}
            type="button"
          >
            <span data-sidebar-section-title>Agents</span>
            {needsYouCount > 0 ? (
              <span
                className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-warning-bg px-1 font-mono text-3xs font-semibold text-warning"
                data-testid="agents-roster-needs-you-count"
              >
                {needsYouCount}
              </span>
            ) : null}
            <span aria-hidden="true" className={SECTION_LABEL_CHEVRON_CLASS}>
              <ChevronDown
                className={cn(
                  SECTION_LABEL_CHEVRON_ICON_CLASS,
                  isCollapsed ? "-rotate-90" : "rotate-0",
                )}
              />
            </span>
          </button>
        </SidebarGroupLabel>
      </div>
      {!isCollapsed ? (
        <SidebarMenu
          data-testid="agents-roster-list"
          id="sidebar-agents-roster"
        >
          {sortedEntries.map(({ agent, status }) => (
            <AgentRosterRow
              agent={agent}
              isMuted={mutedAgentPubkeys.has(agent.pubkey)}
              isPinned={pinnedAgentPubkeys.has(agent.pubkey)}
              key={agent.pubkey}
              muteAgent={muteAgent}
              pinAgent={pinAgent}
              status={status}
              unmuteAgent={unmuteAgent}
              unpinAgent={unpinAgent}
            />
          ))}
        </SidebarMenu>
      ) : null}
    </SidebarGroup>
  );
}
