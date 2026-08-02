const CONFIG_NUDGE_MARKER = "buzz:config-nudge";

/** Maya's reason taxonomy. headsUp = mentions you, needs nothing. */
export type AskType =
  | "decision"
  | "approval"
  | "question"
  | "review"
  | "blocked"
  | "headsUp";

export type AskClassification = {
  type: AskType;
  /** The one-line ask headline; null only for headsUp. */
  ask: string | null;
};

const MAX_TASK_LINE_LENGTH = 110;

/**
 * Agent configuration nudges are device-setup plumbing addressed at owners,
 * not work that needs attention. They should never occupy a Needs Me slot.
 */
export function isConfigNoise(content: string): boolean {
  return content.includes(CONFIG_NUDGE_MARKER);
}

/**
 * Reduce raw message markdown to plain sentence text: code blocks, links,
 * emphasis markers, JSON blobs and bare URLs all removed. Extraction input
 * only — rendering still goes through the shared Markdown component.
 */
export function stripMessageNoise(content: string): string {
  return (
    content
      // fenced code blocks (and any JSON payloads inside them)
      .replace(/```[\s\S]*?```/g, " ")
      // inline code keeps its text
      .replace(/`([^`]*)`/g, "$1")
      // markdown links keep their label
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // bare URLs
      .replace(/https?:\/\/\S+/g, " ")
      // bold / italic / strikethrough markers
      .replace(/(\*\*|__|~~|\*|_)/g, "")
      // heading and blockquote prefixes
      .replace(/^[>#]+\s*/gm, "")
      // leading list markers
      .replace(/^\s*[-*+]\s+/gm, "")
      // bare JSON object blobs that survived (best effort)
      .replace(/\{"[^\n]*\}/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 2);
}

const ASK_PATTERN =
  /\b(please|can you|could you|would you|approve|review|confirm|decide|check|answer|unblock|need you|needs? your|waiting on you|your call|go ahead|say the word|let me know)\b/i;

function truncateTaskLine(sentence: string): string {
  if (sentence.length <= MAX_TASK_LINE_LENGTH) {
    return sentence;
  }
  const cut = sentence.slice(0, MAX_TASK_LINE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : MAX_TASK_LINE_LENGTH)}…`;
}

function findAskSentence(content: string): string | null {
  const cleaned = stripMessageNoise(content);
  if (!cleaned) {
    return null;
  }
  const sentences = splitSentences(cleaned);
  if (sentences.length === 0) {
    return null;
  }

  const readerQuestion = sentences.find(
    (sentence) => sentence.endsWith("?") && /\byou\b|\byour\b/i.test(sentence),
  );
  if (readerQuestion) {
    return readerQuestion;
  }

  const anyQuestion = sentences.find((sentence) => sentence.endsWith("?"));
  if (anyQuestion) {
    return anyQuestion;
  }

  return sentences.find((sentence) => ASK_PATTERN.test(sentence)) ?? null;
}

const APPROVAL_PATTERN =
  /\b(approve|approval|sign[- ]?off|authorise|authorize|green ?light|gated on you|go ahead)\b/i;
const DECISION_PATTERN =
  /\b(decide|decision|choose|choice|your call|pick (?:one|between)|option [ab])\b/i;
const BLOCKED_PATTERN =
  /\b(blocked|cannot proceed|can't proceed|unblock|waiting on you|need you to|stuck until)\b/i;
const REVIEW_PATTERN =
  /\b(review|take a look|have a look|feedback on|ready for your)\b/i;

function classifyAskSentence(sentence: string): AskType {
  if (APPROVAL_PATTERN.test(sentence)) return "approval";
  if (DECISION_PATTERN.test(sentence)) return "decision";
  if (BLOCKED_PATTERN.test(sentence)) return "blocked";
  if (REVIEW_PATTERN.test(sentence)) return "review";
  return "question";
}

/**
 * Tier-2 derived classification (Maya's spec): find the ask sentence,
 * classify it by resolution verb, and demote ask-less mentions to headsUp so
 * the Needs Me count stays honest. Tier-1 declared attention tags replace
 * this heuristic when the contract lands.
 */
export function classifyAsk(content: string): AskClassification {
  if (isConfigNoise(content)) {
    return { type: "headsUp", ask: null };
  }
  const sentence = findAskSentence(content);
  if (!sentence) {
    return { type: "headsUp", ask: null };
  }
  return {
    type: classifyAskSentence(sentence),
    ask: truncateTaskLine(sentence),
  };
}

/**
 * Best-effort one-line "what do I need to do" from message prose.
 * Falls back to the first sentence when no explicit ask is found.
 */
export function extractTaskLine(content: string): string {
  const sentence = findAskSentence(content);
  if (sentence) {
    return truncateTaskLine(sentence);
  }
  const cleaned = stripMessageNoise(content);
  if (!cleaned) {
    return "";
  }
  const sentences = splitSentences(cleaned);
  return truncateTaskLine(sentences[0] ?? cleaned);
}
