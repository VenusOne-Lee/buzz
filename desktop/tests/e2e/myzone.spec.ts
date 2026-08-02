import { expect, test } from "@playwright/test";

import { waitForAnimations } from "../helpers/animations";
import { installMockBridge, TEST_IDENTITIES } from "../helpers/bridge";

const SHOTS = "test-results/myzone";

const AGENTS_CHANNEL_ID = "94a444a4-c0a3-5966-ab05-530c6ddc2301"; // #agents
const AGENT_PUBKEY =
  "db0b028cd36f4d3e36c8300cce87252c1f7fc9495ffecc53f393fcac341ffd36";

type MockWindow = Window & {
  __BUZZ_E2E_PUSH_MOCK_FEED_ITEM__?: (item: {
    category: "mention" | "needs_action" | "activity" | "agent_activity";
    channel_id: string | null;
    channel_name: string;
    content: string;
    created_at: number;
    id: string;
    kind: number;
    pubkey: string;
    tags: string[][];
  }) => unknown;
};

test.describe("myzone attention views", () => {
  test("needs me, waiting, and done flow", async ({ page }) => {
    await installMockBridge(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // The flag-gated nav item renders because the mock bridge seeds all
    // preview features on.
    const navItem = page.getByTestId("open-myzone-view");
    await expect(navItem).toBeVisible();

    // Inject a live workflow-approval request (kind 46010) so Needs Me shows
    // all three seeded reasons: approval, mention, reminder.
    await page.waitForFunction(
      () =>
        typeof (window as MockWindow).__BUZZ_E2E_PUSH_MOCK_FEED_ITEM__ ===
        "function",
    );
    await page.evaluate(
      ({ agentPubkey, channelId, viewerPubkey }) => {
        (window as MockWindow).__BUZZ_E2E_PUSH_MOCK_FEED_ITEM__?.({
          category: "needs_action",
          channel_id: channelId,
          channel_name: "agents",
          content:
            "Release workflow paused: approve the desktop deploy to staging?",
          created_at: Math.floor(Date.now() / 1_000) - 120,
          id: "mock-feed-myzone-approval",
          kind: 46010,
          pubkey: agentPubkey,
          tags: [["p", viewerPubkey]],
        });
      },
      {
        agentPubkey: AGENT_PUBKEY,
        channelId: AGENTS_CHANNEL_ID,
        viewerPubkey: TEST_IDENTITIES.tyler.pubkey,
      },
    );

    await navItem.click();
    await expect(page.getByTestId("myzone-view")).toBeVisible();

    const cards = page.locator('article[data-testid^="myzone-card-"]');
    await expect(cards).toHaveCount(3);
    await expect(page.getByText("Approval requested")).toBeVisible();
    await expect(page.getByText("Mentioned you").first()).toBeVisible();
    await expect(page.getByText("Reminder due")).toBeVisible();
    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/01-needs-me.png` });

    // Park the top card as waiting on someone else.
    await cards.first().getByTestId("myzone-action-waiting").click();
    await expect(cards).toHaveCount(2);
    await page.getByTestId("myzone-tab-waiting").click();
    const waitingCards = page.locator('article[data-testid^="myzone-card-"]');
    await expect(waitingCards).toHaveCount(1);
    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/02-waiting.png` });

    // Resolve it: waiting -> done.
    await waitingCards.first().getByTestId("myzone-action-done").click();
    await expect(waitingCards).toHaveCount(0);
    await page.getByTestId("myzone-tab-done").click();
    const doneCards = page.locator('article[data-testid^="myzone-card-"]');
    await expect(doneCards).toHaveCount(1);
    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/03-done.png` });

    // Restore pulls it back into Needs Me.
    await doneCards.first().getByTestId("myzone-action-restore").click();
    await expect(doneCards).toHaveCount(0);
    await page.getByTestId("myzone-tab-needsMe").click();
    await expect(cards).toHaveCount(3);

    // Deep link: opening a card lands in the original channel conversation.
    await cards.first().getByTestId("myzone-action-open").click();
    await page.waitForURL(/\/channels\//);
  });

  test("empty waiting view explains itself", async ({ page }) => {
    await installMockBridge(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByTestId("open-myzone-view").click();
    await expect(page.getByTestId("myzone-view")).toBeVisible();
    await page.getByTestId("myzone-tab-waiting").click();
    await expect(page.getByTestId("myzone-empty-state")).toBeVisible();
    await expect(
      page.getByText("Nothing is parked as waiting on someone else."),
    ).toBeVisible();
  });
});
