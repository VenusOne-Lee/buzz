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

/**
 * Seed the mock feed with the injected items the redesigned view needs on
 * top of the built-in Tyler feed (a Review mention + a 40007 reminder):
 * a 46010 approval that has been waiting three days (overdue section) and
 * an ask-less mention (To note section).
 */
async function seedAttentionFeed(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () =>
      typeof (window as MockWindow).__BUZZ_E2E_PUSH_MOCK_FEED_ITEM__ ===
      "function",
  );
  await page.evaluate(
    ({ agentPubkey, channelId, viewerPubkey }) => {
      const push = (window as MockWindow).__BUZZ_E2E_PUSH_MOCK_FEED_ITEM__;
      push?.({
        category: "needs_action",
        channel_id: channelId,
        channel_name: "agents",
        content:
          "Release workflow paused: approve the desktop deploy to staging?",
        created_at: Math.floor(Date.now() / 1_000) - 3 * 86_400,
        id: "mock-feed-myzone-approval",
        kind: 46010,
        pubkey: agentPubkey,
        tags: [["p", viewerPubkey]],
      });
      push?.({
        category: "mention",
        channel_id: channelId,
        channel_name: "agents",
        content: "FYI the launch deck shipped last night.",
        created_at: Math.floor(Date.now() / 1_000) - 300,
        id: "mock-feed-myzone-fyi",
        kind: 9,
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
}

test.describe("myzone attention views", () => {
  test("action-driven cards: sections, expand, quick options, undo, posting", async ({
    page,
  }) => {
    await installMockBridge(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const navItem = page.getByTestId("open-myzone-view");
    await expect(navItem).toBeVisible();
    await seedAttentionFeed(page);
    await navItem.click();

    const view = page.getByTestId("myzone-view");
    await expect(view).toBeVisible();

    // 3 real asks (approval, mention, reminder) + 1 heads-up to note.
    const cards = page.locator('article[data-testid^="myzone-card-"]');
    await expect(cards).toHaveCount(4);

    // Split Needs Me count: real asks and to-note are counted separately.
    const needsTab = page.getByTestId("myzone-tab-needsMe");
    await expect(needsTab).toContainText("3 need you");
    await expect(needsTab).toContainText("1 to note");

    // Sections: the 3-day-old approval is overdue, the rest is today,
    // the ask-less mention sits under To note.
    await expect(page.getByTestId("myzone-section-overdue")).toBeVisible();
    await expect(page.getByTestId("myzone-section-today")).toBeVisible();
    await expect(page.getByTestId("myzone-section-note")).toBeVisible();
    await expect(
      page.getByTestId("myzone-section-overdue").locator("article"),
    ).toHaveCount(1);

    // Badges vary by ask type: Approval plus at least one other type.
    const badges = page.getByTestId("myzone-card-badge");
    await expect(badges.filter({ hasText: "Approval" })).toHaveCount(1);
    await expect(badges.filter({ hasText: "Review" }).first()).toBeVisible();
    await expect(badges.filter({ hasText: "Heads up" })).toHaveCount(1);

    // The headline is the ask, not the sender.
    const firstAsk = cards.first().getByTestId("myzone-card-ask");
    await expect(firstAsk).toContainText("approve the desktop deploy");
    const askText = (await firstAsk.textContent())?.trim() ?? "";
    expect(askText.length).toBeGreaterThan(0);
    expect(askText).not.toMatch(/^(Tyler|Alice|Bob)$/);
    // Staleness is surfaced on the meta line.
    await expect(cards.first()).toContainText("waiting 3 days");

    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/01-needs-me-redesign.png` });

    // Keyboard: j selects the first card, e expands it.
    await view.focus();
    await page.keyboard.press("j");
    await expect(cards.first()).toHaveAttribute("data-selected", "true");
    await page.keyboard.press("e");
    const expanded = page.getByTestId("myzone-card-expanded");
    await expect(expanded).toBeVisible();

    // Full message, quick-select options (approval pair), and a reply box.
    await expect(expanded).toContainText(
      "Release workflow paused: approve the desktop deploy to staging?",
    );
    const quickOptions = page.getByTestId("myzone-quick-option");
    await expect(quickOptions).toHaveCount(2);
    await expect(quickOptions.first()).toHaveText("Approve");
    await expect(page.getByTestId("myzone-reply-input")).toBeFocused();
    await expect(page.getByTestId("myzone-action-reply")).toBeDisabled();

    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/02-expanded-card.png` });

    // To note section close-up (scoped shot keeps the three PNGs distinct).
    await waitForAnimations(page);
    await page
      .getByTestId("myzone-section-note")
      .screenshot({ path: `${SHOTS}/03-to-note.png` });

    // Collapse again to keep the list stable for the action flows.
    await view.focus();
    await page.keyboard.press("e");
    await expect(expanded).not.toBeVisible();

    // Undo: Noted parks the heads-up card, Undo brings it straight back.
    const notedCard = page.locator('article[data-testid^="myzone-card-"]', {
      hasText: "FYI the launch deck shipped",
    });
    await notedCard.hover();
    await notedCard.getByTestId("myzone-action-noted").click();
    await expect(cards).toHaveCount(3);
    const undoButton = page.getByRole("button", { name: "Undo" });
    await expect(undoButton).toBeVisible();
    await undoButton.click();
    await expect(cards).toHaveCount(4);

    // Done: the zone change applies immediately, the Undo toast appears,
    // and after the 5s undo window the reply posts without error.
    const mentionCard = page.locator('article[data-testid^="myzone-card-"]', {
      hasText: "review the release checklist",
    });
    await mentionCard.hover();
    await mentionCard.getByTestId("myzone-action-done").click();
    await expect(cards).toHaveCount(3);
    await expect(
      page.getByText("Marked done — reply posts in 5s"),
    ).toBeVisible();
    await page.waitForTimeout(5_500);
    await expect(cards).toHaveCount(3);
    await expect(
      page.getByText("Could not post your reply", { exact: false }),
    ).not.toBeVisible();
    await page.getByTestId("myzone-tab-done").click();
    await expect(
      page.locator('article[data-testid^="myzone-card-"]', {
        hasText: "review the release checklist",
      }),
    ).toBeVisible();

    // Deep link: opening a card lands in the original channel conversation.
    await page.getByTestId("myzone-tab-needsMe").click();
    const openTarget = cards.first();
    await openTarget.hover();
    await openTarget.getByTestId("myzone-action-open").click();
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
      page.getByText(
        "Nothing parked. Items you are waiting on others for land here.",
      ),
    ).toBeVisible();
  });
});
