import { AppShell } from "@/components/app-shell";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <AppShell title={title} eyebrow="Placeholder route" description={description}>
      <section className="rounded-lg border border-dashed border-line bg-white p-8 text-sm text-muted shadow-soft">
        This screen is intentionally reserved for a later goal. The foundation already includes the data contracts needed to build it without changing the core model.
      </section>
    </AppShell>
  );
}
