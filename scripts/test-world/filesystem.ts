import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildBoard } from "../../server/board";
import type { ProjectConfig } from "../../shared/types";
import type { GeneratedWorld } from "./factories";
import { resolveTaskPath } from "../../server/task-paths";

const WORLD_MARKER = ".localtasks-world.json";

export function resolveWorldPath(name: string, cwd = process.cwd()) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    throw new Error("World name must be a plain directory name, not a path.");
  }
  return resolveTaskPath(cwd, path.join(".local", "worlds", name));
}

export async function writeWorld(world: GeneratedWorld, options: { clean: boolean; cwd?: string }) {
  const repoPath = resolveWorldPath(world.name, options.cwd);
  if (path.resolve(world.repoPath) !== repoPath || world.taskDirName !== ".tasks") {
    throw new Error("World path must be .local/worlds/<name> in the working directory.");
  }
  const taskRoot = path.join(repoPath, ".tasks");
  // Validate every generated member before any destructive operation.
  for (const member of [...world.directories, ...world.files.map(file => file.relativePath)]) {
    const relative = path.relative(taskRoot, path.resolve(taskRoot, member));
    if (path.isAbsolute(member) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
      throw new Error("Generated member is outside the world task root.");
    }
  }
  const marker = JSON.stringify({ version: 1, name: world.name });
  if (await exists(repoPath)) {
    if (!options.clean) {
      throw new Error(`World already exists at ${world.repoPath}. Re-run with --clean to replace it.`);
    }
    const markerPath = resolveTaskPath(repoPath, WORLD_MARKER);
    let recorded;
    try { recorded = JSON.parse(await readFile(markerPath, "utf8")); }
    catch { throw new Error("Refusing to replace a directory without a valid generated world marker."); }
    if (recorded?.version !== 1 || recorded?.name !== world.name) {
      throw new Error("Refusing to replace a directory without a matching generated world marker.");
    }
    resolveWorldPath(world.name, options.cwd);
    await rm(repoPath, { recursive: true, force: true });
  }

  await mkdir(repoPath, { recursive: true });
  await writeFile(resolveTaskPath(repoPath, WORLD_MARKER), marker, { encoding: "utf8", flag: "wx" });

  for (const directory of world.directories) {
    await mkdir(resolveTaskPath(taskRoot, directory), { recursive: true });
  }

  for (const file of world.files) {
    const absolutePath = resolveTaskPath(taskRoot, file.relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, { encoding: "utf8", flag: "wx" });
  }
}

export async function validateWorld(world: GeneratedWorld) {
  const project: ProjectConfig = {
    id: world.name,
    name: world.name,
    repoPath: world.repoPath,
    taskDirName: world.taskDirName,
    listOrder: world.listOrder,
  };

  const board = await buildBoard(project);
  const cardCount = board.lists.reduce((total, list) => total + list.cards.length, 0);

  if (!board.taskRootExists) {
    throw new Error(`Generated .tasks root was not found at ${board.taskRootPath}.`);
  }

  if (board.lists.length === 0 || cardCount === 0) {
    throw new Error("Generated world did not produce visible board content.");
  }

  return {
    taskRootPath: board.taskRootPath,
    lists: board.lists.map((list) => ({
      id: list.id,
      title: list.title,
      cards: list.cards.length,
    })),
    cards: cardCount,
  };
}

async function exists(targetPath: string) {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
