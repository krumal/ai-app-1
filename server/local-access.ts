const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const FRONTEND_ORIGINS = new Set([
  "http://127.0.0.1:5173", "http://localhost:5173", "http://[::1]:5173",
]);

// This is a local, single-user application, not a public authenticated service.
// Host checks also prevent a hostile DNS name from being accepted as localhost.
export function rejectNonLocalRequest(request: Request, requireOrigin = false): Response | null {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!LOOPBACK_HOSTS.has(url.hostname)
    || (host !== null && host.toLowerCase() !== url.host.toLowerCase())
    || request.headers.get("sec-fetch-site") === "cross-site"
    || (requireOrigin && origin === null)
    || (origin !== null && origin !== url.origin && !FRONTEND_ORIGINS.has(origin))) {
    return new Response(JSON.stringify({ error: "Only the local LocalTasks application may access this API." }), {
      status: 403, headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return null;
}
