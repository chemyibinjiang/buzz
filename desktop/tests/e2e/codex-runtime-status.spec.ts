import { expect, test } from "@playwright/test";

import { waitForAnimations } from "../helpers/animations";
import { installMockBridge } from "../helpers/bridge";

const SHOTS = "test-results/codex-runtime-status";

test("shows the local Codex runtime and its process details", async ({
  page,
}) => {
  await installMockBridge(page, {
    acpRuntimesCatalog: [
      {
        auth_status: { status: "logged_in" },
        availability: "available",
        avatar_url: "",
        binary_path:
          "C:/Users/test/AppData/Roaming/Buzz/node-tools/codex-acp.cmd",
        can_auto_install: true,
        command: "codex-acp",
        default_args: [],
        id: "codex",
        install_hint: "",
        install_instructions_url: "https://github.com/zed-industries/codex-acp",
        label: "Codex",
        login_hint: null,
        mcp_command: null,
        node_required: true,
        underlying_cli_path:
          "C:/Users/test/AppData/Local/OpenAI/Codex/codex.exe",
      },
    ],
    codexSharedRuntimeStatus: {
      enabled: true,
      state: "ready",
      url: "ws://127.0.0.1:51919",
      detail: null,
      desktop_process_ids: [4242],
      private_app_server_process_ids: [],
      desktop_detection_error: null,
    },
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("open-agents-view")).toBeVisible();
  await page.getByTestId("open-agents-view").click();

  const runtimeButton = page.getByTestId("open-codex-desktop-button");
  await expect(runtimeButton).toHaveAttribute("data-runtime-state", "running");
  await expect(runtimeButton).toContainText("Codex running here");
  await waitForAnimations(page);
  await runtimeButton.screenshot({ path: `${SHOTS}/01-running-button.png` });

  await runtimeButton.click();
  const dialog = page.getByTestId("codex-shared-runtime-dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("codex-runtime-shared")).toContainText(
    "ws://127.0.0.1:51919",
  );
  await expect(page.getByTestId("codex-runtime-desktop")).toContainText(
    "PID 4242",
  );
  await expect(page.getByTestId("codex-runtime-conflict")).toHaveCount(0);
  await waitForAnimations(page);
  await dialog.screenshot({ path: `${SHOTS}/02-runtime-details.png` });
});
