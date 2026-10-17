import { expect, test } from "@playwright/test";

import { waitForAnimations } from "../helpers/animations";
import { installMockBridge } from "../helpers/bridge";

async function seedLongThread(page: import("@playwright/test").Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => typeof window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__ === "function",
      ),
    )
    .toBe(true);
  return page.evaluate(() => {
    const root = window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__?.({
      channelName: "general",
      content: [
        "## Evidence summary",
        "",
        "The expanded evidence keeps the reasoning chain visible instead of compressing every result into one paragraph.",
        "",
        "| Literature / comparison | Method and observed data | What it supports | What it cannot prove |",
        "| --- | --- | --- | --- |",
        "| **Yang, 2012** | TEM + UV-Vis across three addition times | **An early-time window matters** | The active silver species was not measured directly |",
        "| **Tong, 2017** | Distribution fits at 10 and 20 minutes | Timing changes the width population | Fitted groups are not single-particle trajectories |",
      ].join("\n"),
      createdAt: 1_700_900_000,
    });
    if (!root) throw new Error("Failed to seed focus thread root");

    for (let index = 0; index < 48; index += 1) {
      window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__?.({
        channelName: "general",
        content: `Focus reply ${index}: this deliberately wraps across several lines so changing the thread measure causes real layout reflow.`,
        parentEventId: root.id,
        createdAt: 1_700_900_001 + index,
      });
    }
    return root.id;
  });
}

const DOCUMENT_MARKDOWN = [
  "# Evidence review",
  "",
  "The expanded evidence keeps the **reasoning chain visible** instead of compressing every result into one paragraph. Open the [source index](https://example.com/evidence) for the full record.",
  "",
  "A second paragraph verifies that long-form prose uses a readable document rhythm rather than compact chat spacing.",
  "",
  "## What changed",
  "",
  "- Evidence stays attached to each conclusion.",
  "- Review remains scannable:",
  "  - claims use clear hierarchy;",
  "  - caveats remain visible.",
  "- [x] Preserve completed checks",
  "- [ ] Flag unresolved assumptions",
  "",
  "> Treat the table as evidence, not decoration. The layout should keep the qualifier beside the claim.",
  "",
  "### Evidence matrix",
  "",
  "| Literature / comparison | Method and observed data | What it supports | What it cannot prove |",
  "| --- | --- | --- | --- |",
  "| **Yang, 2012** | TEM + UV-Vis across three addition times | **An early-time window matters** | The active silver species was not measured directly |",
  "| **Tong, 2017** | Distribution fits at 10 and 20 minutes | Timing changes the width population | Fitted groups are not single-particle trajectories |",
  "",
  "### Reproducible check",
  "",
  "```ts",
  "const aspectRatio = length / width;",
  "console.log({ aspectRatio });",
  "```",
  "",
  "The normalized score is $s = x / x_{max}$, with the display form:",
  "",
  "$$",
  "s_i = \\frac{x_i}{\\max_j x_j}",
  "$$",
  "",
  "---",
  "",
  "Use `evidenceId` to trace every row back to its source.",
].join("\n");

async function seedDocumentThread(page: import("@playwright/test").Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => typeof window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__ === "function",
      ),
    )
    .toBe(true);
  return page.evaluate((content) => {
    const root = window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__?.({
      channelName: "general",
      content,
      createdAt: 1_700_910_000,
    });
    if (!root) throw new Error("Failed to seed Markdown reader root");
    window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__?.({
      channelName: "general",
      content: "Review complete.",
      parentEventId: root.id,
      createdAt: 1_700_910_001,
    });
    return root.id;
  }, DOCUMENT_MARKDOWN);
}

async function scrollToMiddleVisibleMessage(
  body: import("@playwright/test").Locator,
  threadRootId: string,
): Promise<string> {
  let anchorId: string | null = null;
  await expect
    .poll(async () => {
      anchorId = await body.evaluate((element) => {
        const maxScrollTop = element.scrollHeight - element.clientHeight;
        if (maxScrollTop <= 0) return null;

        const targetScrollTop = Math.floor(maxScrollTop * 0.4);
        element.scrollTop = targetScrollTop;
        element.dispatchEvent(new Event("scroll", { bubbles: true }));

        if (Math.abs(element.scrollTop - targetScrollTop) > 1) return null;
        const bounds = element.getBoundingClientRect();
        const row = Array.from(
          element.querySelectorAll<HTMLElement>("[data-message-id]"),
        ).find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return rect.bottom > bounds.top && rect.top < bounds.bottom;
        });
        return row?.dataset.messageId ?? null;
      });
      return anchorId !== null && anchorId !== threadRootId;
    })
    .toBe(true);

  if (!anchorId) throw new Error("No visible middle-thread anchor");
  return anchorId;
}

/**
 * The channel header must own its pixels, not merely be "visible".
 *
 * Regression guard for the focus-mode launch: a `z-0` on the channel section
 * created a stacking context that flattened the header's `z-30` beneath the
 * sibling shared header backdrop (also `z-30`), painting the backdrop over the
 * name and actions. Neither `toBeVisible()` nor `elementFromPoint` can catch
 * this — the backdrop is `pointer-events-none`, so hit-testing skips it. We
 * compare CSS paint order directly: walk each element's stacking-context
 * chain, find the branches under their common stacking context, and check the
 * header's branch wins (higher z-index, or later in DOM order on a tie).
 */
async function expectChannelHeaderUnobscured(
  page: import("@playwright/test").Page,
) {
  const title = page.getByTestId("chat-title");
  await expect(title).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const titleEl = document.querySelector('[data-testid="chat-title"]');
        const backdropEl = document.querySelector(
          '[data-testid="channel-shared-header-backdrop"]',
        );
        if (!titleEl) return "missing title";
        if (!backdropEl) return "missing backdrop";

        const createsStackingContext = (el: Element): boolean => {
          const style = getComputedStyle(el);
          if (style.position !== "static" && style.zIndex !== "auto")
            return true;
          if (parseFloat(style.opacity) < 1) return true;
          if (style.transform !== "none") return true;
          if (style.filter !== "none") return true;
          const backdropFilter =
            style.backdropFilter ??
            (style as unknown as { webkitBackdropFilter?: string })
              .webkitBackdropFilter;
          if (backdropFilter && backdropFilter !== "none") return true;
          if (style.isolation === "isolate") return true;
          if (
            style.contain.includes("paint") ||
            style.contain.includes("strict")
          )
            return true;
          return false;
        };

        // Chain of stacking-context roots from the element up to <html>.
        const stackingChain = (el: Element): Element[] => {
          const chain: Element[] = [el];
          let current: Element | null = el.parentElement;
          while (current) {
            if (
              createsStackingContext(current) ||
              current === document.documentElement
            ) {
              chain.push(current);
            }
            current = current.parentElement;
          }
          return chain;
        };

        const titleChain = stackingChain(titleEl);
        const backdropChain = stackingChain(backdropEl);
        const common = titleChain.find((el) => backdropChain.includes(el));
        if (!common) return "no common stacking context";

        // Branch = the child-of-common entry each element paints through.
        const titleBranch = titleChain[titleChain.indexOf(common) - 1];
        const backdropBranch = backdropChain[backdropChain.indexOf(common) - 1];
        if (!titleBranch || !backdropBranch) return "degenerate chain";

        const effectiveZ = (el: Element): number => {
          const z = getComputedStyle(el).zIndex;
          return z === "auto" ? 0 : parseInt(z, 10);
        };
        const titleZ = effectiveZ(titleBranch);
        const backdropZ = effectiveZ(backdropBranch);
        if (titleZ !== backdropZ) {
          return titleZ > backdropZ ? true : "backdrop paints above header";
        }
        // Tie: later in DOM order paints on top.
        const order = backdropBranch.compareDocumentPosition(titleBranch);
        return (order & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
          ? true
          : "backdrop paints above header";
      }),
    )
    .toBe(true);
}

test("focus and split preserve reading context and interaction ownership", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem("buzz.channels.threadViewMode", "focus");
  });
  await installMockBridge(page, {
    managedAgents: [
      {
        pubkey:
          "953d3363262e86b770419834c53d2446409db6d918a57f8f339d495d54ab001f",
        name: "alice",
        status: "stopped",
      },
    ],
  });
  await page.goto("/");
  const rootId = await seedLongThread(page);

  await page.getByTestId("channel-general").click();
  await expectChannelHeaderUnobscured(page);
  const summary = page.locator(
    `[data-testid="message-thread-summary"][data-thread-head-id="${rootId}"]`,
  );
  await expect(summary).toBeVisible();
  await summary.click();

  const channel = page.getByTestId("channel-drop-zone");
  const drawer = page.getByTestId("focus-thread-drawer");
  const body = page.getByTestId("message-thread-body");
  await expect(drawer).toBeVisible();
  const readingColumn = page.getByTestId("thread-reading-column");
  await expect(readingColumn).toHaveAttribute(
    "data-reading-layout",
    "comfortable",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          document
            .querySelector('[data-testid="focus-thread-drawer"]')
            ?.contains(document.activeElement),
        ),
      ),
    )
    .toBe(true);
  await expect
    .poll(async () => {
      const box = await readingColumn.boundingBox();
      return box?.width ?? Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(1520);
  await expect(readingColumn).toHaveAttribute("data-reading-width-px", "1520");
  await page.getByTestId("thread-reading-narrower").click();
  await expect(readingColumn).toHaveAttribute("data-reading-width-px", "1400");
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("buzz.desktop.focus-thread-reading-width"),
      ),
    )
    .toBe("1400");
  await page.getByTestId("thread-reading-reset").click();
  await expect(readingColumn).toHaveAttribute("data-reading-width-px", "1520");
  const resizeHandle = page.getByTestId("thread-reading-resize-handle");
  await expect(resizeHandle).toBeVisible();
  const resizeHandleBox = await resizeHandle.boundingBox();
  if (!resizeHandleBox) {
    throw new Error("Thread reading resize handle has no bounding box");
  }
  const resizeY = Math.min(
    620,
    Math.max(
      100,
      resizeHandleBox.y + Math.min(100, resizeHandleBox.height / 2),
    ),
  );
  await page.mouse.move(resizeHandleBox.x + resizeHandleBox.width / 2, resizeY);
  await page.mouse.down();
  await page.mouse.move(
    resizeHandleBox.x + resizeHandleBox.width / 2 - 60,
    resizeY,
  );
  await page.mouse.up();
  await expect(readingColumn).toHaveAttribute("data-reading-width-px", "1400");
  await resizeHandle.dblclick();
  await expect(readingColumn).toHaveAttribute("data-reading-width-px", "1520");
  const focusMarkdown = readingColumn.locator(
    `[data-message-id="${rootId}"] .message-markdown`,
  );
  await expect(focusMarkdown).toBeVisible();
  await expect
    .poll(() =>
      focusMarkdown.evaluate((element) => {
        const style = getComputedStyle(element);
        return `${style.fontSize}/${style.lineHeight}`;
      }),
    )
    .toBe("16px/28px");
  const focusTableBlock = focusMarkdown.locator("[data-table-block]");
  await expect(focusTableBlock).toBeVisible();
  await expect
    .poll(() =>
      focusTableBlock.evaluate((element) => {
        const style = getComputedStyle(element);
        return `${style.borderTopWidth}/${style.borderRadius}`;
      }),
    )
    .toBe("0px/0px");
  await expect
    .poll(() =>
      focusTableBlock.locator("table").evaluate((element) => {
        const style = getComputedStyle(element);
        return `${style.fontSize}/${style.lineHeight}/${style.tableLayout}`;
      }),
    )
    .toBe("16px/28px/fixed");
  await expect
    .poll(() =>
      focusTableBlock.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
  await expect
    .poll(() =>
      focusTableBlock
        .locator("th")
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element);
          return `${style.backgroundColor}/${style.paddingBottom}`;
        }),
    )
    .toBe("rgba(0, 0, 0, 0)/12px");
  const focusRow = readingColumn.getByTestId("message-row").first();
  await expect
    .poll(() =>
      focusRow.evaluate((element) => getComputedStyle(element).paddingTop),
    )
    .toBe("12px");
  await expect(channel).toHaveAttribute("inert", "");

  const anchorId = await scrollToMiddleVisibleMessage(body, rootId);

  const focusModeToggle = page.getByRole("button", {
    name: "Show thread beside channel",
  });
  await focusModeToggle.hover();
  await expect(
    page.getByRole("tooltip", { name: "Show thread beside channel" }),
  ).toBeVisible();
  await focusModeToggle.click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByTestId("thread-reading-column")).toHaveAttribute(
    "data-reading-layout",
    "compact",
  );
  await expect(channel).not.toHaveAttribute("inert", "");
  await expectChannelHeaderUnobscured(page);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.getByTestId("message-thread-body")).toBeFocused();
  await expect(summary).not.toBeFocused();
  await expect(
    body.locator(`[data-message-id="${anchorId}"]`),
  ).toBeInViewport();
  await expect(
    body.locator(`[data-message-id="${anchorId}"]`),
  ).not.toHaveAttribute("data-highlighted", "true");

  // Sidebar background dismissal belongs to the overlay presentation only.
  await page
    .getByTestId("app-sidebar-scroll-anchor")
    .evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("message-thread-panel")).toBeVisible();

  const splitModeToggle = page.getByRole("button", { name: "Expand thread" });
  await splitModeToggle.focus();
  await splitModeToggle.press("Enter");
  await expect(drawer).toBeVisible();
  await expect(channel).toHaveAttribute("inert", "");
  await expect(page.getByTestId("thread-view-mode-toggle")).toBeFocused();
  await expect(
    body.locator(`[data-message-id="${anchorId}"]`),
  ).toBeInViewport();

  // Focus mode owns Escape even while the rich-text composer and one of its
  // nested controls has focus: one press exits the focused thread.
  const threadInput = page
    .getByTestId("message-thread-panel")
    .getByTestId("message-input");
  await threadInput.click();
  await threadInput.pressSequentially("@al");
  await expect(
    page
      .getByTestId("message-thread-panel")
      .getByTestId("mention-autocomplete"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("focus-thread-drawer-overlay")).toHaveCount(0);
  await expect(channel).not.toHaveAttribute("inert", "");

  await summary.click();
  await expect(drawer).toBeVisible();
  const profileCard = page.getByTestId("sidebar-profile-card");
  await profileCard.click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId("profile-popover")).toBeVisible();
  await expect(drawer).toBeVisible();
  await profileCard.click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId("profile-popover")).toHaveCount(0);
  await page
    .getByTestId("app-sidebar-scroll-anchor")
    .evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("focus-thread-drawer-overlay")).toHaveCount(0);

  await summary.click();
  await expect(drawer).toBeVisible();
  await page.getByTestId("focus-thread-drawer-scrim").click({
    position: { x: 24, y: 200 },
  });
  await expect(page.getByTestId("focus-thread-drawer-overlay")).toHaveCount(0);
  await expect(channel).not.toHaveAttribute("inert", "");
});

test("focus thread applies one document theme across Markdown primitives", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("buzz.channels.threadViewMode", "focus");
  });
  await installMockBridge(page);
  await page.goto("/");
  const rootId = await seedDocumentThread(page);

  await page.getByTestId("channel-general").click();
  const summary = page.locator(
    `[data-testid="message-thread-summary"][data-thread-head-id="${rootId}"]`,
  );
  await expect(summary).toBeVisible();
  await summary.click();

  const body = page.getByTestId("message-thread-body");
  await body.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  const focusMarkdown = page.locator(
    `[data-testid="thread-reading-column"] [data-message-id="${rootId}"] .message-markdown`,
  );
  await expect(focusMarkdown).toBeVisible();
  await expect(focusMarkdown).toHaveCSS("font-size", "16px");
  await expect(focusMarkdown).toHaveCSS("line-height", "28px");

  const title = focusMarkdown.locator('[data-markdown-heading="1"]');
  await expect(title).toHaveCSS("font-size", "24px");
  await expect(title).toHaveCSS("font-weight", "650");

  const paragraphs = focusMarkdown.locator("[data-markdown-paragraph]");
  await expect(paragraphs.nth(1)).toHaveCSS("margin-top", "14px");

  const list = focusMarkdown
    .locator('[data-markdown-list="unordered"]')
    .first();
  await expect(list).toHaveCSS("display", "grid");
  await expect(list).toHaveCSS("row-gap", "8px");
  await expect(focusMarkdown.locator(".task-list-item")).toHaveCount(2);

  const quote = focusMarkdown.locator("[data-markdown-blockquote]");
  await expect(quote).toHaveCSS("font-style", "normal");
  await expect(quote).toHaveCSS("padding-top", "12px");
  await expect
    .poll(() =>
      quote.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe("rgba(0, 0, 0, 0)");

  const codeBlock = focusMarkdown.locator("[data-code-block] pre");
  await expect(codeBlock).toHaveCSS("border-radius", "12px");
  await expect(codeBlock).toHaveCSS("padding-top", "16px");
  await expect(codeBlock).toHaveCSS("box-shadow", "none");

  const displayMath = focusMarkdown.locator(".katex-display").first();
  await expect(displayMath).toHaveCSS("overflow-x", "auto");
  await expect(displayMath).toHaveCSS("margin-top", "24px");

  await expect(
    focusMarkdown.getByRole("link", { name: "source index" }),
  ).toHaveCSS("text-decoration-line", "none");

  const tableBlock = focusMarkdown.locator("[data-table-block]");
  await expect(tableBlock).toHaveCSS("border-top-width", "0px");
  await expect(tableBlock).toHaveCSS("border-radius", "0px");
  await expect(tableBlock.locator("table")).toHaveCSS("table-layout", "fixed");
  await expect
    .poll(() =>
      tableBlock.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);

  await body.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await waitForAnimations(page);
  await page.screenshot({
    path: "test-results/buzz-focus-thread-markdown-reader.png",
  });
  await codeBlock.scrollIntoViewIfNeeded();
  await waitForAnimations(page);
  await page.screenshot({
    path: "test-results/buzz-focus-thread-markdown-code-math.png",
  });
});

test("narrow threads do not offer an unavailable layout switch", async ({
  page,
}) => {
  await page.setViewportSize({ width: 860, height: 720 });
  await installMockBridge(page);
  await page.goto("/");
  const rootId = await seedLongThread(page);
  await page.getByTestId("channel-general").click();
  const summary = page.locator(
    `[data-testid="message-thread-summary"][data-thread-head-id="${rootId}"]`,
  );
  await expect(summary).toBeVisible();
  await summary.click();
  await expect(page.getByTestId("message-thread-panel")).toBeVisible();
  await expect(page.getByTestId("thread-view-mode-toggle")).toHaveCount(0);
});
