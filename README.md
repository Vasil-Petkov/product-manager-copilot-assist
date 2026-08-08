# Copilot Assist — AI-Powered Product Manager SaaS

> Turn customer signals, meetings, and competitor intelligence into prioritised product decisions — with AI at every step.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-black?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-gpt--5.6--luna-412991?logo=openai)](https://openai.com/)

---

## Vision

Product Managers drown in noise — hundreds of support tickets, Slack threads, sales calls, and competitor updates — and still have to decide *what to build next*.

**Copilot Assist** is the AI-powered command centre that captures every signal, surfaces the patterns, and guides PMs to the highest-impact decisions. It replaces scattered spreadsheets and ad-hoc Notion docs with a structured, intelligent workflow from raw signal → analysed Product Idea → prioritised roadmap.

---

## Current Sprint: 2.6 — Architecture Stabilization

| Sprint | Focus                          | Status      |
|--------|--------------------------------|-------------|
| 1      | Project bootstrap              | ✅ Complete |
| 2      | Product Discovery Foundation   | ✅ Complete |
| 2.5    | Product Idea Workspace         | ✅ Complete |
| 2.6    | Architecture Stabilization     | ✅ Complete |
| 3      | Prioritization Module          | 🔜 Next     |
| 4      | Product Validation             | 📋 Planned  |
| 5      | Roadmap Builder                | 📋 Planned  |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (React + Vite)                      │
│  Wouter v3 router · React Query · shadcn/ui · Orval-gen hooks   │
└────────────────────────┬────────────────────────────────────────┘
                         │  /api/*  (credentials: include)
┌────────────────────────▼────────────────────────────────────────┐
│                  Express 5 API Server  :8080                    │
│                                                                 │
│  authMiddleware → requireAuth → validate(ZodSchema) → handler  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               Context Engine (internal)                  │  │
│  │  buildProductContext(ideaId) → fan-out 9 tables →        │  │
│  │  formatContextForPrompt(ctx) → AI analysis               │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
              ┌──────────┴──────────┐
              ▼                     ▼
     PostgreSQL (Drizzle ORM)   OpenAI API (gpt-5.6-luna)
```

### Key architectural decisions

- **Context Engine** — before any AI call, `buildProductContext()` fans out across 9 tables in parallel and assembles a rich `ProductContext` object. No AI analysis runs on isolated data.
- **Replit Auth (OIDC)** — session-cookie auth with `openid-client`. Modular design allows replacement with Clerk/Auth0.
- **Nullable `userId` FKs** — preserves backward compatibility with pre-auth seed data.
- **OpenAPI → Orval codegen** — `lib/api-spec/openapi.yaml` is the single source of truth; running codegen regenerates React Query hooks and Zod schemas.
- **Zod v3** — use `import { z } from "zod"` in the API server. Avoid `format: email` / `format: uri` in OpenAPI schemas (they generate Zod v4 methods).

---

## Tech Stack

| Layer            | Technology                                            |
|------------------|-------------------------------------------------------|
| **Frontend**     | React 18, Vite 7, Wouter v3, React Query v5, shadcn/ui, Tailwind CSS |
| **Backend**      | Express 5, TypeScript 5, Pino logger                  |
| **Database**     | PostgreSQL 16 + Drizzle ORM + drizzle-kit             |
| **Auth**         | Replit Auth — OpenID Connect / PKCE                   |
| **AI**           | OpenAI `gpt-5.6-luna` via integrations proxy          |
| **Codegen**      | Orval (OpenAPI → React Query hooks + Zod schemas)     |
| **Package mgr**  | pnpm v10 workspaces (monorepo)                        |
| **Build**        | esbuild (API), Vite (frontend)                        |

---

## Folder Structure

```
workspace/
├── artifacts/
│   ├── api-server/              # Express 5 REST API — :8080, path /api
│   │   └── src/
│   │       ├── app.ts           # CORS, sessions, auth, error handler
│   │       ├── middlewares/     # requireAuth, validate, errorHandler
│   │       ├── routes/          # One file per resource
│   │       └── services/
│   │           └── contextEngine.ts  # Context Engine
│   │
│   └── pm-copilot/              # React SPA — path /
│       └── src/
│           ├── App.tsx          # Router + AuthGate
│           ├── components/
│           └── pages/
│               ├── discovery/   # Opportunities, Meetings, Competitors, …
│               └── prioritization.tsx
│
├── lib/
│   ├── db/                      # Drizzle schemas + migrations
│   ├── api-spec/                # openapi.yaml (source of truth)
│   ├── api-client-react/        # Generated React Query hooks
│   ├── api-zod/                 # Generated Zod schemas
│   └── replit-auth-web/         # useAuth() browser hook
│
├── docs/
│   └── ARCHITECTURE.md          # Full ERD, auth flow, Context Engine, API reference
│
└── README.md
```

---

## Local Setup

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** v10 — `npm install -g pnpm`
- **PostgreSQL** ≥ 16 (or a Neon / Supabase connection string)

### 1. Clone & install

```bash
git clone https://github.com/Vasil-Petkov/product-manager-copilot-assist.git
cd product-manager-copilot-assist
pnpm install
```

### 2. Set environment variables

Copy and fill in the required secrets:

```bash
cp .env.example .env
```

See [Environment Variables](#environment-variables) below.

### 3. Push database schema

```bash
pnpm --filter @workspace/db run push
```

### 4. Regenerate API client (optional — already committed)

```bash
pnpm --filter @workspace/api-spec run codegen
```

### 5. Start development servers

**API server** (port 8080):
```bash
pnpm --filter @workspace/api-server run dev
```

**Frontend** (Vite dev server):
```bash
pnpm --filter @workspace/pm-copilot run dev
```

---

## Environment Variables

| Variable                         | Required | Description                                   |
|----------------------------------|----------|-----------------------------------------------|
| `DATABASE_URL`                   | ✅       | PostgreSQL connection string                   |
| `SESSION_SECRET`                 | ✅       | Random secret for session signing (≥32 chars)  |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | ✅       | OpenAI API key                                 |
| `AI_INTEGRATIONS_OPENAI_BASE_URL`| ✅       | OpenAI base URL (proxy or direct)              |
| `REPLIT_DOMAINS`                 | Auto     | Set automatically by Replit (dev domain)       |
| `NODE_ENV`                       | Auto     | `development` or `production`                  |

> **Never commit** `.env`, API keys, database credentials, or session secrets.

---

## Feature Overview

### Product Discovery
- **Product Ideas** — Central workspace for every opportunity, from signal to release. AI analysis via Context Engine.
- **Signals** — Import customer feedback from any source (social, support, surveys). Auto-creates Product Ideas.
- **Meetings** — Upload transcripts; AI extracts pain points, feature requests, and market opportunities.
- **Competitors** — Track and AI-analyse competitors. Generate reports and threat assessments.
- **Stakeholder Feedback** — Structured departmental feedback linked to Product Ideas.
- **AI Insights** — Cross-portfolio pattern detection and strategic insights.

### Analysis & Prioritisation
- **Context Engine** — Aggregates all linked data before AI analysis (meetings, competitors, signals, feedback, comments, timeline).
- **Health Score** — 0–100 score measuring how well-evidenced a Product Idea is.
- **Prioritization** — RICE, ICE, and MoSCoW frameworks with AI-assisted recommendations.

---

## Roadmap

| Sprint | Module                  | Key deliverables                                              |
|--------|-------------------------|---------------------------------------------------------------|
| **3**  | Prioritization Module   | Full RICE/ICE/MoSCoW UI, score history, AI batch recommend    |
| **4**  | Product Validation      | Hypothesis tracking, experiment design, outcome measurement   |
| **5**  | Roadmap Builder         | Timeline view, dependency mapping, shareable public roadmap   |
| **6**  | Collaboration           | Team workspaces, @mentions, stakeholder sharing               |
| **7**  | Integrations            | Jira, Linear, Slack, Intercom, Salesforce connectors          |
| **8**  | Analytics               | Delivery tracking, impact measurement, OKR alignment          |

---

## Documentation

Full technical documentation lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md):

- Entity-Relationship Diagram (ERD)
- Authentication flow sequence diagram
- Context Engine internals and health score breakdown
- Complete API reference with auth requirements
- Codegen pipeline guide

---

## Contributing

This is a private project under active development. Sprint branches follow the naming convention `sprint/<number>-<short-description>`.

Commit message convention:
```
Sprint <N> - <Module Name>
```

Examples:
- `Sprint 2 - Product Discovery Foundation`
- `Sprint 2.5 - Product Idea Workspace`
- `Sprint 2.6 - Architecture Stabilization`
- `Sprint 3 - Prioritization Module`

---

## License

Copyright © 2026 Vasil Petkov. All rights reserved.

This software is proprietary and confidential. Unauthorised copying, distribution, or modification is strictly prohibited.
