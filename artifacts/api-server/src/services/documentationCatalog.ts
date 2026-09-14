import type { DocumentType } from "@workspace/db";

export type DocumentationDefinition = {
  type: DocumentType;
  purpose: string;
  requiredSections: string[];
  generationInstructions: string;
};

const definitions: Record<DocumentType, DocumentationDefinition> = {
  mrd: { type: "mrd", purpose: "Describe the market and customer opportunity.", requiredSections: ["Market Overview", "Target Market", "Customer Needs", "Competitive Context", "Opportunity", "Open Questions"], generationInstructions: "Focus on market facts present in the supplied context; do not invent market size or competitors." },
  brd: { type: "brd", purpose: "Connect business objectives to business requirements.", requiredSections: ["Business Context", "Objectives", "Expected Outcomes", "Business Requirements", "Constraints", "Risks"], generationInstructions: "Keep business requirements outcome-oriented and grounded in the supplied product facts." },
  business_case: { type: "business_case", purpose: "Explain why an initiative should be pursued.", requiredSections: ["Executive Summary", "Problem", "Opportunity", "Expected Benefits", "Costs and Constraints", "Risks", "Recommendation"], generationInstructions: "Separate known benefits from assumptions and label missing financial information." },
  use_case: { type: "use_case", purpose: "Describe an actor interaction that achieves a goal.", requiredSections: ["Use Case Overview", "Actors", "Preconditions", "Main Flow", "Alternative Flows", "Exceptions", "Postconditions"], generationInstructions: "Describe only flows supported by the product context and label unresolved behavior." },
  prd: {
    type: "prd",
    purpose: "Define the product problem, solution, scope, requirements, and measures of success.",
    requiredSections: ["Document Overview", "Problem Statement", "Product Opportunity", "Goals", "Non-Goals", "Target Users", "User Needs", "Proposed Solution", "Functional Requirements", "User Experience Considerations", "Success Metrics", "Dependencies", "Risks", "Open Questions"],
    generationInstructions: "Create a complete, reviewable PRD. Do not turn assumptions into facts; label unknowns and proposed metrics for PM review.",
  },
  initiative: { type: "initiative", purpose: "Define a strategic body of work and its outcome.", requiredSections: ["Initiative Overview", "Outcome", "Scope", "Success Measures", "Dependencies", "Risks"], generationInstructions: "Keep scope at strategic level and avoid inventing dates or commitments." },
  epic: { type: "epic", purpose: "Define a substantial deliverable that can be split into stories.", requiredSections: ["Epic Summary", "User Value", "Scope", "Requirements", "Acceptance Approach", "Dependencies", "Risks"], generationInstructions: "Use concise, delivery-ready requirements grounded in the context." },
  user_story: { type: "user_story", purpose: "Describe a user need or capability.", requiredSections: ["Story", "Context", "User Value", "Acceptance Criteria", "Dependencies", "Open Questions"], generationInstructions: "Use a clear As a/I want/So that story only when the user is supported by context." },
  acceptance_criteria: { type: "acceptance_criteria", purpose: "Define conditions for accepting a story.", requiredSections: ["Scope", "Acceptance Criteria", "Edge Cases", "Out of Scope", "Open Questions"], generationInstructions: "Make criteria observable and testable without adding unsupported behavior." },
  definition_of_ready: { type: "definition_of_ready", purpose: "Define conditions needed before work starts.", requiredSections: ["Purpose", "Required Product Clarity", "Required Design Clarity", "Required Technical Clarity", "Readiness Checklist", "Exceptions"], generationInstructions: "Provide a practical checklist and distinguish universal gates from context-specific items." },
  definition_of_done: { type: "definition_of_done", purpose: "Define the shared completion quality bar.", requiredSections: ["Purpose", "Implementation", "Quality", "Documentation", "Release Readiness", "Done Checklist"], generationInstructions: "Avoid claiming a team process exists; present proposed criteria for review." },
  functional_requirements: { type: "functional_requirements", purpose: "Describe what the product or system must do.", requiredSections: ["Overview", "Actors", "Functional Requirements", "Business Rules", "Error Handling", "Open Questions"], generationInstructions: "Write numbered, testable requirements and label details that are not in context." },
  nonfunctional_requirements: { type: "nonfunctional_requirements", purpose: "Describe quality attributes and constraints.", requiredSections: ["Overview", "Performance", "Security and Privacy", "Reliability", "Scalability", "Accessibility and Usability", "Open Questions"], generationInstructions: "Do not invent numeric service levels; mark targets as PM input required when absent." },
  technical_requirements: { type: "technical_requirements", purpose: "Capture technical considerations and constraints.", requiredSections: ["Technical Context", "Architecture Considerations", "Integrations", "Data", "Security", "Operations", "Open Questions"], generationInstructions: "Use only technical facts supplied in context and clearly label proposals." },
  release_notes: { type: "release_notes", purpose: "Communicate product changes in a release.", requiredSections: ["Release Summary", "New Capabilities", "Improvements", "Fixes", "Known Limitations", "Action Required"], generationInstructions: "Never claim a release occurred when no release facts were supplied; present a draft and label missing details." },
  stakeholder_updates: { type: "stakeholder_updates", purpose: "Keep stakeholders aligned on progress and decisions.", requiredSections: ["Summary", "Progress", "Decisions", "Risks and Issues", "Upcoming Work", "Asks and Open Questions"], generationInstructions: "Do not invent milestones, decisions, or progress; label missing information." },
};

export function getDocumentationDefinition(type: string): DocumentationDefinition | undefined {
  return definitions[type as DocumentType];
}

export const documentationCatalog = Object.freeze(definitions);