import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AppLayout } from './components/layout';

import Home from './pages/home';
import DiscoveryDashboard from './pages/discovery/dashboard';
import OpportunitiesList from './pages/discovery/opportunities/list';
import OpportunityDetail from './pages/discovery/opportunities/detail';
import FeedbackSources from './pages/discovery/sources';
import CompetitorsList from './pages/discovery/competitors/list';
import CompetitorDetail from './pages/discovery/competitors/detail';
import MeetingsList from './pages/discovery/meetings/list';
import MeetingDetail from './pages/discovery/meetings/detail';
import StakeholderFeedback from './pages/discovery/feedback';
import AiInsights from './pages/discovery/insights';
import Prioritization from './pages/prioritization';
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

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        
        {/* Discovery Routes */}
        <Route path="/discovery" component={DiscoveryDashboard} />
        <Route path="/discovery/opportunities" component={OpportunitiesList} />
        <Route path="/discovery/opportunities/:id" component={OpportunityDetail} />
        <Route path="/discovery/sources" component={FeedbackSources} />
        <Route path="/discovery/competitors" component={CompetitorsList} />
        <Route path="/discovery/competitors/:id" component={CompetitorDetail} />
        <Route path="/discovery/meetings" component={MeetingsList} />
        <Route path="/discovery/meetings/:id" component={MeetingDetail} />
        <Route path="/discovery/feedback" component={StakeholderFeedback} />
        <Route path="/discovery/insights" component={AiInsights} />
        
        <Route path="/prioritization" component={Prioritization} />
        <Route path="/settings" component={Settings} />
        
        {/* Coming soon routes */}
        <Route path="/validation"><ComingSoon title="Validation" description="Test your assumptions before building." /></Route>
        <Route path="/roadmap"><ComingSoon title="Roadmap" description="Visualize and share your product timeline." /></Route>
        <Route path="/documentation"><ComingSoon title="Documentation" description="Keep your specs and PRDs in sync." /></Route>
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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
