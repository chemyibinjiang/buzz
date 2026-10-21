import type { PersonaModelOption } from "./agentConfigOptions";

const CODEX_MODEL_ID = /^(?<model>[^[]+?)(?:\[(?<effort>[^\]]+)\])?$/;

const EFFORT_ORDER = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
] as const;

export type CodexModelSelection = {
  model: string;
  effort: string;
};

export function parseCodexModelSelection(value: string): CodexModelSelection {
  const trimmed = value.trim();
  const match = CODEX_MODEL_ID.exec(trimmed);
  return {
    model: match?.groups?.model?.trim() ?? trimmed,
    effort: match?.groups?.effort?.trim() ?? "",
  };
}

export function formatCodexModelSelection(model: string, effort: string) {
  const trimmedModel = model.trim();
  const trimmedEffort = effort.trim();
  if (!trimmedModel || !trimmedEffort) return trimmedModel;
  return `${trimmedModel}[${trimmedEffort}]`;
}

function modelLabel(option: PersonaModelOption) {
  return option.label.replace(/\s*\([^()]+\)\s*$/, "").trim() || option.id;
}

export function codexBaseModelOptions(
  options: readonly PersonaModelOption[] | null,
  selectedValue: string,
): readonly PersonaModelOption[] | null {
  if (options === null) return null;
  const selected = parseCodexModelSelection(selectedValue);
  const seen = new Set<string>();
  const result: PersonaModelOption[] = [];
  for (const option of options) {
    if (option.id === "") {
      if (!seen.has("")) {
        seen.add("");
        result.push(option);
      }
      continue;
    }
    const parsed = parseCodexModelSelection(option.id);
    if (!parsed.model || seen.has(parsed.model)) continue;
    seen.add(parsed.model);
    result.push({ id: parsed.model, label: modelLabel(option) });
  }
  if (selected.model && !seen.has(selected.model)) {
    result.push({ id: selected.model, label: selected.model });
  }
  return result;
}

export function codexEffortOptions(
  options: readonly PersonaModelOption[] | null,
  selectedValue: string,
) {
  const selected = parseCodexModelSelection(selectedValue);
  const efforts = new Set<string>();
  for (const option of options ?? []) {
    const parsed = parseCodexModelSelection(option.id);
    if (parsed.model === selected.model && parsed.effort) {
      efforts.add(parsed.effort);
    }
  }
  if (selected.effort) efforts.add(selected.effort);
  return [...efforts]
    .sort((left, right) => {
      const leftIndex = EFFORT_ORDER.indexOf(
        left as (typeof EFFORT_ORDER)[number],
      );
      const rightIndex = EFFORT_ORDER.indexOf(
        right as (typeof EFFORT_ORDER)[number],
      );
      if (leftIndex === -1 && rightIndex === -1)
        return left.localeCompare(right);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    })
    .map((effort) => ({
      value: effort,
      label: effort === "xhigh" ? "xhigh (extra high)" : effort,
    }));
}
