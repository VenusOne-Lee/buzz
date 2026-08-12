/**
 * Decision & Approval card logic.
 *
 * A "decision" is the in-channel, return-only-for-approval surface (the pattern
 * Grok Bot popularised) expressed through Buzz's existing approval events. The
 * card is presentational; this module holds the pure mapping between a decision
 * choice and the real grant/deny action the relay understands, plus the
 * keyboard bindings and expiry math. Keeping it here makes the functional
 * contract unit-testable without a DOM.
 */

/** Whether the card asks for a consequential sign-off or a routine steer. */
export type DecisionKind = "approval" | "question";

/** Grant scope. `once` authorises this action; `mission` authorises it for the
 * remainder of the correlated run (recorded on the grant so it is auditable). */
export type DecisionScope = "once" | "mission";

export type DecisionChoice =
  | { type: "allow"; scope: DecisionScope; label: string }
  | { type: "deny"; label: string }
  | { type: "answer"; id: string; label: string };

export type DecisionMeta = {
  /** Who is asking (agent / approver spec). */
  actor?: string;
  /** Tool or connector the action would use. */
  tool?: string;
  /** Human-readable scope of the effect, e.g. "142 recipients". */
  target?: string;
};

export type DecisionRequest = {
  kind: DecisionKind;
  title: string;
  consequence?: string;
  meta?: DecisionMeta;
  /** ISO-8601 expiry; when past, the decision defaults to deny/stop. */
  expiresAt?: string | null;
  choices: DecisionChoice[];
  /**
   * Marks the action as sensitive ("Auto Review"): drives the amber review
   * treatment and keyboard-first affordances. Approvals are always reviewed.
   */
  review?: boolean;
};

export type DecisionResolution = {
  choice: DecisionChoice;
  /** Display name of whoever resolved it. */
  by?: string | null;
  /** Epoch milliseconds the decision was recorded. */
  at?: number | null;
};

/** The real, relay-backed action an approval choice maps to. */
export type ApprovalAction = { action: "grant" | "deny"; note: string };

/** Default choices for a consequential approval. */
export const APPROVAL_CHOICES: DecisionChoice[] = [
  { type: "allow", scope: "once", label: "Allow once" },
  { type: "allow", scope: "mission", label: "Allow for the mission" },
  { type: "deny", label: "Deny" },
];

/** Combine a scope prefix with an optional free-text note into the grant/deny
 * note that is persisted on the signed approval event. */
export function composeNote(prefix: string, userNote?: string): string {
  const extra = userNote?.trim();
  return extra ? `${prefix} — ${extra}` : prefix;
}

/** Canonical label for a resolved choice (used in the condensed state and the
 * persisted note). */
export function describeChoice(choice: DecisionChoice): string {
  switch (choice.type) {
    case "allow":
      return choice.scope === "mission"
        ? "Allowed for the mission"
        : "Allowed once";
    case "deny":
      return "Denied";
    case "answer":
      return choice.label;
  }
}

/**
 * Map a decision choice onto the grant/deny action the relay accepts. The scope
 * distinction ("once" vs "mission") is preserved in the auditable note; a
 * first-class policy grant is a backend follow-up.
 */
export function approvalActionForChoice(
  choice: DecisionChoice,
  userNote?: string,
): ApprovalAction {
  if (choice.type === "deny") {
    return { action: "deny", note: composeNote("Denied", userNote) };
  }
  return {
    action: "grant",
    note: composeNote(describeChoice(choice), userNote),
  };
}

/**
 * Keyboard-first steering. Enter = the safe primary allow-once; M = allow for
 * the mission; D = deny; digits 1–n pick an answer for a question card.
 */
export function choiceForKey(
  key: string,
  choices: DecisionChoice[],
): DecisionChoice | null {
  const lower = key.toLowerCase();
  if (lower === "enter") {
    return (
      choices.find((c) => c.type === "allow" && c.scope === "once") ??
      choices[0] ??
      null
    );
  }
  if (lower === "m") {
    return (
      choices.find((c) => c.type === "allow" && c.scope === "mission") ?? null
    );
  }
  if (lower === "d") {
    return choices.find((c) => c.type === "deny") ?? null;
  }
  const digit = Number.parseInt(key, 10);
  if (!Number.isNaN(digit) && digit >= 1 && digit <= choices.length) {
    return choices[digit - 1] ?? null;
  }
  return null;
}

/** True when the decision has passed its expiry and should default to stop. */
export function isExpired(
  expiresAt: string | null | undefined,
  now: number,
): boolean {
  if (!expiresAt) {
    return false;
  }
  const at = Date.parse(expiresAt);
  return Number.isFinite(at) && at < now;
}

/** Build a decision request from a workflow approval record. */
export function approvalToDecisionRequest(approval: {
  approverSpec: string;
  expiresAt: string;
}): DecisionRequest {
  return {
    kind: "approval",
    review: true,
    title: "Approval required",
    consequence:
      "This action needs your sign-off before the agent continues. Unanswered requests default to deny.",
    meta: { actor: approval.approverSpec },
    expiresAt: approval.expiresAt,
    choices: APPROVAL_CHOICES,
  };
}
