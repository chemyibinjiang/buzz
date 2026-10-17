import assert from "node:assert/strict";
import test from "node:test";

import { codexTaskKey } from "./codexTaskKey.ts";

test("codexTaskKey matches the Rust domain-separated digest", async () => {
  const lower = "019eca9a-beb9-7902-8ce6-527b2ba56020";
  const upper = "019ECA9A-BEB9-7902-8CE6-527B2BA56020";
  const expected =
    "7beca796ed6fd26beca5f5df335271da9e79ffd850a788c0e7d69e1b44bd0977";

  assert.equal(await codexTaskKey(lower), expected);
  assert.equal(await codexTaskKey(upper), expected);
  assert.notEqual(
    await codexTaskKey("019eca9a-beb9-7902-8ce6-527b2ba56021"),
    expected,
  );
  assert.equal(expected.includes(lower), false);
});
