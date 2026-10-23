import assert from "node:assert/strict";
import test from "node:test";

import { allowsNonOwnerAgentDm } from "./agentDirectMessageAccess.ts";

const sharedAgent = {
  managedDefinition: true,
  ownerPubkey: "a".repeat(64),
  deleted: false,
  respondTo: "owner-only",
  allowNonOwnerDm: true,
};

test("explicit DM permission is independent of channel access mode", () => {
  for (const respondTo of ["owner-only", "allowlist", "anyone"]) {
    assert.equal(allowsNonOwnerAgentDm({ ...sharedAgent, respondTo }), true);
  }
});

test("legacy, unverified, deleted and disabled agents do not offer non-owner DMs", () => {
  for (const agent of [
    null,
    undefined,
    { ...sharedAgent, allowNonOwnerDm: undefined },
    { ...sharedAgent, allowNonOwnerDm: false },
    { ...sharedAgent, managedDefinition: false },
    { ...sharedAgent, ownerPubkey: null },
    { ...sharedAgent, deleted: true },
    { ...sharedAgent, respondTo: "nobody" },
    { ...sharedAgent, respondTo: "unknown" },
    { ...sharedAgent, respondTo: null },
  ]) {
    assert.equal(allowsNonOwnerAgentDm(agent), false);
  }
});
