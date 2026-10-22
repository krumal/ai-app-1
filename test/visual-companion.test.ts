import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { withFixture } from "./fixture";
import { createRequire } from "node:module";

const { localSettings } = createRequire(import.meta.url)("../.agents/skills/planact/scripts/local-access.cjs");

const entry = path.resolve(import.meta.dir, "../.agents/skills/planact/scripts/server.cjs");

async function companion(root: string, run: (origin: string) => Promise<void>) {
  const session = path.join(root, "session");
  await mkdir(path.join(session, "state"), { recursive: true });
  await writeFile(path.join(session, "state/session.json"), JSON.stringify({
    decisions: [{ id: "layout", options: [{ id: "compact" }] }],
  }));
  const reservation = createServer();
  await new Promise<void>(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const address = reservation.address();
  if (address === null || typeof address === "string") throw new Error("missing test address");
  const port = address.port;
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  const child = spawn(process.env.LOCALTASKS_TEST_NODE ?? process.execPath, [entry], { env: {
    PLANACT_VC_DIR: session, PLANACT_VC_PORT: String(port), PLANACT_VC_HOST: "127.0.0.1",
  }, stdio: ["ignore", "pipe", "pipe"] });
  const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("companion startup timed out")), 5000);
      let stdout = "";
      child.stdout.on("data", bytes => {
        process.stdout.write(bytes);
        stdout += bytes;
        if (stdout.includes('"type":"server-started"')) { clearTimeout(timer); resolve(); }
      });
      child.stderr.on("data", bytes => process.stderr.write(bytes));
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("close", code => { clearTimeout(timer); reject(new Error(`companion exited before startup (${code})`)); });
    });
    await run(`http://127.0.0.1:${port}`);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await closed;
  }
}

describe("Visual Companion local access", () => {
  test("nonlocal bind and display hosts are rejected before a listener is created", () => {
    for (const host of ["0.0.0.0", "::", "192.0.2.1", "unrelated.invalid"]) {
      expect(() => localSettings({ PLANACT_VC_HOST: host })).toThrow("local-only");
      expect(() => localSettings({ PLANACT_VC_URL_HOST: host })).toThrow("local-only");
    }
    expect(localSettings({ PLANACT_VC_HOST: "localhost" }).host).toBe("127.0.0.1");
    expect(() => localSettings({ PLANACT_VC_PORT: "invalid" })).toThrow("port");
  });
  test("same-origin read and explicit submission remain usable", () => withFixture(root => companion(root, async origin => {
    expect((await fetch(origin + "/api/session")).status).toBe(200);
    const response = await fetch(origin + "/api/submit-decision", { method: "POST", headers: {
      origin, "content-type": "application/json",
    }, body: JSON.stringify({ decision_id: "layout", selected_option_ids: ["compact"], note: "test" }) });
    expect(response.status).toBe(200);
    expect((await response.json()).status.completed).toBe(true);
    expect((await lstat(path.join(root, "session/state/answers.json"))).mode & 0o777).toBe(0o600);
  })));

  test("unrelated Host cannot read decisions", () => withFixture(root => companion(root, async origin => {
    const response = await fetch(origin + "/api/session", { headers: { host: "unrelated.invalid" } });
    expect(response.status).toBe(403);
  })));

  test("cross-origin submission cannot create answers", () => withFixture(root => companion(root, async origin => {
    const response = await fetch(origin + "/api/submit-decision", { method: "POST", headers: {
      origin: "https://unrelated.invalid", "content-type": "application/json",
    }, body: JSON.stringify({ decision_id: "layout", selected_option_ids: ["compact"] }) });
    expect(response.status).toBe(403);
    expect(await readFile(path.join(root, "session/state/answers.json"), "utf8").catch(error => error.code)).toBe("ENOENT");
  })));

  test("cross-site reads cannot expose answers", () => withFixture(root => companion(root, async origin => {
    const response = await fetch(origin + "/api/answers", { headers: { "sec-fetch-site": "cross-site" } });
    expect(response.status).toBe(403);
  })));

  test("submissions without a browser Origin are refused", () => withFixture(root => companion(root, async origin => {
    const response = await fetch(origin + "/api/submit-decision", { method: "POST", headers: {
      "content-type": "application/json",
    }, body: JSON.stringify({ decision_id: "layout", selected_option_ids: ["compact"] }) });
    expect(response.status).toBe(403);
  })));

  test("preview reads are sandboxed and cannot follow filesystem links", () => withFixture(root => companion(root, async origin => {
    const content = path.join(root, "session/content");
    await writeFile(path.join(content, "preview.html"), "synthetic preview");
    await writeFile(path.join(root, "outside.txt"), "not a preview");
    await symlink(path.join(root, "outside.txt"), path.join(content, "linked.html"));
    const response = await fetch(origin + "/content/preview.html");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("synthetic preview");
    expect(response.headers.get("content-security-policy")).toContain("sandbox;");
    expect(response.headers.get("content-security-policy")).not.toContain("allow-scripts");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await fetch(origin + "/content/linked.html")).status).toBe(404);
    expect((await fetch(origin + "/content/%E0%A4%A")).status).toBe(400);
    expect((await fetch(origin + "/api/session")).status).toBe(200);
  })));
});
