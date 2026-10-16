import assert from "node:assert/strict";
import test from "node:test";

import {
  clampThreadReadingWidth,
  THREAD_READING_MAX_WIDTH_PX,
  THREAD_READING_MIN_WIDTH_PX,
} from "./useResizableThreadReadingWidth.ts";

test("clamps thread reading width to the supported range", () => {
  assert.equal(
    clampThreadReadingWidth(THREAD_READING_MIN_WIDTH_PX - 200),
    THREAD_READING_MIN_WIDTH_PX,
  );
  assert.equal(clampThreadReadingWidth(1040), 1040);
  assert.equal(
    clampThreadReadingWidth(THREAD_READING_MAX_WIDTH_PX + 200),
    THREAD_READING_MAX_WIDTH_PX,
  );
});

test("rounds fractional drag widths before persisting them", () => {
  assert.equal(clampThreadReadingWidth(913.6), 914);
});
