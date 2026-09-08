import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  readBridgeTarget,
  unavailableResponse,
} from "../src-tauri/resources/codex_app_tools_bridge.mjs";

test("unavailable bridge completes MCP initialization", () => {
  assert.deepEqual(
    unavailableResponse({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26" },
    }),
    {
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: "buzz-codex-app-tools-bridge",
          version: "1",
        },
      },
    },
  );
});

test("unavailable bridge exposes an empty tool catalog", () => {
  assert.deepEqual(
    unavailableResponse({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    { jsonrpc: "2.0", id: 2, result: { tools: [] } },
  );
  assert.equal(
    unavailableResponse({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
    null,
  );
});

test("ready registry resolves an accessible pipe and official server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "buzz-codex-app-tools-"));
  try {
    const pipePath = join(directory, "pipe");
    const serverPath = join(directory, "server.mjs");
    const registryPath = join(directory, "registry.json");
    await Promise.all([
      writeFile(pipePath, ""),
      writeFile(serverPath, ""),
      writeFile(
        registryPath,
        JSON.stringify({
          version: 1,
          state: "ready",
          pipe_path: pipePath,
          server_path: serverPath,
        }),
      ),
    ]);

    assert.deepEqual(await readBridgeTarget(registryPath), {
      pipePath,
      serverPath,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("stale registry degrades to the unavailable bridge", async () => {
  const directory = await mkdtemp(join(tmpdir(), "buzz-codex-app-tools-"));
  try {
    const registryPath = join(directory, "registry.json");
    await writeFile(
      registryPath,
      JSON.stringify({
        version: 1,
        state: "ready",
        pipe_path: join(directory, "missing-pipe"),
        server_path: join(directory, "missing-server.mjs"),
      }),
    );

    assert.equal(await readBridgeTarget(registryPath), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
