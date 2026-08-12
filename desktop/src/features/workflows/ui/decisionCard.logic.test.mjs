import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DecisionCard } from "./DecisionCard.tsx";
import {
  APPROVAL_CHOICES,
  approvalActionForChoice,
  approvalToDecisionRequest,
  choiceForKey,
  describeChoice,
  isExpired,
} from "./decisionCard.logic.ts";

function render(element) {
  return renderToStaticMarkup(element);
}

const ALLOW_ONCE = APPROVAL_CHOICES[0];
const ALLOW_MISSION = APPROVAL_CHOICES[1];
const DENY = APPROVAL_CHOICES[2];

test("approvalActionForChoice maps scope to a real grant/deny action", () => {
  assert.deepEqual(approvalActionForChoice(ALLOW_ONCE), {
    action: "grant",
    note: "Allowed once",
  });
  assert.deepEqual(approvalActionForChoice(ALLOW_MISSION), {
    action: "grant",
    note: "Allowed for the mission",
  });
  assert.deepEqual(approvalActionForChoice(DENY), {
    action: "deny",
    note: "Denied",
  });
});

test("approvalActionForChoice appends the user's note", () => {
  assert.equal(
    approvalActionForChoice(ALLOW_ONCE, "  looks good  ").note,
    "Allowed once — looks good",
  );
  assert.equal(approvalActionForChoice(ALLOW_ONCE, "   ").note, "Allowed once");
});

test("choiceForKey binds Enter/M/D and answer digits", () => {
  assert.equal(choiceForKey("Enter", APPROVAL_CHOICES), ALLOW_ONCE);
  assert.equal(choiceForKey("m", APPROVAL_CHOICES), ALLOW_MISSION);
  assert.equal(choiceForKey("M", APPROVAL_CHOICES), ALLOW_MISSION);
  assert.equal(choiceForKey("d", APPROVAL_CHOICES), DENY);
  assert.equal(choiceForKey("x", APPROVAL_CHOICES), null);

  const answers = [
    { type: "answer", id: "a", label: "ROI-first" },
    { type: "answer", id: "b", label: "Peer proof" },
  ];
  assert.equal(choiceForKey("2", answers), answers[1]);
  assert.equal(choiceForKey("9", answers), null);
});

test("isExpired compares the ISO expiry against now", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");
  assert.equal(isExpired("2025-12-31T23:59:59Z", now), true);
  assert.equal(isExpired("2026-01-01T00:00:01Z", now), false);
  assert.equal(isExpired(null, now), false);
  assert.equal(isExpired("not-a-date", now), false);
});

test("approvalToDecisionRequest builds a reviewed approval request", () => {
  const request = approvalToDecisionRequest({
    approverSpec: "owner",
    expiresAt: "2026-01-01T00:00:00Z",
  });
  assert.equal(request.kind, "approval");
  assert.equal(request.review, true);
  assert.equal(request.meta.actor, "owner");
  assert.equal(request.expiresAt, "2026-01-01T00:00:00Z");
  assert.equal(request.choices.length, 3);
});

test("DecisionCard renders a pending approval with its choices", () => {
  const html = render(
    React.createElement(DecisionCard, {
      request: approvalToDecisionRequest({
        approverSpec: "owner",
        expiresAt: "2026-01-01T00:00:00Z",
      }),
      onDecide: () => {},
    }),
  );
  assert.match(html, /data-decision-kind="approval"/);
  assert.match(html, /Approval/);
  assert.match(html, /Allow once/);
  assert.match(html, /Allow for the mission/);
  assert.match(html, /Deny/);
  assert.match(html, /owner/);
});

test("DecisionCard condenses to a resolved decision", () => {
  const html = render(
    React.createElement(DecisionCard, {
      request: approvalToDecisionRequest({
        approverSpec: "owner",
        expiresAt: "2026-01-01T00:00:00Z",
      }),
      onDecide: () => {},
      resolution: { choice: ALLOW_MISSION, by: "Mika Rivera" },
    }),
  );
  assert.match(html, /data-decision-resolved="true"/);
  assert.match(html, /Allowed for the mission/);
  assert.match(html, /Mika Rivera/);
  assert.doesNotMatch(html, /Allow once/);
});

test("DecisionCard renders a non-risky question variant", () => {
  const html = render(
    React.createElement(DecisionCard, {
      request: {
        kind: "question",
        title: "Which tone should I lead with?",
        choices: [
          { type: "answer", id: "roi", label: "ROI-first" },
          { type: "answer", id: "peer", label: "Peer proof" },
        ],
      },
      onDecide: () => {},
    }),
  );
  assert.match(html, /data-decision-kind="question"/);
  assert.match(html, /Question/);
  assert.match(html, /ROI-first/);
  assert.match(html, /Peer proof/);
});

test("describeChoice labels each choice type", () => {
  assert.equal(describeChoice(ALLOW_ONCE), "Allowed once");
  assert.equal(describeChoice(ALLOW_MISSION), "Allowed for the mission");
  assert.equal(describeChoice(DENY), "Denied");
  assert.equal(
    describeChoice({ type: "answer", id: "x", label: "Peer proof" }),
    "Peer proof",
  );
});
