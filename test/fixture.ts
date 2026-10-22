import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

// Keep failed fixtures for diagnosis; remove only this test's successful data.
export async function withFixture(run: (root: string) => Promise<void>) {
  const directory = path.resolve(import.meta.dir, "../temp/test-work");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(path.join(directory, "security-"));
  await run(root);
  await rm(root, { recursive: true, force: true });
}
