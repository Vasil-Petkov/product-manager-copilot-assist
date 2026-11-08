import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createFrontendServer } from "./server.mjs";
import { csrfFetch } from "../../lib/api-client-react/src/csrf.ts";

test("production frontend actually sends enforced CSP/headers, serves SPA/assets and rejects unsafe file access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pm-frontend-security-"));
  await mkdir(join(directory, "assets"));
  await writeFile(join(directory, "index.html"), '<!doctype html><html><script type="module" src="/assets/app.js"></script></html>');
  await writeFile(join(directory, "assets/app.js"), "export const ok=true;");
  await symlink("/etc/passwd", join(directory, "outside.txt"));
  const server = createFrontendServer(directory).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ["/", "/discovery/opportunities"]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-security-policy"), /script-src 'self';/);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.match(await response.text(), /assets\/app.js/);
    }
    const asset = await fetch(`${base}/assets/app.js`);
    assert.match(asset.headers.get("content-type"), /javascript/);
    assert.match(asset.headers.get("cache-control"), /immutable/);
    assert.equal((await fetch(base, { method: "HEAD" })).status, 200);
    assert.equal(await (await fetch(base, { method: "HEAD" })).text(), "");
    for (const path of ["/outside.txt", "/%2eenv", "/%2e%2e%2fetc/passwd", "/assets/missing.js", "/api/auth/user", "/%00"]) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
    assert.equal((await fetch(base, { method: "POST" })).status, 405);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("browser client bootstraps CSRF for same-origin mutations, not external/native requests", async () => {
  const previous = { window: globalThis.window, fetch: globalThis.fetch };
  const calls = [];
  const transport = async (input, init = {}) => {
    calls.push({ input, init });
    return String(input).endsWith("/auth/csrf") ? Response.json({ csrfToken: "browser-fixture-token" }) : Response.json({ ok: true });
  };
  globalThis.window = { location: { origin: "https://frontend.example.invalid" } };
  globalThis.fetch = transport;
  try {
    await Promise.all([
      csrfFetch("/api/opportunities", { method: "POST", body: "{}" }),
      csrfFetch("/api/opportunities/1", { method: "DELETE" }),
    ]);
    assert.equal(calls.filter((call) => call.input === "/api/auth/csrf").length, 1);
    for (const call of calls.filter((call) => call.input !== "/api/auth/csrf")) {
      assert.equal(call.init.headers.get("X-CSRF-Token"), "browser-fixture-token");
      assert.equal(call.init.credentials, "include");
    }
    calls.length = 0;
    await csrfFetch("https://external.example.invalid/api/write", { method: "POST" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.headers, undefined);
    delete globalThis.window;
    calls.length = 0;
    await csrfFetch("/api/write", { method: "POST", headers: { authorization: "Bearer native-fixture" } });
    assert.equal(calls.length, 1);
    globalThis.window = {};
    calls.length = 0;
    await csrfFetch("/api/write", { method: "POST", headers: { authorization: "Bearer react-native-fixture" } });
    assert.equal(calls.length, 1, "React Native window without location must not trigger browser bootstrap");
  } finally {
    globalThis.window = previous.window;
    globalThis.fetch = previous.fetch;
  }
});

test("Demo exit uses real transport for both bootstrap and exit; bootstrap failure sends no mutation", async () => {
  const previous = { window: globalThis.window, fetch: globalThis.fetch };
  const calls = [];
  globalThis.window = { location: { origin: "https://frontend.example.invalid" } };
  globalThis.fetch = async () => { throw new Error("Demo fixture transport must not handle exit"); };
  const backend = async (input, init = {}) => {
    calls.push(String(input));
    if (String(input).endsWith("/auth/csrf")) return Response.json({ csrfToken: "server-fixture-token" });
    assert.equal(init.headers.get("X-CSRF-Token"), "server-fixture-token");
    return Response.json({ active: false });
  };
  try {
    await csrfFetch("/api/demo/session/exit", { method: "POST" }, backend);
    assert.deepEqual(calls, ["/api/auth/csrf", "/api/demo/session/exit"]);
    const failures = [];
    await assert.rejects(csrfFetch("/api/write", { method: "POST" }, async (path) => {
      failures.push(path);
      return new Response("", { status: 503 });
    }));
    assert.deepEqual(failures, ["/api/auth/csrf"]);
  } finally {
    globalThis.window = previous.window;
    globalThis.fetch = previous.fetch;
  }
});
