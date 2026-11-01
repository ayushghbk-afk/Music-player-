import test from "node:test";
import assert from "node:assert/strict";
import { SerialTaskQueue } from "../src/services/serialTaskQueue";

test("concurrent native imports cannot interleave begin/append/commit transactions", async () => {
  const queue = new SerialTaskQueue(),
    events: string[] = [];
  const importFile = (name: string) =>
    queue.run(async () => {
      events.push(`${name}:begin`);
      await new Promise((resolve) =>
        setTimeout(resolve, name === "a" ? 15 : 0),
      );
      events.push(`${name}:append`, `${name}:commit`);
      return name;
    });
  assert.deepEqual(await Promise.all([importFile("a"), importFile("b")]), [
    "a",
    "b",
  ]);
  assert.deepEqual(events, [
    "a:begin",
    "a:append",
    "a:commit",
    "b:begin",
    "b:append",
    "b:commit",
  ]);
});
test("a failed native transfer does not poison later imports", async () => {
  const queue = new SerialTaskQueue();
  const failed = queue.run(async () => {
    throw new Error("Storage unavailable");
  });
  const next = queue.run(async () => "saved");
  await assert.rejects(failed, /Storage unavailable/);
  assert.equal(await next, "saved");
});
