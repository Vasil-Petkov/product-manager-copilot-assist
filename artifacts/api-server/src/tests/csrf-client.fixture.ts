import assert from "node:assert/strict";
const tokens = new Map<string, { cookie: string; token: string }>();
export async function csrfHeaders(base: string, cookie: string) {
  const sid = /(?:^|;\s*)sid=([^;]*)/.exec(cookie)?.[1] ?? "";
  const key = `${base}:${sid}`;
  let entry = tokens.get(key);
  if (!entry) {
    const response = await fetch(`${base}/auth/csrf`, { headers: { cookie, connection: "close" } });
    assert.equal(response.status, 200, "CSRF bootstrap must succeed before ownership assertions");
    const nonce = /pm_csrf=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")?.[1];
    assert.ok(nonce);
    const json = await response.json() as { csrfToken: string };
    entry = { cookie: `pm_csrf=${nonce}`, token: json.csrfToken };
    tokens.set(key, entry);
  }
  return { cookie: `${cookie}; ${entry.cookie}`, "X-CSRF-Token": entry.token };
}
