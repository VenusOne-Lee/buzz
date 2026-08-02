import * as React from "react";
import { toast } from "sonner";

export const UNDO_WINDOW_MS = 5_000;

export type QueuedActionInput = {
  /** Attention item id — one pending action per item at a time. */
  itemId: string;
  /** Toast headline, e.g. "Marked done — reply queued". */
  toastLabel: string;
  /** Zone change to apply immediately (optimistic). */
  apply: () => void;
  /** Reverse of `apply`, used by Undo and by send failure. */
  revert: () => void;
  /** Posts the threaded reply. Called once, only after the undo window. */
  send: () => Promise<unknown>;
};

type PendingAction = {
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Optimistic action queue with a 5-second undo window.
 *
 * Each action applies its zone change immediately, then waits
 * UNDO_WINDOW_MS before posting the reply. Undo cancels the timer —
 * nothing is ever published and then deleted. A send failure reverts
 * the zone change and surfaces an error toast. At most one action can
 * be pending per item, so double-clicks and key repeats cannot
 * double-post.
 */
export function useActionQueue() {
  const pendingRef = React.useRef<Map<string, PendingAction>>(new Map());
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const markPending = React.useCallback((itemId: string, pending: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  }, []);

  const queueAction = React.useCallback(
    ({ itemId, toastLabel, apply, revert, send }: QueuedActionInput) => {
      if (pendingRef.current.has(itemId)) {
        return false;
      }
      apply();

      const finish = () => {
        pendingRef.current.delete(itemId);
        markPending(itemId, false);
      };

      const timer = setTimeout(() => {
        finish();
        send().catch(() => {
          toast.error("Could not post your reply. The item was restored.");
          revert();
        });
      }, UNDO_WINDOW_MS);

      pendingRef.current.set(itemId, { timer });
      markPending(itemId, true);

      toast(toastLabel, {
        action: {
          label: "Undo",
          onClick: () => {
            const pending = pendingRef.current.get(itemId);
            if (!pending) {
              return;
            }
            clearTimeout(pending.timer);
            finish();
            revert();
          },
        },
        duration: UNDO_WINDOW_MS,
      });
      return true;
    },
    [markPending],
  );

  return { pendingIds, queueAction };
}

export type ActionQueue = ReturnType<typeof useActionQueue>;
