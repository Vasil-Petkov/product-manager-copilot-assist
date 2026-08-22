import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AppLayout } from './components/layout';
import { useAuth } from '@workspace/replit-auth-web';

import Home from './pages/home';
import DiscoveryDashboard from './pages/discovery/dashboard';
import OpportunitiesList from './pages/discovery/opportunities/list';
import OpportunityDetail from './pages/discovery/opportunities/detail';
import NewOpportunity from './pages/discovery/opportunities/new';
import FeedbackSources from './pages/discovery/sources';
import CompetitorsList from './pages/discovery/competitors/list';
import CompetitorDetail from './pages/discovery/competitors/detail';
import MeetingsList from './pages/discovery/meetings/list';
import MeetingDetail from './pages/discovery/meetings/detail';
import StakeholderFeedback from './pages/discovery/feedback';
import AiInsights from './pages/discovery/insights';
import HypothesisManagement from './pages/validation/hypotheses';
import ValidationMethods from './pages/validation/methods';
import ValidationResults from './pages/validation/results';
import NewValidationExperiment from './pages/validation/experiments/new';
import ValidationExperimentDetail from './pages/validation/experiments/detail';
import Prioritization from './pages/prioritization/index';
import Roadmap from './pages/roadmap';
import Documentation from './pages/documentation';
import Settings from './pages/settings';
import ComingSoon from './pages/coming-soon';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, login } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="size-8 rounded-lg bg-primary mx-auto flex items-center justify-center font-bold text-xl text-primary-foreground">PM</div>
          <p className="text-muted-foreground text-sm">Loading&hellip;</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-sm px-6">
          <div className="space-y-2">
            <div className="size-12 rounded-xl bg-primary mx-auto flex items-center justify-center font-bold text-2xl text-primary-foreground">PM</div>
            <h1 className="text-2xl font-bold tracking-tight">Copilot Assist</h1>
            <p className="text-muted-foreground text-sm">AI-powered product discovery for modern PMs.</p>
          </div>
          <button
            onClick={login}
            className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Log in to continue
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        
        {/* Discovery Routes */}
        <Route path="/discovery" component={DiscoveryDashboard} />
        <Route path="/discovery/opportunities" component={OpportunitiesList} />
        <Route path="/discovery/opportunities/new" component={NewOpportunity} />
        <Route path="/discovery/opportunities/:id" component={OpportunityDetail} />
        <Route path="/discovery/sources" component={FeedbackSources} />
        <Route path="/discovery/competitors" component={CompetitorsList} />
        <Route path="/discovery/competitors/:id" component={CompetitorDetail} />
        <Route path="/discovery/meetings" component={MeetingsList} />
        <Route path="/discovery/meetings/:id" component={MeetingDetail} />
        <Route path="/discovery/feedback" component={StakeholderFeedback} />
        <Route path="/discovery/insights" component={AiInsights} />
        
        <Route path="/prioritization" component={Prioritization} />

        {/* Validation Routes */}
        <Route path="/validation/hypotheses" component={HypothesisManagement} />
        <Route path="/validation/methods" component={ValidationMethods} />
        <Route path="/validation/experiments/new" component={NewValidationExperiment} />
        <Route path="/validation/experiments/:id" component={ValidationExperimentDetail} />
        <Route path="/validation/results" component={ValidationResults} />
        <Route path="/validation"><HypothesisManagement /></Route>
        <Route path="/settings" component={Settings} />
        
        {/* Coming soon routes */}
        <Route path="/roadmap" component={Roadmap} />
        <Route path="/documentation" component={Documentation} />
        <Route path="/meeting-intelligence"><ComingSoon title="Meeting Intelligence" description="Deep analysis of your customer calls." /></Route>
        <Route path="/analytics"><ComingSoon title="Analytics" description="Track feature usage and impact." /></Route>
        <Route path="/ai-advisor"><ComingSoon title="AI Advisor" description="Your strategic PM partner." /></Route>
        
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthGate>
            <Router />
          </AuthGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
