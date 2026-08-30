import * as React from "react";

import {
  DEFAULT_AGENT_ROSTER_PREFERENCES,
  readAgentRosterPreferences,
  toggleAgentRosterSetMember,
  writeAgentRosterPreferences,
  type AgentRosterPreferences,
} from "@/features/sidebar/lib/agentRosterPreferencesStorage";

/**
 * Pin/mute state for the sidebar Agents roster. Local-only (see
 * agentRosterPreferencesStorage.ts doc comment) — real and persisted across
 * reloads on this device, not synced across devices via a relay event.
 */
export function useAgentRosterPreferences(pubkey: string | undefined) {
  const [prefs, setPrefs] = React.useState<AgentRosterPreferences>(() =>
    pubkey
      ? readAgentRosterPreferences(pubkey)
      : DEFAULT_AGENT_ROSTER_PREFERENCES,
  );

  React.useEffect(() => {
    setPrefs(
      pubkey
        ? readAgentRosterPreferences(pubkey)
        : DEFAULT_AGENT_ROSTER_PREFERENCES,
    );
  }, [pubkey]);

  const setMember = React.useCallback(
    (key: "pinned" | "muted", agentPubkey: string, include: boolean) => {
      if (!pubkey) return;
      setPrefs((prev) => {
        const next: AgentRosterPreferences = {
          ...prev,
          [key]: toggleAgentRosterSetMember(prev[key], agentPubkey, include),
        };
        writeAgentRosterPreferences(pubkey, next);
        return next;
      });
    },
    [pubkey],
  );

  const pinnedAgentPubkeys = React.useMemo(
    () => new Set(prefs.pinned),
    [prefs.pinned],
  );
  const mutedAgentPubkeys = React.useMemo(
    () => new Set(prefs.muted),
    [prefs.muted],
  );

  return {
    pinnedAgentPubkeys,
    mutedAgentPubkeys,
    pinAgent: React.useCallback(
      (agentPubkey: string) => setMember("pinned", agentPubkey, true),
      [setMember],
    ),
    unpinAgent: React.useCallback(
      (agentPubkey: string) => setMember("pinned", agentPubkey, false),
      [setMember],
    ),
    muteAgent: React.useCallback(
      (agentPubkey: string) => setMember("muted", agentPubkey, true),
      [setMember],
    ),
    unmuteAgent: React.useCallback(
      (agentPubkey: string) => setMember("muted", agentPubkey, false),
      [setMember],
    ),
  };
}
