import assert from "node:assert/strict";
import test from "node:test";

import {
  getCodexRuntimeIndicator,
  hasCodexDesktopRuntimeConflict,
  isCodexSharedRuntimeUsable,
} from "./codexSharedRuntimeStatus.ts";

const status = (overrides = {}) => ({
  enabled: true,
  state: "ready",
  url: "ws://127.0.0.1:51919",
  detail: null,
  desktopProcessIds: [],
  privateAppServerProcessIds: [],
  desktopDetectionError: null,
  ...overrides,
});

test("a private Desktop backend blocks shared-runtime task use", () => {
  const conflict = status({
    desktopProcessIds: [100],
    privateAppServerProcessIds: [101],
  });
  assert.equal(hasCodexDesktopRuntimeConflict(conflict), true);
  assert.equal(isCodexSharedRuntimeUsable(conflict), false);
});

test("ready is usable only after process detection succeeds", () => {
  assert.equal(isCodexSharedRuntimeUsable(status()), true);
  assert.equal(
    isCodexSharedRuntimeUsable(
      status({ desktopDetectionError: "process query failed" }),
    ),
    false,
  );
});

test("summarizes the computer-level Codex runtime for the Agents toolbar", () => {
  assert.deepEqual(getCodexRuntimeIndicator(undefined, true), {
    label: "Checking Codex...",
    state: "checking",
  });
  assert.deepEqual(
    getCodexRuntimeIndicator(status({ desktopProcessIds: [100] })),
    { label: "Codex running here", state: "running" },
  );
  assert.deepEqual(getCodexRuntimeIndicator(status()), {
    label: "Start Codex Desktop",
    state: "ready",
  });
  assert.deepEqual(
    getCodexRuntimeIndicator(status({ privateAppServerProcessIds: [101] })),
    { label: "Codex runtime conflict", state: "warning" },
  );
  assert.deepEqual(getCodexRuntimeIndicator(status({ state: "unavailable" })), {
    label: "Codex runtime unavailable",
    state: "warning",
  });
});
