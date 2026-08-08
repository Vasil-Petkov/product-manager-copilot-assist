---
name: Sprint 2.6 Architecture Decisions
description: Key decisions and gotchas from Sprint 2.6 stabilization — auth, Context Engine, Zod, FK migrations, response shapes.
---

## Zod in api-server routes
- api-server uses Zod v3; import from "zod" (not "zod/v4")
- "zod" must be added to api-server's package.json dependencies
- esbuild bundles zod inline — it is NOT in the external list

## OpenAPI codegen — format: email/uri
- **Never** add format: email or format: uri to OpenAPI schemas
- Orval generates z.email() / z.url() (Zod v4 only) — breaks typecheck for Zod v3
- Fix: use plain type: string without format annotation

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
