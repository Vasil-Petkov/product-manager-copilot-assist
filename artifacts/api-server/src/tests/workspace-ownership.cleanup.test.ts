import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";
import { createOwnershipTestDatabase, runTestCommand } from "./workspace-ownership.cleanup.ts";

test("disposable ownership database is removed after an assertion process fails", async () => {
  const database = await createOwnershipTestDatabase(new AbortController().signal);
  const directory = database.env.OWNERSHIP_TEST_DIRECTORY;
  try {
    await assert.rejects(
      runTestCommand(process.execPath, ["-e", "process.exit(9)"], database.env),
      /exited with 9/,
    );
  } finally {
    await database.dispose();
  }
  await assert.rejects(access(directory), { code: "ENOENT" });
});

test("disposable ownership database is removed after a subprocess is interrupted", async () => {
  const database = await createOwnershipTestDatabase(new AbortController().signal);
  const directory = database.env.OWNERSHIP_TEST_DIRECTORY;
  try {
    const abort = new AbortController();
    const child = runTestCommand(process.execPath, ["-e", "setInterval(() => {}, 1000)"], database.env, abort.signal);
    const rejected = assert.rejects(child, /interrupted/);
    abort.abort();
    await rejected;
  } finally {
    await database.dispose();
  }
  await assert.rejects(access(directory), { code: "ENOENT" });
});
