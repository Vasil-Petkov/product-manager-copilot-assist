import { createOwnershipTestDatabase, runTestCommand } from "./workspace-ownership.cleanup.ts";
import { randomBytes } from "node:crypto";
import { DEFAULT_POLICIES } from "../lib/security-config.ts";

const abort = new AbortController();
let interruptedBy: NodeJS.Signals | undefined;
const interrupt = (signal: NodeJS.Signals) => {
  interruptedBy = signal;
  abort.abort();
};
const onInt = () => interrupt("SIGINT");
const onTerm = () => interrupt("SIGTERM");
process.once("SIGINT", onInt);
process.once("SIGTERM", onTerm);

let database: Awaited<ReturnType<typeof createOwnershipTestDatabase>> | undefined;
try {
  database = await createOwnershipTestDatabase(abort.signal);
  // --force is used only on the brand-new, disposable database above.
  await runTestCommand("pnpm", [
    "--filter", "@workspace/db", "exec", "drizzle-kit", "push", "--force",
  ], database.env, abort.signal);
  const testEnv = {
    ...database.env,
    NODE_ENV: "test",
    SESSION_SECRET: randomBytes(32).toString("hex"),
    // Ownership matrices intentionally issue many denied AI requests. Keep
    // their original authorization assertions, not a competing 429 assertion.
    RATE_LIMITS_JSON: JSON.stringify(Object.fromEntries(Object.entries(DEFAULT_POLICIES).map(([name, policy]) => [
      name, { ...policy, ipLimit: 1000, ...(policy.userLimit ? { userLimit: 1000 } : {}) },
    ]))),
  };
  await runTestCommand(process.execPath, [
    "--import", "tsx", "--test", "--test-concurrency=1",
    "src/tests/demo-session.integration.test.ts",
    "src/tests/workspace-ownership.integration.test.ts",
    "src/tests/workspace-features.integration.test.ts",
    "src/tests/security-rate-store.integration.test.ts",
    "src/tests/csrf.integration.test.ts",
  ], testEnv, abort.signal);
  await runTestCommand(process.execPath, [
    "--import", "tsx", "--test", "src/tests/security-http.integration.test.ts",
  ], {
    ...testEnv,
    CORS_ALLOWED_ORIGINS: "https://fixture.example.invalid",
    TRUSTED_PROXY_CIDRS: "",
    RATE_LIMITS_JSON: JSON.stringify({
      demoCreate: { ipLimit: 1 }, demoRead: { ipLimit: 1 }, demoExit: { ipLimit: 1 },
      authRead: { ipLimit: 1 }, generation: { userLimit: 1, ipLimit: 10 },
    }),
  }, abort.signal);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = interruptedBy === "SIGINT" ? 130 : interruptedBy === "SIGTERM" ? 143 : 1;
} finally {
  try {
    await database?.dispose();
  } catch (error) {
    process.stderr.write(`Disposable database cleanup failed: ${String(error)}\n`);
    process.exitCode = 1;
  }
  process.off("SIGINT", onInt);
  process.off("SIGTERM", onTerm);
}
