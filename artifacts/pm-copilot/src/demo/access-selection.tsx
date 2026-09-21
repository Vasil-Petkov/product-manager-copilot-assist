import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AccessSelection({
  onChooseDemo,
  onChooseFull,
}: {
  onChooseDemo: () => void;
  onChooseFull: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-4xl space-y-8">
        <header className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/20">
            PM
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Product Manager AI Assist
          </h1>
          <p className="text-base text-muted-foreground">
            How would you like to explore the application?
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="relative overflow-hidden border-primary/40 shadow-lg shadow-primary/10">
            <div className="absolute right-5 top-5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Recommended for a quick tour
            </div>
            <CardHeader className="space-y-3 pr-8">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <CardTitle>Public Demo</CardTitle>
              <CardDescription>
                Explore a realistic demo workspace immediately. No registration and no email required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• No email</li>
                <li>• No registration</li>
                <li>• Fictional demo data only</li>
              </ul>
              <Button className="w-full" onClick={onChooseDemo}>
                Public Demo <ArrowRight className="ml-2 size-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <LockKeyhole className="size-5" />
              </div>
              <CardTitle>Full Workspace</CardTitle>
              <CardDescription>
                Access the complete version with your own workspace and persistent data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Existing authentication flow</li>
                <li>• Persistent workspace data</li>
                <li>• Full AI functionality</li>
              </ul>
              <Button className="w-full" variant="outline" onClick={onChooseFull}>
                Full Workspace <ArrowRight className="ml-2 size-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}