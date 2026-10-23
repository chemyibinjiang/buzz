import type { RelayAgent } from "@/shared/api/types";

/** Only a verified, active managed definition can open DMs to non-owners. */
export function allowsNonOwnerAgentDm(
  agent: RelayAgent | null | undefined,
): boolean {
  return Boolean(
    agent?.managedDefinition &&
      agent.ownerPubkey &&
      !agent.deleted &&
      ["owner-only", "allowlist", "anyone"].includes(agent.respondTo ?? "") &&
      agent.allowNonOwnerDm,
  );
}
