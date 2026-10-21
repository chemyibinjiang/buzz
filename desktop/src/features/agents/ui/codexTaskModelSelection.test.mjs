import assert from "node:assert/strict";
import test from "node:test";

import {
  codexBaseModelOptions,
  codexEffortOptions,
  formatCodexModelSelection,
  parseCodexModelSelection,
} from "./codexTaskModelSelection.ts";

const options = [
  { id: "", label: "Default model" },
  { id: "gpt-5.6-sol", label: "GPT-5.6-Sol" },
  { id: "gpt-5.6-sol[low]", label: "GPT-5.6-Sol (low)" },
  { id: "gpt-5.6-sol[high]", label: "GPT-5.6-Sol (high)" },
  { id: "gpt-5.6-sol[xhigh]", label: "GPT-5.6-Sol (xhigh)" },
  { id: "gpt-5.6-sol[max]", label: "GPT-5.6-Sol (max)" },
  { id: "gpt-5.5[medium]", label: "GPT-5.5 (medium)" },
];

test("Codex model IDs split and compose model plus reasoning effort", () => {
  assert.deepEqual(parseCodexModelSelection("gpt-5.6-sol[xhigh]"), {
    model: "gpt-5.6-sol",
    effort: "xhigh",
  });
  assert.equal(
    formatCodexModelSelection("gpt-5.6-sol", "xhigh"),
    "gpt-5.6-sol[xhigh]",
  );
});

test("Codex task model picker collapses effort variants into one model row", () => {
  assert.deepEqual(codexBaseModelOptions(options, "gpt-5.6-sol[high]"), [
    { id: "", label: "Default model" },
    { id: "gpt-5.6-sol", label: "GPT-5.6-Sol" },
    { id: "gpt-5.5", label: "GPT-5.5" },
  ]);
});

test("Codex task effort picker exposes high, extra-high, max and current values", () => {
  assert.deepEqual(codexEffortOptions(options, "gpt-5.6-sol[xhigh]"), [
    { value: "low", label: "low" },
    { value: "high", label: "high" },
    { value: "xhigh", label: "xhigh (extra high)" },
    { value: "max", label: "max" },
  ]);
});
