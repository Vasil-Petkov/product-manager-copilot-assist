import { useState } from "react";
import { HypothesisList } from "./components/hypothesis-list";
import { HypothesisForm } from "./components/hypothesis-form";
import { HypothesisDetail } from "./components/hypothesis-detail";
import { FlaskConical } from "lucide-react";
import { HelpTooltip } from "@/components/help-tooltip";

export default function HypothesisManagement() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background md:flex-row">
      <div className="flex h-[42vh] w-full shrink-0 flex-col border-b md:h-full md:w-[380px] md:border-b-0 md:border-r">
        <HypothesisList
          selectedId={isCreating ? null : selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setIsEditing(false);
            setIsCreating(false);
          }}
          onCreate={() => {
            setIsCreating(true);
            setSelectedId(null);
            setIsEditing(false);
          }}
        />
      </div>
      <div className="flex-1 overflow-hidden relative">
        {isCreating ? (
          <HypothesisForm
            onCancel={() => setIsCreating(false)}
            onSave={(id) => {
              setIsCreating(false);
              setSelectedId(id);
            }}
          />
        ) : isEditing && selectedId ? (
          <HypothesisForm
            hypothesisId={selectedId}
            onCancel={() => setIsEditing(false)}
            onSave={() => setIsEditing(false)}
          />
        ) : selectedId ? (
          <HypothesisDetail
            hypothesisId={selectedId}
            onEdit={() => setIsEditing(true)}
            onArchive={() => setSelectedId(null)}
            onDuplicate={(id) => setSelectedId(id)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 space-y-4">
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
              <FlaskConical className="size-8 text-primary/60" />
            </div>
            <div className="text-center space-y-2 max-w-md">
              <h2 className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
                Hypothesis Management
                <HelpTooltip
                  purpose="Define the assumptions behind a Product Idea and turn them into clear, testable hypotheses."
                  bullets={[
                    "Capture the riskiest assumptions before building",
                    "Keep Product Idea and prioritization context attached",
                    "Define measurable success criteria",
                    "Keep final wording and status under PM control",
                  ]}
                />
              </h2>
              <p className="text-sm">
                Select a hypothesis from the sidebar to view its details, or create a new one to start structuring your assumptions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
