import { sendAgentObserverControl } from "@/shared/api/observerRelay";
import {
  ensureRelayObserverSubscription,
  subscribeControlResults,
} from "@/features/agents/observerRelayStore";
import type { CancelManagedAgentTurnResult } from "@/shared/api/types";

export async function cancelManagedAgentTurn(
  pubkey: string,
  channelId: string,
): Promise<CancelManagedAgentTurnResult> {
  await sendAgentObserverControl(pubkey, {
    type: "cancel_turn",
    channelId,
  });
  return { status: "sent" };
}

/**
 * Send a live model-switch control frame to a running agent. The switch rides
 * the harness's cancel-switch-requeue path (busy turn) or invalidate-and-reapply
 * (idle); the outcome arrives asynchronously as a `control_result` observer
 * frame, not as the return value here. This is fire-and-forget on the send side.
 */
export async function switchManagedAgentModel(
  pubkey: string,
  channelId: string,
  modelId: string,
): Promise<void> {
  await sendAgentObserverControl(pubkey, {
    type: "switch_model",
    channelId,
    modelId,
  });
}

/** Pause or resume new work without disconnecting the managed Agent. */
export async function setManagedAgentPausedLive(
  pubkey: string,
  paused: boolean,
): Promise<void> {
  await ensureRelayObserverSubscription();
  const requestId = crypto.randomUUID();
  let unsubscribe: () => void = () => undefined;
  let timeout: number | null = null;
  const result = new Promise<void>((resolve, reject) => {
    timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("Agent did not acknowledge the pause command."));
    }, 15_000);
    unsubscribe = subscribeControlResults(pubkey, (frame) => {
      if (frame.type !== "set_paused" || frame.requestId !== requestId) {
        return;
      }
      if (timeout !== null) window.clearTimeout(timeout);
      unsubscribe();
      if (frame.status === "ok" && frame.paused === paused) {
        resolve();
        return;
      }
      reject(new Error("Agent rejected the pause command."));
    });
  });

  try {
    await sendAgentObserverControl(pubkey, {
      type: "set_paused",
      requestId,
      paused,
    });
  } catch (error) {
    if (timeout !== null) window.clearTimeout(timeout);
    unsubscribe();
    throw error instanceof Error ? error : new Error(String(error));
  }
  return result;
}

/** Ask an idle Agent ACP session to summarize itself as Markdown. */
export async function generateManagedAgentHandoff(
  pubkey: string,
  channelId: string | null,
): Promise<string> {
  await ensureRelayObserverSubscription();
  const requestId = crypto.randomUUID();
  const result = new Promise<string>((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;
    const timeout = window.setTimeout(() => {
      unsubscribe?.();
      reject(new Error("Agent handoff summary timed out."));
    }, 180_000);
    unsubscribe = subscribeControlResults(pubkey, (frame) => {
      if (frame.type !== "generate_handoff" || frame.requestId !== requestId) {
        return;
      }
      window.clearTimeout(timeout);
      unsubscribe?.();
      if (frame.status === "ok" && frame.markdown?.trim()) {
        resolve(frame.markdown);
      } else if (frame.status === "busy") {
        reject(
          new Error(
            "Agent A is currently working. Try again after its turn finishes.",
          ),
        );
      } else if (frame.status === "no_session") {
        reject(
          new Error("Agent A has no active ACP session for this channel."),
        );
      } else {
        reject(new Error("Agent A could not generate a handoff summary."));
      }
    });
  });
  try {
    await sendAgentObserverControl(pubkey, {
      type: "generate_handoff",
      requestId,
      channelId,
    });
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
  return result;
}
