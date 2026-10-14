import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getPromptAgentPubkey,
  getWorkflowSourceKind,
  isScheduledAgentTask,
  getWorkflowTriggerSummary,
} from "./workflowDefinition.ts";
import {
  dateInTimezone,
  defaultScheduleOptions,
  scheduledTaskName,
  scheduleTrigger,
} from "./agentTaskSchedule.ts";
import {
  DEFAULT_FORM_STATE,
  formStateToYaml,
  yamlToFormState,
} from "./workflowFormTypes.ts";

const AGENT = "ab".repeat(32);

test("local schedule dates respect timezone rather than the UTC date", () => {
  assert.equal(
    dateInTimezone("Asia/Shanghai", new Date("2026-10-11T16:30:00Z")),
    "2026-10-12",
  );
});

test("calendar custom recurrence survives workflow edits and includes human summary", () => {
  const result = scheduleTrigger({
    ...defaultScheduleOptions(),
    repeat: "custom",
    frequency: "weekly",
    every: "2",
    time: "09:00",
    timezone: "Asia/Shanghai",
    startDate: "2026-10-12",
    weekdays: [5, 1],
  });
  assert.equal(result.error, undefined);
  const yaml = formStateToYaml({
    ...DEFAULT_FORM_STATE,
    name: "Fortnightly report",
    trigger: result.trigger,
    steps: [
      {
        id: "prompt_agent",
        action: "prompt_agent",
        agent: AGENT,
        prompt: "Report",
      },
    ],
  });
  const parsed = yamlToFormState(yaml);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.state.trigger.calendar, {
    frequency: "weekly",
    every: 2,
    time: "09:00",
    timezone: "Asia/Shanghai",
    start_date: "2026-10-12",
    weekdays: [1, 5],
  });
  assert.match(
    getWorkflowTriggerSummary({ trigger: parsed.state.trigger }),
    /Every 2 weeks on Mon, Fri at 09:00 \(Asia\/Shanghai\)/,
  );
});

test("daily, weekdays, heartbeat, and custom daily create mutually exclusive schedules", () => {
  const options = { ...defaultScheduleOptions(), timezone: "Asia/Shanghai" };
  assert.equal(scheduleTrigger(options).trigger.calendar.frequency, "daily");
  assert.deepEqual(
    scheduleTrigger({ ...options, repeat: "weekdays" }).trigger.calendar
      .weekdays,
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    scheduleTrigger({
      ...options,
      repeat: "heartbeat",
      frequency: "minutes",
      every: "5",
    }).trigger,
    { on: "schedule", interval: "5m" },
  );
  assert.deepEqual(
    scheduleTrigger({
      ...options,
      repeat: "custom",
      frequency: "hours",
      every: "2",
    }).trigger,
    { on: "schedule", interval: "2h" },
  );
  assert.equal(
    scheduleTrigger({
      ...options,
      repeat: "custom",
      frequency: "daily",
      every: "3",
    }).trigger.calendar.every,
    3,
  );
});

test("invalid recurrence cannot silently create a different task", () => {
  const options = {
    ...defaultScheduleOptions(),
    repeat: "custom",
    frequency: "weekly",
  };
  for (const patch of [
    { every: "0" },
    { every: "1.5" },
    { every: "367" },
    { every: "" },
    { weekdays: [] },
    { weekdays: [8] },
    { time: "25:00" },
    { timezone: "China Time" },
    { startDate: "2026-02-30" },
  ]) {
    assert.equal(scheduleTrigger({ ...options, ...patch }).trigger, undefined);
  }
  assert.equal(
    scheduleTrigger({
      ...options,
      repeat: "heartbeat",
      frequency: "minutes",
      every: "0",
    }).trigger,
    undefined,
  );
});

test("task name is optional and Unicode instructions are preserved", () => {
  assert.equal(
    scheduledTaskName("", "  检查构建状态\n在群内报告结果"),
    "检查构建状态",
  );
  assert.equal(scheduledTaskName(" My task ", "Instructions"), "My task");
  assert.equal(Array.from(scheduledTaskName("", "😀".repeat(90))).length, 80);
});

test("scheduled Agent task helpers identify target and attributed source", () => {
  const definition = {
    name: "Daily status",
    source: { kind: "channel_user" },
    trigger: { on: "schedule", interval: "1h" },
    steps: [
      {
        id: "prompt_agent",
        action: "prompt_agent",
        agent: AGENT,
        prompt: "Summarize progress",
      },
    ],
  };

  assert.equal(isScheduledAgentTask(definition), true);
  assert.equal(getPromptAgentPubkey(definition), AGENT);
  assert.equal(getWorkflowSourceKind(definition), "channel_user");
});

test("workflow source falls back without misclassifying non-scheduled prompts", () => {
  assert.equal(getWorkflowSourceKind({}), "workflow");
  assert.deepEqual(DEFAULT_FORM_STATE.source, { kind: "channel_user" });
  assert.equal(
    isScheduledAgentTask({
      trigger: { on: "message_posted" },
      steps: [{ action: "prompt_agent", agent: AGENT }],
    }),
    false,
  );
});

test("form YAML round-trip preserves prompt_agent and source attribution", () => {
  const yaml = formStateToYaml({
    name: "Hourly review",
    description: "Check project state",
    enabled: true,
    source: { kind: "agent_self", eventId: "cd".repeat(32) },
    trigger: { on: "schedule", interval: "1h" },
    steps: [
      {
        id: "prompt_agent",
        action: "prompt_agent",
        agent: AGENT,
        prompt: "Review outstanding work",
      },
    ],
  });

  const parsed = yamlToFormState(yaml);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.state.source, {
    kind: "agent_self",
    eventId: "cd".repeat(32),
  });
  assert.equal(parsed.state.steps[0]?.action, "prompt_agent");
  assert.equal(parsed.state.steps[0]?.agent, AGENT);
  assert.equal(parsed.state.steps[0]?.prompt, "Review outstanding work");
});
