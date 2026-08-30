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

/** The token + display context extracted from a raw approval-requested event
 * (kind:46010) so the same functional card can be rendered inline in the
 * channel timeline, not only inside a workflow-run panel. */
export type ChannelApprovalDescriptor = {
  /** Plaintext approval token the grant/deny action resolves against (the
   * `["t", token]` tag, matching the tag `build_approval_grant`/`_deny` emit). */
  token: string;
  request: DecisionRequest;
};

/** First value of the first tag whose name matches `name`. */
function firstTagValue(
  tags: ReadonlyArray<ReadonlyArray<string>> | undefined,
  name: string,
): string | undefined {
  return tags?.find((tag) => tag[0] === name)?.[1];
}

/**
 * Map a raw approval-requested event (kind:46010) onto the token and decision
 * request the in-channel card needs. Returns `null` when the event carries no
 * usable `["t", token]` tag — without a token the card cannot resolve, so it
 * must fall back to plain rendering rather than show an unactionable control.
 *
 * The event body is treated as the human-readable ask (falling back to the
 * default approval copy); the `title` tag, when present, overrides the heading.
 * `actor`/`tool`/`target` meta hydrate from the matching tags so the card shows
 * the same context the workflow-run surface does. Expiry is read from the
 * `expiration` tag (unix seconds, per NIP convention) when present.
 */
export function channelApprovalFromEvent(event: {
  content?: string | null;
  tags?: ReadonlyArray<ReadonlyArray<string>>;
}): ChannelApprovalDescriptor | null {
  const token = firstTagValue(event.tags, "t")?.trim();
  if (!token) {
    return null;
  }

  const body = event.content?.trim() || undefined;
  const title =
    firstTagValue(event.tags, "title")?.trim() || "Approval required";
  const actor = firstTagValue(event.tags, "actor")?.trim();
  const tool = firstTagValue(event.tags, "tool")?.trim();
  const target = firstTagValue(event.tags, "target")?.trim();

  const meta: DecisionMeta = {};
  if (actor) {
    meta.actor = actor;
  }
  if (tool) {
    meta.tool = tool;
  }
  if (target) {
    meta.target = target;
  }

  let expiresAt: string | null = null;
  const expiration = firstTagValue(event.tags, "expiration");
  if (expiration) {
    const seconds = Number.parseInt(expiration, 10);
    if (Number.isFinite(seconds)) {
      expiresAt = new Date(seconds * 1000).toISOString();
    }
  }

  return {
    token,
    request: {
      kind: "approval",
      review: true,
      title,
      consequence:
        body ??
        "This action needs your sign-off before the agent continues. Unanswered requests default to deny.",
      meta: Object.keys(meta).length > 0 ? meta : undefined,
      expiresAt,
      choices: APPROVAL_CHOICES,
    },
  };
}
