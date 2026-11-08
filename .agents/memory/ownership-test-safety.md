---
name: Ownership tests and safe cleanup
description: Safety boundary for workspace ownership fixtures and interpretation of static security scans.
---

Ownership integration tests must provision their own disposable PostgreSQL
cluster, never target the application's configured database.

**Why:** Ownership checks exercise destructive APIs. Prefix-based cleanup can
also match existing records and cannot make a real user database a safe test
target. Static scanners do not detect the missing business-level ownership
boundaries that real two-user API checks expose.

**How to apply:** Keep failures visible and execute authenticated two-user
regression tests before claiming workspace isolation. Dispose only the
runner-created cluster. Do not weaken failing assertions to obtain a green
check, and do not infer legacy record owners during remediation.

For disposable browser servers launched through a package-manager wrapper,
request graceful shutdown from the actual fixture process and confirm database
disposal; do not assume stopping the wrapper ran the fixture's finally block.

**Why:** Stopping a wrapped background browser fixture left its state file
behind without the expected disposal log, despite the processes being stopped.

**How to apply:** Keep fixture lifecycle management separate from managed app
workflows, terminate the fixture process gracefully, and verify shutdown before
removing temporary test credentials or declaring cleanup complete.
