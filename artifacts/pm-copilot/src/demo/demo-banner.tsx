import { RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DemoBanner({ onExit }: { onExit: () => void }) {
  return (
    <div className="sticky top-0 z-50 flex min-h-10 items-center justify-between gap-3 border-b border-primary/20 bg-primary/10 px-4 py-2 text-sm text-foreground backdrop-blur">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <span className="font-semibold">Demo Mode</span>
        <span className="hidden text-muted-foreground sm:inline">— changes are not saved</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onExit}>
        <RotateCcw className="mr-2 size-3.5" />
        Exit demo
      </Button>
    </div>
  );
}