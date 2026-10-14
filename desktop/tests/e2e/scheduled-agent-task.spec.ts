import { expect, test } from "@playwright/test";
import { parse as yamlParse } from "yaml";
import { waitForAnimations } from "../helpers/animations";
import { installMockBridge, TEST_IDENTITIES } from "../helpers/bridge";

test.use({
  timezoneId: "Asia/Shanghai",
  viewport: { width: 1280, height: 1000 },
});

test.beforeEach(async ({ page }) => {
  await installMockBridge(page, {
    managedAgents: [
      {
        pubkey: TEST_IDENTITIES.charlie.pubkey,
        name: "Status Agent",
        status: "running",
        channelNames: ["general"],
        respondTo: "anyone",
      },
      {
        pubkey: TEST_IDENTITIES.outsider.pubkey,
        name: "Other channel Agent",
        status: "running",
        channelNames: ["engineering"],
      },
    ],
  });
  await page.goto("/");
  await page.getByTestId("channel-general").click();
  await page.getByTestId("schedule-agent-task-trigger").click();
  await expect(
    page.getByRole("dialog", { name: "Schedule a task" }),
  ).toBeVisible();
  await page
    .locator("#scheduled-task-agent")
    .selectOption(TEST_IDENTITIES.charlie.pubkey);
});

async function savedDefinition(
  page: import("@playwright/test").Page,
  command = "create_workflow",
) {
  const payload = await page.evaluate((name) => {
    return window.__BUZZ_E2E_COMMAND_LOG__
      ?.filter((entry) => entry.command === name)
      .at(-1)?.payload as
      | { channelId: string; yamlDefinition: string }
      | undefined;
  }, command);
  expect(payload).toBeDefined();
  return { payload, definition: yamlParse(payload?.yamlDefinition ?? "") };
}

test("daily task defaults to local 9am without requiring a task name", async ({
  page,
}) => {
  const dialog = page.getByRole("dialog", { name: "Schedule a task" });
  await expect(dialog.locator("#task-repeat")).toHaveValue("daily");
  await expect(dialog.locator("#task-time")).toHaveValue("09:00");
  await expect(dialog).toContainText("China Time");
  await expect(dialog.getByLabel("Task name (optional)")).toHaveCount(0);
  await expect(dialog.locator("#scheduled-task-agent")).not.toContainText(
    "Other channel Agent",
  );
  await expect(
    dialog.getByRole("button", { name: "Create", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Instructions", { exact: true })
    .fill("Check build status\nReport in this channel.");
  await waitForAnimations(page);
  await dialog.screenshot({
    path: "test-results/scheduled-agent-task/daily.png",
  });
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId("workflows-view")).toBeVisible();
  const { definition } = await savedDefinition(page);
  expect(definition.name).toBe("Check build status");
  expect(definition.trigger.calendar).toMatchObject({
    frequency: "daily",
    every: 1,
    time: "09:00",
    timezone: "Asia/Shanghai",
    weekdays: [],
  });
  expect(definition.source.kind).toBe("channel_user");
  expect(definition.steps[0].agent).toBe(TEST_IDENTITIES.charlie.pubkey);
});

test("custom weekdays and every two weeks survive saving and editing", async ({
  page,
}) => {
  const dialog = page.getByRole("dialog", { name: "Schedule a task" });
  await dialog
    .getByLabel("Instructions", { exact: true })
    .fill("Summarize outstanding work");
  await dialog.locator("#task-repeat").selectOption("custom");
  await expect(dialog.locator("#task-frequency")).toHaveValue("weekly");
  await dialog.getByLabel("Every", { exact: true }).fill("2");
  for (const day of ["Tuesday", "Wednesday", "Thursday"]) {
    await dialog.getByRole("button", { name: day, exact: true }).click();
  }
  await expect(
    dialog.getByRole("button", { name: "Monday", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    dialog.getByRole("button", { name: "Tuesday", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await waitForAnimations(page);
  await dialog.screenshot({
    path: "test-results/scheduled-agent-task/custom-weekly.png",
  });
  await dialog.getByRole("button", { name: "Advanced" }).click();
  await dialog.getByLabel("Task name (optional)").fill("Fortnightly handover");
  await dialog.getByLabel("Start date").fill("2026-10-12");
  await expect(dialog).toContainText(
    "Source: user-created channel task in general",
  );
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const created = await savedDefinition(page);
  expect(created.definition.trigger).toEqual({
    on: "schedule",
    calendar: {
      frequency: "weekly",
      every: 2,
      time: "09:00",
      timezone: "Asia/Shanghai",
      start_date: "2026-10-12",
      weekdays: [1, 5],
    },
  });
  await page.getByTestId("open-workflows-view").click();
  await expect(page.getByTestId("workflows-view")).toContainText(
    "Fortnightly handover",
  );
  await page.getByRole("button", { name: "Workflow actions" }).first().click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit Workflow" });
  await expect(editDialog.getByLabel("Every (weeks)")).toHaveValue("2");
  await expect(editDialog.getByLabel("Timezone")).toHaveValue("Asia/Shanghai");
  await editDialog
    .getByLabel("Workflow name")
    .fill("Fortnightly handover updated");
  await editDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editDialog).not.toBeVisible();
  const updated = await savedDefinition(page, "update_workflow");
  expect(updated.definition.trigger).toEqual(created.definition.trigger);
  expect(updated.definition.source).toEqual(created.definition.source);
});

test("heartbeat blocks zero intervals and saves the requested minutes", async ({
  page,
}) => {
  const dialog = page.getByRole("dialog", { name: "Schedule a task" });
  await dialog
    .getByLabel("Instructions", { exact: true })
    .fill("Check the running experiment; report only on a meaningful change.");
  await dialog.locator("#task-repeat").selectOption("heartbeat");
  await expect(dialog.locator("#task-frequency")).toHaveValue("minutes");
  await dialog.getByLabel("Every", { exact: true }).fill("0");
  await expect(
    dialog.getByRole("button", { name: "Create", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Every", { exact: true }).fill("5");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const { definition } = await savedDefinition(page);
  expect(definition.trigger).toEqual({ on: "schedule", interval: "5m" });
});

test("scheduled tasks remain listed through the relay-wide accessible query", async ({
  page,
}) => {
  const dialog = page.getByRole("dialog", { name: "Schedule a task" });
  await dialog
    .getByLabel("Instructions", { exact: true })
    .fill("Keep this task visible even if its channel projection is delayed.");
  await dialog.locator("#task-repeat").selectOption("heartbeat");
  await dialog.getByLabel("Every", { exact: true }).fill("3");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page.getByTestId("workflows-view")).toContainText(
    "Keep this task visible",
  );
  const usedAccessibleQuery = await page.evaluate(() =>
    Boolean(
      window.__BUZZ_E2E_COMMAND_LOG__?.some(
        (entry) => entry.command === "get_accessible_workflows",
      ),
    ),
  );
  expect(usedAccessibleQuery).toBe(true);
});
