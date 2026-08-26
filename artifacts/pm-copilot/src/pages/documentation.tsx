import { BookOpen, BriefcaseBusiness, FileText, ListChecks, Megaphone, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DocumentationItem = {
  name: string;
  what: string;
  why: string;
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
      },
      {
        name: "BRD Generator — Business Requirements Document",
        what: "Defines the business needs, objectives, expected outcomes, and business requirements behind a product or initiative.",
        why: "Connects the product work to clear business objectives and expected outcomes.",
      },
      {
        name: "Business Case",
        what: "Explains why an initiative should be pursued, including its expected value, benefits, costs, and rationale.",
        why: "Helps stakeholders make an informed investment decision.",
      },
      {
        name: "Use Case",
        what: "Describes how a user or other actor interacts with the product to achieve a specific goal.",
        why: "Clarifies the expected user interaction and behavior.",
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
      },
      {
        name: "Epic",
        what: "A substantial piece of product functionality or work that can be broken into smaller user stories.",
        why: "Helps organize and manage large areas of functionality.",
      },
      {
        name: "User Story",
        what: "A concise description of a user need or capability that the product should provide.",
        why: "Translates product requirements into actionable user-focused work.",
      },
      {
        name: "Acceptance Criteria",
        what: "The specific conditions that must be satisfied for a user story to be accepted.",
        why: "Creates a shared understanding of what successful delivery means.",
      },
      {
        name: "Definition of Ready",
        what: "A set of conditions indicating that work is sufficiently understood and prepared to begin.",
        why: "Helps teams avoid starting work that is unclear or incomplete.",
      },
      {
        name: "Definition of Done",
        what: "A shared set of criteria that must be satisfied before work is considered complete.",
        why: "Creates a consistent quality bar for completed work.",
      },
      {
        name: "Functional Requirements",
        what: "Describes what the product or system must do and the capabilities it must provide.",
        why: "Turns product needs into clear, testable functional expectations.",
      },
      {
        name: "Non-functional Requirements",
        what: "Describes qualities and constraints such as performance, security, reliability, scalability, and usability.",
        why: "Ensures the product meets important quality and operational expectations in addition to functional needs.",
      },
      {
        name: "Technical Requirements",
        what: "Defines the technical considerations, constraints, integrations, dependencies, security, performance, and other technical expectations for the product or feature.",
        why: "Gives engineering and technical stakeholders the context needed to understand implementation requirements and constraints.",
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
      },
      {
        name: "Stakeholder Updates",
        what: "Provides concise updates on product progress, decisions, risks, milestones, and upcoming work for relevant stakeholders.",
        why: "Keeps stakeholders aligned without requiring the Product Manager to repeatedly prepare the same information manually.",
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
      },
      {
        name: "Gap Analysis",
        what: "Identifies missing information, unanswered questions, incomplete requirements, and areas that need clarification.",
        why: "Helps Product Managers identify documentation gaps before they become delivery problems.",
      },
      {
        name: "Edge Case Detection",
        what: "Identifies potential edge cases, exceptions, unusual scenarios, and overlooked user or system conditions.",
        why: "Helps Product Managers discover scenarios that may otherwise be missed during requirements definition.",
      },
      {
        name: "Requirement Quality Scoring",
        what: "Evaluates requirements against quality criteria such as clarity, completeness, consistency, testability, and ambiguity.",
        why: "Gives Product Managers an early indication of requirement quality and areas that need improvement.",
      },
    ],
  },
];

export default function Documentation() {
  return (
    <div className="p-8 max-w-[1200px] mx-auto w-full space-y-8 animate-in fade-in">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="size-8 text-primary" />
          Documentation
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          A structured library of product and delivery documents to help teams align on what to build and why.
        </p>
      </header>

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
                  <h2 className="text-xl font-semibold tracking-tight">{group.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {group.items.map((item) => (
                  <Card key={item.name} className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base leading-tight">{item.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p className="leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground/80">What it is:</span> {item.what}
                      </p>
                      <p className="leading-relaxed text-muted-foreground">
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

      <div className="flex items-center gap-2 border-t pt-6 text-sm text-muted-foreground">
        <BookOpen className="size-4 text-primary" />
        Document editors and generators will be added in a future release.
      </div>
    </div>
  );
}