import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Compass, Lightbulb, Database, Target, Video, Brain, Users,
  BarChart3, FlaskConical, Map as MapIcon, FileText, MessageSquare,
  TrendingUp, Bot, Settings, ChevronDown, ChevronRight,
  BookOpen, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
};

type NavModule = {
  /** Section heading shown in the sidebar */
  label: string;
  /** Whether the section is open on first render */
  defaultOpen: boolean;
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

// ─── Navigation data ─────────────────────────────────────────────────────────

/** Items that always appear above the collapsible modules */
const STANDALONE: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
];

/**
 * Collapsible module sections.
 * To add a future module, append an entry here — no other changes needed.
 */
const MODULES: NavModule[] = [
  {
    label: "Product Discovery",
    defaultOpen: true,
    items: [
      { href: "/discovery",              label: "Discovery Dashboard", icon: Compass   },
      { href: "/discovery/opportunities",label: "Product Ideas",       icon: Lightbulb },
      { href: "/discovery/sources",      label: "Feedback Sources",    icon: Database  },
      { href: "/discovery/competitors",  label: "Competitors",         icon: Target    },
      { href: "/discovery/meetings",     label: "Meetings",            icon: Video     },
      { href: "/discovery/feedback",     label: "Stakeholders",        icon: Users     },
      { href: "/discovery/insights",     label: "AI Insights",         icon: Brain     },
    ],
  },
  {
    label: "Product Validation",
    defaultOpen: false,
    items: [
      { href: "/validation/hypotheses", label: "Hypothesis Management", icon: FlaskConical },
      { href: "/validation/methods",    label: "Validation Methods",    icon: BookOpen    },
      { href: "/validation/results",    label: "Validation Results",    icon: ClipboardList },
    ],
  },
  {
    label: "Planning & Analysis",
    defaultOpen: false,
    items: [
      { href: "/prioritization",      label: "Prioritization",       icon: BarChart3,   },
      { href: "/roadmap",             label: "Roadmap",              icon: MapIcon,      soon: true },
      { href: "/documentation",       label: "Documentation",        icon: FileText,     soon: true },
      { href: "/meeting-intelligence",label: "Meeting Intelligence", icon: MessageSquare,soon: true },
      { href: "/analytics",           label: "Analytics",            icon: TrendingUp,   soon: true },
      { href: "/ai-advisor",          label: "AI Advisor",           icon: Bot,          soon: true },
    ],
  },
];

// ─── Reusable collapsible module ─────────────────────────────────────────────

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
      {/* Module heading — click anywhere to toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 pb-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded"
        aria-expanded={open}
      >
        <span className="text-xs font-bold uppercase tracking-wider text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80 transition-colors">
          {module.label}
        </span>
        <Chevron className="size-3.5 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 transition-colors shrink-0" />
      </button>

      {/* Submenu items */}
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
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-primary" : "text-sidebar-foreground/50"
                  )}
                />
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

// ─── Layout ───────────────────────────────────────────────────────────────────

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  // Initialise from each module's defaultOpen — persists for the session
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(
    () => Object.fromEntries(MODULES.map((m) => [m.label, m.defaultOpen]))
  );

  const toggleModule = (label: string) =>
    setOpenModules((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="flex min-h-screen w-full bg-background font-sans text-foreground">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-sidebar flex flex-col border-r border-sidebar-border h-screen sticky top-0 overflow-y-auto custom-scrollbar">
        {/* Logo */}
        <div className="p-4 flex items-center gap-2 mb-2">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
            C
          </div>
          <span className="font-semibold text-sidebar-foreground tracking-tight text-lg">
            Copilot Assist
          </span>
        </div>

        <nav className="flex-1 px-3 pb-4">
          {/* Standalone top-level items */}
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
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-primary" : "text-sidebar-foreground/50"
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Collapsible module sections */}
          {MODULES.map((module) => (
            <NavModuleSection
              key={module.label}
              module={module}
              location={location}
              open={openModules[module.label] ?? module.defaultOpen}
              onToggle={() => toggleModule(module.label)}
            />
          ))}
        </nav>

        {/* Settings pinned at bottom */}
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

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
