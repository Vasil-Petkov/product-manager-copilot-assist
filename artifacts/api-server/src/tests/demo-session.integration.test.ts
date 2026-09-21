import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { test } from "node:test";
import { count, eq } from "drizzle-orm";
import {
  aiInsightsTable,
  competitorReportsTable,
  competitorsTable,
  conversations,
  db,
  documentsTable,
  feedbackTable,
  ideaCommentsTable,
  ideaCompetitorsTable,
  ideaMeetingsTable,
  ideaTimelineTable,
  messages,
  meetingsTable,
  opportunitiesTable,
  prioritizationAnalysisTable,
  prioritizationScoresTable,
  roadmapInitiativesTable,
  roadmapItemsTable,
  roadmapMilestonesTable,
  sessionsTable,
  signalsTable,
  validationExperiments,
  validationHypotheses,
} from "@workspace/db";
import app from "../app.ts";

type RequestOptions = {
  method?: string;
  cookie?: string;
};

type Response = {
  status: number;
  body: string;
  cookies: string[];
};

const protectedRoutes: Array<{ method: string; path: string }> = [
  { method: "GET", path: "/api/opportunities" },
  { method: "POST", path: "/api/opportunities" },
  { method: "GET", path: "/api/opportunities/1" },
  { method: "PATCH", path: "/api/opportunities/1" },
  { method: "DELETE", path: "/api/opportunities/1" },
  { method: "POST", path: "/api/opportunities/1/analyze" },

  { method: "GET", path: "/api/product-ideas/1/workspace" },
  { method: "GET", path: "/api/product-ideas/1/comments" },
  { method: "POST", path: "/api/product-ideas/1/comments" },
  { method: "DELETE", path: "/api/product-ideas/1/comments/1" },
  { method: "GET", path: "/api/product-ideas/1/timeline" },
  { method: "GET", path: "/api/product-ideas/1/health" },
  { method: "POST", path: "/api/product-ideas/1/link-meeting/1" },
  { method: "DELETE", path: "/api/product-ideas/1/link-meeting/1" },
  { method: "POST", path: "/api/product-ideas/1/link-competitor/1" },
  { method: "DELETE", path: "/api/product-ideas/1/link-competitor/1" },
  { method: "GET", path: "/api/product-ideas/similarity/summary" },
  { method: "POST", path: "/api/product-ideas/1/similarity" },
  { method: "POST", path: "/api/product-ideas/similarity/compare" },
  { method: "POST", path: "/api/product-ideas/merge" },
  { method: "GET", path: "/api/product-ideas/search?q=demo" },

  { method: "GET", path: "/api/signals" },
  { method: "POST", path: "/api/signals" },
  { method: "DELETE", path: "/api/signals/1" },
  { method: "POST", path: "/api/signals/bulk" },

  { method: "GET", path: "/api/feedback" },
  { method: "POST", path: "/api/feedback" },
  { method: "GET", path: "/api/feedback/1" },
  { method: "PATCH", path: "/api/feedback/1" },
  { method: "DELETE", path: "/api/feedback/1" },

  { method: "GET", path: "/api/competitors" },
  { method: "POST", path: "/api/competitors" },
  { method: "GET", path: "/api/competitors/1" },
  { method: "PATCH", path: "/api/competitors/1" },
  { method: "DELETE", path: "/api/competitors/1" },
  { method: "POST", path: "/api/competitors/1/analyze" },
  { method: "GET", path: "/api/competitors/1/reports" },

  { method: "GET", path: "/api/meetings" },
  { method: "POST", path: "/api/meetings" },
  { method: "GET", path: "/api/meetings/1" },
  { method: "PATCH", path: "/api/meetings/1" },
  { method: "DELETE", path: "/api/meetings/1" },
  { method: "POST", path: "/api/meetings/1/analyze" },

  { method: "GET", path: "/api/insights" },
  { method: "GET", path: "/api/insights/trending" },
  { method: "POST", path: "/api/insights/generate" },

  { method: "GET", path: "/api/prioritization" },
  { method: "POST", path: "/api/prioritization/score" },
  { method: "PATCH", path: "/api/prioritization/1" },
  { method: "POST", path: "/api/prioritization/ai-recommend" },
  { method: "POST", path: "/api/prioritization/analyze/1" },
  { method: "GET", path: "/api/prioritization/executive-recommendation" },
  { method: "POST", path: "/api/prioritization/compare" },

  { method: "GET", path: "/api/validation/summary" },
  { method: "GET", path: "/api/validation/methods" },
  { method: "GET", path: "/api/validation/product-ideas" },
  { method: "GET", path: "/api/validation/hypotheses" },
  { method: "POST", path: "/api/validation/hypotheses" },
  { method: "POST", path: "/api/validation/hypotheses/improve" },
  { method: "GET", path: "/api/validation/hypotheses/1" },
  { method: "PATCH", path: "/api/validation/hypotheses/1" },
  { method: "POST", path: "/api/validation/hypotheses/1/duplicate" },
  { method: "POST", path: "/api/validation/hypotheses/1/archive" },
  { method: "GET", path: "/api/validation/experiments" },
  { method: "POST", path: "/api/validation/experiments" },
  { method: "GET", path: "/api/validation/experiments/1" },
  { method: "PATCH", path: "/api/validation/experiments/1" },
  { method: "POST", path: "/api/validation/experiments/assist" },
  { method: "POST", path: "/api/validation/experiments/1/analyze-result" },
  { method: "POST", path: "/api/validation/experiments/1/archive" },

  { method: "GET", path: "/api/roadmap" },
  { method: "POST", path: "/api/roadmap/initiatives" },
  { method: "PATCH", path: "/api/roadmap/initiatives/1" },
  { method: "DELETE", path: "/api/roadmap/initiatives/1" },
  { method: "POST", path: "/api/roadmap/items" },
  { method: "PATCH", path: "/api/roadmap/items/1" },
  { method: "DELETE", path: "/api/roadmap/items/1" },
  { method: "POST", path: "/api/roadmap/milestones" },
  { method: "PATCH", path: "/api/roadmap/milestones/1" },
  { method: "DELETE", path: "/api/roadmap/milestones/1" },
  { method: "POST", path: "/api/roadmap/proposal" },

  { method: "GET", path: "/api/documents" },
  { method: "POST", path: "/api/documents/generate" },
  { method: "GET", path: "/api/documents/1" },
  { method: "GET", path: "/api/documents/context/1/prd" },
  { method: "PATCH", path: "/api/documents/1" },
  { method: "POST", path: "/api/documents/1/regenerate" },
  { method: "POST", path: "/api/documents/1/accept" },

  { method: "GET", path: "/api/openai/conversations" },
  { method: "POST", path: "/api/openai/conversations" },
  { method: "GET", path: "/api/openai/conversations/1" },
  { method: "DELETE", path: "/api/openai/conversations/1" },
  { method: "GET", path: "/api/openai/conversations/1/messages" },
  { method: "POST", path: "/api/openai/conversations/1/messages" },
];

async function request(
  server: http.Server,
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: address.port,
        path,
        method: options.method ?? "GET",
        headers: options.cookie ? { cookie: options.cookie } : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            cookies: res.headers["set-cookie"] ?? [],
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function startServer(): Promise<http.Server> {
  const server = http.createServer(app).listen(0);
  await once(server, "listening");
  return server;
}

async function createDemoCookie(server: http.Server): Promise<string> {
  const created = await request(server, "/api/demo/session", { method: "POST" });
  assert.equal(created.status, 201);
  const cookie = created.cookies[0]?.split(";", 1)[0];
  assert.ok(cookie);
  return cookie;
}

async function captureBusinessCounts() {
  const [
    opportunities,
    signals,
    feedback,
    competitors,
    competitorReports,
    meetings,
    insights,
    prioritizationScores,
    prioritizationAnalysis,
    hypotheses,
    experiments,
    roadmapInitiatives,
    roadmapItems,
    roadmapMilestones,
    conversationsRows,
    messagesRows,
    comments,
    timeline,
    ideaMeetings,
    ideaCompetitors,
    documents,
  ] = await Promise.all([
    db.select({ total: count() }).from(opportunitiesTable),
    db.select({ total: count() }).from(signalsTable),
    db.select({ total: count() }).from(feedbackTable),
    db.select({ total: count() }).from(competitorsTable),
    db.select({ total: count() }).from(competitorReportsTable),
    db.select({ total: count() }).from(meetingsTable),
    db.select({ total: count() }).from(aiInsightsTable),
    db.select({ total: count() }).from(prioritizationScoresTable),
    db.select({ total: count() }).from(prioritizationAnalysisTable),
    db.select({ total: count() }).from(validationHypotheses),
    db.select({ total: count() }).from(validationExperiments),
    db.select({ total: count() }).from(roadmapInitiativesTable),
    db.select({ total: count() }).from(roadmapItemsTable),
    db.select({ total: count() }).from(roadmapMilestonesTable),
    db.select({ total: count() }).from(conversations),
    db.select({ total: count() }).from(messages),
    db.select({ total: count() }).from(ideaCommentsTable),
    db.select({ total: count() }).from(ideaTimelineTable),
    db.select({ total: count() }).from(ideaMeetingsTable),
    db.select({ total: count() }).from(ideaCompetitorsTable),
    db.select({ total: count() }).from(documentsTable),
  ]);

  return {
    opportunities: Number(opportunities[0]?.total ?? 0),
    signals: Number(signals[0]?.total ?? 0),
    feedback: Number(feedback[0]?.total ?? 0),
    competitors: Number(competitors[0]?.total ?? 0),
    competitorReports: Number(competitorReports[0]?.total ?? 0),
    meetings: Number(meetings[0]?.total ?? 0),
    insights: Number(insights[0]?.total ?? 0),
    prioritizationScores: Number(prioritizationScores[0]?.total ?? 0),
    prioritizationAnalysis: Number(prioritizationAnalysis[0]?.total ?? 0),
    hypotheses: Number(hypotheses[0]?.total ?? 0),
    experiments: Number(experiments[0]?.total ?? 0),
    roadmapInitiatives: Number(roadmapInitiatives[0]?.total ?? 0),
    roadmapItems: Number(roadmapItems[0]?.total ?? 0),
    roadmapMilestones: Number(roadmapMilestones[0]?.total ?? 0),
    conversations: Number(conversationsRows[0]?.total ?? 0),
    messages: Number(messagesRows[0]?.total ?? 0),
    comments: Number(comments[0]?.total ?? 0),
    timeline: Number(timeline[0]?.total ?? 0),
    ideaMeetings: Number(ideaMeetings[0]?.total ?? 0),
    ideaCompetitors: Number(ideaCompetitors[0]?.total ?? 0),
    documents: Number(documents[0]?.total ?? 0),
  };
}

test(
  "a valid Demo Session is rejected by every protected application route",
  async (t) => {
    const server = await startServer();
    const authSessionId = `demo-route-matrix-${process.pid}-${Date.now()}`;
    const authUser = {
      id: `demo-route-matrix-user-${process.pid}-${Date.now()}`,
      email: "demo-route-matrix@example.invalid",
      firstName: "Demo",
      lastName: "Matrix",
      profileImageUrl: null,
    };

    await db.insert(sessionsTable).values({
      sid: authSessionId,
      sess: { user: authUser, access_token: "integration-test" },
      expire: new Date(Date.now() + 60 * 60 * 1000),
    });

    t.after(async () => {
      await db
        .delete(sessionsTable)
        .where(eq(sessionsTable.sid, authSessionId));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const demoCookie = await createDemoCookie(server);
    for (const route of protectedRoutes) {
      const response = await request(server, route.path, {
        method: route.method,
        cookie: demoCookie,
      });
      assert.equal(
        response.status,
        403,
        `${route.method} ${route.path} must reject a Demo Session`,
      );
    }

    const combinedCookie = `${demoCookie}; sid=${authSessionId}`;
    for (const route of protectedRoutes) {
      const response = await request(server, route.path, {
        method: route.method,
        cookie: combinedCookie,
      });
      assert.equal(
        response.status,
        403,
        `${route.method} ${route.path} must reject Demo + authenticated sessions`,
      );
    }
  },
);

test(
  "Demo Session lifecycle does not modify PostgreSQL business data",
  async (t) => {
    const server = await startServer();
    t.after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const before = await captureBusinessCounts();
    const demoCookie = await createDemoCookie(server);

    const active = await request(server, "/api/demo/session", {
      cookie: demoCookie,
    });
    assert.equal(active.status, 200);
    assert.deepEqual(JSON.parse(active.body), { active: true });

    const blocked = await request(server, "/api/opportunities", {
      cookie: demoCookie,
    });
    assert.equal(blocked.status, 403);

    const exited = await request(server, "/api/demo/session/exit", {
      method: "POST",
      cookie: demoCookie,
    });
    assert.equal(exited.status, 200);

    const after = await captureBusinessCounts();
    assert.deepEqual(after, before);
  },
);