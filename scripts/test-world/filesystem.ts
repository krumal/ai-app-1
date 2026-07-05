import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildBoard } from "../../server/board";
import type { ProjectConfig } from "../../shared/types";
import type { GeneratedWorld } from "./factories";

export async function writeWorld(world: GeneratedWorld, options: { clean: boolean }) {
  if (await exists(world.repoPath)) {
    if (!options.clean) {
      throw new Error(`World already exists at ${world.repoPath}. Re-run with --clean to replace it.`);
    }

    await rm(world.repoPath, { recursive: true, force: true });
  }

  for (const directory of world.directories) {
    await mkdir(path.join(world.repoPath, world.taskDirName, directory), { recursive: true });
  }

  for (const file of world.files) {
    const absolutePath = path.join(world.repoPath, world.taskDirName, file.relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, "utf8");
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
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
