import type { CodexSharedRuntimeStatus } from "@/shared/api/codexTaskTypes";

export type CodexRuntimeIndicator = {
  label: string;
  state: "checking" | "running" | "ready" | "warning" | "setup";
};

export function hasCodexDesktopRuntimeConflict(
  status: CodexSharedRuntimeStatus | null | undefined,
): boolean {
  return (status?.privateAppServerProcessIds.length ?? 0) > 0;
}

export function isCodexSharedRuntimeUsable(
  status: CodexSharedRuntimeStatus | null | undefined,
): boolean {
  return (
    status?.state === "ready" &&
    !status.desktopDetectionError &&
    !hasCodexDesktopRuntimeConflict(status)
  );
}

export function getCodexRuntimeIndicator(
  status: CodexSharedRuntimeStatus | null | undefined,
  checking = false,
): CodexRuntimeIndicator {
  if (checking && !status) {
    return { label: "Checking Codex...", state: "checking" };
  }
  if (hasCodexDesktopRuntimeConflict(status)) {
    return { label: "Codex runtime conflict", state: "warning" };
  }
  if (status?.desktopDetectionError || status?.state === "unavailable") {
    return { label: "Codex runtime unavailable", state: "warning" };
  }
  if (status?.state === "ready") {
    return status.desktopProcessIds.length > 0
      ? { label: "Codex running here", state: "running" }
      : { label: "Start Codex Desktop", state: "ready" };
  }
  return { label: "Set up Codex", state: "setup" };
}
