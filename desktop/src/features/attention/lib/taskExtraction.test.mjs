import assert from "node:assert/strict";
import test from "node:test";

import {
  extractTaskLine,
  isConfigNoise,
  stripMessageNoise,
} from "./taskExtraction.ts";

test("stripMessageNoise removes markdown, links, code and JSON blobs", () => {
  const cleaned = stripMessageNoise(
    '**Two emails** went out. See [the doc](https://example.com/x) and https://example.com/raw plus `inline` and ```{"a":1}``` end.',
  );
  assert.equal(
    cleaned,
    "Two emails went out. See the doc and plus inline and end.",
  );
});

test("extractTaskLine prefers a question aimed at the reader", () => {
  const line = extractTaskLine(
    "Campaign 2 update. The numbers moved. Does the Backups list show any backup dated today, or is the newest one still the 30 July entry? More detail follows.",
  );
  assert.equal(
    line,
    "Does the Backups list show any backup dated today, or is the newest one still the 30 July entry?",
  );
});

test("extractTaskLine falls back to ask language, then first sentence", () => {
  assert.equal(
    extractTaskLine(
      "Context first sentence here. Please review the v02 proposal before Monday. Closing remark.",
    ),
    "Please review the v02 proposal before Monday.",
  );
  assert.equal(
    extractTaskLine("Engineering signed off on the desktop build. All good."),
    "Engineering signed off on the desktop build.",
  );
});

test("extractTaskLine truncates very long sentences on a word boundary", () => {
  const long = `Reading your message as approval to proceed on the three fixes we converged on earlier because you want it out now rather than waiting on further confirmation from the rest of the team`;
  const line = extractTaskLine(long);
  assert.ok(line.length <= 111);
  assert.ok(line.endsWith("…"));
  assert.ok(!line.includes("  "));
});

test("isConfigNoise flags config-nudge payloads only", () => {
  assert.equal(
    isConfigNoise('run codex login ```buzz:config-nudge {"agent_name":"X"}```'),
    true,
  );
  assert.equal(isConfigNoise("please review the config doc"), false);
});
