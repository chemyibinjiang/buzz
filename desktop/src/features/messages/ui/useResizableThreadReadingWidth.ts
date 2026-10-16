import * as React from "react";

export const THREAD_READING_MIN_WIDTH_PX = 640;
export const THREAD_READING_MAX_WIDTH_PX = 1800;
export const THREAD_READING_WIDTH_STEP_PX = 120;

const THREAD_READING_WIDTH_STORAGE_KEY =
  "buzz.desktop.focus-thread-reading-width";

export function clampThreadReadingWidth(width: number): number {
  return Math.max(
    THREAD_READING_MIN_WIDTH_PX,
    Math.min(THREAD_READING_MAX_WIDTH_PX, Math.round(width)),
  );
}

function getInitialThreadReadingWidth(defaultWidthPx: number): number {
  if (typeof window === "undefined") {
    return clampThreadReadingWidth(defaultWidthPx);
  }

  try {
    const stored = window.localStorage.getItem(
      THREAD_READING_WIDTH_STORAGE_KEY,
    );
    if (!stored) return clampThreadReadingWidth(defaultWidthPx);

    const parsed = Number.parseInt(stored, 10);
    return Number.isFinite(parsed)
      ? clampThreadReadingWidth(parsed)
      : clampThreadReadingWidth(defaultWidthPx);
  } catch {
    return clampThreadReadingWidth(defaultWidthPx);
  }
}

export function useResizableThreadReadingWidth(defaultWidthPx: number) {
  const resolvedDefaultWidthPx = clampThreadReadingWidth(defaultWidthPx);
  const [readingWidthPx, setReadingWidthPx] = React.useState(() =>
    getInitialThreadReadingWidth(resolvedDefaultWidthPx),
  );

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        THREAD_READING_WIDTH_STORAGE_KEY,
        String(readingWidthPx),
      );
    } catch {
      // Storage can be unavailable in hardened webviews. The in-memory choice
      // still applies for the current session.
    }
  }, [readingWidthPx]);

  const narrowReadingWidth = React.useCallback(() => {
    setReadingWidthPx((current) =>
      clampThreadReadingWidth(current - THREAD_READING_WIDTH_STEP_PX),
    );
  }, []);

  const widenReadingWidth = React.useCallback(() => {
    setReadingWidthPx((current) =>
      clampThreadReadingWidth(current + THREAD_READING_WIDTH_STEP_PX),
    );
  }, []);

  const resetReadingWidth = React.useCallback(() => {
    setReadingWidthPx(resolvedDefaultWidthPx);
  }, [resolvedDefaultWidthPx]);

  const handleReadingWidthResizeStart = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();

      const startX = event.clientX;
      const startWidth = readingWidthPx;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handlePointerMove = (moveEvent: PointerEvent) => {
        // The reading column is centered, so moving one edge changes the total
        // measure at twice the pointer delta.
        const deltaX = (moveEvent.clientX - startX) * 2;
        setReadingWidthPx(clampThreadReadingWidth(startWidth + deltaX));
      };

      const finishResize = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", finishResize);
        window.removeEventListener("pointercancel", finishResize);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", finishResize, { once: true });
      window.addEventListener("pointercancel", finishResize, { once: true });
    },
    [readingWidthPx],
  );

  return {
    canNarrowReadingWidth: readingWidthPx > THREAD_READING_MIN_WIDTH_PX,
    canResetReadingWidth: readingWidthPx !== resolvedDefaultWidthPx,
    canWidenReadingWidth: readingWidthPx < THREAD_READING_MAX_WIDTH_PX,
    handleReadingWidthResizeStart,
    narrowReadingWidth,
    readingWidthPx,
    resetReadingWidth,
    widenReadingWidth,
  };
}
