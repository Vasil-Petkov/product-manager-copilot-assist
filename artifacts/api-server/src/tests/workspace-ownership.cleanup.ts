import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";

export async function runTestCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  signal?: AbortSignal,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
      detached: true,
    });
    let interrupted = false;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    const killGroup = (killSignal: NodeJS.Signals) => {
      if (!child.pid) return;
      try { process.kill(-child.pid, killSignal); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    };
    const cancel = () => {
      interrupted = true;
      killGroup("SIGTERM");
      escalation ??= setTimeout(() => killGroup("SIGKILL"), 5_000);
    };
    const timeout = setTimeout(cancel, 120_000);
    signal?.addEventListener("abort", cancel, { once: true });
    const removeListeners = () => {
      clearTimeout(timeout);
      if (escalation) clearTimeout(escalation);
      signal?.removeEventListener("abort", cancel);
    };
    child.once("error", (error) => { removeListeners(); reject(error); });
    child.once("exit", (code, killedBy) => {
      removeListeners();
      if (interrupted) reject(new Error(`${command} was interrupted or timed out`));
      else if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${killedBy ?? code}`));
    });
  });
}

/**
 * The test target is created here, not accepted from DATABASE_URL or a caller.
 * A private Unix socket and fresh data directory isolate it from real data.
 * Cleanup only stops this cluster and removes its own mkdtemp directory;
 * there are deliberately no marker-based DELETE statements against a user DB.
 */
export async function createOwnershipTestDatabase(signal: AbortSignal) {
  const directory = await mkdtemp(join(tmpdir(), "pm-ownership-"));
  const dataDirectory = join(directory, "data");
  const env = { ...process.env };
  let started = false;
  const dispose = async () => {
    // A pg_ctl timeout can occur after PostgreSQL has already started.
    const pidFileExists = await access(join(dataDirectory, "postmaster.pid")).then(() => true, () => false);
    if (started || pidFileExists) {
      await runTestCommand("pg_ctl", ["-D", dataDirectory, "-m", "immediate", "-w", "stop"], env);
      started = false;
    }
    await rm(directory, { recursive: true, force: true });
  };
  try {
    await runTestCommand("initdb", ["-D", dataDirectory, "-A", "trust", "--no-locale", "--encoding=UTF8"], env, signal);
    // No TCP listener; every concurrent test run gets a different socket dir.
    await runTestCommand("pg_ctl", [
      "-D", dataDirectory, "-l", join(directory, "postgres.log"),
      "-o", `-k ${directory} -h '' -c unix_socket_permissions=0700`, "-w", "start",
    ], env);
    started = true;
    signal.throwIfAborted();
    const connection = new URL("postgresql://localhost/postgres");
    connection.username = userInfo().username;
    connection.searchParams.set("host", directory);
    return {
      env: {
        ...env,
        DATABASE_URL: connection.href,
        OWNERSHIP_TEST_DIRECTORY: directory,
        LOG_LEVEL: "silent",
      },
      dispose,
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}
