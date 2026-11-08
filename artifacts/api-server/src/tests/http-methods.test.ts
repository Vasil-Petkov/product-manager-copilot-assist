import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import ts from "typescript";

test("all registered routes are inventoried; business GET handlers contain no direct persistence/provider calls", async () => {
  const directory = new URL("../routes/", import.meta.url);
  const counts: Record<string, number> = { get: 0, post: 0, patch: 0, delete: 0 };
  const effects: string[] = [];
  for (const file of await readdir(directory)) {
    if (!file.endsWith(".ts")) continue;
    const source = ts.createSourceFile(file, await readFile(new URL(file, directory), "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.expression.getText(source) === "router") {
        const method = node.expression.name.text;
        const path = node.arguments[0];
        if (method in counts && path && ts.isStringLiteral(path)) {
          counts[method]++;
          if (method === "get" && /\.insert\(|\.update\(|\.delete\(|\.create\(|createSession\(|upsertUser\(/.test(node.getText(source))) effects.push(`${file}:${path.text}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(counts, { get: 43, post: 43, patch: 11, delete: 12 },
    "New routes require method/CSRF inventory review, not a silent snapshot update");
  // OIDC callback must consume the provider GET and establish the validated
  // session. Its state/nonce/PKCE checks remain intact, not converted to POST.
  assert.deepEqual(effects, ["auth.ts:/callback"]);
  const app = await readFile(new URL("../app.ts", import.meta.url), "utf8");
  const guard = app.indexOf('csrfProtection(counterSecret, security.origins).guard');
  assert.ok(guard >= 0);
  assert.ok(guard < app.indexOf('app.use("/api", router)'));
});

test("explicit migration CLI failures and early startup failures emit safe events without DB access", () => {
  const observer = new URL("../../../../lib/db/scripts/migration-observability.mjs", import.meta.url).href;
  const failure = spawnSync(process.execPath, ["--input-type=module", "-e",
    `await import(${JSON.stringify(observer)}); throw new Error("fixture-private-detail-not-for-logs")`], { encoding: "utf8" });
  assert.equal(failure.status, 1);
  assert.match(failure.stderr, /"name":"migration_failure"/);
  assert.doesNotMatch(failure.stderr, /fixture-private-detail|Error:|postgres/);
  const startup = spawnSync(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: new URL("../../", import.meta.url), encoding: "utf8", env: { ...process.env, PORT: "" }, timeout: 15_000,
  });
  assert.equal(startup.status, 1);
  assert.match(startup.stderr, /"name":"startup_failure"/);
  assert.doesNotMatch(startup.stderr, /DATABASE_URL|postgres(?:ql)?:\/\//);
});
