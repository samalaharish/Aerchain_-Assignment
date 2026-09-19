import Link from "next/link";
import { Bot, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { answerProcurementAnalystQuestion } from "@/lib/domain/ai-analyst";
import { buildDemoComparisonDataset } from "@/lib/extraction/comparison-source";

export const dynamic = "force-dynamic";

type AnalystPageProps = {
  searchParams?: {
    q?: string;
  };
};

const suggestedPrompts = [
  "Which supplier has the lowest comparable cost?",
  "What if we split the award by line, but only among vendors that passed the quality questionnaire?",
  "Which suppliers have incomplete quotes?",
  "Where are the biggest exceptions?",
  "Which lines have the largest price differences?",
  "What should I review before making a decision?"
];

export default async function AnalystPage({ searchParams }: AnalystPageProps) {
  const dataset = await buildDemoComparisonDataset();
  const question = searchParams?.q ?? suggestedPrompts[0];
  const answer = await answerProcurementAnalystQuestion({ dataset, question });

  return (
    <AppShell
      title="Procurement Analyst"
      eyebrow="Tool-backed analysis"
      description="Ask questions about this RFx, supplier responses, comparison data, exceptions, and scenarios. Calculations come from deterministic tools; AI explains when configured."
    >
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <Bot className="mt-1 h-5 w-5 text-accent" aria-hidden="true" />
          <div className="flex-1">
            <label className="text-sm font-semibold" htmlFor="analyst-question">What would you like to understand?</label>
            <div className="mt-2 flex rounded-md border border-line bg-panel px-3 py-2 text-sm text-muted">
              <Search className="mr-2 h-4 w-4" aria-hidden="true" />
              <span id="analyst-question">{question}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestedPrompts.map((prompt) => (
                <Link
                  key={prompt}
                  href={`/analyst?q=${encodeURIComponent(prompt)}`}
                  className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-accent"
                >
                  {prompt}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-accent">Answer</div>
            <h2 className="mt-2 text-xl font-semibold">{answer.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{answer.answer}</p>
            {answer.caveat && <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{answer.caveat}</p>}
          </div>
          <StatusBadge status={answer.mode === "openai" ? `OpenAI explanation: ${answer.model}` : "Deterministic explanation"} tone="success" />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {answer.metrics.map((metric) => (
            <div key={metric.label} className="rounded-md border border-line bg-panel p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">{metric.label}</div>
              <div className="mt-1 text-lg font-semibold">{metric.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold">Evidence</h3>
            <div className="mt-3 space-y-2">
              {answer.evidence.map((item) => (
                <Link key={`${item.label}-${item.href}`} href={item.href} className="block rounded-md border border-line bg-panel p-3 hover:border-accent">
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="mt-1 text-xs text-muted">{item.detail}</div>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold">Next actions</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {answer.actions.map((action) => (
                <Link key={action.href} href={action.href} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
