import * as React from "react";

import {
  setThreadViewMode,
  type ThreadViewMode,
} from "@/features/channels/lib/threadViewModePreference";

export function findTopVisibleThreadMessageId(
  body: HTMLElement | null,
): string | null {
  if (!body) return null;

  const bodyTop = body.getBoundingClientRect().top;
  const visibleReply = Array.from(
    body.querySelectorAll<HTMLElement>("[data-message-id]"),
  ).find((row) => row.getBoundingClientRect().bottom > bodyTop);
  return visibleReply?.dataset.messageId ?? null;
}

export function isThreadMessageVisible(
  body: HTMLElement | null,
  messageId: string | null,
): boolean {
  if (!body || !messageId) return false;

  const row = Array.from(
    body.querySelectorAll<HTMLElement>("[data-message-id]"),
  ).find((candidate) => candidate.dataset.messageId === messageId);
  if (!row) return false;

  const bodyBounds = body.getBoundingClientRect();
  const rowBounds = row.getBoundingClientRect();
  return rowBounds.bottom > bodyBounds.top && rowBounds.top < bodyBounds.bottom;
}

export function getResolvedThreadTargets({
  externalTargetId,
  layoutTargetId,
}: {
  externalTargetId: string | null;
  layoutTargetId: string | null;
}) {
  return {
    resolveExternal:
      layoutTargetId === null || layoutTargetId === externalTargetId,
    resolveLayout: layoutTargetId !== null,
  };
}

type LayoutScrollTarget = {
  messageId: string;
  threadHeadId: string;
};

export function getScopedLayoutScrollTargetId({
  activeThreadHeadId,
  layoutTarget,
}: {
  activeThreadHeadId: string | null;
  layoutTarget: LayoutScrollTarget | null;
}): string | null {
  return layoutTarget?.threadHeadId === activeThreadHeadId
    ? layoutTarget.messageId
    : null;
}

type ThreadViewModeSwitchOptions = {
  activeThreadHeadId: string | null;
  externalScrollTargetId: string | null;
  onExternalTargetResolved: () => void;
  onModeChange?: (mode: ThreadViewMode) => void;
};

/** Preserves the reply being read while the thread changes presentation. */
export function useThreadViewModeSwitch({
  activeThreadHeadId,
  externalScrollTargetId,
  onExternalTargetResolved,
  onModeChange,
}: ThreadViewModeSwitchOptions) {
  const [layoutScrollTarget, setLayoutScrollTarget] =
    React.useState<LayoutScrollTarget | null>(null);
  const lastLayoutAnchorRef = React.useRef<LayoutScrollTarget | null>(null);
  const layoutScrollTargetId = getScopedLayoutScrollTargetId({
    activeThreadHeadId,
    layoutTarget: layoutScrollTarget,
  });

  React.useEffect(() => {
    setLayoutScrollTarget((current) =>
      current?.threadHeadId === activeThreadHeadId ? current : null,
    );
    if (lastLayoutAnchorRef.current?.threadHeadId !== activeThreadHeadId) {
      lastLayoutAnchorRef.current = null;
    }
  }, [activeThreadHeadId]);

  const changeThreadViewMode = React.useCallback(
    (mode: ThreadViewMode, restoreFocus: boolean) => {
      const body = document.querySelector<HTMLElement>(
        '[data-testid="message-thread-body"]',
      );
      const previousAnchor = lastLayoutAnchorRef.current;
      const anchorId =
        previousAnchor?.threadHeadId === activeThreadHeadId &&
        isThreadMessageVisible(body, previousAnchor.messageId)
          ? previousAnchor.messageId
          : findTopVisibleThreadMessageId(body);

      lastLayoutAnchorRef.current =
        anchorId && activeThreadHeadId
          ? { messageId: anchorId, threadHeadId: activeThreadHeadId }
          : null;

      setLayoutScrollTarget(lastLayoutAnchorRef.current);
      onModeChange?.(mode);
      setThreadViewMode(mode);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(
              restoreFocus
                ? '[data-testid="thread-view-mode-toggle"]'
                : '[data-testid="message-thread-body"]',
            )
            ?.focus({ preventScroll: true });
        });
      });
    },
    [activeThreadHeadId, onModeChange],
  );

  const resolveScrollTarget = React.useCallback(
    (settledMessageId?: string) => {
      const resolution = getResolvedThreadTargets({
        externalTargetId: externalScrollTargetId,
        layoutTargetId: layoutScrollTargetId,
      });
      if (resolution.resolveExternal) onExternalTargetResolved();
      if (settledMessageId) {
        setLayoutScrollTarget((current) =>
          current?.threadHeadId === activeThreadHeadId &&
          current.messageId === settledMessageId
            ? null
            : current,
        );
      }
    },
    [
      activeThreadHeadId,
      externalScrollTargetId,
      layoutScrollTargetId,
      onExternalTargetResolved,
    ],
  );

  return {
    changeThreadViewMode,
    layoutScrollTargetId,
    resolveScrollTarget,
  };
}
