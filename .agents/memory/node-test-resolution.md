---
name: Native Node TypeScript and workspace test resolution
description: Why API tests need a resolution-aware TypeScript loader in this bundler-style workspace.
---

Use a resolution-aware TypeScript loader for source-level tests in this workspace;
native Node type stripping alone is not a substitute for bundler module resolution.

**Why:** The workspace deliberately uses extensionless relative imports and schema
directory barrels. Native Node 24 ESM rejects those imports before integration
tests can execute. Rewriting the entire source graph solely for a test command
would create broad, unnecessary churn.

**How to apply:** Keep the test loader declared in the package that uses it. When
updating Node or test scripts, exercise a real application/database import, not
only isolated unit tests that happen to use explicit file extensions.
