import * as React from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  Laptop,
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  Server,
} from "lucide-react";

import {
  isAgentCardAvatarLoading,
  resolveAgentCardAvatarUrl,
} from "@/features/agents/lib/agentCardAvatar";
import { resolveAgentCardModelLabel } from "@/features/agents/lib/agentCardModelLabel";
import { friendlyAgentLastError } from "@/features/agents/lib/friendlyAgentLastError";
import { isManagedAgentActive } from "@/features/agents/lib/managedAgentControlActions";
import type { AgentAvailabilityReader } from "@/features/agents/lib/useAgentAvailability";
import { useUserProfileQuery } from "@/features/profile/hooks";
import type { AgentPersona, ManagedAgent } from "@/shared/api/types";
import type { ProfilePanelOpenOptions } from "@/shared/context/ProfilePanelContext";
import { useFeedbackToasts } from "@/shared/hooks/useToastEffect";
import { requestOpenEditAgent } from "@/features/agents/openEditAgentEvent";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { IdentityCardSkeleton } from "@/shared/ui/identity-card-skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { AgentIdentityCard } from "./AgentIdentityCard";
import { AgentRuntimeAvatarControl } from "./AgentRuntimeAvatarControl";
import { CreateIdentityCard } from "./CreateIdentityCard";
import { PersonaActionsMenu } from "./PersonaActionsMenu";
import { buildUnifiedGroups, pickProfileAgent } from "./unifiedAgentGroups";

type UnifiedAgentsSectionProps = {
  defaultModel: string;
  getAvailability: AgentAvailabilityReader;
  actionErrorMessage: string | null;
  actionNoticeMessage: string | null;
  agents: ManagedAgent[];
  agentsError: Error | null;
  isActionPending: boolean;
  isAgentsLoading: boolean;
  pausingAgentPubkey: string | null;
  restartingAgentPubkey: string | null;
  startingAgentPubkey: string | null;
  startingPersonaIds: ReadonlySet<string>;
  onOpenAgentProfile: (
    pubkey: string,
    options?: ProfilePanelOpenOptions,
  ) => void;
  onOpenPersonaProfile: (persona: AgentPersona) => void;
  onRestartAgent: (pubkey: string) => void;
  onSetPaused: (pubkey: string, paused: boolean) => void;
  onStartAgent: (pubkey: string) => void;
  onStartPersona: (persona: AgentPersona) => void;
  personas: AgentPersona[];
  personasError: Error | null;
  personaFeedbackErrorMessage: string | null;
  personaFeedbackNoticeMessage: string | null;
  isPersonasLoading: boolean;
  isPersonasPending: boolean;
  onOpenCatalog: () => void;
  onDuplicatePersona: (persona: AgentPersona) => void;
  onEditPersona: (persona: AgentPersona) => void;
  onSharePersona: (
    persona: AgentPersona,
    linkedAgent: ManagedAgent | undefined,
    effectiveAvatarUrl: string | null,
  ) => void;
  onDeactivatePersona: (persona: AgentPersona) => void;
  onDeletePersona: (persona: AgentPersona) => void;
};

const AGENT_CARD_COLUMN_CLASS = "w-full";
export const AGENT_CARD_GRID_COLUMNS_CLASS =
  "grid-cols-1 [@container(min-width:21rem)]:grid-cols-2 [@container(min-width:32rem)]:grid-cols-3 [@container(min-width:43rem)]:grid-cols-4 [@container(min-width:54rem)]:grid-cols-5";
export const IDENTITY_CARD_GRID_CLASS = `${AGENT_CARD_COLUMN_CLASS} ${AGENT_CARD_GRID_COLUMNS_CLASS} grid gap-3`;

function CodexTaskLocationBadge({ agent }: { agent: ManagedAgent }) {
  const binding = agent.codexTaskBinding;
  if (!binding) return null;
  const remote = Boolean(binding.sshHost);
  const Icon = remote ? Server : Laptop;
  return (
    <Badge className="max-w-full gap-1" variant="outline">
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {remote ? `SSH · ${binding.sshHost}` : "Local Codex task"}
      </span>
    </Badge>
  );
}

function AgentLifecycleBadges({
  agent,
  isActive,
  isPausing,
  onSetPaused,
}: {
  agent: ManagedAgent;
  isActive: boolean;
  isPausing: boolean;
  onSetPaused: (pubkey: string, paused: boolean) => void;
}) {
  const canTogglePause =
    agent.backend.type === "local" && (isActive || agent.paused);
  if (!agent.codexTaskBinding && !canTogglePause && !agent.paused) return null;

  return (
    <div className="flex max-w-full flex-wrap items-center gap-1">
      <CodexTaskLocationBadge agent={agent} />
      {agent.paused ? (
        <Badge className="gap-1" variant="warning">
          <Pause className="h-3 w-3" />
          Paused
        </Badge>
      ) : null}
      {canTogglePause ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={`${agent.paused ? "Resume" : "Pause"} ${agent.name}`}
              data-testid={`agent-pause-${agent.pubkey}`}
              disabled={isPausing}
              onClick={(event) => {
                event.stopPropagation();
                onSetPaused(agent.pubkey, !agent.paused);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              size="xs"
              type="button"
              variant="outline"
            >
              {isPausing ? (
                <LoaderCircle className="animate-spin" />
              ) : agent.paused ? (
                <Play />
              ) : (
                <Pause />
              )}
              {agent.paused ? "Resume" : "Pause"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {agent.paused
              ? isActive
                ? "Resume queued and new work"
                : "Accept work when this Agent next connects"
              : "Finish current work, then hold new messages"}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

export function UnifiedAgentsSection(props: UnifiedAgentsSectionProps) {
  const {
    actionErrorMessage,
    actionNoticeMessage,
    defaultModel,
    getAvailability,
    agents,
    agentsError,
    isActionPending,
    isAgentsLoading,
    pausingAgentPubkey,
    restartingAgentPubkey,
    startingAgentPubkey,
    startingPersonaIds,
    onOpenAgentProfile,
    onOpenPersonaProfile,
    onRestartAgent,
    onSetPaused,
    onStartAgent,
    onStartPersona,
    personas,
    personasError,
    personaFeedbackErrorMessage,
    personaFeedbackNoticeMessage,
    isPersonasLoading,
    isPersonasPending,
    onOpenCatalog,
    onDuplicatePersona,
    onEditPersona,
    onSharePersona,
    onDeactivatePersona,
    onDeletePersona,
  } = props;

  const { groups, ungrouped, unknown } = React.useMemo(
    () => buildUnifiedGroups(personas, agents),
    [personas, agents],
  );
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useFeedbackToasts(actionNoticeMessage, actionErrorMessage);
  useFeedbackToasts(personaFeedbackNoticeMessage, personaFeedbackErrorMessage);
  const isLoading = isAgentsLoading || isPersonasLoading;

  return (
    <section
      className="relative space-y-4"
      data-testid="agents-library-personas"
    >
      {isLoading ? <LoadingSkeleton /> : null}

      {!isLoading ? (
        <div className="space-y-3" data-testid="unified-agents-groups">
          <div className={IDENTITY_CARD_GRID_CLASS}>
            <CreateIdentityCard
              ariaLabel="New agent"
              dataTestId="new-agent-card"
              disabled={isPersonasPending}
              onClick={onOpenCatalog}
            />
            {groups.map((group) => {
              const profileAgent = pickProfileAgent(group.agents);
              return (
                <AgentPersonaCard
                  actions={(effectiveAvatarUrl, isEffectiveAvatarLoading) => (
                    <PersonaActionsMenu
                      isActionPending={
                        isActionPending || isEffectiveAvatarLoading
                      }
                      isPending={isPersonasPending}
                      persona={group.persona}
                      linkedAgent={profileAgent}
                      onDeactivate={onDeactivatePersona}
                      onDelete={onDeletePersona}
                      onDuplicate={onDuplicatePersona}
                      onEdit={onEditPersona}
                      onShare={(persona, linkedAgent) =>
                        onSharePersona(persona, linkedAgent, effectiveAvatarUrl)
                      }
                    />
                  )}
                  agent={profileAgent}
                  defaultModel={defaultModel}
                  getAvailability={getAvailability}
                  key={group.persona.id}
                  persona={group.persona}
                  pausingAgentPubkey={pausingAgentPubkey}
                  restartingAgentPubkey={restartingAgentPubkey}
                  startingAgentPubkey={startingAgentPubkey}
                  startingPersonaIds={startingPersonaIds}
                  onOpenAgentProfile={onOpenAgentProfile}
                  onOpenPersonaProfile={onOpenPersonaProfile}
                  onRestartAgent={onRestartAgent}
                  onSetPaused={onSetPaused}
                  onStartAgent={onStartAgent}
                  onStartPersona={onStartPersona}
                />
              );
            })}
          </div>

          {unknown.length > 0 ? (
            <CollapsibleAgentGroup
              agents={unknown}
              collapsed={collapsed}
              defaultModel={defaultModel}
              getAvailability={getAvailability}
              groupKey="__unknown__"
              label="Unknown agents"
              pausingAgentPubkey={pausingAgentPubkey}
              restartingAgentPubkey={restartingAgentPubkey}
              startingAgentPubkey={startingAgentPubkey}
              onToggle={toggle}
              onOpenAgentProfile={onOpenAgentProfile}
              onRestartAgent={onRestartAgent}
              onSetPaused={onSetPaused}
              onStartAgent={onStartAgent}
            />
          ) : null}
          {ungrouped.length > 0 ? (
            <CollapsibleAgentGroup
              agents={ungrouped}
              collapsed={collapsed}
              defaultModel={defaultModel}
              getAvailability={getAvailability}
              groupKey="__ungrouped__"
              label="Custom agents"
              pausingAgentPubkey={pausingAgentPubkey}
              restartingAgentPubkey={restartingAgentPubkey}
              startingAgentPubkey={startingAgentPubkey}
              onToggle={toggle}
              onOpenAgentProfile={onOpenAgentProfile}
              onRestartAgent={onRestartAgent}
              onSetPaused={onSetPaused}
              onStartAgent={onStartAgent}
            />
          ) : null}
        </div>
      ) : null}

      {agentsError ? (
        <p
          className={`${AGENT_CARD_COLUMN_CLASS} rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive`}
        >
          {agentsError.message}
        </p>
      ) : null}
      {personasError ? (
        <p
          className={`${AGENT_CARD_COLUMN_CLASS} rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive`}
        >
          {personasError.message}
        </p>
      ) : null}
    </section>
  );
}

function AgentPersonaCard({
  actions,
  agent,
  defaultModel,
  getAvailability,
  persona,
  pausingAgentPubkey,
  restartingAgentPubkey,
  startingAgentPubkey,
  startingPersonaIds,
  onOpenAgentProfile,
  onOpenPersonaProfile,
  onRestartAgent,
  onSetPaused,
  onStartAgent,
  onStartPersona,
}: {
  actions?: (
    effectiveAvatarUrl: string | null,
    isEffectiveAvatarLoading: boolean,
  ) => React.ReactNode;
  agent: ManagedAgent | undefined;
  defaultModel: string;
  getAvailability: AgentAvailabilityReader;
  persona: AgentPersona;
  pausingAgentPubkey: string | null;
  restartingAgentPubkey: string | null;
  startingAgentPubkey: string | null;
  startingPersonaIds: ReadonlySet<string>;
  onOpenAgentProfile: (
    pubkey: string,
    options?: ProfilePanelOpenOptions,
  ) => void;
  onOpenPersonaProfile: (persona: AgentPersona) => void;
  onRestartAgent: (pubkey: string) => void;
  onSetPaused: (pubkey: string, paused: boolean) => void;
  onStartAgent: (pubkey: string) => void;
  onStartPersona: (persona: AgentPersona) => void;
}) {
  const availability = getAvailability(agent?.pubkey);
  const title = persona.displayName;
  const modelLabel = resolveAgentCardModelLabel({
    agent,
    personaModel: persona.model,
    defaultModel,
  });
  const isActive = agent ? isManagedAgentActive(agent) : false;
  const profileQuery = useUserProfileQuery(agent?.pubkey);
  const avatarUrl = agent
    ? resolveAgentCardAvatarUrl(profileQuery.data?.avatarUrl, persona.avatarUrl)
    : persona.avatarUrl;
  const friendlyError = agent
    ? friendlyAgentLastError(agent.lastError, agent.lastErrorCode)?.copy
    : null;
  const opensRuntimeTab = Boolean(agent && friendlyError && !isActive);

  return (
    <AgentIdentityCard
      actions={actions?.(
        avatarUrl,
        isAgentCardAvatarLoading(Boolean(agent), profileQuery.isPending),
      )}
      ariaLabel={`${title} agent profile`}
      avatar={
        agent ? (
          <AgentRuntimeAvatarControl
            actionKind={agent.codexTaskBinding ? "connect" : "start"}
            activeTestId={`agent-runtime-active-${agent.pubkey}`}
            avatarUrl={avatarUrl}
            errorLabel={friendlyError}
            errorTestId={`agent-runtime-error-${agent.pubkey}`}
            isActive={isActive}
            availability={availability}
            isRestarting={restartingAgentPubkey === agent.pubkey}
            isStarting={startingAgentPubkey === agent.pubkey}
            label={title}
            requiresRestart={agent.needsRestart}
            startTestId={`agent-runtime-start-${agent.pubkey}`}
            onOpenError={() => {
              onOpenAgentProfile(agent.pubkey, { tab: "runtime" });
            }}
            onStart={() =>
              agent.needsRestart
                ? onRestartAgent(agent.pubkey)
                : onStartAgent(agent.pubkey)
            }
          />
        ) : (
          <AgentRuntimeAvatarControl
            activeTestId={`persona-runtime-active-${persona.id}`}
            avatarUrl={avatarUrl}
            isActive={false}
            isStarting={startingPersonaIds.has(persona.id)}
            label={title}
            startTestId={`persona-runtime-start-${persona.id}`}
            onStart={() => onStartPersona(persona)}
          />
        )
      }
      avatarUrl={avatarUrl}
      dataTestId={`persona-agent-row-${persona.id}`}
      label={title}
      modelLabel={modelLabel}
      onClick={() => {
        if (agent) {
          onOpenAgentProfile(
            agent.pubkey,
            opensRuntimeTab ? { tab: "runtime" } : undefined,
          );
          return;
        }
        onOpenPersonaProfile(persona);
      }}
      statusBadge={
        agent?.personaOrphaned ? (
          <Badge className="gap-1" variant="warning">
            <AlertTriangle className="h-3 w-3" />
            Configuration missing
          </Badge>
        ) : agent ? (
          <AgentLifecycleBadges
            agent={agent}
            isActive={isActive}
            isPausing={pausingAgentPubkey === agent.pubkey}
            onSetPaused={onSetPaused}
          />
        ) : null
      }
    />
  );
}

function StandaloneAgentCard({
  agent,
  defaultModel,
  getAvailability,
  pausingAgentPubkey,
  restartingAgentPubkey,
  startingAgentPubkey,
  onOpenAgentProfile,
  onRestartAgent,
  onSetPaused,
  onStartAgent,
}: {
  agent: ManagedAgent;
  defaultModel: string;
  getAvailability: AgentAvailabilityReader;
  pausingAgentPubkey: string | null;
  restartingAgentPubkey: string | null;
  startingAgentPubkey: string | null;
  onOpenAgentProfile: (
    pubkey: string,
    options?: ProfilePanelOpenOptions,
  ) => void;
  onRestartAgent: (pubkey: string) => void;
  onSetPaused: (pubkey: string, paused: boolean) => void;
  onStartAgent: (pubkey: string) => void;
}) {
  const availability = getAvailability(agent.pubkey);
  const title = agent.name;
  const profileQuery = useUserProfileQuery(agent.pubkey);
  const friendlyError = friendlyAgentLastError(
    agent.lastError,
    agent.lastErrorCode,
  )?.copy;
  const isActive = isManagedAgentActive(agent);
  const opensRuntimeTab = Boolean(friendlyError && !isActive);

  return (
    <AgentIdentityCard
      actions={
        <StandaloneAgentActionsMenu
          onEdit={() => {
            onOpenAgentProfile(agent.pubkey);
            requestOpenEditAgent(agent.pubkey);
          }}
        />
      }
      ariaLabel={`${title} agent profile`}
      avatar={
        <AgentRuntimeAvatarControl
          actionKind={agent.codexTaskBinding ? "connect" : "start"}
          activeTestId={`agent-runtime-active-${agent.pubkey}`}
          avatarUrl={profileQuery.data?.avatarUrl}
          errorLabel={friendlyError}
          errorTestId={`agent-runtime-error-${agent.pubkey}`}
          isActive={isActive}
          availability={availability}
          isRestarting={restartingAgentPubkey === agent.pubkey}
          isStarting={startingAgentPubkey === agent.pubkey}
          label={title}
          requiresRestart={agent.needsRestart}
          startTestId={`agent-runtime-start-${agent.pubkey}`}
          onOpenError={() => {
            onOpenAgentProfile(agent.pubkey, { tab: "runtime" });
          }}
          onStart={() =>
            agent.needsRestart
              ? onRestartAgent(agent.pubkey)
              : onStartAgent(agent.pubkey)
          }
        />
      }
      avatarUrl={profileQuery.data?.avatarUrl}
      dataTestId={`managed-agent-${agent.pubkey}`}
      label={title}
      modelLabel={resolveAgentCardModelLabel({
        agent,
        personaModel: null,
        defaultModel,
      })}
      onClick={() => {
        onOpenAgentProfile(
          agent.pubkey,
          opensRuntimeTab ? { tab: "runtime" } : undefined,
        );
      }}
      statusBadge={
        agent.personaOrphaned ? (
          <Badge className="gap-1" variant="warning">
            <AlertTriangle className="h-3 w-3" />
            Configuration missing
          </Badge>
        ) : (
          <AgentLifecycleBadges
            agent={agent}
            isActive={isActive}
            isPausing={pausingAgentPubkey === agent.pubkey}
            onSetPaused={onSetPaused}
          />
        )
      }
    />
  );
}

function StandaloneAgentActionsMenu({ onEdit }: { onEdit: () => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Open agent actions"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          type="button"
        >
          <EllipsisVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Edit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LoadingSkeleton() {
  return (
    <div className={IDENTITY_CARD_GRID_CLASS}>
      <IdentityCardSkeleton
        footerSubtitleWidthClass="w-14"
        footerTitleWidthClass="w-24"
      />
      <IdentityCardSkeleton
        footerSubtitleWidthClass="w-20"
        footerTitleWidthClass="w-32"
      />
      <IdentityCardSkeleton
        footerSubtitleWidthClass="w-16"
        footerTitleWidthClass="w-28"
      />
    </div>
  );
}

function CollapsibleAgentGroup({
  groupKey,
  label,
  agents,
  collapsed,
  defaultModel,
  getAvailability,
  pausingAgentPubkey,
  restartingAgentPubkey,
  startingAgentPubkey,
  onToggle,
  onOpenAgentProfile,
  onRestartAgent,
  onSetPaused,
  onStartAgent,
}: {
  groupKey: string;
  label: string;
  agents: ManagedAgent[];
  collapsed: ReadonlySet<string>;
  defaultModel: string;
  getAvailability: AgentAvailabilityReader;
  pausingAgentPubkey: string | null;
  restartingAgentPubkey: string | null;
  startingAgentPubkey: string | null;
  onToggle: (key: string) => void;
  onOpenAgentProfile: (
    pubkey: string,
    options?: ProfilePanelOpenOptions,
  ) => void;
  onRestartAgent: (pubkey: string) => void;
  onSetPaused: (pubkey: string, paused: boolean) => void;
  onStartAgent: (pubkey: string) => void;
}) {
  const isCollapsed = collapsed.has(groupKey);
  return (
    <div className={`${AGENT_CARD_COLUMN_CLASS} space-y-2`}>
      <button
        className="group flex items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/50"
        onClick={() => onToggle(groupKey)}
        type="button"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">({agents.length})</span>
      </button>
      {!isCollapsed ? (
        <div className={IDENTITY_CARD_GRID_CLASS}>
          {agents.map((agent) => (
            <StandaloneAgentCard
              agent={agent}
              defaultModel={defaultModel}
              getAvailability={getAvailability}
              key={agent.pubkey}
              pausingAgentPubkey={pausingAgentPubkey}
              restartingAgentPubkey={restartingAgentPubkey}
              startingAgentPubkey={startingAgentPubkey}
              onOpenAgentProfile={onOpenAgentProfile}
              onRestartAgent={onRestartAgent}
              onSetPaused={onSetPaused}
              onStartAgent={onStartAgent}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
