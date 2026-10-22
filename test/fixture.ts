import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep failed fixtures for diagnosis; remove only this test's successful data.
export async function withFixture(run: (root: string) => Promise<void>) {
  const directory = fileURLToPath(new URL("../temp/test-work", import.meta.url));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(path.join(directory, "security-"));
  await run(root);
  await rm(root, { recursive: true, force: true });
}
