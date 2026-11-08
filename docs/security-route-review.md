# Registered API method / CSRF inventory

All paths below are under `/api`. Current router AST inventory is **109
registrations: 43 GET, 43 POST, 11 PATCH, 12 DELETE**. HEAD inherits GET behavior.
There are no registered PUT/business OPTIONS handlers. CORS handles preflights.
The global CSRF guard is mounted before the entire API router; it is not an
opt-in per-handler frontend filter. A regression test detects inventory changes
and direct GET persistence/provider operations. Static inspection is not a
formal proof of arbitrary future transitive helpers.

## Cookie-authenticated mutations: all 66 unsafe registrations

Each of these requires session-bound CSRF proof when ambient cookies/browser
signals are present. Origin must exactly match the configured CORS set; absent
Origin uses a validated Referer when supplied. With both absent, the token is
still mandatory. Adding Authorization cannot bypass a sid cookie.

| Module | POST |
|---|---|
| Auth | `/logout`, `/mobile-auth/token-exchange`, `/mobile-auth/logout` |
| Demo | `/demo/session`, `/demo/session/exit` |
| Competitors | `/competitors`, `/competitors/:id/analyze` |
| Dashboard | `/dashboard/daily-summary` |
| Documents | `/documents/generate`, `/documents/:id/regenerate`, `/documents/:id/accept` |
| Feedback | `/feedback` |
| Insights | `/insights/generate` |
| Meetings | `/meetings`, `/meetings/:id/analyze` |
| Conversations | `/openai/conversations`, `/openai/conversations/:id/messages` |
| Opportunities | `/opportunities`, `/opportunities/:id/analyze` |
| Prioritization | `/prioritization/score`, `/prioritization/ai-recommend`, `/prioritization/analyze/:opportunityId`, `/prioritization/compare` |
| Product ideas | `/product-ideas/:id/comments`, `/product-ideas/:id/link-meeting/:meetingId`, `/product-ideas/:id/link-competitor/:competitorId`, `/product-ideas/:id/similarity`, `/product-ideas/similarity/compare`, `/product-ideas/merge` |
| Roadmap | `/roadmap/initiatives`, `/roadmap/items`, `/roadmap/milestones`, `/roadmap/proposal` |
| Signals | `/signals`, `/signals/bulk` |
| Validation | `/validation/hypotheses`, `/validation/hypotheses/improve`, `/validation/hypotheses/:id/duplicate`, `/validation/hypotheses/:id/archive`, `/validation/experiments`, `/validation/experiments/assist`, `/validation/experiments/:id/analyze-result`, `/validation/experiments/:id/archive` |

PATCH: `/competitors/:id`, `/documents/:id`, `/feedback/:id`, `/meetings/:id`,
`/opportunities/:id`, `/prioritization/:id`, `/roadmap/initiatives/:id`,
`/roadmap/items/:id`, `/roadmap/milestones/:id`, `/validation/hypotheses/:id`,
`/validation/experiments/:id`.

DELETE: `/competitors/:id`, `/feedback/:id`, `/meetings/:id`,
`/openai/conversations/:id`, `/opportunities/:id`,
`/product-ideas/:id/comments/:commentId`,
`/product-ideas/:id/link-meeting/:meetingId`,
`/product-ideas/:id/link-competitor/:competitorId`,
`/roadmap/initiatives/:id`, `/roadmap/items/:id`, `/roadmap/milestones/:id`,
`/signals/:id`.

## GET/HEAD review

- Auth: `/auth/user` reads session identity; `/auth/csrf` issues a nonce/token;
  `/logout` renders a confirmation only, without deleting SQL sessions or
  contacting provider logout. GET/HEAD `/dashboard/daily-summary` returns 405
  with Allow: POST; it never calls the AI provider.
- OIDC protocol exceptions: `/login` creates state/nonce/PKCE browser cookies;
  `/callback` consumes a validated provider GET and establishes the session
  after state/nonce/PKCE/token validation. Converting the provider callback to
  POST would break OIDC. Generic session expiry/refresh and bounded Demo TTL
  cleanup remain authentication maintenance, not business GET mutations.
- Demo `/demo/session` reads active status. `/healthz` is health status.
- Competitors: list, detail, reports. Feedback: list/detail. Meetings:
  list/detail. Opportunities: list/detail. Signals: list. These read owned
  data; no direct persistence/provider call was found in these GET handlers.
- Conversations: list, detail, messages. Insights: list, trending.
- Prioritization: list and executive-recommendation read stored owned analyses;
  executive-recommendation does not make an extra provider request.
- Product ideas: workspace, comments, timeline, health, similarity/summary,
  search. Workspace/context aggregation remains scoped to the authorized
  user's existing relationships. Unknown legacy owners remain inaccessible.
- Documents: list, detail, context/:productIdeaId/:documentType. Roadmap: list.
- Validation: summary, methods, product-ideas, hypotheses/list/detail,
  experiments/list/detail.

The test intentionally permits direct persistence only in the validated OIDC
callback. It must fail if a new GET directly calls insert/update/delete/create
or session establishment, unless the protocol review explicitly justifies it.
All previous ownership assertions continue to run with valid CSRF transport,
so a CSRF 403 cannot silently replace an expected ownership 403.

## Regression evidence

Real isolated HTTP tests submit JSON and URL-encoded forms to the actual app:
foreign/null Origin, spoofed/malformed/userinfo Referer, explicit cross-site
Fetch Metadata, cross-session token, missing token and missing Origin/Referer.
Legitimate allowlisted Origin, valid Referer, and private-header-free requests
with valid session-bound proof succeed; matching source alone never suffices.
They verify no unauthorized row was created and preserve native Bearer writes/
logout. OIDC metadata only is stubbed; authorization/session/DB checks are not.
