import type { ProductContext } from "./contextEngine";
import { getDocumentationDefinition } from "./documentationCatalog";

export type DocumentationAiContext = {
  productIdeaId: number;
  documentType: string;
  requiredSections: string[];
  productIdea: {
    title: string;
    description: string;
    category: string | null;
    sourceType: string;
    status: string;
    problemStatement: string | null;
    rootCause: string | null;
    customerProblem: string | null;
    suggestedSolution: string | null;
    businessValue: string | null;
    customerValue: string | null;
    estimatedCustomerImpact: string | null;
    estimatedBusinessImpact: string | null;
    dependencies: string | null;
    openQuestions: string[];
    aiSummary: string | null;
    aiRecommendation: string | null;
  };
  evidenceSummary: {
    signalsCount: number;
    stakeholderFeedbackCount: number;
    linkedMeetingsCount: number;
    linkedCompetitorsCount: number;
  };
};

/**
 * Create the deliberately small representation that is both shown to the PM
 * and sent to the documentation model. Do not add raw ProductContext fields
 * here: this is the provider data-minimization boundary.
 */
export function buildDocumentationAiContext(
  context: ProductContext,
  documentType: string,
): DocumentationAiContext {
  const definition = getDocumentationDefinition(documentType);
  if (!definition) throw new Error("Unsupported document type");

  return {
    productIdeaId: context.idea.id,
    documentType: definition.type,
    requiredSections: [...definition.requiredSections],
    productIdea: {
      title: context.idea.title,
      description: context.idea.description,
      category: context.idea.category,
      sourceType: context.idea.sourceType,
      status: context.idea.status,
      problemStatement: context.idea.problemStatement,
      rootCause: context.idea.rootCause,
      customerProblem: context.idea.customerProblem,
      suggestedSolution: context.idea.suggestedSolution,
      businessValue: context.idea.businessValue,
      customerValue: context.idea.customerValue,
      estimatedCustomerImpact: context.idea.estimatedCustomerImpact,
      estimatedBusinessImpact: context.idea.estimatedBusinessImpact,
      dependencies: context.idea.dependencies,
      openQuestions: [...(context.idea.openQuestions ?? [])],
      aiSummary: context.idea.aiSummary,
      aiRecommendation: context.idea.aiRecommendation,
    },
    evidenceSummary: {
      signalsCount: context.signals.length,
      stakeholderFeedbackCount: context.stakeholderFeedback.length,
      linkedMeetingsCount: context.linkedMeetings.length,
      linkedCompetitorsCount: context.linkedCompetitors.length,
    },
  };
}