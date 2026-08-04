"use client";

import { useState } from "react";
import Link from "next/link";

type Citation = {
  n: number;
  chunkId: string;
  policyDocId: string;
  source: string;
  docTitle: string;
  sourceUrl: string;
  excerpt: string;
};

type AskResponse = {
  answer: string;
  citations: Citation[];
  citationsUsed: number[];
  confidence: "high" | "medium" | "low";
  suggestion: string;
  latencyMs: number;
  structured: boolean;
};

export default function PoliciesPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AskResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setErr(null);
    setData(null);

    try {
      const r = await fetch("/api/policies/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!r.ok) {
        const eb = await r.json().catch(() => ({}));
        throw new Error(eb.error ?? `HTTP ${r.status}`);
      }
      const json: AskResponse = await r.json();
      setData(json);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  const exampleQuestions = [
    "What does AHIMA say about non-leading physician queries?",
    "How does CMS-HCC V28 differ from V24 for diabetes coding?",
    "What are the MEAT criteria for HCC documentation?",
    "What is the RADV audit sample size and process?",
    "Which HEDIS measures apply to Medicare Advantage members with diabetes?",
    "Can a physician query be verbal, and what documentation is required?",
  ];

  /**
   * Render the answer with [N] citations converted to superscript badges
   * that link to the citation card below.
   */
  function renderAnswerWithCitations(answer: string) {
    // Match [1], [2], [1, 2], [1,3,5] etc
    const parts = answer.split(/(\[[\d\s,]+\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/^\[([\d\s,]+)\]$/);
      if (!match) return <span key={idx}>{part}</span>;
      const nums = match[1]
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      return (
        <span key={idx}>
          {nums.map((n, k) => (
            <a
              key={k}
              href={`#citation-${n}`}
              className="mx-0.5 rounded bg-indigo-100 px-1 py-0.5 text-xs font-bold text-indigo-700 hover:bg-indigo-200"
            >
              {n}
            </a>
          ))}
        </span>
      );
    });
  }

  const confidenceLabel = {
    high: { text: "High confidence", color: "bg-emerald-100 text-emerald-800" },
    medium: { text: "Medium confidence", color: "bg-amber-100 text-amber-800" },
    low: { text: "Low confidence", color: "bg-red-100 text-red-800" },
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="inline-flex items-center rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
          Policy Q&amp;A
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Ask a compliance question.
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Grounded in AHIMA, ACDIS, CMS-HCC V28, NCQA HEDIS, and Medicare Advantage RADV audit standards. Answers cite the source paragraph — no hallucination.
        </p>
      </section>

      <form onSubmit={onAsk} className="space-y-4">
        <div>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="e.g. What does AHIMA say about non-leading physician queries?"
            className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500">Try:</span>
            {exampleQuestions.map((q, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setQuestion(q)}
                className="text-xs text-brand-600 hover:underline"
              >
                Example {i + 1}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-md bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Searching policies…" : "Ask"}
        </button>
      </form>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {data && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${confidenceLabel[data.confidence].color}`}
              >
                {confidenceLabel[data.confidence].text}
              </span>
              <span className="text-xs text-slate-500">
                {data.latencyMs}ms · {data.citations.length} policy chunks searched
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-800">
              {renderAnswerWithCitations(data.answer)}
            </div>

            {data.suggestion && (
              <div className="mt-4 rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
                💡 {data.suggestion}
              </div>
            )}
          </div>

          {data.citations.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Sources
              </h2>
              <ol className="space-y-3">
                {data.citations.map((c) => (
                  <li
                    key={c.n}
                    id={`citation-${c.n}`}
                    className={`rounded-md border p-4 ${
                      data.citationsUsed.includes(c.n)
                        ? "border-indigo-200 bg-indigo-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-white px-1.5 py-0.5 text-xs font-bold text-indigo-700">
                        [{c.n}]
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {c.source} · {c.docTitle}
                      </span>
                      {data.citationsUsed.includes(c.n) && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                          cited
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs italic text-slate-700">
                      &ldquo;{c.excerpt}&rdquo;
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <a
                        href={`/api/policies/document/${c.policyDocId}`}
                        className="inline-flex items-center gap-1 rounded border border-brand-200 bg-white px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                      >
                        ⬇ Download policy (DOCX)
                      </a>
                      {c.sourceUrl && (
                        <a
                          href={c.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-xs text-indigo-600 hover:underline"
                        >
                          Open source →
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Not finding what you need? Try rephrasing, or use the{" "}
            <Link href="/query-forms" className="text-brand-600 hover:underline">
              Query Forms
            </Link>{" "}
            feature for patient-specific documentation clarifications.
          </div>
        </section>
      )}
    </div>
  );
}
