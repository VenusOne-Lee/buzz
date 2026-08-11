import { expect, test } from "@playwright/test";

import { waitForAnimations } from "../helpers/animations";
import { installMockBridge } from "../helpers/bridge";

const SHOTS = "test-results/goals";

// `general` ships with pre-seeded mock content (see e2eBridge mockChannels),
// so the timeline has a real header/composer to interact with before the
// spec injects its own Goal Thread root.
const CHANNEL = "general";

async function waitForMockLiveSubscription(
  page: import("@playwright/test").Page,
  channelName: string,
  kind?: number,
) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ channelName, kind }) =>
          window.__BUZZ_E2E_HAS_MOCK_LIVE_SUBSCRIPTION__?.({
            channelName,
            kind,
          }) ?? false,
        { channelName, kind },
      ),
    )
    .toBe(true);
}

async function emit(
  page: import("@playwright/test").Page,
  content: string,
  options?: { parentEventId?: string },
) {
  const event = await page.evaluate(
    (payload) =>
      window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__?.({
        channelName: payload.channel,
        content: payload.content,
        parentEventId: payload.parentEventId,
      }),
    {
      channel: CHANNEL,
      content,
      parentEventId: options?.parentEventId ?? null,
    },
  );
  if (!event) throw new Error("mock message emitter is not installed");
  return event as { created_at: number; id: string };
}

/**
 * Boot into #general with the `goals` preview feature set per `goalsEnabled`,
 * emit a fresh root message declaring a Goal Thread via an author-declared
 * `Goal:` marker line, and open its thread panel via the row's Reply action
 * (same affordance messaging.spec.ts uses). Returns the root event id so
 * callers can inject thread replies that carry ledger markers.
 *
 * `installMockBridge` opts every preview feature (including "goals") in by
 * default — see `seedPreviewFeaturesEnabled` in `../helpers/bridge` — so the
 * "off" case has to explicitly opt back out via `seedPreviewFeatures: false`
 * rather than seed anything itself.
 */
async function openGoalThread(
  page: import("@playwright/test").Page,
  options: { goalsEnabled: boolean },
): Promise<string> {
  await installMockBridge(
    page,
    undefined,
    options.goalsEnabled ? undefined : { seedPreviewFeatures: false },
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.getByTestId(`channel-${CHANNEL}`).click();
  await expect(page.getByTestId("message-timeline")).toBeVisible();
  await waitForMockLiveSubscription(page, CHANNEL);

  const root = await emit(page, "Goal: ship the goal panel this week");
  const timeline = page.getByTestId("message-timeline");
  const rootRow = timeline.locator(`[data-message-id="${root.id}"]`);
  await expect(rootRow).toBeVisible();
  await rootRow.hover();
  await rootRow.getByRole("button", { name: "Reply" }).click();
  await expect(page.getByTestId("message-thread-panel")).toBeVisible();

  return root.id;
}

test.describe("goal threads", () => {
  test("feature off: a Goal: thread does not render a goal panel", async ({
    page,
  }) => {
    await openGoalThread(page, { goalsEnabled: false });

    const threadPanel = page.getByTestId("message-thread-panel");
    await expect(threadPanel.getByTestId("goal-panel")).toHaveCount(0);
  });

  test("feature on: the goal panel renders with the outcome text", async ({
    page,
  }) => {
    await openGoalThread(page, { goalsEnabled: true });

    const threadPanel = page.getByTestId("message-thread-panel");
    const goalPanel = threadPanel.getByTestId("goal-panel");
    await expect(goalPanel).toBeVisible();
    await expect(goalPanel.getByTestId("goal-panel-outcome")).toHaveText(
      "ship the goal panel this week",
    );
    await expect(goalPanel.getByTestId("goal-panel-state")).toHaveText("Open");

    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/01-goal-panel.png` });
  });

  test("Decision/Question/Blocker replies land in the matching ledger lane", async ({
    page,
  }) => {
    const rootId = await openGoalThread(page, { goalsEnabled: true });

    const threadPanel = page.getByTestId("message-thread-panel");
    const goalPanel = threadPanel.getByTestId("goal-panel");
    await expect(goalPanel).toBeVisible();

    await emit(page, "Decision: use the shared marker parser", {
      parentEventId: rootId,
    });
    await emit(page, "Question: who owns the badge palette?", {
      parentEventId: rootId,
    });
    await emit(page, "Blocker: waiting on the frozen GoalProjection type", {
      parentEventId: rootId,
    });

    await expect(
      goalPanel
        .getByTestId("goal-ledger-decisions")
        .getByText("use the shared marker parser"),
    ).toBeVisible();
    await expect(
      goalPanel
        .getByTestId("goal-ledger-questions")
        .getByText("who owns the badge palette?"),
    ).toBeVisible();
    await expect(
      goalPanel
        .getByTestId("goal-ledger-blockers")
        .getByText("waiting on the frozen GoalProjection type"),
    ).toBeVisible();
    // A blocker with no Resolved: marker yet keeps the thread "Blocked".
    await expect(goalPanel.getByTestId("goal-panel-state")).toHaveText(
      "Blocked",
    );

    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/02-ledger.png` });
  });

  test("a Resolved: reply flips the state badge to Done", async ({ page }) => {
    const rootId = await openGoalThread(page, { goalsEnabled: true });

    const threadPanel = page.getByTestId("message-thread-panel");
    const goalPanel = threadPanel.getByTestId("goal-panel");
    await expect(goalPanel).toBeVisible();
    await expect(goalPanel.getByTestId("goal-panel-state")).toHaveText("Open");

    await emit(page, "Resolved: shipped, panel is live", {
      parentEventId: rootId,
    });

    await expect(goalPanel.getByTestId("goal-panel-state")).toHaveText("Done");

    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/03-resolved.png` });
  });
});
