import type { AskType } from "@/features/myzone/lib/taskExtraction";

const MAX_OPTION_LENGTH = 60;
const MAX_OPTIONS = 4;

/** Auxiliary-verb leads that mark a polar (yes/no) question. */
const YES_NO_LEAD =
  /^(?:do|does|is|are|can|could|should|will|would|has|have|did)\b/i;

const NUMBERED_LIST_ITEM = /^\s*\d+[.)]\s+(.*)$/;

/** Reduce a candidate option to plain text: links keep labels, markers drop. */
function stripOptionMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|\*|_|`)/g, "")
    .trim();
}

function capOption(text: string): string {
  if (text.length <= MAX_OPTION_LENGTH) {
    return text;
  }
  return text.slice(0, MAX_OPTION_LENGTH).trimEnd();
}

/**
 * "A or B?" asks become their two alternatives. Both sides must be short
 * enough to work as buttons — a long side means the "or" was mid-sentence
 * prose, not a real either/or choice.
 */
function eitherOrOptions(ask: string | null): string[] | null {
  if (!ask) {
    return null;
  }
  const trimmed = ask.trim();
  if (!trimmed.endsWith("?")) {
    return null;
  }
  const body = trimmed.replace(/\?+$/, "");
  const splitAt = body.indexOf(" or ");
  if (splitAt === -1) {
    return null;
  }
  const left = body.slice(0, splitAt).trim();
  const right = body.slice(splitAt + " or ".length).trim();
  if (!left || !right) {
    return null;
  }
  if (left.length > MAX_OPTION_LENGTH || right.length > MAX_OPTION_LENGTH) {
    return null;
  }
  return [left, right];
}

/** Numbered lists in the message body become their first four item texts. */
function numberedListOptions(content: string): string[] {
  const items: string[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(NUMBERED_LIST_ITEM);
    if (!match) {
      continue;
    }
    const text = stripOptionMarkdown(match[1]);
    if (!text) {
      continue;
    }
    items.push(capOption(text));
  }
  return items.length >= 2 ? items.slice(0, MAX_OPTIONS) : [];
}

/**
 * Derive one-click reply options for an attention card. Precedence (a
 * declared tier-1 option tag would sit above all of these when it lands):
 * A-or-B alternatives > polar yes/no > approval pair > numbered list.
 * Returns [] when the ask has no obvious short answers.
 */
export function deriveQuickOptions(
  askType: AskType,
  ask: string | null,
  content: string,
): string[] {
  const alternatives = eitherOrOptions(ask);
  if (alternatives) {
    return alternatives;
  }
  if (askType === "question" && ask && YES_NO_LEAD.test(ask.trim())) {
    return ["Yes", "No"];
  }
  if (askType === "approval") {
    return ["Approve", "Reject"];
  }
  return numberedListOptions(content);
}
