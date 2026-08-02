import * as React from "react";

import {
  pruneZoneState,
  type ZoneStateEntry,
  type ZoneStateMap,
} from "@/features/attention/lib/attention";

const STORAGE_KEY = "buzz-attention-zones.v1";

function storageKey(pubkey: string) {
  return `${STORAGE_KEY}:${pubkey}`;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1_000);
}

function isZoneStateEntry(value: unknown): value is ZoneStateEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    (entry.zone === "waiting" || entry.zone === "done") &&
    typeof entry.changedAt === "number"
  );
}

function readStoredState(key: string): ZoneStateMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(key);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const state: ZoneStateMap = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (isZoneStateEntry(entry)) {
        state[id] = entry;
      }
    }
    return pruneZoneState(state, nowSeconds());
  } catch {
    return {};
  }
}

function writeStoredState(key: string, state: ZoneStateMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    key,
    JSON.stringify(pruneZoneState(state, nowSeconds())),
  );
}

/**
 * Per-user, per-device zone state for Attention items, keyed by conversation id.
 * Prototype persistence: localStorage, mirroring the Inbox's local done set.
 * Durable cross-device state is a follow-up architecture decision.
 */
export function useAttentionZoneState(pubkey: string | undefined) {
  const normalizedPubkey = pubkey?.trim().toLowerCase() ?? "";

  const [zoneState, setZoneState] = React.useState<ZoneStateMap>(() =>
    readStoredState(storageKey(normalizedPubkey)),
  );
  const [loadedPubkey, setLoadedPubkey] = React.useState(normalizedPubkey);

  React.useEffect(() => {
    setZoneState(readStoredState(storageKey(normalizedPubkey)));
    setLoadedPubkey(normalizedPubkey);
  }, [normalizedPubkey]);

  React.useEffect(() => {
    if (loadedPubkey !== normalizedPubkey) return;
    writeStoredState(storageKey(normalizedPubkey), zoneState);
  }, [loadedPubkey, normalizedPubkey, zoneState]);

  const markWaiting = React.useCallback((id: string) => {
    setZoneState((prev) => ({
      ...prev,
      [id]: { zone: "waiting", changedAt: nowSeconds() },
    }));
  }, []);

  const markDone = React.useCallback((id: string) => {
    setZoneState((prev) => ({
      ...prev,
      [id]: { zone: "done", changedAt: nowSeconds() },
    }));
  }, []);

  const restore = React.useCallback((id: string) => {
    setZoneState((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  return { markDone, markWaiting, restore, zoneState };
}

export type AttentionState = ReturnType<typeof useAttentionZoneState>;
