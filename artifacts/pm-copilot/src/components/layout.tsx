import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Compass, Lightbulb, Database, Target, Video, Brain, Users,
  BarChart3, FlaskConical, Map as MapIcon, FileText, MessageSquare,
  TrendingUp, Bot, Settings 
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { type: "divider", label: "Product Discovery" },
  { href: "/discovery", label: "Discovery Dashboard", icon: Compass },
  { href: "/discovery/opportunities", label: "Product Ideas", icon: Lightbulb },
  { href: "/discovery/sources", label: "Feedback Sources", icon: Database },
  { href: "/discovery/competitors", label: "Competitors", icon: Target },
  { href: "/discovery/meetings", label: "Meetings", icon: Video },
  { href: "/discovery/feedback", label: "Stakeholders", icon: Users },
  { href: "/discovery/insights", label: "AI Insights", icon: Brain },
  { type: "divider", label: "Planning & Analysis" },
  { href: "/prioritization", label: "Prioritization", icon: BarChart3 },
  { href: "/validation", label: "Validation", icon: FlaskConical, soon: true },
  { href: "/roadmap", label: "Roadmap", icon: MapIcon, soon: true },
  { href: "/documentation", label: "Documentation", icon: FileText, soon: true },
  { href: "/meeting-intelligence", label: "Meeting Intelligence", icon: MessageSquare, soon: true },
  { href: "/analytics", label: "Analytics", icon: TrendingUp, soon: true },
  { href: "/ai-advisor", label: "AI Advisor", icon: Bot, soon: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen w-full bg-background font-sans text-foreground">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-sidebar flex flex-col border-r border-sidebar-border h-screen sticky top-0 overflow-y-auto custom-scrollbar">
        <div className="p-4 flex items-center gap-2 mb-2">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
            C
          </div>
          <span className="font-semibold text-sidebar-foreground tracking-tight text-lg">Copilot Assist</span>
        </div>
        
        <nav className="flex-1 px-3 space-y-1 pb-4">
          {NAV_ITEMS.map((item, idx) => {
            if (item.type === "divider") {
              return (
                <div key={`div-${idx}`} className="px-3 pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {item.label}
                </div>
              );
            }
            
            const Icon = item.icon!;
            // exact match for /discovery, prefix match for others to keep active state when deep linking
            const isActive = location === item.href || (item.href !== "/" && item.href !== "/discovery" && location.startsWith(item.href!));
            
            return (
              <Link key={item.href} href={item.href!} className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}>
                <Icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50")} />
                <span className="truncate">{item.label}</span>
                {item.soon && (
                  <span className="ml-auto text-[10px] uppercase font-bold bg-sidebar-accent text-sidebar-foreground/50 px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-3 border-t border-sidebar-border mt-auto shrink-0">
          <Link href="/settings" className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            location === "/settings" 
              ? "bg-sidebar-accent text-sidebar-accent-foreground" 
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}>
            <Settings className="size-4 shrink-0" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
