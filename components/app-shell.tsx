import { WorkflowNav } from "@/components/workflow-nav";
import { getExtractionProviderMode } from "@/lib/extraction/config";

type AppShellProps = {
  title: string;
  eyebrow: string;
  description: string;
  children: React.ReactNode;
};

export function AppShell({ title, eyebrow, description, children }: AppShellProps) {
  const isDemoMode = getExtractionProviderMode() === "demo";

  return (
    <div className="min-h-screen">
      <WorkflowNav />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {isDemoMode && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            Prototype mode: extraction values from the demo provider are simulated and clearly labeled where shown.
          </div>
        )}
        <header className="rounded-lg border border-line bg-white p-6 shadow-soft">
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">{eyebrow}</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-ink md:text-3xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p>
        </header>
        {children}
      </main>
    </div>
  );
}
