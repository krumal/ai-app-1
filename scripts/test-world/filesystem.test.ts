import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "bun:test";
import { withFixture } from "../../test/fixture";
import { writeWorld } from "./filesystem";
import { buildPreset } from "./presets";

function world(cwd: string, name = "demo") {
  return buildPreset({ preset: "smoke", name, seed: 42,
    repoPath: path.join(cwd, ".local/worlds", name) });
}

test("generated worlds can be created and explicitly replaced", () => withFixture(async root => {
  const value = world(root);
  await writeWorld(value, { clean: false, cwd: root });
  await writeFile(path.join(value.repoPath, "previous.txt"), "old fixture");
  await expect(writeWorld(value, { clean: false, cwd: root })).rejects.toThrow(/already exists/i);
  await writeWorld(value, { clean: true, cwd: root });
  await expect(readFile(path.join(value.repoPath, "previous.txt"))).rejects.toMatchObject({ code: "ENOENT" });
}));

test("cleanup refuses an unowned directory even inside worlds", () => withFixture(async root => {
  const value = world(root);
  await mkdir(value.repoPath, { recursive: true });
  const sentinel = path.join(value.repoPath, "keep.txt");
  await writeFile(sentinel, "untouched");
  await expect(writeWorld(value, { clean: true, cwd: root })).rejects.toThrow(/generated world/i);
  expect(await readFile(sentinel, "utf8")).toBe("untouched");
}));

test("world names and mismatched targets cannot escape worlds", () => withFixture(async root => {
  for (const name of ["..", "../outside", "nested/world", "nested\\world", path.join(root, "absolute")]) {
    await expect(writeWorld(world(root, name), { clean: true, cwd: root })).rejects.toThrow(/world name/i);
  }
  await expect(writeWorld({ ...world(root), repoPath: root }, { clean: true, cwd: root }))
    .rejects.toThrow(/world path/i);
}));

test("a redirected worlds directory cannot delete another directory", () => withFixture(async root => {
  const outside = path.join(root, "outside");
  await mkdir(path.join(outside, "demo"), { recursive: true });
  await writeFile(path.join(outside, "demo/keep.txt"), "untouched");
  await mkdir(path.join(root, ".local"));
  await symlink(outside, path.join(root, ".local/worlds"), "dir");
  await expect(writeWorld(world(root), { clean: true, cwd: root })).rejects.toThrow(/symbolic link/i);
  expect(await readFile(path.join(outside, "demo/keep.txt"), "utf8")).toBe("untouched");
}));

test("unsafe generated members are rejected before cleanup", () => withFixture(async root => {
  const value = world(root);
  await writeWorld(value, { clean: false, cwd: root });
  const sentinel = path.join(value.repoPath, "keep.txt");
  await writeFile(sentinel, "untouched");
  await expect(writeWorld({ ...value, files: [{ relativePath: "../../outside.txt", content: "bad" }] },
    { clean: true, cwd: root })).rejects.toThrow(/outside/i);
  expect(await readFile(sentinel, "utf8")).toBe("untouched");
}));

test("a linked world leaf is not followed, even with a copied marker", () => withFixture(async root => {
  const outside = path.join(root, "outside");
  await mkdir(outside);
  await writeFile(path.join(outside, "keep.txt"), "untouched");
  await writeFile(path.join(outside, ".localtasks-world.json"), JSON.stringify({ version: 1, name: "demo" }));
  await mkdir(path.join(root, ".local/worlds"), { recursive: true });
  await symlink(outside, world(root).repoPath, "dir");
  await expect(writeWorld(world(root), { clean: true, cwd: root })).rejects.toThrow(/symbolic link/i);
  expect(await readFile(path.join(outside, "keep.txt"), "utf8")).toBe("untouched");
}));
