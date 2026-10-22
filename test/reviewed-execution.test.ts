import assert from "node:assert/strict";
import test from "node:test";
import { readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { runReviewedNodeFile } from "../lesson-materials/lesson-2/src/reviewed-execution.ts";
import { withFixture } from "./fixture.ts";

test("the lesson cannot execute model-written code without interactive approval", () => withFixture(async workspace => {
  await writeFile(path.join(workspace, "demo.js"), 'process.stdout.write("must not run");');
  const result = await runReviewedNodeFile({ workspace, fileName: "demo.js" });
  assert.equal(result.ok, false);
  assert.match(result.error!, /approval/u);
}));

test("declining approval never starts the requested program", () => withFixture(async workspace => {
  const marker = path.join(workspace, "executed");
  await writeFile(path.join(workspace, "demo.js"),
    `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'test');`);
  const result = await runReviewedNodeFile({ workspace, fileName: "demo.js", confirm: async () => false });
  assert.equal(result.ok, false);
  assert.equal(await readFile(marker, "utf8").catch(error => error.code), "ENOENT");
}));

test("only the displayed snapshot is executed after approval", () => withFixture(async workspace => {
  const file = path.join(workspace, "demo.js");
  const original = 'process.stdout.write("reviewed\\n");';
  await writeFile(file, original);
  const result = await runReviewedNodeFile({ workspace, fileName: "demo.js", confirm: async review => {
    assert.equal(review.fileName, "demo.js");
    assert.equal(review.code, original);
    assert.match(review.sha256, /^[a-f0-9]{64}$/);
    await writeFile(file, 'process.stdout.write("changed\\n");');
    return true;
  } });
  assert.deepEqual(result, { ok: true, stdout: "reviewed\n", stderr: "" });
}));

test("approval is required again for every call", () => withFixture(async workspace => {
  await writeFile(path.join(workspace, "demo.js"), 'process.stdout.write("test");');
  let requests = 0;
  const confirm = async () => ++requests === 1;
  assert.equal((await runReviewedNodeFile({ workspace, fileName: "demo.js", confirm })).ok, true);
  assert.equal((await runReviewedNodeFile({ workspace, fileName: "demo.js", confirm })).ok, false);
  assert.equal(requests, 2);
}));

test("the approved child does not inherit the parent environment", () => withFixture(async workspace => {
  const previous = process.env.LOCALTASKS_EXECUTION_TEST_SECRET;
  process.env.LOCALTASKS_EXECUTION_TEST_SECRET = "synthetic";
  try {
    await writeFile(path.join(workspace, "demo.js"),
      'process.stdout.write(process.env.LOCALTASKS_EXECUTION_TEST_SECRET === undefined ? "clean" : "inherited");');
    const result = await runReviewedNodeFile({ workspace, fileName: "demo.js", confirm: async () => true });
    assert.equal(result.ok, true);
    assert.equal(result.stdout, "clean");
  } finally {
    if (previous === undefined) delete process.env.LOCALTASKS_EXECUTION_TEST_SECRET;
    else process.env.LOCALTASKS_EXECUTION_TEST_SECRET = previous;
  }
}));

test("paths, links, non-JavaScript inputs and oversized files cannot reach approval", () => withFixture(async workspace => {
  await writeFile(path.join(workspace, "demo.js"), 'process.stdout.write("test");');
  await symlink(path.join(workspace, "demo.js"), path.join(workspace, "linked.js"));
  await writeFile(path.join(workspace, "large.js"), "x".repeat(65537));
  for (const fileName of ["../demo.js", ".", "..", "demo.txt", "linked.js", "large.js"]) {
    let approved = false;
    const result = await runReviewedNodeFile({ workspace, fileName, confirm: async () => { approved = true; return true; } });
    assert.equal(result.ok, false);
    assert.equal(approved, false);
  }
}));
