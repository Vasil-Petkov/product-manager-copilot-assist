import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Compass, Lightbulb, Database, Target, Video, Brain, Users,
  BarChart3, FlaskConical, Map as MapIcon, FileText, MessageSquare,
  TrendingUp, Bot, Rocket, Activity, Settings, ChevronDown, ChevronRight,
  BookOpen, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
};

type NavModule = {
  label: string;
  group: "Product Lifecycle" | "Upcoming";
  lifecycleNumber?: number;
  defaultOpen: boolean;
  soon?: boolean;
  items: NavItem[];
};

function isNavItemActive(item: NavItem, location: string): boolean {
  if (item.href === "/validation/methods") {
    return location === item.href
      || location.startsWith(`${item.href}/`)
      || location === "/validation/experiments/new"
      || location.startsWith("/validation/experiments/");
  }
  return location === item.href
    || (item.href !== "/"
      && item.href !== "/discovery"
      && location.startsWith(item.href));
}

const STANDALONE: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
];

const MODULES: NavModule[] = [
  {
    label: "Product Discovery",
    group: "Product Lifecycle",
    lifecycleNumber: 1,
    defaultOpen: true,
    items: [
      { href: "/discovery",               label: "Discovery Dashboard", icon: Compass },
      { href: "/discovery/opportunities", label: "Product Ideas",       icon: Lightbulb },
      { href: "/discovery/sources",       label: "Feedback Sources",    icon: Database },
      { href: "/discovery/competitors",   label: "Competitors",         icon: Target },
      { href: "/discovery/meetings",      label: "Meetings",            icon: Video },
      { href: "/discovery/feedback",      label: "Stakeholders",        icon: Users },
      { href: "/discovery/insights",      label: "AI Insights",         icon: Brain },
    ],
  },
  {
    label: "Prioritization",
    group: "Product Lifecycle",
    lifecycleNumber: 2,
    defaultOpen: false,
    items: [
      { href: "/prioritization", label: "Prioritization workspace", icon: BarChart3 },
    ],
  },
  {
    label: "Validation",
    group: "Product Lifecycle",
    lifecycleNumber: 3,
    defaultOpen: false,
    items: [
      { href: "/validation/hypotheses", label: "Hypothesis Management", icon: FlaskConical },
      { href: "/validation/methods",    label: "Validation Methods",    icon: BookOpen },
      { href: "/validation/results",    label: "Validation Results",    icon: ClipboardList },
    ],
  },
  {
    label: "Roadmap",
    group: "Product Lifecycle",
    lifecycleNumber: 4,
    defaultOpen: false,
    items: [
      { href: "/roadmap", label: "Roadmap workspace", icon: MapIcon },
    ],
  },
  {
    label: "Documentation",
    group: "Product Lifecycle",
    lifecycleNumber: 5,
    defaultOpen: false,
    items: [
      { href: "/documentation", label: "Documentation workspace", icon: FileText },
    ],
  },
  {
    label: "Go To Market",
    group: "Product Lifecycle",
    lifecycleNumber: 6,
    defaultOpen: false,
    items: [
      { href: "/go-to-market", label: "Go To Market workspace", icon: Rocket },
    ],
  },
  {
    label: "Post Launch Monitoring",
    group: "Product Lifecycle",
    lifecycleNumber: 7,
    defaultOpen: false,
    items: [
      { href: "/post-launch-monitoring", label: "Post Launch Monitoring workspace", icon: Activity },
    ],
  },
  {
    label: "Upcoming",
    group: "Upcoming",
    defaultOpen: false,
    items: [
      { href: "/meeting-intelligence", label: "Meeting Intelligence", icon: MessageSquare, soon: true },
      { href: "/analytics",            label: "Analytics",            icon: TrendingUp, soon: true },
      { href: "/ai-advisor",           label: "AI Advisor",           icon: Bot, soon: true },
    ],
  },
];

function NavModuleSection({
  module,
  location,
  open,
  onToggle,
}: {
  module: NavModule;
  location: string;
  open: boolean;
  onToggle: () => void;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 pb-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80 transition-colors">
          {module.lifecycleNumber !== undefined && (
            <span className="text-[10px] font-semibold tabular-nums text-sidebar-foreground/45">
              {module.lifecycleNumber}
            </span>
          )}
          {module.label}
          {module.soon && (
            <span className="text-[10px] uppercase font-bold bg-primary/20 text-primary/80 border border-primary/30 px-1.5 py-0.5 rounded-full">
              Soon
            </span>
          )}
        </span>
        <Chevron className="size-3.5 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 transition-colors shrink-0" />
      </button>

      {open && (
        <div className="space-y-1">
          {module.items.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(item, location);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
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
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(
    () => Object.fromEntries(MODULES.map((m) => [m.label, m.defaultOpen]))
  );

  const toggleModule = (label: string) =>
    setOpenModules((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="flex min-h-screen w-full bg-background font-sans text-foreground">
      <aside className="w-64 flex-shrink-0 bg-sidebar flex flex-col border-r border-sidebar-border h-screen sticky top-0 overflow-y-auto custom-scrollbar">
        <div className="p-4 flex items-center gap-2 mb-2">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
            PM
          </div>
          <span className="font-semibold text-sidebar-foreground tracking-tight text-lg">
            Copilot Assist
          </span>
        </div>

        <nav className="flex-1 px-3 pb-4">
          <div className="space-y-1">
            {STANDALONE.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {MODULES.map((module, index) => (
            <div key={module.label}>
              {(index === 0 || MODULES[index - 1].group !== module.group) && (
                <div className="mt-5 px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/40">
                  {module.group}
                </div>
              )}
              <NavModuleSection
                module={module}
                location={location}
                open={openModules[module.label] ?? module.defaultOpen}
                onToggle={() => toggleModule(module.label)}
              />
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border mt-auto shrink-0">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              location === "/settings"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Settings className="size-4 shrink-0" />
            Settings
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
