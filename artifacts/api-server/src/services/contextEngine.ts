/**
 * Product Context Engine
 *
 * The intelligence backbone of PM Copilot Assist. Before any AI analysis is
 * executed, this service gathers every available piece of context related to a
 * Product Idea and returns a single, unified ProductContext object.
 *
 * Every future module (Prioritization, Validation, Roadmap, Documentation,
 * Analytics) must consume ProductContext rather than querying multiple services
 * independently.
 */

import { db } from "@workspace/db";
import {
  opportunitiesTable,
  meetingsTable,
  competitorsTable,
  signalsTable,
  feedbackTable,
  aiInsightsTable,
  ideaCommentsTable,
  ideaTimelineTable,
  ideaMeetingsTable,
  ideaCompetitorsTable,
  prioritizationScoresTable,
} from "@workspace/db";
import { eq, desc, and, ilike, or } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LinkedMeeting {
  id: number;
  title: string;
  meetingDate: Date;
  analyzed: boolean;
  transcript: string | null;
  extractedInsights: unknown | null;
  attendees: string[];
}

export interface LinkedCompetitor {
  id: number;
  name: string;
  website: string | null;
  threatLevel: string | null;
  latestAnalysis: string | null;
  lastAnalyzedAt: Date | null;
}

export interface RelatedSignal {
  id: number;
  content: string;
  sourceType: string;
  sourcePlatform: string | null;
  sourceUrl: string | null;
  sentiment: string | null;
  author: string | null;
  createdAt: Date;
}

export interface RelatedFeedback {
  id: number;
  stakeholderName: string;
  department: string;
  description: string;
  customerImpact: string | null;
  urgency: string | null;
}

export interface TimelineEvent {
  id: number;
  eventType: string;
  description: string;
  metadata: unknown | null;
  createdAt: Date;
}

export interface Comment {
  id: number;
  author: string;
  content: string;
  createdAt: Date;
}

export interface PrioritizationContext {
  framework: string;
  riceScore: number | null;
  iceScore: number | null;
  moscowCategory: string | null;
  kanoCategory: string | null;
  aiReasoning: string | null;
}

export interface EvidenceSummary {
  customerRequestCount: number;
  stakeholderMentions: number;
  meetingMentions: number;
  competitorReferences: number;
  socialMentions: number;
  exampleQuotes: string[];
  sourceLinks: string[];
  feedbackQuotes: string[];
}

export interface RelatedIdea {
  id: number;
  title: string;
  status: string;
  category: string | null;
  similarity: "high" | "medium";
}

export interface ProductContext {
  /** The core Product Idea */
  idea: typeof opportunitiesTable.$inferSelect;

  /** Meetings explicitly linked to this idea */
  linkedMeetings: LinkedMeeting[];

  /** Competitors explicitly linked to this idea */
  linkedCompetitors: LinkedCompetitor[];

  /** Raw customer/signal data referencing this idea */
  signals: RelatedSignal[];

  /** Stakeholder feedback referencing this idea */
  stakeholderFeedback: RelatedFeedback[];

  /** Aggregated evidence for AI decision-making */
  evidence: EvidenceSummary;

  /** Chronological audit trail */
  timeline: TimelineEvent[];

  /** PM notes and comments */
  comments: Comment[];

  /** Prioritization score history (latest first) */
  prioritization: PrioritizationContext | null;

  /** Related product ideas (by category or keywords) */
  relatedIdeas: RelatedIdea[];

  /** AI-generated insights that reference this idea */
  relatedInsights: Array<{ type: string; title: string; content: string; confidence: number | null }>;

  /** Computed health score */
  health: {
    score: number;
    grade: "A" | "B" | "C" | "D" | "F";
    dimensions: Record<string, number>;
  };

  /** When this context snapshot was assembled */
  assembledAt: Date;
}

// ─── Context Engine ────────────────────────────────────────────────────────────

/**
 * Gather the full Product Context for a given idea ID.
 * All DB queries run in parallel for minimum latency.
 *
 * @throws Error if the idea does not exist.
 */
export async function buildProductContext(ideaId: number): Promise<ProductContext> {
  // 1. Load the core idea first (fail fast if not found)
  const [idea] = await db
    .select()
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.id, ideaId));

  if (!idea) {
    throw new Error(`Product Idea ${ideaId} not found`);
  }

  // 2. Fan out all remaining queries in parallel
  const [
    ideaMeetingLinks,
    ideaCompetitorLinks,
    signals,
    feedback,
    timeline,
    comments,
    latestScore,
    allInsights,
  ] = await Promise.all([
    // Junction tables for linked entities
    db.select().from(ideaMeetingsTable).where(eq(ideaMeetingsTable.ideaId, ideaId)),
    db.select().from(ideaCompetitorsTable).where(eq(ideaCompetitorsTable.ideaId, ideaId)),

    // Customer signals referencing this idea
    db
      .select()
      .from(signalsTable)
      .where(eq(signalsTable.opportunityId, ideaId))
      .orderBy(desc(signalsTable.createdAt)),

    // Stakeholder feedback referencing this idea
    db
      .select()
      .from(feedbackTable)
      .where(eq(feedbackTable.opportunityId, ideaId))
      .orderBy(desc(feedbackTable.createdAt)),

    // Timeline events
    db
      .select()
      .from(ideaTimelineTable)
      .where(eq(ideaTimelineTable.ideaId, ideaId))
      .orderBy(desc(ideaTimelineTable.createdAt)),

    // Comments
    db
      .select()
      .from(ideaCommentsTable)
      .where(eq(ideaCommentsTable.ideaId, ideaId))
      .orderBy(desc(ideaCommentsTable.createdAt)),

    // Latest prioritization score
    db
      .select()
      .from(prioritizationScoresTable)
      .where(eq(prioritizationScoresTable.opportunityId, ideaId))
      .orderBy(desc(prioritizationScoresTable.createdAt))
      .limit(1),

    // All AI insights
    db.select().from(aiInsightsTable).orderBy(desc(aiInsightsTable.createdAt)),
  ]);

  // 3. Resolve linked meetings and competitors in parallel
  const meetingIds = ideaMeetingLinks.map((l) => l.meetingId);
  const competitorIds = ideaCompetitorLinks.map((l) => l.competitorId);

  const [linkedMeetingsRaw, linkedCompetitorsRaw, relatedIdeasRaw] = await Promise.all([
    meetingIds.length > 0
      ? db.select().from(meetingsTable).where(
          or(...meetingIds.map((id) => eq(meetingsTable.id, id)))!
        )
      : Promise.resolve([]),

    competitorIds.length > 0
      ? db.select().from(competitorsTable).where(
          or(...competitorIds.map((id) => eq(competitorsTable.id, id)))!
        )
      : Promise.resolve([]),

    // Related ideas — same category, or keyword overlap in title
    idea.category
      ? db
          .select({
            id: opportunitiesTable.id,
            title: opportunitiesTable.title,
            status: opportunitiesTable.status,
            category: opportunitiesTable.category,
          })
          .from(opportunitiesTable)
          .where(
            and(
              eq(opportunitiesTable.category, idea.category),
              // Exclude self
            )
          )
          .limit(6)
      : Promise.resolve([]),
  ]);

  // 4. Build evidence summary
  const evidence: EvidenceSummary = {
    customerRequestCount: signals.length,
    stakeholderMentions: feedback.length,
    meetingMentions: linkedMeetingsRaw.length,
    competitorReferences: linkedCompetitorsRaw.length,
    socialMentions: signals.filter((s) => s.sourceType === "social_media").length,
    exampleQuotes: signals
      .filter((s) => s.content)
      .slice(0, 3)
      .map((s) => s.content.substring(0, 200)),
    sourceLinks: signals.filter((s) => s.sourceUrl).map((s) => s.sourceUrl!),
    feedbackQuotes: feedback
      .slice(0, 3)
      .map((f) => `[${f.stakeholderName}, ${f.department}]: ${f.description.substring(0, 150)}`),
  };

  // 5. Compute health score from 6 dimensions
  const health = computeHealthScore(idea, evidence, linkedMeetingsRaw.length, linkedCompetitorsRaw.length);

  // 6. Filter AI insights that reference this idea
  const relatedInsights = allInsights
    .filter((i) => i.relatedOpportunityIds.includes(String(ideaId)))
    .map((i) => ({
      type: i.type,
      title: i.title,
      content: i.content,
      confidence: i.confidence,
    }));

  // 7. Shape related ideas (exclude self)
  const relatedIdeas: RelatedIdea[] = relatedIdeasRaw
    .filter((r) => r.id !== ideaId)
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      category: r.category,
      similarity: "medium" as const,
    }));

  // 8. Prioritization context
  const score = latestScore[0] ?? null;
  const prioritization: PrioritizationContext | null = score
    ? {
        framework: score.framework,
        riceScore: score.riceScore,
        iceScore: score.iceScore,
        moscowCategory: score.moscowCategory,
        kanoCategory: score.kanoCategory,
        aiReasoning: score.aiReasoning,
      }
    : null;

  return {
    idea,
    linkedMeetings: linkedMeetingsRaw.map((m) => ({
      id: m.id,
      title: m.title,
      meetingDate: m.meetingDate,
      analyzed: m.analyzed,
      transcript: m.transcript,
      extractedInsights: m.extractedInsights,
      attendees: m.attendees,
    })),
    linkedCompetitors: linkedCompetitorsRaw.map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website,
      threatLevel: c.threatLevel,
      latestAnalysis: c.latestAnalysis,
      lastAnalyzedAt: c.lastAnalyzedAt,
    })),
    signals: signals.map((s) => ({
      id: s.id,
      content: s.content,
      sourceType: s.sourceType,
      sourcePlatform: s.sourcePlatform,
      sourceUrl: s.sourceUrl,
      sentiment: s.sentiment,
      author: s.author,
      createdAt: s.createdAt,
    })),
    stakeholderFeedback: feedback.map((f) => ({
      id: f.id,
      stakeholderName: f.stakeholderName,
      department: f.department,
      description: f.description,
      customerImpact: f.customerImpact,
      urgency: f.urgency,
    })),
    evidence,
    timeline: timeline.map((t) => ({
      id: t.id,
      eventType: t.eventType,
      description: t.description,
      metadata: t.metadata,
      createdAt: t.createdAt,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      author: c.author,
      content: c.content,
      createdAt: c.createdAt,
    })),
    prioritization,
    relatedIdeas,
    relatedInsights,
    health,
    assembledAt: new Date(),
  };
}

// ─── Health Score ──────────────────────────────────────────────────────────────

function computeHealthScore(
  idea: typeof opportunitiesTable.$inferSelect,
  evidence: EvidenceSummary,
  meetingCount: number,
  competitorCount: number,
): ProductContext["health"] {
  const dimensions: Record<string, number> = {
    customerDemand: Math.min(25, evidence.customerRequestCount * 5 + evidence.socialMentions * 2),
    stakeholderSupport: Math.min(20, evidence.stakeholderMentions * 7),
    meetingEvidence: Math.min(15, meetingCount * 5),
    competitorContext: Math.min(15, competitorCount * 5),
    aiConfidence: Math.min(15, (idea.confidenceScore ?? 0) * 15),
    sourceDiversity: Math.min(10, (evidence.sourceLinks.length > 0 ? 5 : 0) + (idea.sourceType !== "manual" ? 3 : 0) + 2),
  };

  const score = Math.round(Object.values(dimensions).reduce((a, b) => a + b, 0));
  const grade: "A" | "B" | "C" | "D" | "F" =
    score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 30 ? "D" : "F";

  return { score, grade, dimensions };
}

/**
 * Build a concise context string suitable for injecting into an AI prompt.
 * Trims content to stay within reasonable token budgets.
 */
export function formatContextForPrompt(ctx: ProductContext): string {
  const parts: string[] = [];

  parts.push(`=== PRODUCT IDEA ===`);
  parts.push(`Title: ${ctx.idea.title}`);
  parts.push(`Description: ${ctx.idea.description}`);
  if (ctx.idea.customerProblem) parts.push(`Customer Problem: ${ctx.idea.customerProblem}`);
  if (ctx.idea.suggestedSolution) parts.push(`Suggested Solution: ${ctx.idea.suggestedSolution}`);
  if (ctx.idea.businessValue) parts.push(`Business Value: ${ctx.idea.businessValue}`);
  parts.push(`Status: ${ctx.idea.status} | Urgency: ${ctx.idea.urgency ?? "unknown"} | Category: ${ctx.idea.category ?? "uncategorized"}`);
  parts.push(`Health Score: ${ctx.health.score}/100 (${ctx.health.grade})`);

  if (ctx.linkedMeetings.length > 0) {
    parts.push(`\n=== LINKED MEETINGS (${ctx.linkedMeetings.length}) ===`);
    ctx.linkedMeetings.slice(0, 3).forEach((m) => {
      parts.push(`• ${m.title} (${m.meetingDate.toISOString().split("T")[0]})`);
      if (m.transcript) {
        parts.push(`  Transcript excerpt: ${m.transcript.substring(0, 300)}...`);
      }
    });
  }

  if (ctx.linkedCompetitors.length > 0) {
    parts.push(`\n=== COMPETITOR CONTEXT (${ctx.linkedCompetitors.length}) ===`);
    ctx.linkedCompetitors.forEach((c) => {
      parts.push(`• ${c.name} — threat: ${c.threatLevel ?? "unknown"}`);
      if (c.latestAnalysis) parts.push(`  Analysis: ${c.latestAnalysis.substring(0, 200)}...`);
    });
  }

  if (ctx.evidence.exampleQuotes.length > 0) {
    parts.push(`\n=== CUSTOMER QUOTES ===`);
    ctx.evidence.exampleQuotes.forEach((q) => parts.push(`• "${q}"`));
  }

  if (ctx.evidence.feedbackQuotes.length > 0) {
    parts.push(`\n=== STAKEHOLDER FEEDBACK ===`);
    ctx.evidence.feedbackQuotes.forEach((q) => parts.push(`• ${q}`));
  }

  if (ctx.relatedIdeas.length > 0) {
    parts.push(`\n=== RELATED PRODUCT IDEAS ===`);
    ctx.relatedIdeas.forEach((r) => parts.push(`• [${r.id}] ${r.title} (${r.status})`));
  }

  if (ctx.relatedInsights.length > 0) {
    parts.push(`\n=== AI INSIGHTS ===`);
    ctx.relatedInsights.slice(0, 3).forEach((i) => parts.push(`• [${i.type}] ${i.title}: ${i.content.substring(0, 200)}`));
  }

  return parts.join("\n");
}
