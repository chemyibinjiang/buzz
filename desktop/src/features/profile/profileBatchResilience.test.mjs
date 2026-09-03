import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("useUsersBatchQuery retries transient relay failures", async () => {
  const source = await readFile(new URL("./hooks.ts", import.meta.url), "utf8");
  const start = source.indexOf("export function useUsersBatchQuery");
  const end = source.indexOf("// Seed individual", start);

  assert.notEqual(start, -1, "useUsersBatchQuery must exist");
  assert.notEqual(end, -1, "useUsersBatchQuery test boundary must exist");

  const querySource = source.slice(start, end);
  assert.match(querySource, /retry:\s*3/);
  assert.match(
    querySource,
    /retryDelay:\s*\(attempt\)\s*=>\s*Math\.min\(1_000 \* 2 \*\* attempt, 30_000\)/,
  );
  assert.match(
    querySource,
    /refetchOnWindowFocus:\s*\(batchQuery\)\s*=>\s*batchQuery\.state\.status === "error"/,
  );
  assert.doesNotMatch(querySource, /refetchOnWindowFocus:\s*true/);
});

test("profile resilience does not change global query defaults", async () => {
  const source = await readFile(
    new URL("../../shared/api/queryClient.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /retry:\s*1/);
  assert.match(source, /refetchOnWindowFocus:\s*false/);
});
