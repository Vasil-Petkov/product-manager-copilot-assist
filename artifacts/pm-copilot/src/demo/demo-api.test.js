test("CSRF-aware Demo mutation stays local without bootstrap/backend persistence", async () => {
  const cleanup = installDemoApi();
  const before = backendCalls;
  try {
    const response = await csrfFetch("/api/opportunities", { method: "POST", body: JSON.stringify({ title: "CSRF local fixture" }) }, window.fetch);
    assert.ok(response.ok);
    const created = await response.json();
    const workspace = await (await window.fetch(`/api/product-ideas/${created.id}/workspace`)).json();
    assert.equal(workspace.idea.id, created.id);
    for (const values of [workspace.evidence.exampleQuotes, workspace.evidence.feedbackQuotes, workspace.evidence.sourceLinks, workspace.linkedMeetings, workspace.linkedCompetitors]) assert.ok(Array.isArray(values));
    assert.equal(backendCalls, before);
  } finally { cleanup(); }
});
import assert from "node:assert/strict";
import test from "node:test";
import { installDemoApi } from "./demo-api.ts";
import { csrfFetch } from "../../../../lib/api-client-react/src/csrf.ts";

const originalBackendFetch = async () => {
  backendCalls += 1;
  return new Response(JSON.stringify({ source: "private-backend" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

let backendCalls = 0;
globalThis.window = {
  location: { origin: "http://demo.local" },
  fetch: originalBackendFetch,
};

test("Public Demo covers lifecycle data without forwarding to the backend", async () => {
  const cleanup = installDemoApi();
  const lifecycleRequests = [
    "/api/opportunities",
    "/api/prioritization",
    "/api/validation/hypotheses",
    "/api/roadmap",
    "/api/documents",
    "/api/feedback",
    "/api/insights",
  ];

  for (const route of lifecycleRequests) {
    const response = await window.fetch(route);
    assert.equal(response.status, 200, `${route} should be served by demo mode`);
    const payload = await response.json();
    assert.ok(payload, `${route} should return a demo payload`);
  }

  const authResponse = await window.fetch("/api/auth/user");
  assert.deepEqual((await authResponse.json()).user.id, "demo-user");
  assert.equal(backendCalls, 0, "demo requests must not reach the private backend");

  const beforeMutation = await (await window.fetch("/api/opportunities")).json();
  await window.fetch("/api/opportunities", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Temporary demo idea",
      description: "This only exists in the demo session.",
      sourceType: "other",
    }),
  });
  const afterMutation = await (await window.fetch("/api/opportunities")).json();
  assert.equal(afterMutation.length, beforeMutation.length + 1);
  cleanup();

  const freshCleanup = installDemoApi();
  const afterReset = await (await window.fetch("/api/opportunities")).json();
  assert.equal(afterReset.length, beforeMutation.length, "a fresh demo session resets local changes");
  freshCleanup();
});

test("Public Demo never intercepts non-API requests after cleanup", async () => {
  const response = await window.fetch("/assets/app.css");
  assert.equal(response.status, 200);
  assert.equal(backendCalls, 1);
});