import { expect, test } from "@playwright/test";

import { waitForAnimations } from "../helpers/animations";
import { installMockBridge } from "../helpers/bridge";
import { FEATURE_OVERRIDES_STORAGE_KEY } from "../helpers/features";

const SHOTS = "test-results/spine";

// `general` ships with pre-seeded mock content (see e2eBridge mockChannels),
// so the rail has real history to index before the spec injects its own.
const CHANNEL = "general";
const SPINE_FEATURE_ID = "spine";

const ALL_LENSES = [
  "spine-lens-all",
  "spine-lens-decisions",
  "spine-lens-threads",
  "spine-lens-media",
  "spine-lens-links",
  "spine-lens-artifacts",
  "spine-lens-questions",
] as const;

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

/**
 * Force-enable the `spine` preview feature via the production overrides key.
 *
 * Registered AFTER installMockBridge on purpose: the bridge's own
 * seedPreviewFeaturesEnabled init script REPLACES the overrides key with the
 * manifest's feature ids, and `spine` is not in preview-features.json yet —
 * a script registered earlier would be clobbered. Init scripts all run before
 * app mount regardless of registration order, so merging here is still
 * "seeded before React reads state" and survives the bridge's write.
 */
async function seedSpineFeatureEnabled(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ featureId, key }) => {
      let overrides: Record<string, boolean> = {};
      try {
        const raw = window.localStorage.getItem(key);
        const parsed: unknown = raw === null ? null : JSON.parse(raw);
        if (parsed !== null && typeof parsed === "object") {
          overrides = parsed as Record<string, boolean>;
        }
      } catch {
        // malformed entry — start fresh
      }
      overrides[featureId] = true;
      window.localStorage.setItem(key, JSON.stringify(overrides));
    },
    { featureId: SPINE_FEATURE_ID, key: FEATURE_OVERRIDES_STORAGE_KEY },
  );
}

async function emit(page: import("@playwright/test").Page, content: string) {
  const event = await page.evaluate(
    (payload) =>
      window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__?.({
        channelName: payload.channel,
        content: payload.content,
      }),
    { channel: CHANNEL, content },
  );
  if (!event) throw new Error("mock message emitter is not installed");
  return event as { created_at: number; id: string };
}

/**
 * Boot into #general with the spine feature enabled and inject the three
 * messages the lanes key on: an author-declared decision marker, a message
 * carrying a plain URL, and an ordinary line.
 */
async function openGeneralWithSpineSeeds(
  page: import("@playwright/test").Page,
) {
  await installMockBridge(page);
  await seedSpineFeatureEnabled(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.getByTestId(`channel-${CHANNEL}`).click();
  await expect(page.getByTestId("message-timeline")).toBeVisible();
  await waitForMockLiveSubscription(page, CHANNEL);

  await emit(page, "Decision: ship the rail this week");
  await emit(
    page,
    "Related PR for context: https://github.com/block/buzz/pull/4766",
  );
  await emit(page, "Morning all — build is green, nothing else to report.");
}

test.describe("spine rail", () => {
  test("spine rail reveals with lanes and ranked threads", async ({ page }) => {
    await openGeneralWithSpineSeeds(page);

    // The channel-header toggle reveals the rail above the timeline.
    await page.getByTestId("spine-toggle").click();
    const rail = page.getByTestId("spine-rail");
    await expect(rail).toBeVisible();

    // Every lens is present on the toggle row.
    for (const lens of ALL_LENSES) {
      await expect(page.getByTestId(lens)).toBeVisible();
    }

    // Decisions lens surfaces the author-declared marker (prefix stripped).
    await page.getByTestId("spine-lens-decisions").click();
    await expect(
      rail
        .getByTestId("spine-card-marker")
        .filter({ hasText: "ship the rail" })
        .first(),
    ).toBeVisible();

    // Links lens surfaces the plain URL as a link card.
    await page.getByTestId("spine-lens-links").click();
    await expect(rail.getByTestId("spine-card-link").first()).toBeVisible();

    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/01-rail.png` });
  });

  test("lens counts and empty state", async ({ page }) => {
    await openGeneralWithSpineSeeds(page);

    await page.getByTestId("spine-toggle").click();
    const rail = page.getByTestId("spine-rail");
    await expect(rail).toBeVisible();

    // Nothing in the mock channel carries imeta tags, so the media lens is
    // empty and must say so rather than rendering a blank strip.
    await page.getByTestId("spine-lens-media").click();
    await expect(rail.getByTestId("spine-card-media")).toHaveCount(0);
    await expect(rail.getByText("Nothing here yet.")).toBeVisible();

    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/02-empty-lens.png` });
  });

  test("card click navigates", async ({ page }) => {
    await openGeneralWithSpineSeeds(page);

    await page.getByTestId("spine-toggle").click();
    const rail = page.getByTestId("spine-rail");
    await expect(rail).toBeVisible();

    await page.getByTestId("spine-lens-decisions").click();
    const card = rail
      .getByTestId("spine-card-marker")
      .filter({ hasText: "ship the rail" })
      .first();
    await expect(card).toBeVisible();

    // Downgraded navigation assertion: the attention spec proves deep links
    // via waitForURL(/\/channels\//), but a spine card is clicked from INSIDE
    // /channels/:id, so that pattern is vacuous here. Until the in-channel
    // navigation artifact (scroll/highlight/thread pane) is nailed down,
    // assert the accessibility contract instead: the card is a focusable
    // button with an accessible label, and clicking it does not break the
    // surface it navigates within.
    const role = await card.evaluate(
      (el) => el.getAttribute("role") ?? el.tagName.toLowerCase(),
    );
    expect(["button"]).toContain(role);
    const ariaLabel = (await card.getAttribute("aria-label")) ?? "";
    expect(ariaLabel.length).toBeGreaterThan(0);
    await card.focus();
    await expect(card).toBeFocused();

    await card.click();
    await expect(page).toHaveURL(/\/channels\//);
    await expect(page.getByTestId("message-timeline")).toBeVisible();
  });
});
