# Copilot Assist — Architecture Reference

> Sprint 2.6 — Last updated: 2026-08-08

---

## Table of Contents

1. [Overview](#overview)
2. [Folder Structure](#folder-structure)
3. [Entity-Relationship Diagram (ERD)](#erd)
4. [Authentication Flow](#authentication-flow)
5. [Context Engine](#context-engine)
6. [API Reference](#api-reference)
7. [Codegen Pipeline](#codegen-pipeline)

---

## Overview

Copilot Assist is an AI-powered SaaS for Product Managers — it captures signals, organises them into Product Ideas, extracts insights from meetings, tracks competitors, and runs AI analysis via a centralised Context Engine.

| Layer        | Technology                                      |
|--------------|-------------------------------------------------|
| Frontend     | React 18, Vite, Wouter v3, React Query, shadcn/ui |
| Backend      | Express 5, TypeScript, Pino logger              |
| Database     | PostgreSQL via Drizzle ORM                      |
| Auth         | Replit Auth (OpenID Connect / PKCE)             |
| AI           | OpenAI `gpt-5.6-luna` via `@workspace/integrations-openai-ai-server` |
| Codegen      | OpenAPI spec → Orval → React Query hooks + Zod schemas |

---

## Folder Structure

```
workspace/
├── artifacts/
│   ├── api-server/          # Express 5 API — port 8080, path /api
│   │   └── src/
│   │       ├── app.ts       # Express app setup (cors, session, auth, error handler)
│   │       ├── index.ts     # Entry point
│   │       ├── lib/
│   │       │   ├── auth.ts  # OIDC session CRUD helpers
│   │       │   └── logger.ts
│   │       ├── middlewares/
│   │       │   ├── authMiddleware.ts   # Attaches req.user from session
│   │       │   ├── requireAuth.ts      # Returns 401 if not authenticated
│   │       │   ├── validate.ts         # Zod validation middleware
│   │       │   └── errorHandler.ts     # Global error handler + AppError classes
│   │       ├── routes/
│   │       │   ├── auth.ts             # /api/login, /api/logout, /api/auth/*
│   │       │   ├── opportunities.ts    # /api/opportunities (Product Ideas CRUD + AI)
│   │       │   ├── product-ideas.ts    # /api/product-ideas/* (workspace, comments, timeline)
│   │       │   ├── signals.ts          # /api/signals (CRUD + bulk import)
│   │       │   ├── meetings.ts         # /api/meetings (CRUD + AI analysis)
│   │       │   ├── competitors.ts      # /api/competitors (CRUD + AI analysis)
│   │       │   ├── feedback.ts         # /api/feedback (stakeholder CRUD)
│   │       │   ├── insights.ts         # /api/insights (AI insights)
│   │       │   ├── prioritization.ts   # /api/prioritization (RICE/ICE/MoSCoW)
│   │       │   ├── dashboard.ts        # /api/dashboard (stats + daily summary)
│   │       │   └── openai-conversations.ts
│   │       └── services/
│   │           └── contextEngine.ts    # Internal service: builds full ProductContext
│   │
│   └── pm-copilot/          # React frontend — path /
│       └── src/
│           ├── App.tsx       # Router + AuthGate
│           ├── components/
│           │   └── layout.tsx
│           └── pages/
│               ├── home.tsx
│               ├── discovery/
│               │   ├── dashboard.tsx
│               │   ├── opportunities/
│               │   ├── meetings/
│               │   ├── competitors/
│               │   ├── feedback.tsx
│               │   ├── insights.tsx
│               │   └── sources.tsx
│               └── prioritization.tsx
│
├── lib/
│   ├── db/                  # Drizzle ORM schemas + migrations
│   │   └── src/schema/
│   │       ├── auth.ts      # sessions, users
│   │       ├── opportunities.ts
│   │       ├── signals.ts
│   │       ├── meetings.ts
│   │       ├── competitors.ts
│   │       ├── feedback.ts
│   │       ├── prioritization.ts
│   │       ├── product-ideas.ts   # comments, timeline, meeting/competitor links
│   │       └── index.ts
│   ├── api-spec/            # openapi.yaml → source of truth for API shape
│   ├── api-client-react/    # Generated React Query hooks (via Orval)
│   ├── api-zod/             # Generated Zod validation schemas (via Orval)
│   └── replit-auth-web/     # Browser useAuth() hook (wraps /api/auth/user)
│
└── docs/
    └── ARCHITECTURE.md      # (this file)
```

---

## ERD

```
users
  id (PK), replitId (unique), username, email, firstName, lastName,
  profileImageUrl, createdAt, updatedAt

sessions
  id (PK, varchar), userId (FK → users.id), expiresAt, data

opportunities (Product Ideas)
  id (PK), title, description, sourceType, category, status, urgency,
  sentiment, tags[], aiSummary, problemStatement, rootCause, customerValue,
  dependencies, aiRecommendation, openQuestions[], confidenceScore,
  estimatedCustomerImpact, estimatedBusinessImpact, healthScore,
  owner, userId (FK → users.id, nullable), createdAt, updatedAt

signals
  id (PK), content, sourceType, sourcePlatform, author, sourceUrl,
  votes (integer), customerId, sentiment, processed,
  opportunityId (FK → opportunities.id, nullable), createdAt

stakeholder_feedback
  id (PK), department, stakeholderName, description, customerImpact,
  businessContext, urgency, opportunityId (FK → opportunities.id, nullable),
  createdAt

meetings
  id (PK), title, meetingDate, attendees[], transcript, notes,
  analyzed, opportunitiesExtracted, extractedInsights,
  userId (FK → users.id, nullable), createdAt

competitors
  id (PK), name, website, description, industry, notes,
  latestAnalysis, lastAnalyzedAt, threatLevel,
  userId (FK → users.id, nullable), createdAt

competitor_reports
  id (PK), competitorId (FK → competitors.id), summary, newFeatures[],
  pricingChanges, businessImpact, possibleThreat, possibleOpportunity,
  recommendation, createdAt

prioritization_scores
  id (PK), opportunityId (FK → opportunities.id), framework,
  riceReach, riceImpact, riceConfidence, riceEffort, riceScore,
  iceImpact, iceConfidence, iceEase, iceScore,
  moscowCategory, kanoCategory, manualOverride, createdAt

ai_insights
  id (PK), type, title, content, relatedOpportunityIds[], confidence, createdAt

idea_comments
  id (PK), ideaId (FK → opportunities.id), content, author, createdAt

idea_timeline
  id (PK), ideaId (FK → opportunities.id), eventType, description, metadata, createdAt

idea_meetings (join)
  ideaId (FK → opportunities.id), meetingId (FK → meetings.id)

idea_competitors (join)
  ideaId (FK → opportunities.id), competitorId (FK → competitors.id)
```

---

## Authentication Flow

```
Browser                         API Server                      Replit OIDC
  |                                 |                               |
  |-- GET /api/login?returnTo=/ --> |                               |
  |                                 |-- Redirect to Replit OIDC --> |
  |<------ 302 to OIDC login ------ |                               |
  |                                                                  |
  |---- POST /api/auth/callback?code=xxx --------------------------> |
  |                                 |<-- id_token + userinfo ------- |
  |                                 |-- Upsert user in DB            |
  |                                 |-- Create session (cookie)      |
  |<------ 302 to returnTo -------- |                               |
  |
  |-- GET /api/auth/user          -->|
  |                                  |-- authMiddleware reads cookie |
  |                                  |-- Looks up session → user     |
  |<-- { user: {...} } ------------ |
  |
  [All subsequent API calls include session cookie]
  |-- GET /api/opportunities ------->|
  |                                  |-- requireAuth checks req.user |
  |<-- [...opportunities] ---------- |
```

**Key files:**
- `artifacts/api-server/src/lib/auth.ts` — OIDC client, session helpers
- `artifacts/api-server/src/middlewares/authMiddleware.ts` — session → `req.user`
- `artifacts/api-server/src/middlewares/requireAuth.ts` — 401 guard
- `artifacts/api-server/src/routes/auth.ts` — login/callback/logout/user endpoints
- `lib/replit-auth-web/src/use-auth.ts` — `useAuth()` browser hook

**Protected routes:** All routes except `GET /api/health` and auth routes (`/api/login`, `/api/logout`, `/api/auth/*`).

---

## Context Engine

`artifacts/api-server/src/services/contextEngine.ts`

The Context Engine is an internal service that gathers **all available context** for a Product Idea before AI analysis. It replaces scattered ad-hoc queries in individual routes.

### What it builds

```
buildProductContext(ideaId) → ProductContext
  │
  ├── idea              — the opportunity row
  ├── linkedMeetings    — meetings linked via idea_meetings join table
  ├── linkedCompetitors — competitors linked via idea_competitors join table
  ├── relatedSignals    — signals with this opportunityId
  ├── relatedFeedback   — stakeholder feedback with this opportunityId
  ├── timeline          — idea_timeline events
  ├── comments          — idea_comments
  ├── prioritization    — prioritization_scores for this idea
  ├── relatedInsights   — ai_insights referencing this idea
  ├── relatedIdeas      — other ideas with same category/source
  ├── evidence          — aggregated counts/quotes
  └── health            — computed HealthScore (0-100)
```

### Sequence: AI Analysis

```
POST /api/opportunities/:id/analyze
  │
  ├── buildProductContext(id)          # fan-out parallel queries
  ├── formatContextForPrompt(ctx)      # markdown-formatted context string
  ├── openai.chat.completions.create() # model sees full context
  └── db.update(opportunitiesTable)    # persist AI result + healthScore
```

### Health Score computation

| Factor                     | Weight |
|----------------------------|--------|
| Has description            |  10    |
| Has customer problem       |  10    |
| Has AI summary             |  15    |
| Signals count              | ≤15    |
| Stakeholder feedback count | ≤15    |
| Meeting linked             |  10    |
| Competitor linked          |  10    |
| Prioritization scored      |  10    |
| Comments / discussion      |  5     |
| **Max**                    | **100**|

---

## API Reference

All routes (except `/api/health` and auth routes) require a valid session cookie.

### Authentication

| Method | Path                              | Description                     |
|--------|-----------------------------------|---------------------------------|
| GET    | `/api/login`                      | Redirect to Replit OIDC         |
| GET    | `/api/logout`                     | Clear session + redirect        |
| GET    | `/api/auth/callback`              | OIDC callback (browser flow)    |
| GET    | `/api/auth/user`                  | Get current user (null if anon) |

### Product Ideas (Opportunities)

| Method | Path                              | Auth | Description                   |
|--------|-----------------------------------|------|-------------------------------|
| GET    | `/api/opportunities`              | ✓    | List with filters + pagination |
| POST   | `/api/opportunities`              | ✓    | Create (auto-records timeline) |
| GET    | `/api/opportunities/:id`          | ✓    | Get one + evidence bundle      |
| PATCH  | `/api/opportunities/:id`          | ✓    | Update fields                  |
| DELETE | `/api/opportunities/:id`          | ✓    | Delete                         |
| POST   | `/api/opportunities/:id/analyze`  | ✓    | AI analysis via Context Engine |

### Product Idea Workspace

| Method | Path                                          | Auth | Description              |
|--------|-----------------------------------------------|------|--------------------------|
| GET    | `/api/product-ideas/:id/workspace`            | ✓    | Full context aggregate   |
| GET    | `/api/product-ideas/:id/comments`             | ✓    | List comments            |
| POST   | `/api/product-ideas/:id/comments`             | ✓    | Add comment              |
| DELETE | `/api/product-ideas/:id/comments/:commentId`  | ✓    | Remove comment           |
| GET    | `/api/product-ideas/:id/timeline`             | ✓    | Event timeline           |
| GET    | `/api/product-ideas/:id/health`               | ✓    | Health score             |
| POST   | `/api/product-ideas/:id/link-meeting/:mid`    | ✓    | Link a meeting           |
| DELETE | `/api/product-ideas/:id/link-meeting/:mid`    | ✓    | Unlink meeting           |
| POST   | `/api/product-ideas/:id/link-competitor/:cid` | ✓    | Link a competitor        |
| DELETE | `/api/product-ideas/:id/link-competitor/:cid` | ✓    | Unlink competitor        |
| POST   | `/api/product-ideas/duplicate-check`          | ✓    | Semantic duplicate check |
| GET    | `/api/product-ideas/search`                   | ✓    | Full-text search         |

### Other Resources

| Resource     | Endpoints                                    |
|--------------|----------------------------------------------|
| Signals      | CRUD + `POST /api/signals/bulk`              |
| Meetings     | CRUD + `POST /api/meetings/:id/analyze`      |
| Competitors  | CRUD + `POST /api/competitors/:id/analyze`   |
| Feedback     | CRUD                                         |
| Insights     | `GET` list, `GET` trending, `POST` generate  |
| Prioritization | CRUD + `POST /api/prioritization/score` + `POST /api/prioritization/ai-recommend` |
| Dashboard    | `GET /api/dashboard/stats` + `GET /api/dashboard/daily-summary` |

---

## Codegen Pipeline

```
lib/api-spec/openapi.yaml
        │
        ▼  pnpm --filter @workspace/api-spec run codegen
        │
        ├──► lib/api-client-react/src/generated/
        │         api.ts          — React Query hooks (useListOpportunities, etc.)
        │         api.schemas.ts  — TypeScript interfaces
        │
        └──► lib/api-zod/src/generated/
                  api.ts          — Zod schemas for all API types
```

**When to re-run:** Any time you add/change/remove paths, parameters, or schemas in `openapi.yaml`.

**Important:** Avoid `format: email` and `format: uri` in OpenAPI schemas — they generate `z.email()` / `z.url()` which are Zod v4 only (project uses v3). Use plain `type: string` instead.
