import * as React from "react";
import type { VListHandle } from "virtua";
import {
  estimateVirtualizedTimelineItemHeight,
  type VirtualizedTimelineItem,
} from "@/features/messages/lib/virtualizedTimelineItems";
import { nextRetainedTimelineKeys } from "./timelineRetention";

const INITIAL_RETAINED_TAIL_LIMIT = 24;

function initialRetainedTimelineKeys(
  keys: readonly string[],
  items: readonly VirtualizedTimelineItem[],
): string[] {
  const targetHeight =
    typeof window === "undefined" ? 1_000 : window.innerHeight;
  const retained: string[] = [];
  let estimatedHeight = 0;

  for (
    let index = keys.length - 1;
    index >= 0 && retained.length < INITIAL_RETAINED_TAIL_LIMIT;
    index -= 1
  ) {
    const key = keys[index];
    const item = items[index];
    if (!key || !item) continue;
    retained.push(key);
    estimatedHeight += estimateVirtualizedTimelineItemHeight(item);
    if (estimatedHeight >= targetHeight) break;
  }

  return retained;
}

export function useTimelineRetention(
  keys: readonly string[],
  items: readonly VirtualizedTimelineItem[],
  listRef: React.RefObject<VListHandle | null>,
  isPrepend: boolean,
) {
  // Retain one estimated viewport on the first render. Counting pixels rather
  // than rows keeps rich media and Markdown channels from eagerly mounting a
  // fixed tail that can be many screens tall.
  const [retainedKeys, setRetainedKeys] = React.useState<ReadonlySet<string>>(
    () => new Set(initialRetainedTimelineKeys(keys, items)),
  );
  const evictionNotBeforeRef = React.useRef(0);
  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const initialRefreshFrameRef = React.useRef<number | null>(null);
  const keysRef = React.useRef(keys);
  keysRef.current = keys;

  const refreshRetainedKeys = React.useCallback(() => {
    const remainingGuardMs = evictionNotBeforeRef.current - performance.now();
    if (remainingGuardMs > 0) {
      refreshTimerRef.current = setTimeout(
        refreshRetainedKeys,
        remainingGuardMs,
      );
      return;
    }

    refreshTimerRef.current = null;
    const currentKeys = keysRef.current;
    const list = listRef.current;
    if (!list || currentKeys.length === 0) return;
    setRetainedKeys((previous) =>
      nextRetainedTimelineKeys(currentKeys, previous, list),
    );
  }, [listRef]);

  React.useLayoutEffect(() => {
    if (isPrepend) evictionNotBeforeRef.current = performance.now() + 3_000;
  }, [isPrepend]);

  React.useEffect(() => {
    // `onScrollEnd` is not guaranteed for Virtua's initial programmatic
    // positioning. Wait until the first painted frame so the initial render
    // still gives Virtua only the bounded tail, then seed from its measured
    // viewport instead of retaining all history.
    initialRefreshFrameRef.current = requestAnimationFrame(() => {
      initialRefreshFrameRef.current = null;
      refreshRetainedKeys();
    });
    return () => {
      if (initialRefreshFrameRef.current !== null) {
        cancelAnimationFrame(initialRefreshFrameRef.current);
      }
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [refreshRetainedKeys]);

  const retainedIndices = React.useMemo(
    () => keys.flatMap((key, index) => (retainedKeys.has(key) ? [index] : [])),
    [keys, retainedKeys],
  );
  const onScrollEnd = React.useCallback(() => {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    refreshRetainedKeys();
  }, [refreshRetainedKeys]);

  return { retainedIndices, onScrollEnd };
}
