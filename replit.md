# Copilot Assist — Product Manager AI SaaS

## Project overview

AI-powered product management copilot. Captures signals from customer feedback, meetings, and competitor research; organises them into Product Ideas; runs AI analysis via a centralised **Context Engine**; and supports RICE/ICE/MoSCoW prioritisation.

**Current sprint:** 2.6 — Architecture Stabilization & Production Readiness

## Stack

| Layer        | Technology                                      |
|--------------|-------------------------------------------------|
| Frontend     | React 18 + Vite, Wouter v3, React Query, shadcn/ui |
| Backend      | Express 5 + TypeScript, Pino                    |
| Database     | PostgreSQL via Drizzle ORM                      |
| Auth         | Replit Auth (OpenID Connect / PKCE)             |
| AI           | OpenAI `gpt-5.6-luna` via integrations proxy    |
| Codegen      | OpenAPI spec → Orval → React Query + Zod        |

## Key paths

- Frontend: `artifacts/pm-copilot/` — served at `/`
- API server: `artifacts/api-server/` — served at `/api`, port 8080
- DB schema: `lib/db/src/schema/`
- OpenAPI spec: `lib/api-spec/openapi.yaml` (source of truth for API shape)
- Generated client: `lib/api-client-react/src/generated/`
- Generated Zod schemas: `lib/api-zod/src/generated/`
- Context Engine: `artifacts/api-server/src/services/contextEngine.ts`
- Developer docs: `docs/ARCHITECTURE.md`

## Architecture decisions

- **Context Engine is backend-only** — no UI; internal service gathers all Product Idea context before AI calls.
- **Auth is Replit Auth (OIDC)** — modular so it can be replaced with Clerk/Auth0 later.
- **`userId` FK is nullable** on all entity tables — preserves backward compatibility with pre-auth data.
- **Codegen**: avoid `format: email` / `format: uri` in OpenAPI schemas — generates `z.email()` / `z.url()` (Zod v4 only), project uses Zod v3.
- **Text→integer migrations**: done with raw SQL USING cast before `drizzle-kit push` (drizzle-kit cannot auto-cast text→integer).

## Running the project

```bash
# Install
pnpm install

# Push DB schema
pnpm --filter @workspace/db run push

# Regenerate API client + Zod schemas
pnpm --filter @workspace/api-spec run codegen

# Dev (both servers via workflows)
# API server:  artifacts/api-server: API Server
# Frontend:    artifacts/pm-copilot: web
```

## User preferences

- No new business features in Sprint 2.6 — architecture only.
- Keep `userId` FK nullable on all entity tables.
- When in doubt about API response shape changes, prefer backward-compatible flat arrays over wrapped objects so generated hooks keep working.
- **Prioritization module**: all changes must be committed and pushed to the `feature/prioritization` GitHub branch only. Never push Prioritization work directly to `main`.
