import assert from "node:assert/strict";
import test from "node:test";

import { buildUnifiedGroups } from "./unifiedAgentGroups.ts";

const persona = {
  id: "debug-definition",
  displayName: "Debug",
  isActive: true,
};

test("Codex task agents stay in Custom agents after persona backfill", () => {
  const result = buildUnifiedGroups(
    [persona],
    [
      {
        name: "Debug",
        personaId: "debug-definition",
        codexTaskBinding: { taskId: "task-1" },
      },
    ],
  );

  assert.equal(result.groups.length, 0);
  assert.equal(result.ungrouped.length, 1);
  assert.equal(result.ungrouped[0].name, "Debug");
});

test("accidental copies of a Codex task definition remain visible as custom agents", () => {
  const result = buildUnifiedGroups(
    [persona],
    [
      {
        name: "Bound task",
        personaId: "debug-definition",
        codexTaskBinding: { taskId: "task-1" },
      },
      {
        name: "Accidental copy",
        personaId: "debug-definition",
      },
    ],
  );

  assert.equal(result.groups.length, 0);
  assert.deepEqual(
    result.ungrouped.map((agent) => agent.name),
    ["Bound task", "Accidental copy"],
  );
});

test("ordinary persona-linked agents remain grouped", () => {
  const result = buildUnifiedGroups(
    [persona],
    [{ name: "Debug", personaId: "debug-definition" }],
  );

  assert.equal(result.groups[0].agents.length, 1);
  assert.equal(result.ungrouped.length, 0);
});

test("remote Codex task agents stay in Custom agents and hide the persona start card", () => {
  const result = buildUnifiedGroups(
    [persona],
    [],
    [
      {
        name: "Debug",
        personaId: "debug-definition",
        codexTask: true,
        status: "online",
      },
    ],
  );

  assert.equal(result.groups.length, 0);
  assert.equal(result.remoteCustomAgents.length, 1);
  assert.equal(result.remoteCustomAgents[0].name, "Debug");
});

test("ordinary remote persona-linked agents remain grouped without becoming local instances", () => {
  const result = buildUnifiedGroups(
    [persona],
    [],
    [
      {
        name: "Remote Debug",
        personaId: "debug-definition",
        codexTask: false,
        status: "online",
      },
    ],
  );

  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].agents.length, 0);
  assert.equal(result.groups[0].remoteAgents.length, 1);
  assert.equal(result.remoteCustomAgents.length, 0);
});
