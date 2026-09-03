import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { presenceQueryKey, usePresenceQuery } from "@/features/presence/hooks";
import { relayClient } from "@/shared/api/relayClient";
import type { PresenceLookup, PresenceStatus } from "@/shared/api/types";
import { useRelayConnection } from "@/shared/api/useRelayConnection";
import { normalizePubkey } from "@/shared/lib/pubkey";

/** Availability comes from current relay presence, not a retained launch record. */
export function resolveAgentAvailability(
  status: PresenceStatus | undefined,
  presenceLoaded: boolean,
  connected: boolean,
): PresenceStatus | undefined {
  return presenceLoaded && connected ? (status ?? "offline") : undefined;
}

/** Positive presence blocks a duplicate start but does not grant stop authority. */
export function agentPresenceStartBlockReason(
  isLifecycleActive: boolean,
  availability: PresenceStatus | undefined,
): string | undefined {
  return !isLifecycleActive &&
    (availability === "online" || availability === "away")
    ? "This agent is present on the relay. Starting another instance is unavailable."
    : undefined;
}

export type AgentAvailabilityReader = (
  pubkey: string | null | undefined,
) => PresenceStatus | undefined;

/** Share one presence query across an agent surface and read fresh state at action time. */
export function useAgentAvailabilityLookup(
  pubkeys: string[],
  options?: { enabled?: boolean },
) {
  const query = usePresenceQuery(pubkeys, options);
  const queryClient = useQueryClient();
  const connection = useRelayConnection({ degradedAfterMs: 0 });
  const keyId = JSON.stringify(presenceQueryKey(pubkeys));

  // biome-ignore lint/correctness/useExhaustiveDependencies: Render dependencies subscribe to query changes; actions must read current cache and connection state.
  const getAvailability: AgentAvailabilityReader = React.useMemo(() => {
    const key: string[] = JSON.parse(keyId);
    const requested = new Set(key.slice(1));
    return (pubkey) => {
      const normalized = pubkey ? normalizePubkey(pubkey) : "";
      if (!normalized || !requested.has(normalized)) return undefined;
      const state = queryClient.getQueryState<PresenceLookup>(key);
      return resolveAgentAvailability(
        state?.data?.[normalized],
        state?.status === "success",
        relayClient.getConnectionState() === "connected",
      );
    };
  }, [keyId, queryClient, query.data, query.isSuccess, connection]);

  return { query, getAvailability };
}

export function useAgentAvailability(
  pubkey: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const { query, getAvailability } = useAgentAvailabilityLookup(
    pubkey ? [pubkey] : [],
    options,
  );
  return { query, status: getAvailability(pubkey) };
}
