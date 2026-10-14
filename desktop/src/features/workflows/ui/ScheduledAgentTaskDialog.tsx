import { ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";
import { stringify as yamlStringify } from "yaml";
import { toast } from "sonner";

import {
  useManagedAgentsQuery,
  useRelayAgentsQuery,
} from "@/features/agents/hooks";
import { useChannelMembersQuery } from "@/features/channels/hooks";
import { useCreateWorkflowMutation } from "@/features/workflows/hooks";
import type { Channel } from "@/shared/api/types";
import { normalizePubkey } from "@/shared/lib/pubkey";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { FieldLabel, FormSelect } from "./workflowFormPrimitives";
import {
  AgentTaskCalendarAdvanced,
  AgentTaskScheduleFields,
} from "./AgentTaskScheduleFields";
import {
  defaultScheduleOptions,
  scheduledTaskName,
  scheduleTrigger,
} from "./agentTaskSchedule";

type ScheduledAgentTaskDialogProps = {
  channel: Channel;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function ScheduledAgentTaskDialog({
  channel,
  onOpenChange,
  open,
}: ScheduledAgentTaskDialogProps) {
  const membersQuery = useChannelMembersQuery(channel.id);
  const managedAgentsQuery = useManagedAgentsQuery();
  const relayAgentsQuery = useRelayAgentsQuery();
  const createTask = useCreateWorkflowMutation(channel.id);
  const resetCreateTask = createTask.reset;
  const [name, setName] = React.useState("");
  const [agentPubkey, setAgentPubkey] = React.useState("");
  const [instruction, setInstruction] = React.useState("");
  const [schedule, setSchedule] = React.useState(defaultScheduleOptions);
  const [advanced, setAdvanced] = React.useState(false);

  const agents = React.useMemo(() => {
    const managedByPubkey = new Map(
      (managedAgentsQuery.data ?? []).map((agent) => [
        normalizePubkey(agent.pubkey),
        agent.name,
      ]),
    );
    const relayByPubkey = new Map(
      (relayAgentsQuery.data ?? [])
        .filter((agent) => !agent.deleted)
        .map((agent) => [normalizePubkey(agent.pubkey), agent.name]),
    );
    return (membersQuery.data ?? [])
      .filter((member) => {
        const pubkey = normalizePubkey(member.pubkey);
        return (
          member.isAgent ||
          member.role === "bot" ||
          managedByPubkey.has(pubkey) ||
          relayByPubkey.has(pubkey)
        );
      })
      .map((member) => {
        const pubkey = normalizePubkey(member.pubkey);
        return {
          pubkey,
          name:
            member.displayName ??
            managedByPubkey.get(pubkey) ??
            relayByPubkey.get(pubkey) ??
            `${pubkey.slice(0, 8)}…`,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [managedAgentsQuery.data, membersQuery.data, relayAgentsQuery.data]);

  React.useEffect(() => {
    if (!open) return;
    // Reset when opening or switching channel, not when Agent queries refresh.
    void channel.id;
    setName("");
    setAgentPubkey("");
    setInstruction("");
    setSchedule(defaultScheduleOptions());
    setAdvanced(false);
    resetCreateTask();
  }, [open, channel.id, resetCreateTask]);

  React.useEffect(() => {
    if (open && !agentPubkey && agents[0]) setAgentPubkey(agents[0].pubkey);
  }, [agentPubkey, agents, open]);

  const result = scheduleTrigger(schedule);
  const canSubmit =
    instruction.trim().length > 0 &&
    agents.some((agent) => agent.pubkey === agentPubkey) &&
    !!result.trigger &&
    !createTask.isPending;
  const loadingAgents =
    membersQuery.isLoading ||
    managedAgentsQuery.isLoading ||
    relayAgentsQuery.isLoading;
  const agentError =
    membersQuery.error ?? managedAgentsQuery.error ?? relayAgentsQuery.error;

  async function handleSubmit() {
    if (!canSubmit || !result.trigger) return;
    const definition = {
      name: scheduledTaskName(name, instruction),
      description: `Scheduled instruction for ${agents.find((agent) => agent.pubkey === agentPubkey)?.name ?? "Agent"}`,
      enabled: true,
      source: { kind: "channel_user" },
      trigger: result.trigger,
      steps: [
        {
          id: "prompt_agent",
          action: "prompt_agent",
          agent: agentPubkey,
          prompt: instruction.trim(),
        },
      ],
    };
    try {
      await createTask.mutateAsync(yamlStringify(definition));
      toast.success("Scheduled Agent task created");
      onOpenChange(false);
    } catch {
      // React Query retains the error for the inline diagnostic below.
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Schedule a task</DialogTitle>
          <DialogDescription>
            Give an Agent in {channel.name} a recurring instruction.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="scheduled-task-instruction">
              Instructions
            </FieldLabel>
            <Textarea
              className="min-h-36 resize-y rounded-xl text-sm"
              disabled={createTask.isPending}
              id="scheduled-task-instruction"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="What should the Agent do, and where should it report the result?"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="scheduled-task-agent">Agent</FieldLabel>
            <FormSelect
              disabled={
                createTask.isPending || loadingAgents || agents.length === 0
              }
              id="scheduled-task-agent"
              onChange={setAgentPubkey}
              value={agentPubkey}
            >
              {agents.length === 0 ? (
                <option value="">
                  {loadingAgents
                    ? "Loading Agents…"
                    : "No Agents in this channel"}
                </option>
              ) : (
                agents.map((agent) => (
                  <option key={agent.pubkey} value={agent.pubkey}>
                    {agent.name}
                  </option>
                ))
              )}
            </FormSelect>
          </div>
          <AgentTaskScheduleFields
            disabled={createTask.isPending}
            value={schedule}
            onChange={setSchedule}
          />
          {result.error ? (
            <p role="alert" className="text-sm text-destructive">
              {result.error}
            </p>
          ) : null}
          <Button
            aria-expanded={advanced}
            aria-controls="task-advanced"
            type="button"
            variant="ghost"
            onClick={() => setAdvanced(!advanced)}
          >
            Advanced{" "}
            {advanced ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
          {advanced ? (
            <div id="task-advanced" className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel htmlFor="scheduled-task-name">
                  Task name (optional)
                </FieldLabel>
                <Input
                  disabled={createTask.isPending}
                  id="scheduled-task-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Defaults to the first line of your instructions"
                />
              </div>
              <AgentTaskCalendarAdvanced
                disabled={createTask.isPending}
                value={schedule}
                onChange={setSchedule}
              />
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <p>Source: user-created channel task in {channel.name}</p>
                <p>
                  Creator: your current Buzz identity (recorded by the Relay)
                </p>
                <p>
                  The Agent checks its instruction-access policy on every run.
                  Removing it from this channel stops delivery.
                </p>
                <p>
                  Missed runs are not replayed in bulk. The Agent runtime must
                  be online to respond.
                </p>
              </div>
            </div>
          ) : null}
          {agentError instanceof Error ? (
            <p role="alert" className="text-sm text-destructive">
              {agentError.message}
            </p>
          ) : null}
          {createTask.error instanceof Error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {createTask.error.message}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            disabled={createTask.isPending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className="rounded-full"
          >
            {createTask.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
