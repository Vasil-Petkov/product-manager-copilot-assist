import { spawn } from "node:child_process";
import { once } from "node:events";

import {
  cleanupOwnershipFixtures,
  verifyOwnershipFixturesAbsent,
} from "./workspace-ownership.cleanup.ts";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must point to the isolated disposable database used by workspace ownership integration checks.",
  );
}

const { pool } = await import("@workspace/db");

type ChildResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

let interruptedBy: NodeJS.Signals | undefined;
let child: ReturnType<typeof spawn> | undefined;

const signalExitCode = (signal: NodeJS.Signals): number =>
  signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1;

const forwardSignal = (signal: NodeJS.Signals) => {
  interruptedBy ??= signal;
  if (child && child.exitCode === null) {
    child.kill(signal);
  }
};

process.on("SIGINT", forwardSignal);
process.on("SIGTERM", forwardSignal);

let childResult: ChildResult = { code: 1, signal: null };
let cleanupError: unknown;

try {
  // Remove fixtures from any prior run before starting. This also keeps an
  // interrupted run from affecting the next test's workspace totals.
  await cleanupOwnershipFixtures(pool);
  await verifyOwnershipFixturesAbsent(pool);

  child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "--test",
      "src/tests/workspace-ownership.integration.test.ts",
      "src/tests/demo-session.integration.test.ts",
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    },
  );

  const [code, signal] = await once(child, "exit");
  childResult = {
    code: (code as number | null) ?? null,
    signal: signal as NodeJS.Signals | null,
  };
} finally {
  try {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
    await cleanupOwnershipFixtures(pool);
    await verifyOwnershipFixturesAbsent(pool);
  } catch (error) {
    cleanupError = error;
  } finally {
    process.off("SIGINT", forwardSignal);
    process.off("SIGTERM", forwardSignal);
    await pool.end();
  }
}

if (cleanupError) {
  console.error(cleanupError);
  process.exitCode = 1;
} else if (interruptedBy) {
  process.exitCode = signalExitCode(interruptedBy);
} else if (childResult.signal) {
  process.exitCode = 1;
} else {
  process.exitCode = childResult.code ?? 1;
}