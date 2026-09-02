import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePublicRelayUrl,
  parseHttpHead,
  validateBuzzNip11,
  validateWebSocketHandshake,
  websocketAcceptForKey,
} from "./check-relay-edge.mjs";

test("normalizes a public HTTPS origin to its canonical WSS identity", () => {
  assert.equal(
    normalizePublicRelayUrl("https://relay.example").toString(),
    "wss://relay.example/",
  );
  assert.equal(
    normalizePublicRelayUrl("wss://relay.example:8443").toString(),
    "wss://relay.example:8443/",
  );
});

test("rejects insecure, credentialed, and path-mounted relay URLs", () => {
  assert.throws(
    () => normalizePublicRelayUrl("ws://relay.example"),
    /must use wss/,
  );
  assert.throws(
    () => normalizePublicRelayUrl("wss://219.229.81.240"),
    /stable domain/,
  );
  assert.throws(
    () => normalizePublicRelayUrl("wss://user:secret@relay.example"),
    /credentials/,
  );
  assert.throws(
    () => normalizePublicRelayUrl("wss://relay.example/buzz"),
    /relay origin/,
  );
});

test("parses HTTP response headers case-insensitively", () => {
  const response = parseHttpHead(
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nCONNECTION: Upgrade",
  );
  assert.equal(response.statusCode, 101);
  assert.equal(response.headers.get("connection"), "Upgrade");
});

test("validates the RFC 6455 WebSocket handshake", () => {
  const key = "dGhlIHNhbXBsZSBub25jZQ==";
  assert.equal(websocketAcceptForKey(key), "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
  const response = validateWebSocketHandshake(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: keep-alive, Upgrade",
      `Sec-WebSocket-Accept: ${websocketAcceptForKey(key)}`,
    ].join("\r\n"),
    key,
  );
  assert.equal(response.statusCode, 101);
});

test("diagnoses an HTTP-only reverse proxy as a failed WSS edge", () => {
  assert.throws(
    () =>
      validateWebSocketHandshake(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json",
        "unused",
      ),
    /did not forward the WebSocket Upgrade headers/,
  );
});

test("requires a Buzz NIP-11 document with authentication support", () => {
  const document = {
    name: "Buzz Relay",
    software: "https://github.com/block/buzz",
    supported_nips: [1, 11, 42],
  };
  assert.equal(validateBuzzNip11(document), document);
  assert.throws(
    () => validateBuzzNip11({ ...document, supported_nips: [1, 11] }),
    /NIP-42/,
  );
  assert.throws(
    () => validateBuzzNip11({ ...document, software: "other-relay" }),
    /Buzz relay software/,
  );
});
