---
name: PM Copilot import fixes
description: Patterns the design subagent gets wrong that need manual fixing after it runs.
---

## Issues and fixes

**Non-exported subpath imports from `@workspace/api-client-react`**
Design subagent generates `import { SomeType } from "@workspace/api-client-react/src/generated/api.schemas"`.
That subpath is not in the package `exports` map (only `"."` is exported).
Fix: replace with inline `const EnumName = { ... } as const; type EnumName = ...` in the consuming file.

**Why:** The `lib/api-client-react/package.json` `exports` field only has `".": "./src/index.ts"`. Deep subpath imports are blocked by Node/Vite's package exports resolution.

**How to apply:** After any design subagent run, grep for `api-client-react/src/generated` in `artifacts/pm-copilot/src/` and fix each one.

---

**Missing react-icons exports (e.g. `SiSalesforce`)**
Design subagent imports brand icons from `react-icons/si` that don't exist in the installed version.
Fix: replace the entire `react-icons/si` import with aliased lucide-react icons, e.g.:
```ts
import { Cloud, ... } from "lucide-react";
const SiSalesforce = Cloud;
```

**Why:** `react-icons` version in the workspace may not include every brand icon the subagent assumes. Lucide is always installed and safe.

**How to apply:** After subagent runs, check for `react-icons` imports and verify exports exist. If not, alias to lucide equivalents.
