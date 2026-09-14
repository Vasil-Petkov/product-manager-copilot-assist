import { BookOpen, BriefcaseBusiness, FileText, ListChecks, Megaphone, Sparkles, FileEdit, Clock, CheckCircle2, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentType, useListDocuments, useListOpportunities, Document } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";

type DocumentationItem = {
  name: string;
  what: string;
  why: string;
  type: DocumentType;
};

type DocumentationGroup = {
  title: string;
  description: string;
  icon: typeof BriefcaseBusiness;
  items: DocumentationItem[];
};

const GROUPS: DocumentationGroup[] = [
  {
    title: "Business & Strategy",
    description: "Frame the market opportunity, business objectives, and strategic rationale behind product work.",
    icon: BriefcaseBusiness,
    items: [
      {
        name: "MRD — Market Requirements Document",
        what: "Defines the market, target customers, market needs, and the opportunity the product or initiative addresses.",
        why: "Helps align the product direction with real market and customer needs.",
        type: "mrd"
      },
      {
        name: "BRD — Business Requirements Document",
        what: "Defines the business needs, objectives, expected outcomes, and business requirements behind a product or initiative.",
        why: "Connects the product work to clear business objectives and expected outcomes.",
        type: "brd"
      },
      {
        name: "Business Case",
        what: "Explains why an initiative should be pursued, including its expected value, benefits, costs, and rationale.",
        why: "Helps stakeholders make an informed investment decision.",
        type: "business_case"
      },
      {
        name: "Use Case",
        what: "Describes how a user or other actor interacts with the product to achieve a specific goal.",
        why: "Clarifies the expected user interaction and behavior.",
        type: "use_case"
      },
    ],
  },
  {
    title: "Product Definition",
    description: "Connect validated customer needs and product strategy to a clear definition of what should be built.",
    icon: FileText,
    items: [
      {
        name: "PRD — Product Requirements Document",
        what: "A comprehensive product requirements document that connects the customer problem, validated evidence, product solution, scope, requirements, and success criteria.",
        why: "Creates a shared product definition that connects strategy and discovery with delivery.",
        type: "prd"
      },
    ],
  },
  {
    title: "Requirements & Delivery",
    description: "Turn strategic intent into clear, actionable guidance for product and delivery teams.",
    icon: ListChecks,
    items: [
      {
        name: "Initiative",
        what: "A larger strategic body of work connected to a meaningful product or business outcome.",
        why: "Provides a strategic container for related epics and work.",
        type: "initiative"
      },
      {
        name: "Epic",
        what: "A substantial piece of product functionality or work that can be broken into smaller user stories.",
        why: "Helps organize and manage large areas of functionality.",
        type: "epic"
      },
      {
        name: "User Story",
        what: "A concise description of a user need or capability that the product should provide.",
        why: "Translates product requirements into actionable user-focused work.",
        type: "user_story"
      },
      {
        name: "Acceptance Criteria",
        what: "The specific conditions that must be satisfied for a user story to be accepted.",
        why: "Creates a shared understanding of what successful delivery means.",
        type: "acceptance_criteria"
      },
      {
        name: "Definition of Ready",
        what: "A set of conditions indicating that work is sufficiently understood and prepared to begin.",
        why: "Helps teams avoid starting work that is unclear or incomplete.",
        type: "definition_of_ready"
      },
      {
        name: "Definition of Done",
        what: "A shared set of criteria that must be satisfied before work is considered complete.",
        why: "Creates a consistent quality bar for completed work.",
        type: "definition_of_done"
      },
      {
        name: "Functional Requirements",
        what: "Describes what the product or system must do and the capabilities it must provide.",
        why: "Turns product needs into clear, testable functional expectations.",
        type: "functional_requirements"
      },
      {
        name: "Non-functional Requirements",
        what: "Describes qualities and constraints such as performance, security, reliability, scalability, and usability.",
        why: "Ensures the product meets important quality and operational expectations in addition to functional needs.",
        type: "nonfunctional_requirements"
      },
      {
        name: "Technical Requirements",
        what: "Defines the technical considerations, constraints, integrations, dependencies, security, performance, and other technical expectations for the product or feature.",
        why: "Gives engineering and technical stakeholders the context needed to understand implementation requirements and constraints.",
        type: "technical_requirements"
      },
    ],
  },
  {
    title: "Release & Communication",
    description: "Prepare clear product updates and release communication for customers, stakeholders, and internal teams.",
    icon: Megaphone,
    items: [
      {
        name: "Release Notes",
        what: "Summarizes what changed in a product release, including new capabilities, improvements, fixes, and relevant customer-facing information.",
        why: "Communicates product changes clearly to customers, stakeholders, and internal teams.",
        type: "release_notes"
      },
      {
        name: "Stakeholder Updates",
        what: "Provides concise updates on product progress, decisions, risks, milestones, and upcoming work for relevant stakeholders.",
        why: "Keeps stakeholders aligned without requiring the Product Manager to repeatedly prepare the same information manually.",
        type: "stakeholder_updates"
      },
    ],
  },
  {
    title: "AI Documentation Intelligence",
    description: "Future AI-assisted capabilities to help Product Managers improve documentation quality and completeness.",
    icon: Sparkles,
    items: [
      {
        name: "AI Documentation Reviewer",
        what: "Reviews product documentation for clarity, completeness, consistency, and potential issues.",
        why: "Helps Product Managers improve documentation quality before sharing it with stakeholders or delivery teams.",
        type: "ai_documentation_reviewer" as any
      },
      {
        name: "Gap Analysis",
        what: "Identifies missing information, unanswered questions, incomplete requirements, and areas that need clarification.",
        why: "Helps Product Managers identify documentation gaps before they become delivery problems.",
        type: "gap_analysis" as any
      },
      {
        name: "Edge Case Detection",
        what: "Identifies potential edge cases, exceptions, unusual scenarios, and overlooked user or system conditions.",
        why: "Helps Product Managers discover scenarios that may otherwise be missed during requirements definition.",
        type: "edge_case_detection" as any
      },
      {
        name: "Requirement Quality Scoring",
        what: "Evaluates requirements against quality criteria such as clarity, completeness, consistency, testability, and ambiguity.",
        why: "Gives Product Managers an early indication of requirement quality and areas that need improvement.",
        type: "requirement_quality_scoring" as any
      },
    ],
  },
];

const getStatusBadge = (status: Document['status']) => {
  switch (status) {
    case 'accepted':
      return <Badge variant="default" className="bg-success text-success-foreground hover:bg-success/90">Official</Badge>;
    case 'ai_generated':
      return <Badge variant="secondary" className="bg-ai/10 text-ai hover:bg-ai/20 border-ai/20"><Bot className="size-3 mr-1" /> AI Draft</Badge>;
    case 'in_review':
      return <Badge variant="secondary" className="bg-warning/10 text-warning-foreground hover:bg-warning/20 border-warning/20">In Review</Badge>;
    default:
      return <Badge variant="outline">Draft</Badge>;
  }
};

export function DocumentLibrary({ onCreateNew, onOpenDoc }: { onCreateNew: (type: DocumentType) => void, onOpenDoc: (id: number) => void }) {
  const { data: documents, isLoading } = useListDocuments();
  const { data: opportunities } = useListOpportunities();
  const { toast } = useToast();

  const getOppTitle = (id: number) => {
    return opportunities?.find(o => o.id === id)?.title || `Product Idea #${id}`;
  };

  const handleCreate = (type: DocumentType) => {
    const isFuture = ["ai_documentation_reviewer", "gap_analysis", "edge_case_detection", "requirement_quality_scoring"].includes(type as string);
    if (isFuture) {
      toast({
        title: "Coming Soon",
        description: "This AI Intelligence feature will be available in a future update."
      });
      return;
    }
    trackEvent("document_type_selected", { document_type: type });
    onCreateNew(type);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="size-8 text-primary" />
          Documentation
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          A structured library of product and delivery documents to help teams align on what to build and why.
        </p>
      </header>

      {/* Existing Documents */}
      {documents && documents.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Your Documents</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map(doc => (
              <Card
                key={doc.id}
                className="cursor-pointer hover:border-primary/50 transition-colors group flex flex-col"
                onClick={() => onOpenDoc(doc.id)}
              >
                <CardHeader className="pb-3 flex-1">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <Badge variant="outline" className="uppercase tracking-wider text-[10px]">
                      {doc.documentType.replace(/_/g, ' ')}
                    </Badge>
                    {getStatusBadge(doc.status)}
                  </div>
                  <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2 mb-1">
                    {doc.title || `Untitled ${doc.documentType}`}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground line-clamp-1">{getOppTitle(doc.productIdeaId)}</p>
                  <CardDescription className="flex items-center gap-1.5 mt-3 text-xs">
                    <Clock className="size-3.5" />
                    Updated {formatDistanceToNow(new Date(doc.updatedAt))} ago
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Create New Document Library */}
      <div className="space-y-10 pt-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight mb-1">Create New Document</h2>
          <p className="text-sm text-muted-foreground mb-6">Select a document type to start with an AI-generated draft based on your Product Ideas.</p>

          <div className="space-y-10">
            {GROUPS.map((group) => {
              const GroupIcon = group.icon;

              return (
                <section key={group.title} className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                      <GroupIcon className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium tracking-tight">{group.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {group.items.map((item) => (
                      <Card
                        key={item.name}
                        className="h-full hover:border-primary/50 transition-colors cursor-pointer group"
                        onClick={() => handleCreate(item.type)}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base leading-tight group-hover:text-primary transition-colors flex items-center justify-between">
                            {item.name}
                            <Bot className="size-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <p className="leading-relaxed text-muted-foreground line-clamp-2">
                            <span className="font-medium text-foreground/80">What it is:</span> {item.what}
                          </p>
                          <p className="leading-relaxed text-muted-foreground line-clamp-2">
                            <span className="font-medium text-foreground/80">Why it is used:</span> {item.why}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}