---
name: Sprint 2.6 Architecture Decisions
description: Key decisions and gotchas from Sprint 2.6 stabilization — auth, Context Engine, Zod, FK migrations, response shapes.
---

## Validator compatibility
Use Zod v4 for validation, including transitive consumers; the earlier decision
to retain v3 and prohibit OpenAPI email/URI formats for compatibility is obsolete.

**Why:** The collection-validation memory exhaustion advisory has no patched v3
release. Retaining v3 for codegen compatibility would leave the security issue open.

**How to apply:** Do not reintroduce v3 to resolve schema or form typing problems.
Keep form resolvers compatible with v4 and test existing request coercion and
structured validation errors when changing validation dependencies.

## replit-auth-web lib — import.meta.env
- lib/replit-auth-web has no vite devDependency, so vite/client types are unavailable
- Use type assertion: (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL
- Do NOT add "vite/client" to tsconfig types — it will fail at build time

## Response shapes — backward compat
- Orval-generated hooks (useListOpportunities etc.) expect plain arrays
- Wrapping list responses in {data, pagination} breaks all generated list hooks
- Decision: list endpoints return flat arrays; limit/offset applied server-side

## Text → integer FK migrations
- drizzle-kit push cannot auto-cast text→integer columns
- Must run raw SQL with USING clause before drizzle-kit push

## userId FK nullable
- All entity tables have userId as nullable FK → users.id
- Preserves backward compat with pre-auth data

## Context Engine
- Internal service only — buildProductContext(ideaId) fan-out queries 9 tables
- Always call before AI analysis routes instead of ad-hoc queries
- formatContextForPrompt(ctx) produces markdown string for AI prompt
