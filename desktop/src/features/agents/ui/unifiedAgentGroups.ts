import { isManagedAgentActive } from "@/features/agents/lib/managedAgentControlActions";
import type {
  AgentPersona,
  ManagedAgent,
  RelayAgent,
} from "@/shared/api/types";

type PersonaGroup = {
  persona: AgentPersona;
  agents: ManagedAgent[];
  remoteAgents: RelayAgent[];
};

export function buildUnifiedGroups(
  personas: AgentPersona[],
  agents: ManagedAgent[],
  remoteAgents: RelayAgent[] = [],
) {
  const taskBoundPersonaIds = new Set([
    ...agents.flatMap((agent) =>
      agent.codexTaskBinding && agent.personaId ? [agent.personaId] : [],
    ),
    ...remoteAgents.flatMap((agent) =>
      agent.codexTask && agent.personaId ? [agent.personaId] : [],
    ),
  ]);
  const byPersonaId = new Map<string, ManagedAgent[]>();
  const remoteByPersonaId = new Map<string, RelayAgent[]>();
  const ungrouped: ManagedAgent[] = [];
  const remoteCustomAgents: RelayAgent[] = [];

  for (const agent of agents) {
    // Codex task agents are user-created instances whose configuration lives
    // on the agent record. A migration may manufacture a persona link for
    // them, but that internal link must not move them out of Custom agents or
    // remove their instance-level edit affordance.
    if (
      !agent.personaId ||
      agent.codexTaskBinding ||
      taskBoundPersonaIds.has(agent.personaId)
    ) {
      ungrouped.push(agent);
    } else {
      const list = byPersonaId.get(agent.personaId) ?? [];
      list.push(agent);
      byPersonaId.set(agent.personaId, list);
    }
  }

  for (const agent of remoteAgents) {
    if (
      agent.codexTask ||
      !agent.personaId ||
      taskBoundPersonaIds.has(agent.personaId)
    ) {
      remoteCustomAgents.push(agent);
    } else {
      const list = remoteByPersonaId.get(agent.personaId) ?? [];
      list.push(agent);
      remoteByPersonaId.set(agent.personaId, list);
    }
  }

  const matched = new Set<string>();
  const groups: PersonaGroup[] = personas
    .filter((persona) => !taskBoundPersonaIds.has(persona.id))
    .map((persona) => {
      matched.add(persona.id);
      return {
        persona,
        agents: byPersonaId.get(persona.id) ?? [],
        remoteAgents: remoteByPersonaId.get(persona.id) ?? [],
      };
    });

  const unknown: ManagedAgent[] = [];
  for (const [id, list] of byPersonaId) {
    if (!matched.has(id)) unknown.push(...list);
  }
  for (const [id, list] of remoteByPersonaId) {
    if (!matched.has(id)) remoteCustomAgents.push(...list);
  }

  return { groups, ungrouped, unknown, remoteCustomAgents };
}

export function pickProfileAgent(agents: ManagedAgent[]) {
  return [...agents].sort((left, right) => {
    const activeDiff =
      Number(isManagedAgentActive(right)) - Number(isManagedAgentActive(left));
    if (activeDiff !== 0) return activeDiff;
    return left.name.localeCompare(right.name);
  })[0];
}

export function pickRemoteProfileAgent(agents: RelayAgent[]) {
  return [...agents].sort((left, right) => {
    const statusScore = (status: RelayAgent["status"]) =>
      status === "online" ? 2 : status === "away" ? 1 : 0;
    const statusDiff = statusScore(right.status) - statusScore(left.status);
    if (statusDiff !== 0) return statusDiff;
    return left.name.localeCompare(right.name);
  })[0];
}
