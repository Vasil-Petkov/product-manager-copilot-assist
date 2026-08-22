import { BookOpen, BriefcaseBusiness, FileText, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
          <Badge variant="secondary">SOON</Badge>
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