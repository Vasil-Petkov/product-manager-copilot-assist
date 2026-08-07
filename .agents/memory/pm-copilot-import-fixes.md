---
name: PM Copilot import fixes
description: Known import pitfalls in pm-copilot and api-client-react that cause runtime errors
---

## customFetch export
`customFetch` from `lib/api-client-react/src/custom-fetch.ts` must be explicitly exported in `lib/api-client-react/src/index.ts`.
As of the workspace sprint, the index exports it:
```ts
export { setBaseUrl, setAuthTokenGetter, customFetch } from "./custom-fetch";
```

**Why:** Design subagent and main agent both needed direct fetch calls for non-codegen'd endpoints. The function existed but wasn't re-exported, causing a runtime SyntaxError in the browser.

**How to apply:** Any time a component needs direct `customFetch` calls, it imports from `@workspace/api-client-react` directly — no need to import from the subpath.

## react-icons
Never use `react-icons` (e.g. `SiSalesforce`). Use `lucide-react` only.

## Subpath imports from api-client-react
Never import from `@workspace/api-client-react/src/generated/api.schemas` — that subpath is not exported. Define enum consts inline instead.

## DB table naming (opportunity/idea)
The DB table is `opportunities` (via `opportunitiesTable`). The concept is exposed as "Product Idea" in the UI and API layer. New junction tables: `idea_comments`, `idea_timeline`, `idea_meetings`, `idea_competitors`.

## recordTimeline helper
`recordTimeline(ideaId, eventType, description, metadata?)` lives in `artifacts/api-server/src/routes/product-ideas.ts` and is exported. Import it in other route files to record events without circular deps.
