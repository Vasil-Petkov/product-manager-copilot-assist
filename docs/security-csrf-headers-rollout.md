# CSRF, response headers and observability — production remains pending

This follow-up is stacked on PR #30. It does not merge, publish, execute
production DDL, enable notifications, or configure guessed proxy networks.

## Browser and native authentication

- Every cookie-bearing unsafe API request requires a session-bound HMAC token
  and HttpOnly nonce cookie, including JSON and form mutations. Origins are
  still checked by PR #30's exact CORS allowlist **before** route execution.
- `GET /api/auth/csrf` is no-store, rate-limited under `authRead`. The nonce is
  server-random; a client-supplied value is never reflected into Set-Cookie.
  Production uses a Secure, HttpOnly, SameSite=Lax, path=/ `__Host-pm_csrf`
  cookie without Domain. HMAC input includes the current `sid`, so tokens
  cannot be transplanted between login sessions.
- Generated browser calls and the two direct mutation callers fetch the token
  and send `X-CSRF-Token`. Concurrent bootstrap is coalesced. Bootstrap failure
  fails closed without dispatching a mutation. Session changes can invalidate
  an in-flight request: refresh/retry, not an automatic mutation replay.
- Native Bearer/PKCE clients without ambient browser cookies/Origin/Fetch
  Metadata do not need CSRF tokens. A Bearer header does not exempt a request
  that also carries a browser session cookie. React Native's `window` without
  `location.origin` is not classified as a browser by the client helper.
- `GET/HEAD /api/logout` only renders an escaped confirmation form; it never
  deletes a session or calls the provider. Explicit `POST /api/logout` always
  requires CSRF proof, then preserves the validated OIDC end-session redirect.
  Cancel leaves the session intact. Existing logout links remain usable.
- Login/callback retain OIDC state, nonce and PKCE checks. Mobile token exchange
  still returns an opaque token rather than setting a browser login cookie.
- Daily summary uses **POST only**, with explicit Generate briefing buttons on
  Home, Discovery Dashboard and AI Insights. GET/HEAD returns 405/Allow: POST
  even with valid proof. Page loading never generates AI work.
  Complete registered method inventory: `security-route-review.md`.
- Unsafe browser requests check Origin exactly against the CORS allowlist.
  Without Origin, a supplied Referer must parse to an allowed origin without
  userinfo. Bad source/cross-site Fetch Metadata rejects even valid tokens.
  With neither header, ambient-cookie requests still require session-bound
  proof; no Host or forwarding header creates an implicit trusted origin.
- Public Demo bootstrap/mutations use local fixture tokens while Demo is
  installed. Explicit exit uses the original server transport for **both**
  token bootstrap and exit, preserving Demo if exit fails. No fixture content
  is written to DB or sent to AI. Dedicated shared abuse counters are still
  persisted, as in PR #30; these are not business/Demo content.
- Browser testing exposed missing arrays in the Demo workspace response after
  creating an idea. Its local response now includes the actual idea, feedback
  quotes and linked-item arrays; regression assertions cover that contract.

## Enforced security headers, not an unsupported static-host assumption

Official responseHeaders documentation is explicitly for **Static Deployments**:
https://docs.replit.com/features/deployment-customization/static-deployments-advanced
It does not establish support for this Autoscale application router.

The frontend production service therefore serves the same Vite output through
a small Node HTTP server. Artifact configuration was validated through Replit's
artifact validator. No `.replit` change is needed. `/api` remains routed to the
existing API service. Direct SPA deep links and assets are supported; private
files, symlink escapes, unknown assets and non-GET/HEAD requests are rejected.
API and frontend share one header policy:

- CSP: scripts self only (no unsafe-inline/eval); objects/base disabled; frames
  denied; same-origin API connections; HTTPS images/data/blob; Google font CSS
  and font files explicitly allowed.
- Inline **styles**, not scripts, remain allowed for React/Radix/Recharts.
- Form actions allow self and `https://replit.com`; public provider discovery
  directly confirmed both authorization and end-session origins there.
  No live login was completed. A future issuer change requires CSP review.
- nosniff, no-referrer, disabled camera/microphone/geolocation, DENY framing and
  HSTS. The API disables X-Powered-By and sets no-store.
- Vite development alone permits inline refresh scripts and HMR WebSockets/
  the Replit parent frame. Production uses the strict policy above.
- The dev command no longer invokes legacy migration scripts on every workflow
  restart. Production already starts the compiled API without those scripts.
  New databases must be initialized explicitly; tests provision their own schema.

The frontend now needs a Node service on its existing port rather than native
static hosting. Confirm health, resource utilization and headers on the real
published root/deep links/assets after the later approved publication.
No production runtime/headers claim is made before that check.

## Privacy-safe metrics; notification alerts are NOT configured

Connected integration search returned no monitoring/alert integration.
Official docs search did not establish a programmable custom 429 alert API.
Do not interpret logs as delivered alerts.

Each API instance emits `event=security_metrics` JSON every 60 seconds:
bounded `name`, bounded `policy`, numeric `count`, `windowSeconds`. Events:
`csrf_rejected`, `cors_rejected`, `rate_allowed`, `rate_limited`,
`rate_store_unavailable`, `demo_capacity`, `auth_callback_error`,
`database_failure`, `migration_readiness_failure`, `startup_failure`.
Critical failures additionally emit immediate synchronous `security_failure`
JSON so fatal startup does not lose events while waiting for a timer.
No IPs, user IDs, tokens, headers,
query strings, prompts or bodies are event labels. Request logging already
omits query strings and request headers/body. Counters are bounded per-process
aggregation, not durable global monitoring; abrupt shutdown can lose a window.
Distributed request enforcement still uses PR #30's PostgreSQL atomic store.

Explicit migration CLIs emit `security_failure/name=migration_failure` and exit
nonzero without raw SQL/driver/connection details. This does NOT observe the
separate Replit managed Publish schema execution: its errors require owner
Publishing history/log access. No migration CLI was run during these tests or
startup. Startup performs SELECT-only schema readiness before listening and
fails closed for missing ownership columns/FKs/indexes or limiter schema. It
never runs DDL/backfill. Request failures no longer log raw driver errors.
Generic OIDC/AI network errors are not mislabeled as DB outages: Node transport
codes require a known Drizzle query boundary. Readiness/pool operations have
their own explicit DB boundary.

Native destinations directly checked:
https://docs.replit.com/features/publishing/monitoring-agent
and https://docs.replit.com/features/publishing/monitoring-a-deployment .
The docs specify uptime email, Monitoring alerts for error logs/HTTP errors/
latency, personal Settings > Notifications > Active monitoring alerts, and
account-wide Monitoring alert recipients/severity in advanced settings.
Project enablement/recipients/delivery remain **unverified and unchanged**.
No native custom security-counter threshold/routing API was found. Organization
Audit Log streaming does not prove export of application security_metrics.

Owner/operator setup, not performed:
1. Open Replit Publishing Monitoring/Monitoring Agent; verify availability,
   recipient, uptime notification options and test delivery through the UI.
2. Keep Auto-fix and Auto-republish OFF without separate authorization; native
   alerts do not require automatic code changes/publication.
   For abuse thresholds, connect an actual supported log/metric alert sink;
   aggregate instance counters, do not assume one process sees all traffic.
   Required: confirmed forwarding mechanism, HTTPS ingestion endpoint, scoped
   write-only ingestion credential, verified email/on-call destination, and
   rule-management permission or owner UI access. No provider/destination/
   credential is configured; any credentials require secure Secrets input.
3. Suggested initial rules (tune to baseline): any store-unavailable event;
   sustained demo-capacity; >5% rate_limited/(rate_allowed+rate_limited) for
   5 minutes with at least 100 requests; unusual CSRF/CORS rejection bursts.
4. Define owner/on-call routing, deduplication and recovery notifications.
   Trigger a controlled non-production event and verify a real notification
   receipt before marking alerting configured. Never load-test production.

## Exact production configuration and proxy blocker

The only approved production frontend origin is:

```
CORS_ALLOWED_ORIGINS=https://product-manager-copilot-assist.replit.app
```

Production existence lookup showed this secret and TRUSTED_PROXY_CIDRS absent.
The available interfaces can inspect existence, set **non-secret** production
env values, or open an interactive secure Secrets form. They do not expose a
verified non-interactive Publishing secret setter with a supplied value.
No plain-env substitute was written under authorization limited to deployment
**secrets**. Owner: enter exactly the value above in Publishing secrets and
verify scope. No credentials or existing secret values were read.

TRUSTED_PROXY_CIDRS remains unset. Neither official docs nor deployment metadata
supplied authoritative proxy CIDRs and a header-sanitization/forwarding contract.
Do not infer them from observed socket addresses, private networks, a guessed
hop count, REPLIT_DOMAINS, X-Forwarded-Host or arbitrary X-Forwarded-For.
Production intentionally remains fail-closed rather than silently disabling IP
protection or assigning every user to a shared guessed proxy IP.

Alternative independent of Replit socket CIDRs, **not implemented**: a
controlled edge with its own authoritative client-IP contract signs a canonical
envelope of method, path, client IP, timestamp and nonce with a server-only key.
Strip incoming forwarding/signature headers. The backend verifies signature,
clock skew and atomic replay protection and rejects **all** unsigned direct
requests before using the authenticated client IP as limiter identity. A public
backend cannot bypass signature enforcement. A CDN alone or a key shipped to
the browser is not this architecture.

Required: real signer, protected key rotation, shared replay store, reviewed
routing and staging tests. Owner must arrange routing for the confirmed origin
or separately approve a real custom origin/OIDC/CORS update; no domain is
invented here. No such edge, credentials or routing is available/configured.
Retain the proxy-contract blocker until a real alternative is approved/tested.

## Publish schema and PITR gate — no production writes

Fresh managed preview still has exactly these six additive statements:

```sql
CREATE TABLE "security_rate_limits" (
  "bucket_key" text PRIMARY KEY NOT NULL,
  "hits" integer NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
ALTER TABLE "signals" ADD COLUMN "user_id" text;
ALTER TABLE "stakeholder_feedback" ADD COLUMN "user_id" text;
CREATE INDEX "security_rate_limits_expiry_idx"
  ON "security_rate_limits" USING btree ("expires_at");
ALTER TABLE "signals" ADD CONSTRAINT "signals_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
ALTER TABLE "stakeholder_feedback" ADD CONSTRAINT "stakeholder_feedback_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
```

Preview: success, no structural data loss, no backwards-compatibility warning,
no removals/truncations/other statements. Preserve `conversations_user_idx` and
`ai_insights_user_idx`. No owner inference/default/backfill. Unknown owners
remain inaccessible.

Before any future approval:
- [ ] Owner checks Production Database Settings: PITR enabled/retention,
      latest restorable time (record UTC), recovery permissions and recovery
      objective. API access here does not verify these facts.
- [ ] Confirm a backup/recovery test to an isolated target by a supported
      mechanism. Do not test restore by replacing the live production DB.
      Git backups do not back up production data.
- [ ] Check writer activity and long transactions; agree maintenance window,
      lock/statement timeout and abort procedure. Nullable ADD COLUMN without a
      default normally avoids table rewrite but still needs ACCESS EXCLUSIVE.
      FK validation scans and locks referenced/referencing tables. Small row
      estimates from a replica do not prove writer lock readiness.
- [ ] Recompute/review Publish preview line by line immediately before Publish:
      exactly the six statements above, both ownership indexes preserved,
      overwrite data OFF; stop if any additional operation appears.
- [ ] Verify proxy contract, exact production secrets, isolated validations,
      code review and reviewed merged source. Owner executes the Publishing UI
      schema confirmation/Publish; Agent has no direct production writer flow.
- [ ] Post-publication: verify revision, catalog columns/FKs/indexes, headers/
      CSP, CORS allow/deny/preflight, spoof-resistant IP extraction, controlled
      429/Retry-After, Demo, real login/refresh/confirmed logout, two dedicated
      user isolation and exact fixture cleanup. These live tests are pending.

## Automation boundary

Automated here: source/contract changes, disposable DB/unit/integration/browser
fixtures, builds/scans, read-only schema preview, Git branch and review PR.
Tracked generated clients were regenerated with the installed patched Orval
8.44 toolchain: many generated model diffs are header-only, and query-hook
overload/types changed with that generator. No dependency was downgraded to
reproduce an obsolete generator banner. Workspace typecheck and builds cover
consumer compatibility; generated output is not an independent security fix.
Owner browser/provider/support needed: production secret input through the
available secure interface, authoritative proxy contract, actual PITR readiness/
restore exercise, real OAuth sessions and two authorized production accounts,
notification setup/delivery verification, and final Publishing action.

## Actual isolated validation

- Workspace typecheck: passed.
- API unit: **36 passed, 0 failed, 0 skipped**.
- API integration: **42 + 3 = 45 passed, 0 failed, 0 skipped**, each runner
  provisions disposable PostgreSQL, verifies its target and disposes it.
  Original ownership assertions remain; browser fixtures now supply valid CSRF
  before those assertions so authorization is actually exercised.
- Frontend: **6 passed, 0 failed, 0 skipped**.
- API, PM frontend and mockup-sandbox production builds passed with their
  explicit service PORT/BASE_PATH. Existing nonfatal bundle/sourcemap warnings
  remain; no dependency update/install was used.
- Dependency audit: 0 vulnerabilities. SAST: complete, 0 findings. Privacy/
  dataflow: 0 findings. An initial cookie-reflection SAST finding was fixed by
  setting only server-random nonce values, not suppressing the rule.
- Browser: actual production frontend server/CSP, local Demo create/detail/
  exit, owner create/persist/reload, actual CSRF request header, missing-token
  403/no mutation, safe logout GET/Cancel and intentional inline-script blocking
  passed on a disposable fixture. No live OAuth/login/provider completion.
  One unidentified resource 404 was observed; it caused no unhandled JS error
  and did not block the verified flows. It is not claimed resolved.
- Initial fixture validation failures (missing description/CSRF transport) and
  a real Demo response-shape crash were fixed; final passing results above are
  from subsequent runs, not from the failed initial attempts.
- The normal development preview rendered after workflow restarts; this is
  not production smoke evidence. Production schema/secrets/proxy/OAuth and
  delivered notification readiness remain unverified/pending as listed above.

The focused browser follow-up verified manual briefing buttons on all three
pages (no request before click), POST 200 with browser Origin/CSRF, GET/HEAD
405/Allow: POST, missing-proof 403 and valid owner mutation 201, GET logout
session preservation/Cancel, and production CSP blocking inline scripts while
SPA assets load. An initial automatic-generation report was not reproduced
after correcting the tester's asynchronous response predicate; the source
only invokes these mutations from explicit click handlers.

**Browser limitation, not a claimed pass:** attacker-origin form/simple fetch
probes remained pending/aborted in the browser harness. No attack title was
found in the owner listing, but browser response-level denial is unverified.
Independent real HTTP form/JSON probes against that same disposable fixture
both immediately returned 403 `Origin not allowed`; committed actual-app
cross-origin/Referer/token/no-write integration assertions also pass. Browser
transport diagnosis remains pending; none of this is production smoke evidence.

## Incident response — operator checklist, not automatic remediation

1. Triage fixed event counts, UTC window and deployment revision. Escalate
   cross-user access or unexpected authenticated writes as high severity;
   a rate-limit burst alone is not proof of an attack.
2. Pause rollout; leave Auto-fix/Auto-republish off. Owner may restrict affected
   traffic through an approved change. Never restore availability by removing
   ownership, CSRF, proxy or limiter fail-closed checks.
3. Preserve minimal sanitized evidence and read-only schema/status. Do not
   export user rows, cookies, tokens, authorization codes, prompts, request
   bodies or raw SQL parameters into incident tickets/alerts.
4. With separate approval, revoke/rotate affected credentials through their
   provider/Secrets UI. **SESSION_SECRET rotation does not revoke opaque
   SQL-stored sid sessions.** Plan targeted session revocation separately;
   never guess owners or delete production rows as a shortcut.
5. Follow the PITR checklist above. A live restore replaces current data; it is
   not a safe test or a blind response to an auth bug. Validate recovery on an
   authorized isolated target using an actually supported recovery mechanism.
6. Recover with reviewed code, additive schema and explicit Publishing approval.
   Verify real auth/isolation and delivered notifications before closure.
   Record impact, root cause, containment, recovery point and prevention tasks
   without private payloads.

Recharts maintenance is outside scope: the dependency audit has no advisory
requiring its upgrade/replacement. Maintenance status alone is not claimed as
an exploitable security vulnerability.
