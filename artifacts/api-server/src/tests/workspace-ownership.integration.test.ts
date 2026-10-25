import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { join } from "node:path";
import { after, before, test } from "node:test";
import {
  db, pool, usersTable, sessionsTable, opportunitiesTable, competitorsTable,
  meetingsTable, feedbackTable, signalsTable, aiInsightsTable,
} from "@workspace/db";

let server: http.Server;
const fixture = {
  userA: "ownership-user-a",
  userB: "ownership-user-b",
  sidA: "ownership-session-a",
  sidB: "ownership-session-b",
};
const records: Record<string, { a: number; b: number }> = {};

function responseId(body: unknown): number {
  assert.ok(body && typeof body === "object" && "id" in body && typeof body.id === "number");
  return body.id;
}

async function request(path: string, method = "GET", body?: unknown, sid = fixture.sidB) {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/api${path}`, {
    method,
    headers: {
      cookie: `sid=${sid}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "manual",
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  const directory = process.env.OWNERSHIP_TEST_DIRECTORY;
  assert.ok(directory, "Run via test:integration: it provisions an isolated PostgreSQL cluster");
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(target.searchParams.get("host"), directory);
  const actual = await pool.query("SHOW data_directory");
  assert.equal(actual.rows[0].data_directory, join(directory, "data"),
    "Refusing fixture writes outside the runner's fresh database");

  for (const [id, sid] of [[fixture.userA, fixture.sidA], [fixture.userB, fixture.sidB]]) {
    const user = { id, email: `${id}@example.invalid`, firstName: "Owner", lastName: id, profileImageUrl: null };
    await db.insert(usersTable).values(user);
    await db.insert(sessionsTable).values({
      sid, sess: { user, access_token: "test-only" },
      expire: new Date(Date.now() + 3_600_000),
    });
  }
  const ideas = await db.insert(opportunitiesTable).values([
    { title: "Owner A private idea", description: "Private A", sourceType: "manual", userId: fixture.userA },
    { title: "Owner B private idea", description: "Private B", sourceType: "manual", userId: fixture.userB },
  ]).returning();
  records.opportunities = { a: ideas[0].id, b: ideas[1].id };
  const competitors = await db.insert(competitorsTable).values([
    { name: "Private competitor A", userId: fixture.userA },
    { name: "Private competitor B", userId: fixture.userB },
  ]).returning();
  records.competitors = { a: competitors[0].id, b: competitors[1].id };
  const meetings = await db.insert(meetingsTable).values([
    { title: "Private meeting A", meetingDate: new Date("2026-01-01T00:00:00Z"), userId: fixture.userA },
    { title: "Private meeting B", meetingDate: new Date("2026-01-01T00:00:00Z"), userId: fixture.userB },
  ]).returning();
  records.meetings = { a: meetings[0].id, b: meetings[1].id };
  const feedback = await db.insert(feedbackTable).values([
    { description: "Private feedback A", department: "Product", stakeholderName: "Owner A", opportunityId: ideas[0].id },
    { description: "Private feedback B", department: "Product", stakeholderName: "Owner B", opportunityId: ideas[1].id },
  ]).returning();
  records.feedback = { a: feedback[0].id, b: feedback[1].id };
  const signals = await db.insert(signalsTable).values([
    { content: "Private signal A", sourceType: "manual", opportunityId: ideas[0].id },
    { content: "Private signal B", sourceType: "manual", opportunityId: ideas[1].id },
  ]).returning();
  records.signals = { a: signals[0].id, b: signals[1].id };
  const { default: app } = await import("../app.ts");
  server = http.createServer(app).listen(0, "127.0.0.1");
  await once(server, "listening");
  // Create conversations through the authenticated API, not by assigning
  // hypothetical owner columns that are absent in the current schema.
  const conversationA = await request("/openai/conversations", "POST", { title: "Private conversation A" }, fixture.sidA);
  const conversationB = await request("/openai/conversations", "POST", { title: "Private conversation B" });
  assert.equal(conversationA.status, 201);
  assert.equal(conversationB.status, 201);
  records.conversations = { a: responseId(conversationA.body), b: responseId(conversationB.body) };
  // Legacy unassigned data must not become visible to every signed-in user.
  await db.insert(aiInsightsTable).values({
    type: "trend", title: "Legacy private analysis", content: "Unassigned private insight",
  });
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
  // The parent runner stops/removes its isolated cluster even if an assertion
  // fails or a signal interrupts this process. No user-data DELETE is needed.
});

for (const domain of ["opportunities", "competitors", "meetings", "feedback", "signals"]) {
  test(`${domain}: lists contain only the authenticated owner's records`, async () => {
    const response = await request(`/${domain}`);
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body));
    assert.deepEqual(response.body.map((row: { id: number }) => row.id), [records[domain].b]);
  });
}

for (const [domain, changes] of [
  ["opportunities", { title: "tampered" }],
  ["competitors", { name: "tampered" }],
  ["meetings", { title: "tampered" }],
  ["feedback", { description: "tampered" }],
] as const) {
  test(`${domain}: cross-workspace reads, updates, and deletes are denied`, async () => {
    const path = `/${domain}/${records[domain].a}`;
    assert.equal((await request(path)).status, 404, "cross-owner GET");
    assert.equal((await request(path, "PATCH", changes)).status, 404, "cross-owner PATCH");
    assert.equal((await request(path, "DELETE")).status, 404, "cross-owner DELETE");
    assert.equal((await request(`/${domain}/${records[domain].b}`)).status, 200, "own record remains accessible");
  });
}

test("signals: cross-workspace deletion is denied", async () => {
  assert.equal((await request(`/signals/${records.signals.a}`, "DELETE")).status, 404);
});

test("product workspace aggregation rejects another user's idea", async () => {
  assert.equal((await request(`/product-ideas/${records.opportunities.a}/workspace`)).status, 404);
});

test("conversation lists do not expose another authenticated user's conversation", async () => {
  const response = await request("/openai/conversations");
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.deepEqual(response.body.map((row: { id: number }) => row.id), [records.conversations.b]);
});

test("unassigned legacy AI insights are not shared with every authenticated user", async () => {
  const response = await request("/insights");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});
