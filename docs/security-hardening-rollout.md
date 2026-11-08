# Remaining security hardening — review and rollout gate

## Scope and current state

Based on GitHub main `ddef13811115d3b72db178bb1faf161371fdc971`.
No production migration, environment update, publish, merge, or direct main push
is part of this change. Replit-only module-order changes are archived separately
and are not part of the security commit.

**Not production-ready until proxy configuration is independently verified.**
The deployment service reports Autoscale and the public URL
`https://product-manager-copilot-assist.replit.app`, with no additional URLs.
This is the verified frontend origin, not an invented domain. The production
environment currently has no `CORS_ALLOWED_ORIGINS` or `TRUSTED_PROXY_CIDRS`
configuration. `SESSION_SECRET` existence is confirmed; its value was not read.

Official documentation searches did not establish trusted proxy CIDRs or a
guaranteed overwritten client-IP header. Do not guess a hop count, trust all
private ranges, trust arbitrary X-Forwarded-For, or treat an observed socket
address as a permanent platform contract. Obtain the proxy address ranges and
forwarding/appending behavior from authoritative Replit deployment configuration
or Replit support before setting the production proxy variable. Confirm that
clients cannot directly reach the process while claiming a trusted source.

## Required configuration

| Variable | Requirement |
| --- | --- |
| `CORS_ALLOWED_ORIGINS` | Required in production. Comma-separated **canonical complete origins**. For the verified current frontend: `https://product-manager-copilot-assist.replit.app`. Add another origin only after verifying that frontend deployment. No paths, trailing slash, credentials, wildcard, query, fragment, or `null`; HTTPS required in production. Nondefault ports are exact and significant. Default HTTPS port is represented without `:443`. |
| `TRUSTED_PROXY_CIDRS` | Required in production. Explicit, independently verified proxy IPs/CIDRs; **no value supplied by this PR**. `/0`, booleans and hop counts are rejected. Express walks the forwarded chain only through trusted source addresses, stopping at the first untrusted hop. No proxies are trusted by default in development. |
| `SESSION_SECRET` | Existing secret, at least 32 characters, identical across instances. HMAC domain-separated counter keys conceal raw IPs and user IDs. Never print it. Rotation resets effective rate budgets; coordinate rotation. |
| `DATABASE_URL` | Existing managed PostgreSQL; same database for all API instances. No new external store credential is required. |
| `RATE_LIMITS_JSON` | Optional partial policy overrides, e.g. `{"generation":{"userLimit":8,"ipLimit":24,"windowMs":600000}}`. Unknown policy/field, zero, negative or noninteger limits are rejected. Windows max 24 hours; limits max 100,000. |
| `DEMO_SESSION_CAP` | Optional integer 1–100,000; default **1,000 per process**, not a global Autoscale capacity claim. |

Production configuration failure aborts application initialization, not merely
omitting CORS headers. Do not publish first and configure later.
Development can derive its exact HTTPS origin from the runtime-managed
`REPLIT_DEV_DOMAIN`; production never derives a CORS allowlist from OAuth hosts
or forwarded headers.

Requests without Origin are supported; an unlisted supplied Origin gets a safe
403 before auth, counters, body parsing or handlers. Configured preflights get
204 with explicit methods/headers and do not spend counters. CORS does not
replace authentication or a complete CSRF policy.

## Shared limiter

`security_rate_limits` is a dedicated PostgreSQL counter table, not a demo data
store. It holds only HMAC bucket keys, counts and expiry timestamps. No demo
sessions, demo payloads, user records, raw IPs, cookies, tokens or prompts are
persisted by the limiter. Existing workspace persistence assertions remain.

Each request atomically upserts its IP and (for AI) user counters in one SQL
statement, using database time and deterministic lock order. A separate bounded
cleanup statement removes at most 100 expired **counter** rows per consumption;
row locks use SKIP LOCKED. Idle expired rows can remain until traffic resumes,
but cannot authorize requests or prolong a window. There is no startup DDL.
The counter pool is separate, max four connections per instance, with bounded
connection/statement/query timeouts. Store errors produce 503 + Retry-After 30,
never an in-memory fallback or fail-open handler execution.

Fixed-window defaults (budgets shared across endpoints within each class):

| Policy | Window | Per IP | Per authenticated user |
| --- | ---: | ---: | ---: |
| auth login/callback/logout/mobile token exchange/mobile logout | 15 min | 30 | — |
| auth user lookup | 1 min | 120 | — |
| demo create | 10 min | 12 | — |
| demo status | 1 min | 120 | — |
| demo exit | 1 min | 60 | — |
| generation: documents generate/regenerate, insights generate, roadmap proposal | 10 min | 20 | 6 |
| analysis: competitors/meetings/opportunities analyze, idea similarity/compare, prioritization analyze/compare/ai-recommend, validation improve/assist/analyze-result, dashboard daily-summary | 10 min | 40 | 12 |
| conversation messages/streaming | 10 min | 90 | 30 |

AI requests consume **both** budgets, including validation/ownership denials by
an authenticated caller. Anonymous and valid demo requests retain their original
401/403 private denial and never spend AI counters. HEAD aliases, case variants
and terminal slashes cannot bypass matching GET budgets. 429 includes integer
Retry-After and a generic no-store body. Health probes remain unthrottled.
Fixed windows allow bursts near a boundary; this is not volumetric edge DDoS
protection. NAT users share IP budgets; tune from observed legitimate usage.
External/platform rate limiting remains **unconfirmed**, not assumed.

## Bounded Public Demo sessions

Sessions remain in process memory only, with random IDs and the existing
HttpOnly/SameSite cookie (Secure in production). Browser-session cookie behavior
is unchanged; server expiry is one hour. A 60-second unref'ed cleanup timer
removes expired entries without incoming requests. Reads and creation also
enforce expiry. At capacity, creation returns safe 429 + Retry-After 60 without
evicting another visitor. Exiting/restarting one's own demo releases its slot.

Autoscale restarts or routing to another instance can invalidate an in-memory
demo session. No shared demo persistence or AI provider call is introduced.
The cap is per process; the SQL rate counters are shared across instances.

## Production schema preview — reviewed, NOT executed

Read-only production catalogs confirm missing `signals.user_id`,
`stakeholder_feedback.user_id` and their FKs. Both existing
`conversations_user_idx` and `ai_insights_user_idx` exist and are declared in
the Drizzle schema. No owner inference/backfill is introduced.

### A. Ownership-only preview before the new counter table

The live development-to-production preview contained exactly these four
additive statements (ordering can vary). No DROP, replacement or data update:

```sql
ALTER TABLE "stakeholder_feedback" ADD COLUMN "user_id" text;
ALTER TABLE "signals" ADD COLUMN "user_id" text;
ALTER TABLE "stakeholder_feedback"
  ADD CONSTRAINT "stakeholder_feedback_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "signals"
  ADD CONSTRAINT "signals_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
```

Columns have no default and remain nullable. Existing unknown owners remain
NULL, inaccessible as standalone records; authoritative owned-parent evidence
authorization is unchanged and does not assign owners.

### B. Separate additive requirement for the requested shared limiter

The new table/index were applied **only in development**. The resulting actual
full Publish preview contains **six**, not four, statements: the four above
plus these two. An ownership-only four-statement preview must not be mistaken
for the complete limiter rollout plan.

```sql
CREATE TABLE "security_rate_limits" (
  "bucket_key" text PRIMARY KEY NOT NULL,
  "hits" integer NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
CREATE INDEX "security_rate_limits_expiry_idx"
  ON "security_rate_limits" USING btree ("expires_at");
```

All six were reviewed individually. Preview reports no structural data loss,
no non-backwards-compatible change, no warnings and empty removal/truncation
lists. Neither existing ownership index is dropped. This is a preview record,
**not a production migration runner**. FK validation can still take table locks;
review traffic/table sizes and rollout timing.

If review requires publishing only the four ownership statements first, do so
as a separate reviewed rollout; **do not start this branch's API without the
counter table and required configuration**.

### Safe subsequent rollout procedure — pending separate approval

1. Review this branch/PR and the complete six-statement plan; verify proxy
   configuration and set required production variables before any publish.
2. After an approved merge, re-read production catalogs and refresh Publish
   preview. Stop on any additional statement, DROP, rename ambiguity, backfill,
   default owner, overwrite-data or replacement option.
3. Use only the managed Publishing schema flow, never a prod SQL script,
   deploy-build migration hook or startup self-healing DDL. Keep **overwrite
   data off**. No publication was performed for this PR.
4. Verify both nullable columns/FKs, both preserved ownership indexes, and the
   counter table/index using production read-only catalogs.
5. Confirm live revision, full OAuth login/callback/refresh/logout, normal Demo,
   owner CRUD and two-user isolation before declaring production complete.
6. A code rollback must leave additive schema intact; never drop user columns
   or assign legacy owners to make a rollback pass.

## Monitoring and remaining operational gates

Use privacy-safe request status/path metrics (not cookies, tokens, prompt
contents, raw counter keys, IPs or user IDs):

- Alert on `rate_store_unavailable` / protection 503 immediately; investigate DB
  connectivity and pool saturation, never bypass the limiter.
- Suggested starting alert: 429 ratio above 5% for five minutes per policy,
  separated by demo/auth/AI; distinguish attacks from NAT/legitimate usage.
- Watch demo-capacity 429s, process RSS, Autoscale instance counts, auth
  callback failure rates, SQL statement latency and counter-table growth.
- Alert on missing schema/startup configuration errors before promotion.
- Provider rate limits are a separate downstream limit, not an app-user quota.

These are documented signals, **not claims that external alerts are configured**.
Live proxy verification, production configuration, production schema rollout,
full provider OAuth and post-rollout two-user smoke checks remain pending.
Recharts maintenance, a full logout/CSRF review, frontend security headers, and
backup/restore/incident-response exercises remain separate audit follow-ups.

## Validation evidence

- Full `pnpm run typecheck`: passed.
- API unit/cleanup: **24 passed, 0 failed, 0 skipped**.
- API integration: **34 passed** (original 32 plus two real shared-SQL tests);
  real HTTP CORS/limiter integration: **3 passed**. **61 API tests total**.
- Frontend demo: **2 passed, 0 failed, 0 skipped**.
- All DB-backed suites provision a fresh runner-owned Unix-socket PostgreSQL
  cluster, verify its directory, and dispose only that cluster. They do not use
  application/production DATABASE_URL. No original assertion was removed.
- Ownership regression matrices use generous **test-process-only** quotas so
  authorization assertions still exercise 401/403/404 rather than 429. Dedicated
  HTTP limiter tests use low quotas and actual PostgreSQL counters.
- Dependency audit: **0**; SAST: **0**, complete; privacy/dataflow: **0**.
- Production API, frontend and mockup builds: passed with explicit artifact
  PORT/BASE_PATH values. Initial generic recursive build failed because those
  injected variables were absent; corrected per-artifact invocations succeeded.
- Existing frontend sourcemap/annotation/chunk-size warnings remain nonfatal.
- No real OAuth/provider completion, external edge-limiter validation or
  production rollout was performed or claimed.
