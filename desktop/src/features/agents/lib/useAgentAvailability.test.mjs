import assert from "node:assert/strict";
import test from "node:test";

import {
  agentPresenceStartBlockReason,
  resolveAgentAvailability,
} from "./useAgentAvailability.ts";

test("availability requires a successful read on a connected relay", () => {
  assert.equal(resolveAgentAvailability("online", true, true), "online");
  assert.equal(resolveAgentAvailability("away", true, true), "away");
  assert.equal(resolveAgentAvailability(undefined, true, true), "offline");
  assert.equal(resolveAgentAvailability("online", false, true), undefined);
  assert.equal(resolveAgentAvailability("online", true, false), undefined);
});

test("positive presence blocks a duplicate start only when lifecycle is idle", () => {
  assert.match(agentPresenceStartBlockReason(false, "online"), /present/);
  assert.match(agentPresenceStartBlockReason(false, "away"), /present/);
  assert.equal(agentPresenceStartBlockReason(false, "offline"), undefined);
  assert.equal(agentPresenceStartBlockReason(false, undefined), undefined);
  assert.equal(agentPresenceStartBlockReason(true, "online"), undefined);
});
