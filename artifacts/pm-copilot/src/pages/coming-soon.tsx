import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ComingSoon({ title, description }: { title: string, description: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="max-w-md space-y-6">
        <div className="mx-auto size-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
          <Sparkles className="size-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {description} This module is currently in active development.
        </p>
        
        <div className="pt-6">
          <ul className="text-sm text-left space-y-3 mb-8 mx-auto max-w-xs text-muted-foreground bg-card p-6 rounded-xl border shadow-sm">
            <li className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-primary/50" /> Better workflows
            </li>
            <li className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-primary/50" /> AI powered insights
            </li>
            <li className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-primary/50" /> Deep integrations
            </li>
          </ul>
          
          <Button size="lg" className="w-full sm:w-auto group">
            Request Early Access
            <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </div>
  );
}
