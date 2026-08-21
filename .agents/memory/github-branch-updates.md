---
name: GitHub branch updates
description: Safe fallback for updating an existing GitHub branch when local Git credentials are unavailable.
---

When local `git push` authentication fails, use the already-installed GitHub connection and Git database API to create blobs/tree/commit and update the existing branch ref. Build the tree from the latest `main` tree plus the local feature diff, and preserve both parents for a merge commit.

**Why:** This environment may have a healthy GitHub integration while the shell Git credential helper has an invalid or expired token.

**How to apply:** Use this only for the requested existing branch, never create a second PR, and verify the remote PR head and mergeability afterward.