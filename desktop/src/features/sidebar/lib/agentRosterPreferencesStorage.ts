/**
 * Local-only pin/mute preferences for the agent roster. Deliberately scoped
 * down from `channelStarsStorage.ts` + `channelStarsSync.ts`: channel
 * star/mute state is a relay-synced NIP list so it follows the user across
 * devices; there is no equivalent "agent pin/mute" event kind today, and
 * adding one is out of scope for this slice. This store is per-device
 * localStorage only, keyed by the viewer's own pubkey — a real, working
 * preference (it changes sort order and row emphasis), just not synced.
 */
const STORAGE_KEY_PREFIX = "buzz-agent-roster-prefs.v1";

export type AgentRosterPreferences = {
  version: 1;
  pinned: string[];
  muted: string[];
};

export const DEFAULT_AGENT_ROSTER_PREFERENCES: AgentRosterPreferences =
  Object.freeze({
    version: 1,
    pinned: [],
    muted: [],
  });

export function agentRosterPreferencesStorageKey(pubkey: string): string {
  return `${STORAGE_KEY_PREFIX}:${pubkey}`;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function parseAgentRosterPreferences(
  json: unknown,
): AgentRosterPreferences | null {
  if (typeof json !== "object" || json === null) return null;
  const obj = json as Record<string, unknown>;
  if (obj.version !== 1) return null;
  return {
    version: 1,
    pinned: stringArray(obj.pinned),
    muted: stringArray(obj.muted),
  };
}

export function readAgentRosterPreferences(
  pubkey: string,
): AgentRosterPreferences {
  try {
    const raw = window.localStorage.getItem(
      agentRosterPreferencesStorageKey(pubkey),
    );
    if (!raw) {
      return DEFAULT_AGENT_ROSTER_PREFERENCES;
    }
    const parsed = JSON.parse(raw);
    return (
      parseAgentRosterPreferences(parsed) ?? DEFAULT_AGENT_ROSTER_PREFERENCES
    );
  } catch {
    return DEFAULT_AGENT_ROSTER_PREFERENCES;
  }
}

export function writeAgentRosterPreferences(
  pubkey: string,
  prefs: AgentRosterPreferences,
): boolean {
  try {
    window.localStorage.setItem(
      agentRosterPreferencesStorageKey(pubkey),
      JSON.stringify(prefs),
    );
    return true;
  } catch {
    return false;
  }
}

/** Returns a new list with `value` added (include=true) or removed. */
export function toggleAgentRosterSetMember(
  list: readonly string[],
  value: string,
  include: boolean,
): string[] {
  const set = new Set(list);
  if (include) {
    set.add(value);
  } else {
    set.delete(value);
  }
  return [...set];
}
