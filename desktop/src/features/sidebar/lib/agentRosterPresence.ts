import type { PresenceStatus } from "@/shared/api/types";

/**
 * The roster's three-state model (feature map: "the roster reflects live
 * active / idle / needs-you state"). Sourced from the same signals
 * BotActivityBar already keys off — the unified `useAgentWorking` working
 * set (`desktop/src/features/agents/agentWorkingSignal.ts`) and presence
 * (`usePresenceQuery`, backed by `KIND_PRESENCE_UPDATE` / `_SNAPSHOT`) — plus
 * the managed-agent record fields `ManagedAgentRow` already surfaces as
 * inline warnings (lastError, needsRestart, personaOrphaned), promoted here
 * from a per-row paragraph to a roster-level state.
 */
export type AgentRosterStatus = "active" | "idle" | "needs-you";

export type AgentRosterStatusInput = {
  presenceStatus: PresenceStatus | undefined;
  isWorking: boolean;
  hasError: boolean;
  needsRestart: boolean;
  personaOrphaned: boolean;
};

export function classifyAgentRosterStatus(
  input: AgentRosterStatusInput,
): AgentRosterStatus {
  if (input.hasError || input.needsRestart || input.personaOrphaned) {
    return "needs-you";
  }
  if (input.isWorking) {
    return "active";
  }
  return input.presenceStatus === "online" ? "active" : "idle";
}

export function agentRosterStatusLabel(status: AgentRosterStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "idle":
      return "Idle";
    case "needs-you":
      return "Needs you";
  }
}

// Semantic-token-only styling (no hex, no Tailwind literal color classes).
// "needs-you" reuses the `warning` token the rest of the agent surfaces
// already use for non-routine, needs-a-human states (see the Work-object
// "Interrupted" row in docs/buzz-one/README.md, and ModelPicker's
// "restart to apply" note) rather than introducing a new color.
export function agentRosterStatusDotClassName(
  status: AgentRosterStatus,
): string {
  switch (status) {
    case "active":
      return "bg-primary motion-safe:animate-pulse";
    case "needs-you":
      return "bg-warning";
    case "idle":
      return "bg-muted-foreground/40";
  }
}

export function agentRosterStatusTextClassName(
  status: AgentRosterStatus,
): string {
  switch (status) {
    case "active":
      return "text-primary";
    case "needs-you":
      return "text-warning";
    case "idle":
      return "text-muted-foreground";
  }
}

const STATUS_RANK: Record<AgentRosterStatus, number> = {
  "needs-you": 0,
  active: 1,
  idle: 2,
};

export type AgentRosterSortable = {
  pubkey: string;
  name: string;
  status: AgentRosterStatus;
};

/** Pinned rows first, then needs-you > active > idle, then name. */
export function sortAgentRosterRows<T extends AgentRosterSortable>(
  rows: readonly T[],
  isPinned: (pubkey: string) => boolean,
): T[] {
  return [...rows].sort((a, b) => {
    const pinnedA = isPinned(a.pubkey) ? 0 : 1;
    const pinnedB = isPinned(b.pubkey) ? 0 : 1;
    if (pinnedA !== pinnedB) return pinnedA - pinnedB;
    const rankDelta = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rankDelta !== 0) return rankDelta;
    return a.name.localeCompare(b.name);
  });
}
