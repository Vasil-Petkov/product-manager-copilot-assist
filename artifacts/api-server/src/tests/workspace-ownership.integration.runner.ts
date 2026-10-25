import { createOwnershipTestDatabase, runTestCommand } from "./workspace-ownership.cleanup.ts";

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
  await runTestCommand(process.execPath, [
    "--import", "tsx", "--test", "--test-concurrency=1",
    "src/tests/demo-session.integration.test.ts",
    "src/tests/workspace-ownership.integration.test.ts",
  ], database.env, abort.signal);
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
