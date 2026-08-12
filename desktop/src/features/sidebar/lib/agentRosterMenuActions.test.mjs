import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAgentRosterMenuItems } from "./agentRosterMenuActions.ts";

const ACTION_IDS_IN_ORDER = ["pin", "mute", "pause", "openWork", "settings"];

describe("buildAgentRosterMenuItems", () => {
  it("exposes the five acceptance-test actions in a stable order", () => {
    const items = buildAgentRosterMenuItems({
      isPinned: false,
      isMuted: false,
      canPause: true,
    });
    assert.deepEqual(
      items.map((item) => item.id),
      ACTION_IDS_IN_ORDER,
    );
  });

  it("flips pin/mute labels and ids when already pinned/muted", () => {
    const items = buildAgentRosterMenuItems({
      isPinned: true,
      isMuted: true,
      canPause: true,
    });
    const pinItem = items.find((item) => item.id === "unpin");
    const muteItem = items.find((item) => item.id === "unmute");
    assert.equal(pinItem?.label, "Unpin");
    assert.equal(muteItem?.label, "Unmute");
  });

  it("disables pause when the agent cannot be paused", () => {
    const items = buildAgentRosterMenuItems({
      isPinned: false,
      isMuted: false,
      canPause: false,
    });
    const pauseItem = items.find((item) => item.id === "pause");
    assert.equal(pauseItem?.disabled, true);
  });

  it("never disables pin, mute, open work, or settings", () => {
    const items = buildAgentRosterMenuItems({
      isPinned: false,
      isMuted: false,
      canPause: false,
    });
    for (const item of items) {
      if (item.id === "pause") continue;
      assert.equal(item.disabled, false, `${item.id} should not be disabled`);
    }
  });
});
