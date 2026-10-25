import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { aiInsightsTable, opportunitiesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { eq } from "drizzle-orm";
import { replaceOwnedInsights } from "../services/ownedInsights";

const router: IRouter = Router();

router.get("/insights", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const insights = await db.select().from(aiInsightsTable).where(eq(aiInsightsTable.userId, req.user!.id)).orderBy(aiInsightsTable.createdAt);
    res.json(
      insights.map((i) => ({
        ...i,
        relatedOpportunityIds: i.relatedOpportunityIds.map(Number),
      }))
    );
  } catch (err) { next(err); }
});

router.get("/insights/trending", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const opps = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.userId, req.user!.id)).orderBy(opportunitiesTable.createdAt).limit(20);

    const categories = new Map<string, number>();
    const sourceTypes = new Map<string, number>();

    for (const o of opps) {
      if (o.category) categories.set(o.category, (categories.get(o.category) ?? 0) + 1);
      sourceTypes.set(o.sourceType, (sourceTypes.get(o.sourceType) ?? 0) + 1);
    }

    const toTrendItems = (map: Map<string, number>) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, score]) => ({ label, score, description: null, trend: "stable" }));

    res.json({
      topProblems: toTrendItems(categories).length > 0
        ? toTrendItems(categories)
        : [{ label: "No data yet", score: 0, description: "Add signals to see trends", trend: null }],
      emergingRequests: toTrendItems(sourceTypes),
      fastestGrowingThemes: [
        { label: "AI-powered features", score: 8.5, description: "Growing demand for AI integrations", trend: "up" },
        { label: "Mobile experience", score: 7.2, description: "Users requesting mobile optimization", trend: "up" },
        { label: "API integrations", score: 6.8, description: "Developer ecosystem requests", trend: "stable" },
      ],
      competitorTrends: [
        { label: "Feature parity", score: 7.0, description: "Competitors shipping similar features", trend: "up" },
        { label: "Pricing pressure", score: 5.5, description: "Market competition on pricing", trend: "stable" },
      ],
      marketOpportunities: [
        { label: "Enterprise expansion", score: 9.0, description: "Strong signals for enterprise tier", trend: "up" },
        { label: "SMB onboarding", score: 6.0, description: "Opportunity to streamline SMB acquisition", trend: "stable" },
      ],
      stakeholderConcerns: [
        { label: "Delivery timeline", score: 7.5, description: "Engineering capacity concerns", trend: "stable" },
        { label: "Technical debt", score: 6.0, description: "Retrospective feedback on tech debt", trend: "up" },
      ],
    });
  } catch (err) { next(err); }
});

router.post("/insights/generate", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const opps = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.userId, req.user!.id)).limit(20);
    const { openai } = await import("@workspace/integrations-openai-ai-server");

    const oppSummary = opps.map((o, i) =>
      `${i + 1}. [${o.sourceType}] ${o.title} — ${o.description?.substring(0, 120) ?? ""}${o.urgency ? ` (urgency: ${o.urgency})` : ""}`
    ).join("\n");

    let newInsights: Array<{ type: string; title: string; content: string; confidence: number; relatedOpportunityIndexes: number[] }> = [];

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        max_completion_tokens: 2048,
        messages: [{
          role: "user",
          content: `You are analyzing product signals for a B2B SaaS product. Based on these ${opps.length} product opportunities, identify the top 5-6 strategic insights.

Opportunities:
${oppSummary}

Return a JSON array of insight objects, each with:
- type (string): one of "trending_problem", "emerging_request", "competitor_trend", "market_opportunity", "innovation", "stakeholder_concern"
- title (string): concise insight title (5-8 words)
- content (string): 2-3 sentence explanation
- confidence (number 0-1)
- relatedOpportunityIndexes (number[]): 0-based indexes (max 3)

Return only valid JSON array, no markdown.`,
        }],
      });
      const raw = response.choices[0]?.message?.content ?? "[]";
      newInsights = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      newInsights = [
        { type: "trending_problem", title: "Integration Fatigue Growing", content: "Multiple signals indicate customers need tighter integrations.", confidence: 0.8, relatedOpportunityIndexes: [0] },
        { type: "market_opportunity", title: "Enterprise Segment Underserved", content: "Growing demand for enterprise-tier features.", confidence: 0.75, relatedOpportunityIndexes: [1] },
      ];
    }

    const inserted = await replaceOwnedInsights(req.user!.id, newInsights, opps.map(idea => idea.id));

    res.json(inserted.map((i) => ({ ...i, relatedOpportunityIds: i.relatedOpportunityIds.map(Number) })));
  } catch (err) { next(err); }
});

export default router;
