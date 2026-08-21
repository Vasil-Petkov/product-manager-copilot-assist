import { useState } from "react";
import { useListValidationHypotheses, HypothesisStatus, HypothesisType } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, FileText, FilterX } from "lucide-react";
import { format } from "date-fns";

interface HypothesisListProps {
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
}

export function HypothesisList({ selectedId, onSelect, onCreate }: HypothesisListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<HypothesisStatus | "all">("all");
  const [type, setType] = useState<HypothesisType | "all">("all");

  const { data: hypotheses, isLoading, isError, refetch } = useListValidationHypotheses(
    {
      search: search || undefined,
      status: status !== "all" ? status : undefined,
      hypothesisType: type !== "all" ? type : undefined,
    }
  );

  return (
    <div className="flex flex-col h-full bg-sidebar/5 border-r">
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Hypotheses</h2>
          <Button size="sm" onClick={onCreate} data-testid="button-create-hypothesis">
            <Plus className="size-4 mr-2" />
            New
          </Button>
        </div>
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search hypotheses..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-hypotheses"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as HypothesisStatus | "all")
              }
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="ready_for_validation">Ready</SelectItem>
                <SelectItem value="in_validation">In Validation</SelectItem>
                <SelectItem value="validated">Validated</SelectItem>
                <SelectItem value="invalidated">Invalidated</SelectItem>
                <SelectItem value="inconclusive">Inconclusive</SelectItem>
                <SelectItem value="needs_more_validation">Needs More</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={type}
              onValueChange={(value) =>
                setType(value as HypothesisType | "all")
              }
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-filter-type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="problem">Problem</SelectItem>
                <SelectItem value="solution">Solution</SelectItem>
                <SelectItem value="value">Value</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="pricing">Pricing</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3 border rounded-md space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        )}
        
        {isError && (
          <div className="p-4 text-center text-sm text-destructive">
            <p>Failed to load hypotheses.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-2"
              data-testid="button-retry-hypotheses"
            >
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && hypotheses?.length === 0 && (
          <div
            className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center"
            data-testid="empty-hypotheses"
          >
            <FilterX className="size-8 mb-2 opacity-50" />
            <p>No hypotheses found.</p>
            {(search || status !== "all" || type !== "all") && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setType("all");
                }}
                data-testid="button-clear-hypothesis-filters"
              >
                Clear filters
              </Button>
            )}
          </div>
        )}

        {!isLoading && hypotheses?.map((hyp) => (
          <button
            key={hyp.id}
            data-testid={`button-select-hypothesis-${hyp.id}`}
            onClick={() => onSelect(hyp.id)}
            className={`w-full text-left p-3 rounded-md transition-colors border ${
              selectedId === hyp.id 
                ? "bg-primary/10 border-primary/30" 
                : "bg-card hover:bg-muted/50 border-transparent hover:border-border"
            }`}
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {hyp.hypothesisType}
              </span>
              <Badge variant={
                hyp.status === 'validated' ? 'secondary' :
                hyp.status === 'invalidated' ? 'destructive' :
                hyp.status === 'in_validation' ? 'default' :
                'outline'
              } className={`text-[10px] h-4 px-1.5 font-medium ${
                hyp.status === "validated"
                  ? "bg-success/10 text-success hover:bg-success/10"
                  : ""
              }`}>
                {hyp.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="font-medium text-sm line-clamp-2 leading-tight">
              {hyp.statement}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1 truncate max-w-[150px]">
                <FileText className="size-3 shrink-0" />
                <span className="truncate">{hyp.productIdea?.title || "Unknown Idea"}</span>
              </span>
              <span className="shrink-0">{format(new Date(hyp.updatedAt), "MMM d")}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
