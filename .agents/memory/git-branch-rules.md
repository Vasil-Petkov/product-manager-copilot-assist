---
name: Git branch rules
description: Which GitHub branch to push to for each module; never push module work directly to main.
---

## Rule

All changes related to the **Prioritization module** must be committed and pushed to the `feature/prioritization` branch on GitHub. Do not push Prioritization work to `main`.

**Why:** User explicitly requested branch isolation for the Prioritization module so it can be reviewed and merged separately.

**How to apply:**
- Before pushing any Prioritization work, ensure the local `replit-agent` branch contains only that work, then push to `feature/prioritization` (new branch name each push if needed due to the `BRANCH_ALREADY_EXISTS` limitation — e.g. `feature/prioritization-sprint4`).
- All other modules follow the existing sprint-branch convention (see Sprint 2.6 arch decisions).
- Never include Prioritization commits in a push targeting `main` or any other branch.
