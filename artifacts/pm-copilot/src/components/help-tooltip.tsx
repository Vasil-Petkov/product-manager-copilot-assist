import { CircleHelp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  purpose: string;
  bullets: string[];
  className?: string;
}

export function HelpTooltip({ purpose, bullets, className }: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Help"
            className={cn(
              "inline-flex items-center text-muted-foreground/60 hover:text-muted-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full",
              className,
            )}
          >
            <CircleHelp className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className={cn(
            "bg-popover text-popover-foreground border shadow-md",
            "max-w-[320px] rounded-lg p-4",
            "text-sm",
          )}
        >
          <p className="font-medium mb-2 leading-snug">{purpose}</p>
          <ul className="space-y-1">
            {bullets.map((bullet, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-muted-foreground leading-snug"
              >
                <span className="mt-1 shrink-0 size-1.5 rounded-full bg-primary/70" />
                {bullet}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}