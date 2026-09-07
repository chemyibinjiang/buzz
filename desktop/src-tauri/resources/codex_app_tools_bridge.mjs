import { access, readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BRIDGE_VERSION = "1";
const DEFAULT_REGISTRY_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "codex-app-tools-bridge.json",
);
const LAUNCH_WAIT_MS = 8_000;
const POLL_INTERVAL_MS = 100;

const sleep = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

export async function readBridgeTarget(
  registryPath = process.env.BUZZ_CODEX_APP_TOOLS_REGISTRY ??
    DEFAULT_REGISTRY_PATH,
) {
  const deadline = Date.now() + LAUNCH_WAIT_MS;

  while (true) {
    let registry;
    try {
      registry = JSON.parse(await readFile(registryPath, "utf8"));
    } catch {
      return null;
    }

    if (registry.state === "launching" && Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (
      registry.state !== "ready" ||
      typeof registry.pipe_path !== "string" ||
      typeof registry.server_path !== "string"
    ) {
      return null;
    }

    try {
      await Promise.all([
        access(registry.pipe_path),
        access(registry.server_path),
      ]);
      return {
        pipePath: registry.pipe_path,
        serverPath: registry.server_path,
      };
    } catch {
      return null;
    }
  }
}

export function unavailableResponse(request) {
  if (request == null || request.jsonrpc !== "2.0" || !("id" in request)) {
    return null;
  }

  if (request.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: request.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: "buzz-codex-app-tools-bridge",
          version: BRIDGE_VERSION,
        },
      },
    };
  }
  if (request.method === "tools/list") {
    return { jsonrpc: "2.0", id: request.id, result: { tools: [] } };
  }
  if (request.method === "ping") {
    return { jsonrpc: "2.0", id: request.id, result: {} };
  }
  if (request.method === "shutdown") {
    return { jsonrpc: "2.0", id: request.id, result: null };
  }

  return {
    jsonrpc: "2.0",
    id: request.id,
    error: { code: -32601, message: `Method not found: ${request.method}` },
  };
}

async function serveUnavailableBridge() {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let pending = Promise.resolve();

  lines.on("line", (line) => {
    pending = pending.then(async () => {
      let request;
      try {
        request = JSON.parse(line);
      } catch {
        return;
      }
      const response = unavailableResponse(request);
      if (response != null) {
        process.stdout.write(`${JSON.stringify(response)}\n`);
      }
    });
  });
  await new Promise((resolvePromise) => lines.once("close", resolvePromise));
  await pending;
}

async function main() {
  const target = await readBridgeTarget();
  if (target == null) {
    await serveUnavailableBridge();
    return;
  }

  process.env.CODEX_APP_TOOLS_PIPE_PATH = target.pipePath;
  process.argv = [
    process.execPath,
    target.serverPath,
    ...process.argv.slice(2),
  ];
  await import(pathToFileURL(target.serverPath).href);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  await main();
}
