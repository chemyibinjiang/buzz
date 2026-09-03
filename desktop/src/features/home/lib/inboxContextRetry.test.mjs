import assert from "node:assert/strict";
import test from "node:test";

let fakeNow = 0;
let nextTimerId = 1;
const pendingTimers = new Map();

globalThis.window = {
  setTimeout(fn, ms) {
    const id = nextTimerId++;
    pendingTimers.set(id, { fireAt: fakeNow + ms, fn });
    return id;
  },
  clearTimeout(id) {
    pendingTimers.delete(id);
  },
};

const originalDateNow = Date.now;
Date.now = () => fakeNow;

const { isRateLimited, resetRateLimitGate } = await import(
  "../../../shared/api/relayRateLimitGate.ts"
);
const { retryInboxContextRead } = await import("./inboxContextRetry.ts");

function resetGate() {
  fakeNow = 0;
  nextTimerId = 1;
  pendingTimers.clear();
  resetRateLimitGate();
}

function tickTo(ms) {
  fakeNow = ms;
  for (const [id, timer] of [...pendingTimers]) {
    if (timer.fireAt <= fakeNow) {
      pendingTimers.delete(id);
      timer.fn();
    }
  }
}

test("Inbox context reads wait for relay back-pressure and retry", async () => {
  resetGate();
  let calls = 0;
  const resultPromise = retryInboxContextRead(async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error("relay rate-limited: retry in 1s");
    }
    return "loaded";
  });

  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(isRateLimited(), true);
  tickTo(1_001);
  assert.equal(await resultPromise, "loaded");
  assert.equal(calls, 2);
});

test("Inbox context reads do not retry permanent misses", async () => {
  resetGate();
  let calls = 0;
  await assert.rejects(
    retryInboxContextRead(async () => {
      calls += 1;
      throw new Error("event not found");
    }),
    /event not found/,
  );
  assert.equal(calls, 1);
});

test("teardown restores Date.now", () => {
  resetRateLimitGate();
  Date.now = originalDateNow;
  assert.ok(true);
});
