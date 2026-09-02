#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { connect as connectTls } from "node:tls";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_HTTP_BODY_BYTES = 1024 * 1024;
const MAX_HANDSHAKE_BYTES = 64 * 1024;
const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export function normalizePublicRelayUrl(input) {
  const relayUrl = new URL(input);
  if (relayUrl.protocol === "https:") relayUrl.protocol = "wss:";
  if (relayUrl.protocol !== "wss:") {
    throw new Error(
      `public relay URL must use wss:// or https://; got ${input}`,
    );
  }
  if (isIP(relayUrl.hostname.replace(/^\[|\]$/g, ""))) {
    throw new Error(
      "public relay URL must use a stable domain, not an IP address",
    );
  }
  if (relayUrl.username || relayUrl.password) {
    throw new Error("public relay URL must not contain credentials");
  }
  if (relayUrl.pathname !== "/" || relayUrl.search || relayUrl.hash) {
    throw new Error(
      "Buzz must be served at the relay origin, not under a path",
    );
  }
  return relayUrl;
}

export function websocketAcceptForKey(key) {
  return createHash("sha1").update(`${key}${WEBSOCKET_GUID}`).digest("base64");
}

export function parseHttpHead(rawHead) {
  const lines = rawHead.split("\r\n");
  const statusMatch = /^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s+.*)?$/i.exec(
    lines.shift() ?? "",
  );
  if (!statusMatch)
    throw new Error("edge returned a malformed HTTP status line");

  const headers = new Map();
  for (const line of lines) {
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator <= 0)
      throw new Error(`edge returned a malformed header: ${line}`);
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    headers.set(
      name,
      headers.has(name) ? `${headers.get(name)}, ${value}` : value,
    );
  }
  return { statusCode: Number(statusMatch[1]), headers };
}

export function validateWebSocketHandshake(rawHead, key) {
  const response = parseHttpHead(rawHead);
  if (response.statusCode !== 101) {
    const detail =
      response.statusCode === 200
        ? " The edge served HTTP but did not forward the WebSocket Upgrade headers."
        : "";
    throw new Error(
      `WSS upgrade returned HTTP ${response.statusCode}, expected 101.${detail}`,
    );
  }
  if (response.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    throw new Error("WSS response is missing Upgrade: websocket");
  }
  const connectionTokens = (response.headers.get("connection") ?? "")
    .toLowerCase()
    .split(",")
    .map((value) => value.trim());
  if (!connectionTokens.includes("upgrade")) {
    throw new Error("WSS response is missing Connection: Upgrade");
  }
  if (
    response.headers.get("sec-websocket-accept") !== websocketAcceptForKey(key)
  ) {
    throw new Error("WSS response has an invalid Sec-WebSocket-Accept value");
  }
  return response;
}

export function validateBuzzNip11(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("HTTPS response is not a NIP-11 object");
  }
  if (
    typeof document.software !== "string" ||
    !document.software.toLowerCase().includes("buzz")
  ) {
    throw new Error("NIP-11 response does not identify Buzz relay software");
  }
  if (!Array.isArray(document.supported_nips)) {
    throw new Error("NIP-11 response is missing supported_nips");
  }
  for (const requiredNip of [11, 42]) {
    if (!document.supported_nips.includes(requiredNip)) {
      throw new Error(`NIP-11 response does not advertise NIP-${requiredNip}`);
    }
  }
  return document;
}

function relayPort(relayUrl) {
  return relayUrl.port ? Number(relayUrl.port) : 443;
}

function connectionHost(relayUrl, connectIp) {
  return connectIp || relayUrl.hostname;
}

export async function resolveRelayDns(relayUrl, expectedIps = []) {
  const records = await lookup(relayUrl.hostname, {
    all: true,
    verbatim: true,
  });
  const addresses = [...new Set(records.map((record) => record.address))];
  if (
    expectedIps.length > 0 &&
    !expectedIps.some((ip) => addresses.includes(ip))
  ) {
    throw new Error(
      `DNS resolved ${relayUrl.hostname} to ${addresses.join(", ") || "no addresses"}; ` +
        `expected one of ${expectedIps.join(", ")}`,
    );
  }
  return addresses;
}

export function fetchBuzzNip11({ relayUrl, connectIp, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: connectionHost(relayUrl, connectIp),
        port: relayPort(relayUrl),
        servername: relayUrl.hostname,
        method: "GET",
        path: "/",
        headers: {
          Accept: "application/nostr+json",
          Host: relayUrl.host,
        },
        rejectUnauthorized: true,
        timeout: timeoutMs,
      },
      (response) => {
        const chunks = [];
        let bodyBytes = 0;
        response.on("error", reject);
        response.on("data", (chunk) => {
          bodyBytes += chunk.length;
          if (bodyBytes > MAX_HTTP_BODY_BYTES) {
            response.destroy(new Error("NIP-11 response exceeded 1 MiB"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `NIP-11 request returned HTTP ${response.statusCode}, expected 200`,
              ),
            );
            return;
          }
          try {
            const body = Buffer.concat(chunks).toString("utf8");
            resolve(validateBuzzNip11(JSON.parse(body)));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("NIP-11 request timed out")));
    req.on("error", reject);
    req.end();
  });
}

export function probeWebSocketUpgrade({ relayUrl, connectIp, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const key = randomBytes(16).toString("base64");
    const socket = connectTls({
      host: connectionHost(relayUrl, connectIp),
      port: relayPort(relayUrl),
      servername: relayUrl.hostname,
      ALPNProtocols: ["http/1.1"],
      rejectUnauthorized: true,
    });
    let settled = false;
    let response = Buffer.alloc(0);

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };

    socket.setTimeout(timeoutMs, () =>
      finish(new Error("WSS upgrade timed out")),
    );
    socket.on("error", (error) => finish(error));
    socket.on("secureConnect", () => {
      socket.write(
        [
          "GET / HTTP/1.1",
          `Host: ${relayUrl.host}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ].join("\r\n"),
      );
    });
    socket.on("data", (chunk) => {
      response = Buffer.concat([response, chunk]);
      if (response.length > MAX_HANDSHAKE_BYTES) {
        finish(new Error("WSS handshake response exceeded 64 KiB"));
        return;
      }
      const headEnd = response.indexOf("\r\n\r\n");
      if (headEnd < 0) return;
      try {
        finish(
          null,
          validateWebSocketHandshake(
            response.subarray(0, headEnd).toString(),
            key,
          ),
        );
      } catch (error) {
        finish(error);
      }
    });
  });
}

export async function checkRelayEdge({
  url,
  connectIp,
  expectedIps = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onStep = () => {},
}) {
  const relayUrl = normalizePublicRelayUrl(url);
  for (const ip of [connectIp, ...expectedIps].filter(Boolean)) {
    if (!isIP(ip))
      throw new Error(`expected an IPv4 or IPv6 address; got ${ip}`);
  }
  let addresses;
  try {
    addresses = await resolveRelayDns(relayUrl, expectedIps);
  } catch (error) {
    if (!connectIp || expectedIps.length > 0) throw error;
    addresses = [];
  }
  onStep({
    stage: "dns",
    addresses,
    connectIp,
    includesConnectIp: connectIp ? addresses.includes(connectIp) : true,
  });
  const nip11 = await fetchBuzzNip11({ relayUrl, connectIp, timeoutMs });
  onStep({ stage: "nip11", document: nip11 });
  await probeWebSocketUpgrade({ relayUrl, connectIp, timeoutMs });
  onStep({ stage: "websocket", statusCode: 101 });
  return {
    relayUrl: relayUrl.toString().replace(/\/$/, ""),
    connectedTo: connectIp || relayUrl.hostname,
    dnsAddresses: addresses,
    dnsIncludesConnectedIp: connectIp ? addresses.includes(connectIp) : true,
    nip11: {
      name: nip11.name,
      software: nip11.software,
      version: nip11.version,
    },
    websocketStatus: 101,
  };
}

function parseTimeout(value) {
  if (value === undefined) return DEFAULT_TIMEOUT_MS;
  const timeoutMs = Number(value);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`--timeout-ms must be a positive integer; got ${value}`);
  }
  return timeoutMs;
}

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: "string" },
      "connect-ip": { type: "string" },
      "expected-ip": { type: "string", multiple: true, default: [] },
      "timeout-ms": { type: "string" },
      json: { type: "boolean", default: false },
    },
  });
  if (!values.url) throw new Error("--url is required");

  const reportStep = values.json
    ? undefined
    : (step) => {
        if (step.stage === "dns") {
          const addresses = step.addresses.join(", ") || "not published";
          const line = step.connectIp
            ? `INFO DNS: ${addresses} (${step.includesConnectIp ? "includes" : "does not include"} forced edge ${step.connectIp})`
            : `PASS DNS: ${addresses}`;
          process.stdout.write(`${line}\n`);
        } else if (step.stage === "nip11") {
          process.stdout.write(
            `PASS HTTPS/NIP-11: ${step.document.name} ${step.document.version ?? ""}\n`,
          );
        } else if (step.stage === "websocket") {
          process.stdout.write(
            `PASS WSS: HTTP ${step.statusCode} Switching Protocols\n`,
          );
        }
      };
  const result = await checkRelayEdge({
    url: values.url,
    connectIp: values["connect-ip"],
    expectedIps: values["expected-ip"],
    timeoutMs: parseTimeout(values["timeout-ms"]),
    onStep: reportStep,
  });
  if (values.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(
    `Relay edge is ready: ${result.relayUrl} (connected to ${result.connectedTo})\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    process.stderr.write(`FAIL relay edge: ${error.message}\n`);
    process.exitCode = 1;
  });
}
