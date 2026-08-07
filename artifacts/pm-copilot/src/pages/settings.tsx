import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Brain, Settings as SettingsIcon, Link as LinkIcon, Blocks, User, GitBranch, MessageSquare, Github, Cloud, Headphones, Zap } from "lucide-react";

// Connector icon mapping using lucide-react (react-icons removed due to missing exports)
const SiJira = GitBranch;
const SiSlack = MessageSquare;
const SiGithub = Github;
const SiSalesforce = Cloud;
const SiHubspot = Zap;
const SiZendesk = Headphones;

export default function Settings() {
  return (
    <div className="p-8 max-w-[1200px] mx-auto w-full space-y-8 animate-in fade-in">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="size-8 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your workspace, profile, and integrations.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="size-5" /> Profile</CardTitle>
              <CardDescription>Manage your personal account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input defaultValue="Alex Product" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input defaultValue="alex@acmecorp.com" disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Input defaultValue="Senior Product Manager" />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-5">
              <Button>Save Changes</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Blocks className="size-5" /> Workspace</CardTitle>
              <CardDescription>Configure your team's workspace settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Workspace Name</label>
                <Input defaultValue="Acme Corp Product Team" />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-5">
              <Button>Save Workspace</Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="bg-ai/5 border-ai/20 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-ai"><Brain className="size-5" /> AI Engine</CardTitle>
              <CardDescription>Your AI capabilities are powered by Replit AI Integration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
                <div>
                  <p className="font-semibold text-foreground">Replit AI Models</p>
                  <p className="text-sm text-muted-foreground">Active and processing signals.</p>
                </div>
                <Badge className="bg-success text-success-foreground hover:bg-success">Connected</Badge>
              </div>
            </CardContent>
          </Card>

          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                <LinkIcon className="size-5 text-muted-foreground" /> Connectors
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Sync data automatically from your other tools.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ConnectorCard name="Jira" Icon={SiJira} color="#0052CC" />
              <ConnectorCard name="Slack" Icon={SiSlack} color="#4A154B" />
              <ConnectorCard name="GitHub" Icon={SiGithub} color="#181717" />
              <ConnectorCard name="Salesforce" Icon={SiSalesforce} color="#00A1E0" />
              <ConnectorCard name="HubSpot" Icon={SiHubspot} color="#FF7A59" />
              <ConnectorCard name="Zendesk" Icon={SiZendesk} color="#03363D" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectorCard({ name, Icon, color }: any) {
  return (
    <Card className="flex flex-col items-center justify-center p-6 text-center hover:border-primary/50 transition-colors relative overflow-hidden group opacity-80 hover:opacity-100">
      <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] uppercase font-bold tracking-wider opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 text-primary border-primary/20">Coming Soon</Badge>
      <Icon className="size-10 mb-3" style={{ color }} />
      <h3 className="font-semibold">{name}</h3>
      <Button variant="outline" size="sm" className="mt-4 w-full" disabled>Connect</Button>
    </Card>
  );
}
