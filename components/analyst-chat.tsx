"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Bot, Send, UserRound } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getAnalystDisplay, type AnalystDisplayToolSummary } from "@/lib/analyst/display";

type AnalystMetric = {
  label: string;
  value: string;
};

type AnalystEvidence = {
  label: string;
  detail: string;
  href: string;
};

type AnalystAction = {
  label: string;
  href: string;
};

type AnalystResponse = {
  title: string;
  answer: string;
  caveat: string | null;
  metrics: AnalystMetric[];
  evidence: AnalystEvidence[];
  actions: AnalystAction[];
  mode: "deterministic" | "openai";
  model: string | null;
  toolSummary?: AnalystDisplayToolSummary;
};

type ChatMessage =
  | {
      id: string;
      role: "assistant";
      kind: "welcome";
      content: string;
    }
  | {
      id: string;
      role: "user";
      content: string;
    }
  | {
      id: string;
      role: "assistant";
      kind: "answer";
      response: AnalystResponse;
    }
  | {
      id: string;
      role: "assistant";
      kind: "error";
      content: string;
      retryQuestion: string;
    };

const suggestedQuestions = [
  "Who has the lowest comparable cost?",
  "Which suppliers have incomplete quotes?",
  "What if we split the award by line, but only among vendors that passed the quality questionnaire?",
  "Which lines have the largest price differences?",
  "Which suppliers are strongest on quality and coverage?",
  "What should I review before making a decision?"
];

export function AnalystChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      kind: "welcome",
      content: "I can analyze supplier pricing, coverage, quality, exceptions and award scenarios."
    }
  ]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function askAnalyst(rawQuestion: string, options: { appendUser: boolean } = { appendUser: true }) {
    const nextQuestion = rawQuestion.trim();
    if (!nextQuestion || isLoading) return;
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const message of messages) {
      if (message.role === "user") history.push({ role: "user", content: message.content });
      else if (message.kind === "answer") history.push({ role: "assistant", content: `${message.response.title}: ${message.response.answer}` });
      else if (message.kind === "welcome") history.push({ role: "assistant", content: message.content });
    }
    const recentHistory = history.slice(-8);

    if (options.appendUser) {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", content: nextQuestion }
      ]);
    }
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: nextQuestion, history: recentHistory })
      });

      if (!response.ok) {
        throw new Error(`Analyst request failed with ${response.status}`);
      }

      const answer = await response.json() as AnalystResponse;
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", kind: "answer", response: answer }
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The analyst could not answer right now.";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          kind: "error",
          content: message,
          retryQuestion: nextQuestion
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askAnalyst(question);
  }

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">Procurement Analyst</div>
        <h2 className="mt-2 text-xl font-semibold">Ask about this RFx</h2>
        <p className="mt-1 text-sm text-muted">Ask anything about this RFx, supplier responses, pricing, quality and scenarios.</p>
      </div>

      <div className="max-h-[620px] space-y-4 overflow-y-auto rounded-md border border-line bg-panel p-4">
        {messages.map((message) => (
          <MessageCard key={message.id} message={message} onRetry={(retryQuestion) => void askAnalyst(retryQuestion, { appendUser: false })} />
        ))}

        {isLoading && (
          <div className="flex items-start gap-3 rounded-md border border-line bg-white p-4">
            <Bot className="mt-1 h-5 w-5 text-accent" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold">Analyst</div>
              <div className="mt-1 text-sm text-muted">Analyzing...</div>
            </div>
          </div>
        )}
      </div>

      <form className="mt-4 flex gap-2" onSubmit={handleSubmit}>
        <input
          className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          placeholder="Ask a procurement question..."
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading || !question.trim()}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Ask
        </button>
      </form>

      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Suggested questions</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestedQuestions.map((suggestedQuestion) => (
            <button
              key={suggestedQuestion}
              type="button"
              className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={() => void askAnalyst(suggestedQuestion)}
            >
              {shortLabel(suggestedQuestion)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function MessageCard({ message, onRetry }: { message: ChatMessage; onRetry: (question: string) => void }) {
  if (message.role === "user") {
    return (
      <div className="ml-auto flex max-w-3xl items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4">
        <UserRound className="mt-1 h-5 w-5 text-emerald-700" aria-hidden="true" />
        <div>
          <div className="text-sm font-semibold text-emerald-900">You</div>
          <p className="mt-1 text-sm leading-6 text-emerald-900">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.kind === "welcome") {
    return (
      <div className="flex items-start gap-3 rounded-md border border-line bg-white p-4">
        <Bot className="mt-1 h-5 w-5 text-accent" aria-hidden="true" />
        <div>
          <div className="text-sm font-semibold">Analyst</div>
          <p className="mt-1 text-sm leading-6 text-muted">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.kind === "error") {
    return (
      <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4">
        <Bot className="mt-1 h-5 w-5 text-red-700" aria-hidden="true" />
        <div>
          <div className="text-sm font-semibold text-red-900">Analyst</div>
          <p className="mt-1 text-sm leading-6 text-red-800">{message.content}</p>
          <button
            type="button"
            className="mt-3 rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100"
            onClick={() => onRetry(message.retryQuestion)}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <AnalystAnswerCard response={message.response} />;
}

function AnalystAnswerCard({ response }: { response: AnalystResponse }) {
  const display = getAnalystDisplay(response);

  return (
    <div className="flex items-start gap-3 rounded-md border border-line bg-white p-4">
      <Bot className="mt-1 h-5 w-5 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Analyst</div>
            <h3 className="mt-1 text-lg font-semibold">{response.title}</h3>
          </div>
          <StatusBadge
            status={response.mode === "openai" ? `OpenAI explanation: ${response.model}` : "Deterministic explanation"}
            tone="success"
          />
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">{response.answer}</p>
        {response.caveat && <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{response.caveat}</p>}

        {display.showMetrics && (
          <div className="mt-4 overflow-hidden rounded-md border border-line">
            <table className="min-w-full divide-y divide-line text-sm">
              <tbody className="divide-y divide-line bg-panel">
                {response.metrics.map((metric) => (
                  <tr key={metric.label}>
                    <td className="w-1/2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">{metric.label}</td>
                    <td className="px-3 py-2 font-semibold text-ink">{metric.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {display.showSecondaryDetails && (
          <details className="mt-4 rounded-md border border-line bg-panel p-3">
            <summary className="cursor-pointer text-sm font-semibold text-muted">Evidence and related views</summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {response.evidence.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold">Evidence</h4>
                  <div className="mt-2 space-y-2">
                    {response.evidence.map((item) => (
                      <Link key={`${item.label}-${item.href}`} href={item.href} className="block rounded-md border border-line bg-white p-3 hover:border-accent">
                        <div className="text-sm font-semibold">{item.label}</div>
                        <div className="mt-1 text-xs text-muted">{item.detail}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {response.actions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold">Related views</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {response.actions.map((action) => (
                      <Link key={action.href} href={action.href} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-muted hover:border-accent hover:text-accent">
                        {action.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function shortLabel(question: string) {
  if (question.startsWith("Who has")) return "Lowest comparable cost";
  if (question.startsWith("Which suppliers")) return "Incomplete quotes";
  if (question.startsWith("What if we split")) return "Quality-filtered split award";
  if (question.startsWith("Which lines")) return "Largest price differences";
  if (question.startsWith("Which suppliers are strongest")) return "Quality and coverage";
  return "What should I review?";
}
