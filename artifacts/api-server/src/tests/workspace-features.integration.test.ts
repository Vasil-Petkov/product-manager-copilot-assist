import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import {
  db, pool, usersTable, sessionsTable, opportunitiesTable, competitorsTable,
  meetingsTable, feedbackTable, signalsTable, conversations, messages,
  aiInsightsTable, documentsTable, validationHypotheses, validationExperiments,
  roadmapInitiativesTable, roadmapItemsTable, roadmapMilestonesTable,
  ideaCommentsTable, ideaMeetingsTable, ideaCompetitorsTable,
} from "@workspace/db";
import { validationMethods } from "../lib/validation-methods";
import { buildProductContext } from "../services/contextEngine";
import { replaceOwnedInsights } from "../services/ownedInsights";

const userC = "boundary-owner-c";
const userD = "boundary-owner-d";
const ids: Record<string, number> = {};
let server: http.Server;
let foreignBefore: string;
let legacyBefore: string;

function object(body: unknown): Record<string, unknown> {
  assert.ok(body && typeof body === "object" && !Array.isArray(body));
  return body as Record<string, unknown>;
}
function rows(body: unknown): Array<{ id: number }> {
  assert.ok(Array.isArray(body));
  return body;
}
async function request(path: string, method = "GET", body?: unknown, user = userD) {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/api${path}`, {
    method, redirect: "manual",
    headers: { cookie: `sid=${user}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() as unknown };
}
async function snapshotForeign() {
  return JSON.stringify(await Promise.all([
    db.select().from(opportunitiesTable).where(eq(opportunitiesTable.userId, userC)),
    db.select().from(competitorsTable).where(eq(competitorsTable.userId, userC)),
    db.select().from(meetingsTable).where(eq(meetingsTable.userId, userC)),
    db.select().from(documentsTable).where(eq(documentsTable.userId, userC)),
    db.select().from(validationHypotheses).where(eq(validationHypotheses.userId, userC)),
    db.select().from(validationExperiments).where(eq(validationExperiments.userId, userC)),
    db.select().from(conversations).where(eq(conversations.userId, userC)),
    db.select().from(aiInsightsTable).where(eq(aiInsightsTable.userId, userC)),
    db.select().from(roadmapItemsTable).where(eq(roadmapItemsTable.userId, userC)),
    db.select().from(roadmapInitiativesTable).where(eq(roadmapInitiativesTable.userId, userC)),
    db.select().from(roadmapMilestonesTable).where(eq(roadmapMilestonesTable.userId, userC)),
    db.select().from(feedbackTable).where(eq(feedbackTable.userId, userC)),
    db.select().from(signalsTable).where(eq(signalsTable.userId, userC)),
  ]));
}
async function snapshotLegacy() {
  return JSON.stringify(await Promise.all([
    db.select().from(conversations).where(eq(conversations.id, ids.legacyConversation)),
    db.select().from(aiInsightsTable).where(eq(aiInsightsTable.id, ids.legacyInsight)),
    db.select().from(feedbackTable).where(eq(feedbackTable.id, ids.legacyFeedback)),
    db.select().from(signalsTable).where(eq(signalsTable.id, ids.legacySignal)),
    db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, ids.legacyIdea)),
    db.select().from(competitorsTable).where(eq(competitorsTable.id, ids.legacyCompetitor)),
    db.select().from(meetingsTable).where(eq(meetingsTable.id, ids.legacyMeeting)),
  ]));
}

before(async () => {
  const directory = process.env.OWNERSHIP_TEST_DIRECTORY;
  assert.ok(directory, "Only the disposable integration runner may execute these fixtures");
  assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get("host"), directory);
  assert.equal((await pool.query("SHOW data_directory")).rows[0].data_directory, join(directory, "data"));
  for (const userId of [userC, userD]) {
    await db.insert(usersTable).values({ id: userId });
    await db.insert(sessionsTable).values({
      sid: userId, sess: { user: { id: userId }, access_token: "test-only" },
      expire: new Date(Date.now() + 3_600_000),
    });
    const name = userId === userC ? "SECRET_C" : "OWN_D";
    const [idea] = await db.insert(opportunitiesTable).values({ title: name, description: name, sourceType: "manual", userId }).returning();
    ids[`idea-${userId}`] = idea.id;
    const [competitor] = await db.insert(competitorsTable).values({ name, userId }).returning();
    ids[`competitor-${userId}`] = competitor.id;
    const [meeting] = await db.insert(meetingsTable).values({ title: name, meetingDate: new Date(), userId }).returning();
    ids[`meeting-${userId}`] = meeting.id;
    const [hypothesis] = await db.insert(validationHypotheses).values({ statement: name, opportunityId: idea.id, userId }).returning();
    ids[`hypothesis-${userId}`] = hypothesis.id;
    const [experiment] = await db.insert(validationExperiments).values({
      name, hypothesisId: hypothesis.id, userId, methodKey: validationMethods[0].key,
    }).returning();
    ids[`experiment-${userId}`] = experiment.id;
    const [doc] = await db.insert(documentsTable).values({ title: name, content: name, documentType: "prd", productIdeaId: idea.id, userId }).returning();
    ids[`document-${userId}`] = doc.id;
    const [initiative] = await db.insert(roadmapInitiativesTable).values({ name, userId }).returning();
    ids[`initiative-${userId}`] = initiative.id;
    const [item] = await db.insert(roadmapItemsTable).values({
      opportunityId: idea.id, initiativeId: initiative.id, userId, startDate: "2026-01-01", endDate: "2026-01-02",
    }).returning();
    ids[`item-${userId}`] = item.id;
    const [milestone] = await db.insert(roadmapMilestonesTable).values({ name, date: "2026-01-02", userId, initiativeId: initiative.id }).returning();
    ids[`milestone-${userId}`] = milestone.id;
    const [conversation] = await db.insert(conversations).values({ title: name, userId }).returning();
    ids[`conversation-${userId}`] = conversation.id;
    await db.insert(messages).values({ conversationId: conversation.id, role: "user", content: name });
    const [comment] = await db.insert(ideaCommentsTable).values({ ideaId: idea.id, content: name }).returning();
    ids[`comment-${userId}`] = comment.id;
  }
  const [legacyConversation] = await db.insert(conversations).values({ title: "LEGACY" }).returning();
  const [legacyInsight] = await db.insert(aiInsightsTable).values({ type: "trend", title: "LEGACY", content: "LEGACY" }).returning();
  const [legacyFeedback] = await db.insert(feedbackTable).values({ department: "PM", stakeholderName: "Legacy", description: "LEGACY" }).returning();
  const [legacySignal] = await db.insert(signalsTable).values({ content: "LEGACY", sourceType: "manual" }).returning();
  Object.assign(ids, { legacyConversation: legacyConversation.id, legacyInsight: legacyInsight.id, legacyFeedback: legacyFeedback.id, legacySignal: legacySignal.id });
  const [legacyIdea] = await db.insert(opportunitiesTable).values({ title: "LEGACY", description: "LEGACY", sourceType: "manual" }).returning();
  const [legacyCompetitor] = await db.insert(competitorsTable).values({ name: "LEGACY" }).returning();
  const [legacyMeeting] = await db.insert(meetingsTable).values({ title: "LEGACY", meetingDate: new Date() }).returning();
  Object.assign(ids, { legacyIdea: legacyIdea.id, legacyCompetitor: legacyCompetitor.id, legacyMeeting: legacyMeeting.id });
  // Deliberately inconsistent legacy relationships must fail closed at every level.
  const [badHypothesis] = await db.insert(validationHypotheses).values({ statement: "SECRET_C inconsistent", userId: userD, opportunityId: ids[`idea-${userC}`] }).returning();
  ids.badHypothesis = badHypothesis.id;
  const [badExperiment] = await db.insert(validationExperiments).values({
    name: "SECRET_C inconsistent", userId: userD, hypothesisId: ids[`hypothesis-${userC}`], methodKey: validationMethods[0].key,
  }).returning();
  ids.badExperiment = badExperiment.id;
  const [badDocument] = await db.insert(documentsTable).values({
    title: "SECRET_C inconsistent", content: "SECRET_C", documentType: "prd", userId: userD, productIdeaId: ids[`idea-${userC}`],
  }).returning();
  ids.badDocument = badDocument.id;
  const [badItem] = await db.insert(roadmapItemsTable).values({
    userId: userD, opportunityId: ids[`idea-${userC}`], startDate: "2026-01-01", endDate: "2026-01-02",
  }).returning();
  ids.badItem = badItem.id;
  const [badMilestone] = await db.insert(roadmapMilestonesTable).values({
    name: "SECRET_C inconsistent", userId: userD, initiativeId: ids[`initiative-${userC}`], date: "2026-01-02",
  }).returning();
  ids.badMilestone = badMilestone.id;
  await db.insert(ideaMeetingsTable).values([
    { ideaId: ids[`idea-${userD}`], meetingId: ids[`meeting-${userC}`] },
    { ideaId: ids[`idea-${userD}`], meetingId: ids[`meeting-${userD}`] },
  ]);
  await db.insert(ideaCompetitorsTable).values([
    { ideaId: ids[`idea-${userD}`], competitorId: ids[`competitor-${userC}`] },
    { ideaId: ids[`idea-${userD}`], competitorId: ids[`competitor-${userD}`] },
  ]);
  await db.insert(feedbackTable).values({
    userId: userC, opportunityId: ids[`idea-${userD}`], department: "PM", stakeholderName: "SECRET_C", description: "SECRET_C",
  });
  await db.insert(signalsTable).values({ userId: userC, opportunityId: ids[`idea-${userD}`], content: "SECRET_C", sourceType: "manual" });
  await db.insert(aiInsightsTable).values({
    userId: userC, type: "trend", title: "SECRET_C", content: "SECRET_C", relatedOpportunityIds: [String(ids[`idea-${userD}`])],
  });
  foreignBefore = await snapshotForeign();
  legacyBefore = await snapshotLegacy();
  const { default: app } = await import("../app.ts");
  server = http.createServer(app).listen(0, "127.0.0.1");
  await once(server, "listening");
});
after(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

for (const domain of ["hypothesis", "experiment", "document"] as const) {
  const prefix = domain === "document" ? "/documents" : `/validation/${domain === "hypothesis" ? "hypotheses" : "experiments"}`;
  test(`${domain}: lists and details reject foreign and mismatched-parent records`, async () => {
    const list = await request(prefix);
    assert.equal(list.status, 200);
    assert.deepEqual(rows(list.body).map(row => row.id), [ids[`${domain}-${userD}`]]);
    for (const id of [ids[`${domain}-${userC}`], ids[`bad${domain[0].toUpperCase()}${domain.slice(1)}`]]) {
      assert.equal((await request(`${prefix}/${id}`)).status, 404);
      const patch = domain === "hypothesis" ? { statement: "tampered" } : domain === "experiment" ? { name: "tampered" } : { title: "tampered", expectedRevision: 1 };
      assert.equal((await request(`${prefix}/${id}`, "PATCH", patch)).status, 404);
    }
    assert.equal((await request(`${prefix}/${ids[`${domain}-${userD}`]}`)).status, 200);
  });
}

test("validation: foreign and mismatched ancestors block creation, archive, duplicate, and AI", async () => {
  for (const id of [ids[`hypothesis-${userC}`], ids.badHypothesis]) {
    for (const suffix of ["archive", "duplicate"]) assert.equal((await request(`/validation/hypotheses/${id}/${suffix}`, "POST", {})).status, 404);
    assert.equal((await request("/validation/experiments", "POST", { hypothesisId: id, name: "Denied", methodKey: validationMethods[0].key, status: "draft" })).status, 404);
  }
  for (const id of [ids[`experiment-${userC}`], ids.badExperiment]) {
    assert.equal((await request(`/validation/experiments/${id}/archive`, "POST", {})).status, 404);
    assert.equal((await request(`/validation/experiments/${id}/analyze-result`, "POST", {})).status, 404);
  }
  const summary = await request("/validation/summary");
  assert.equal(summary.status, 200);
  assert.equal(object(summary.body).hypotheses, 1);
  assert.equal(object(summary.body).experiments, 1);
});

test("documentation: all AI and accept operations authorize both document and idea", async () => {
  for (const id of [ids[`document-${userC}`], ids.badDocument]) {
    for (const action of ["accept", "regenerate"]) assert.equal((await request(`/documents/${id}/${action}`, "POST", { expectedRevision: 1, confirmReplace: true })).status, 404);
  }
  assert.equal((await request(`/documents/context/${ids[`idea-${userC}`]}/prd`)).status, 404);
  assert.equal((await request("/documents/generate", "POST", { productIdeaId: ids[`idea-${userC}`], documentType: "prd" })).status, 404);
  assert.equal((await request(`/documents/${ids[`document-${userD}`]}`, "PATCH", { title: "OWN_D updated", expectedRevision: 1 })).status, 200);
});

test("roadmap: lists, updates, deletes, and links reject foreign parents", async () => {
  const response = await request("/roadmap");
  assert.equal(response.status, 200);
  const roadmap = object(response.body);
  assert.deepEqual(rows(roadmap.items).map(row => row.id), [ids[`item-${userD}`]]);
  assert.deepEqual(rows(roadmap.milestones).map(row => row.id), [ids[`milestone-${userD}`]]);
  for (const [path, changes] of [
    [`/roadmap/items/${ids[`item-${userC}`]}`, { notes: "tampered" }],
    [`/roadmap/items/${ids.badItem}`, { notes: "tampered" }],
    [`/roadmap/initiatives/${ids[`initiative-${userC}`]}`, { name: "tampered" }],
    [`/roadmap/milestones/${ids[`milestone-${userC}`]}`, { name: "tampered" }],
    [`/roadmap/milestones/${ids.badMilestone}`, { name: "tampered" }],
  ] as const) {
    assert.equal((await request(path, "PATCH", changes)).status, 404, path);
    assert.equal((await request(path, "DELETE")).status, 404, path);
  }
  assert.equal((await request(`/roadmap/items/${ids[`item-${userD}`]}`, "PATCH", { initiativeId: ids[`initiative-${userC}`] })).status, 404);
  assert.equal((await request("/roadmap/items", "POST", { opportunityId: ids[`idea-${userC}`], startDate: "2026-01-01", endDate: "2026-01-02" })).status, 404);
});

test("product workspace: links, search, comments, and AI context cannot expose foreign data", async () => {
  const own = ids[`idea-${userD}`], foreign = ids[`idea-${userC}`];
  const context = await buildProductContext(own, userD);
  assert.ok(!JSON.stringify(context).includes("SECRET_C"));
  assert.equal(context.linkedMeetings.length, 1);
  assert.equal(context.linkedCompetitors.length, 1);
  await assert.rejects(buildProductContext(foreign, userD), /not found/i);
  await assert.rejects(buildProductContext(own, undefined as unknown as string), /authenticated owner/);
  for (const action of ["comments", "timeline", "health", "workspace"]) assert.equal((await request(`/product-ideas/${foreign}/${action}`)).status, 404);
  assert.equal((await request(`/product-ideas/${foreign}/comments`, "POST", { content: "tampered" })).status, 404);
  assert.equal((await request(`/product-ideas/${own}/comments/${ids[`comment-${userC}`]}`, "DELETE")).status, 404);
  for (const entity of ["meeting", "competitor"]) {
    const entityId = ids[`${entity}-${userC}`];
    assert.equal((await request(`/product-ideas/${own}/link-${entity}/${entityId}`, "POST", {})).status, 404);
    assert.equal((await request(`/product-ideas/${own}/link-${entity}/${entityId}`, "DELETE")).status, 404);
    assert.equal((await request(`/product-ideas/${foreign}/link-${entity}/${ids[`${entity}-${userD}`]}`, "DELETE")).status, 404);
  }
  const search = await request("/product-ideas/search?q=SECRET_C");
  assert.equal(search.status, 200);
  assert.deepEqual(search.body, { ideas: [], meetings: [] });
  const aggregate = await request(`/product-ideas/${own}/workspace`);
  assert.equal(aggregate.status, 200);
  assert.ok(!JSON.stringify(aggregate.body).includes("SECRET_C"));
  const dashboard = await request("/dashboard/stats");
  assert.equal(dashboard.status, 200);
  assert.equal(object(dashboard.body).totalOpportunities, 1);
  assert.equal(object(dashboard.body).totalCompetitors, 1);
  assert.equal(object(dashboard.body).totalSignals, 0);
  assert.ok(!JSON.stringify(dashboard.body).includes("SECRET_C"));
});

test("AI endpoints and conversation children deny unauthorized work before mutations or streaming", async () => {
  for (const entity of ["opportunities", "competitors", "meetings"]) {
    const key = entity === "opportunities" ? "idea" : entity === "competitors" ? "competitor" : "meeting";
    assert.equal((await request(`/${entity}/${ids[`${key}-${userC}`]}/analyze`, "POST", {})).status, 404);
  }
  for (const id of [ids[`conversation-${userC}`], ids.legacyConversation]) {
    for (const suffix of ["", "/messages"]) assert.equal((await request(`/openai/conversations/${id}${suffix}`)).status, 404);
    assert.equal((await request(`/openai/conversations/${id}/messages`, "POST", { content: "tampered" })).status, 404);
    assert.equal((await request(`/openai/conversations/${id}`, "DELETE")).status, 404);
  }
  assert.equal((await request(`/openai/conversations/${ids[`conversation-${userD}`]}/messages`)).status, 200);
  assert.equal((await request(`/competitors/${ids[`competitor-${userC}`]}/reports`)).status, 404);
  assert.equal((await request(`/prioritization/analyze/${ids[`idea-${userC}`]}`, "POST", {})).status, 404);
});

test("legacy ownerless data stays unassigned and cannot be claimed or disclosed", async () => {
  for (const [path, id] of [
    ["/feedback", ids.legacyFeedback], ["/signals", ids.legacySignal],
    ["/opportunities", ids.legacyIdea], ["/competitors", ids.legacyCompetitor], ["/meetings", ids.legacyMeeting],
  ] as const) {
    const list = await request(path);
    assert.equal(list.status, 200);
    assert.ok(!rows(list.body).some(row => row.id === id));
    assert.equal((await request(`${path}/${id}`, "DELETE")).status, 404);
  }
  assert.equal((await request(`/feedback/${ids.legacyFeedback}`, "PATCH", { opportunityId: ids[`idea-${userD}`] })).status, 404);
  const insights = await request("/insights");
  assert.equal(insights.status, 200);
  assert.deepEqual(insights.body, []);
  assert.equal(await snapshotLegacy(), legacyBefore);
});

test("signal creation and bulk import use server identity and remain owner-scoped", async () => {
  const created = await request("/signals", "POST", { content: "Own new signal", sourceType: "manual", userId: userC });
  assert.equal(created.status, 201);
  const signal = object(object(created.body).signal);
  const idea = object(object(created.body).opportunity);
  assert.equal(signal.userId, userD);
  assert.equal(idea.userId, userD);
  assert.equal((await request(`/signals/${signal.id}`, "DELETE")).status, 204);
  assert.equal((await request(`/opportunities/${idea.id}`, "DELETE")).status, 204);
  const imported = await request("/signals/bulk", "POST", { signals: ["Own bulk signal"], sourceType: "manual", userId: userC });
  assert.equal(imported.status, 201);
  const bulkSignal = object((object(imported.body).signals as unknown[])[0]);
  assert.equal(bulkSignal.userId, userD);
  assert.equal((await request(`/signals/${bulkSignal.id}`, "DELETE")).status, 204);
  assert.equal((await request(`/opportunities/${bulkSignal.opportunityId}`, "DELETE")).status, 204);
});

test("new standalone feedback uses server identity and remains usable after linking and detaching", async () => {
  const created = await request("/feedback", "POST", { department: "PM", stakeholderName: "D", description: "Own", userId: userC });
  assert.equal(created.status, 201);
  const row = object(created.body), id = row.id;
  assert.equal(row.userId, userD);
  assert.equal((await request(`/feedback/${id}`, "PATCH", { opportunityId: ids[`idea-${userC}`] })).status, 404);
  assert.equal((await request(`/feedback/${id}`, "PATCH", { opportunityId: ids[`idea-${userD}`] })).status, 200);
  assert.equal((await request(`/feedback/${id}`, "PATCH", { opportunityId: null })).status, 200);
  assert.equal((await request(`/feedback/${id}`)).status, 200);
  assert.equal((await request(`/feedback/${id}`, "DELETE")).status, 204);
});

test("legitimate owner CRUD workflows remain usable and cannot spoof server identity", async () => {
  for (const [domain, fields, changes] of [
    ["opportunities", { title: "Own CRUD", description: "Own", sourceType: "manual" }, { title: "Own changed" }],
    ["competitors", { name: "Own CRUD" }, { name: "Own changed" }],
    ["meetings", { title: "Own CRUD", meetingDate: "2026-01-01T00:00:00Z" }, { title: "Own changed" }],
  ] as const) {
    const created = await request(`/${domain}`, "POST", { ...fields, userId: userC });
    assert.equal(created.status, 201, domain);
    const row = object(created.body);
    assert.equal(row.userId, userD);
    const path = `/${domain}/${row.id}`;
    assert.equal((await request(path)).status, 200);
    assert.equal((await request(path, "PATCH", { ...changes, userId: userC })).status, 200);
    assert.equal(object((await request(path)).body).userId, userD);
    assert.equal((await request(path, "DELETE")).status, 204);
  }
  const conv = await request("/openai/conversations", "POST", { title: "Own CRUD", userId: userC });
  assert.equal(conv.status, 201);
  const conversation = object(conv.body);
  assert.equal(conversation.userId, userD);
  assert.equal((await request(`/openai/conversations/${conversation.id}/messages`)).status, 200);
  assert.equal((await request(`/openai/conversations/${conversation.id}`, "DELETE")).status, 204);
});

test("legitimate validation creation, updates, duplication, and archival remain usable", async () => {
  const hypothesis = await request("/validation/hypotheses", "POST", {
    opportunityId: ids[`idea-${userD}`], hypothesisType: "custom", statement: "Own lifecycle", status: "draft", userId: userC,
  });
  assert.equal(hypothesis.status, 201);
  const id = object(hypothesis.body).id;
  const experiment = await request("/validation/experiments", "POST", {
    hypothesisId: id, name: "Own lifecycle", status: "draft", methodKey: validationMethods[0].key, userId: userC,
  });
  assert.equal(experiment.status, 201);
  const experimentId = object(experiment.body).id;
  assert.equal((await request(`/validation/experiments/${experimentId}`, "PATCH", { name: "Own changed" })).status, 200);
  assert.equal((await request(`/validation/experiments/${experimentId}/archive`, "POST", {})).status, 200);
  assert.equal((await request(`/validation/hypotheses/${id}/duplicate`, "POST", {})).status, 201);
  assert.equal((await request(`/validation/hypotheses/${id}/archive`, "POST", {})).status, 200);
  assert.equal((await request(`/documents/${ids[`document-${userD}`]}/accept`, "POST", { expectedRevision: 2 })).status, 200);
});

test("legitimate roadmap create, update, and delete workflows remain usable", async () => {
  const idea = await request("/opportunities", "POST", { title: "Own roadmap", description: "Own", sourceType: "manual" });
  assert.equal(idea.status, 201);
  const ideaId = object(idea.body).id;
  const initiative = await request("/roadmap/initiatives", "POST", { name: "Own lifecycle" });
  assert.equal(initiative.status, 201);
  const initiativeId = object(initiative.body).id;
  const item = await request("/roadmap/items", "POST", { opportunityId: ideaId, initiativeId, startDate: "2026-01-01", endDate: "2026-01-02" });
  assert.equal(item.status, 201);
  const itemId = object(item.body).id;
  assert.equal((await request(`/roadmap/items/${itemId}`, "PATCH", { progress: 25 })).status, 200);
  const milestone = await request("/roadmap/milestones", "POST", { initiativeId, name: "Own milestone", date: "2026-01-02" });
  assert.equal(milestone.status, 201);
  assert.equal((await request(`/roadmap/milestones/${object(milestone.body).id}`, "DELETE")).status, 204);
  assert.equal((await request(`/roadmap/items/${itemId}`, "DELETE")).status, 204);
  assert.equal((await request(`/roadmap/initiatives/${initiativeId}`, "DELETE")).status, 204);
  assert.equal((await request(`/opportunities/${ideaId}`, "DELETE")).status, 204);
});

test("insight regeneration cannot delete foreign or legacy data or reference a foreign idea", async () => {
  const generated = [{ type: "trend", title: "Own insight", content: "Own analysis", relatedOpportunityIndexes: [0, -1, 500], userId: userC }];
  const inserted = await replaceOwnedInsights(userD, generated, [ids[`idea-${userD}`]]);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].userId, userD);
  assert.deepEqual(inserted[0].relatedOpportunityIds, [String(ids[`idea-${userD}`])]);
  await assert.rejects(replaceOwnedInsights(userD, generated, [ids[`idea-${userC}`]]), /not found/i);
  const list = await request("/insights");
  assert.equal(list.status, 200);
  assert.deepEqual(rows(list.body).map(row => row.id), [inserted[0].id]);
  assert.equal(await snapshotLegacy(), legacyBefore);
  assert.equal(await snapshotForeign(), foreignBefore);
});

test("legacy inconsistent children block cascading deletion instead of being reassigned or exposed", async () => {
  assert.equal((await request(`/opportunities/${ids[`idea-${userD}`]}`, "DELETE")).status, 409);
  assert.equal((await request(`/roadmap/initiatives/${ids[`initiative-${userC}`]}`, "DELETE", undefined, userC)).status, 409);
  const roadmap = await request("/roadmap");
  assert.equal(roadmap.status, 200);
  assert.ok(!rows(object(roadmap.body).milestones).some(row => row.id === ids.badMilestone));
});

test("denied operations leave the other user's records unchanged", async () => {
  assert.equal(await snapshotForeign(), foreignBefore);
  assert.equal(await snapshotLegacy(), legacyBefore);
});
