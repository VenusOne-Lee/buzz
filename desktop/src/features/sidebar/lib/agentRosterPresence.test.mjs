import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  agentRosterStatusLabel,
  classifyAgentRosterStatus,
  sortAgentRosterRows,
} from "./agentRosterPresence.ts";

describe("classifyAgentRosterStatus", () => {
  it("prioritizes needs-you over everything else", () => {
    assert.equal(
      classifyAgentRosterStatus({
        presenceStatus: "online",
        isWorking: true,
        hasError: true,
        needsRestart: false,
        personaOrphaned: false,
      }),
      "needs-you",
    );
    assert.equal(
      classifyAgentRosterStatus({
        presenceStatus: undefined,
        isWorking: false,
        hasError: false,
        needsRestart: true,
        personaOrphaned: false,
      }),
      "needs-you",
    );
    assert.equal(
      classifyAgentRosterStatus({
        presenceStatus: undefined,
        isWorking: false,
        hasError: false,
        needsRestart: false,
        personaOrphaned: true,
      }),
      "needs-you",
    );
  });

  it("is active when the working signal says so, regardless of presence", () => {
    assert.equal(
      classifyAgentRosterStatus({
        presenceStatus: undefined,
        isWorking: true,
        hasError: false,
        needsRestart: false,
        personaOrphaned: false,
      }),
      "active",
    );
  });

  it("is active when online but not working", () => {
    assert.equal(
      classifyAgentRosterStatus({
        presenceStatus: "online",
        isWorking: false,
        hasError: false,
        needsRestart: false,
        personaOrphaned: false,
      }),
      "active",
    );
  });

  it("is idle when away/offline/unknown and not working", () => {
    for (const presenceStatus of ["away", "offline", undefined]) {
      assert.equal(
        classifyAgentRosterStatus({
          presenceStatus,
          isWorking: false,
          hasError: false,
          needsRestart: false,
          personaOrphaned: false,
        }),
        "idle",
      );
    }
  });
});

describe("agentRosterStatusLabel", () => {
  it("has a readable label for each state", () => {
    assert.equal(agentRosterStatusLabel("active"), "Active");
    assert.equal(agentRosterStatusLabel("idle"), "Idle");
    assert.equal(agentRosterStatusLabel("needs-you"), "Needs you");
  });
});

describe("sortAgentRosterRows", () => {
  const rows = [
    { pubkey: "c", name: "Charlie", status: "idle" },
    { pubkey: "a", name: "Alice", status: "needs-you" },
    { pubkey: "b", name: "Bob", status: "active" },
    { pubkey: "d", name: "Dana", status: "idle" },
  ];

  it("orders pinned rows first regardless of status", () => {
    const sorted = sortAgentRosterRows(rows, (pubkey) => pubkey === "d");
    assert.deepEqual(
      sorted.map((r) => r.pubkey),
      ["d", "a", "b", "c"],
    );
  });

  it("orders needs-you > active > idle when nothing is pinned", () => {
    const sorted = sortAgentRosterRows(rows, () => false);
    assert.deepEqual(
      sorted.map((r) => r.pubkey),
      ["a", "b", "c", "d"],
    );
  });

  it("breaks ties within a tier alphabetically by name", () => {
    const sorted = sortAgentRosterRows(rows, () => false);
    const idleNames = sorted
      .filter((r) => r.status === "idle")
      .map((r) => r.name);
    assert.deepEqual(idleNames, ["Charlie", "Dana"]);
  });
});
