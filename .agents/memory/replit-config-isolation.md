---
name: Replit configuration isolation
description: Preserve platform-only module reorder history separately from security application changes.
---

Keep Replit-only configuration changes separate from reviewable security diffs.
Preserve their history with an explicit reference before starting security work
from GitHub main; do not silently reset or cherry-pick them into a remediation.

**Why:** The user requires independent review of application security and runtime
configuration. Module-order changes have reappeared during inspection/build work
without an explicit file edit and can otherwise contaminate the final patch.

**How to apply:** Check the final worktree as well as the staged/remote diff.
Archive any new configuration state before excluding it from a security commit,
and disclose uncommitted configuration differences rather than claiming a clean
tree. Do not attribute an automatic change to a specific actor without evidence.
