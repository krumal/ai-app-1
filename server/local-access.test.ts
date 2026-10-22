import { expect, test } from "bun:test";

process.env.LOCALTASKS_SKIP_SERVER = "1";
const { apiHandler, handleServerRequest } = await import("./index");

for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
  test(`${method} from a third-party site is rejected before routing`, async () => {
    const response = await apiHandler(new Request("http://127.0.0.1:3001/api/health", {
      method, headers: { origin: "https://unrelated.example" },
    }));
    expect(response.status).toBe(403);
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
  });
}

for (const host of ["unrelated.example", "localhost.unrelated.example", "192.0.2.1"]) {
  test(`a non-local Host is rejected (${host})`, async () => {
    expect((await apiHandler(new Request(`http://${host}:3001/api/health`))).status).toBe(403);
  });
}

test("spoofed Host, opaque Origin, and cross-site fetch metadata are rejected", async () => {
  const cases: Record<string, string>[] = [{ host: "unrelated.example" }, { origin: "null" },
    { "sec-fetch-site": "cross-site" }];
  for (const headers of cases) {
    expect((await apiHandler(new Request("http://127.0.0.1:3001/api/health", { headers }))).status).toBe(403);
  }
});

test("local requests and the fixed Vite frontend continue to work without wildcard CORS", async () => {
  for (const origin of [undefined, "http://127.0.0.1:3001", "http://127.0.0.1:5173", "http://localhost:5173"]) {
    const response = await apiHandler(new Request("http://127.0.0.1:3001/api/health", {
      headers: origin ? { origin } : {},
    }));
    expect(response.status).toBe(200);
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
  }
});

test("WebSocket access is checked before upgrade, including missing Origin", async () => {
  let upgrades = 0;
  const server = { upgrade: () => { upgrades += 1; return true; } };
  for (const origin of [undefined, "null", "https://unrelated.example"]) {
    const response = await handleServerRequest(new Request("http://127.0.0.1:3001/ws", {
      headers: origin ? { origin } : {},
    }), server);
    expect(response?.status).toBe(403);
  }
  expect(upgrades).toBe(0);
  expect(await handleServerRequest(new Request("http://127.0.0.1:3001/ws", {
    headers: { origin: "http://localhost:5173" },
  }), server)).toBeUndefined();
  expect(upgrades).toBe(1);
});
