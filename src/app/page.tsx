"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

const modes = [
  {
    id: "analyze",
    label: "Analyze brief",
    description: "Understand requirements, judging signals, risks, and the best angle.",
  },
  {
    id: "ideas",
    label: "Generate ideas",
    description: "Create project ideas that fit the sponsor, prizes, and constraints.",
  },
  {
    id: "submission",
    label: "Submission plan",
    description: "Turn a nearly finished project into a checklist, pitch, and final polish plan.",
  },
  {
    id: "search",
    label: "Search opportunities",
    description: "Find relevant hackathons, grants, bounties, and builder opportunities.",
  },
] as const;

type ScoutMode = (typeof modes)[number]["id"];

const analysisCards = [
  {
    title: "opportunity fit",
    description: "Quickly checks whether the brief matches Scout’s intended use case.",
  },
  {
    title: "best angle",
    description: "Identifies the strongest positioning or submission strategy.",
  },
  {
    title: "risks",
    description: "Flags weak assumptions, missing details, or avoidable mistakes.",
  },
  {
    title: "next steps",
    description: "Turns the brief into an actionable plan.",
  },
];

export default function Home() {
  const [brief, setBrief] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ScoutMode>("analyze");
  const [sourceType, setSourceType] = useState("");

  const activeInput = mode === "search" ? searchQuery : brief;

  async function handleAnalyze() {
    setLoading(true);
    setError("");
    setReport("");
    setSourceType("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brief: activeInput,
          mode,
        }),
      });

      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!response.ok) {
        throw new Error(data?.details || data?.error || "request failed");
      }

      setReport(data.report || "no report returned.");
      setSourceType(data.sourceType || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#090306] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-8 lg:grid lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-red-950/70 bg-gradient-to-b from-[#130608] to-[#090306] p-6 shadow-2xl shadow-red-950/20">
          <div className="mb-8">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <p className="text-sm uppercase tracking-[0.35em] text-red-300/70">
                swarms marketplace agent
              </p>

              <div className="inline-flex items-center gap-3 rounded-full border border-red-500/25 bg-black/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-red-100 shadow-[0_0_30px_rgba(239,68,68,0.18)]">
                <img
                  src="/swarms-logo.svg"
                  alt="swarms"
                  className="h-5 w-5 rounded-full object-contain"
                />
                <span>built for swarms acm hackathon</span>
              </div>
            </div>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Scout
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
              Scout analyses hackathon briefs, grants, and bounties, then turns
              them into a specific action plan with a strong winning angle.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-red-100">
              Choose analysis mode
            </label>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {modes.map((item) => {
                const active = mode === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-red-400/70 bg-red-500/15 text-white shadow-[0_0_30px_rgba(239,68,68,0.18)]"
                        : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-red-400/40 hover:text-white"
                    }`}
                  >
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-2 text-xs leading-5">{item.description}</p>
                  </button>
                );
              })}
            </div>

            {mode === "search" ? (
              <div className="space-y-3 pt-2">
                <label className="block text-sm font-medium text-red-100">
                  search for opportunities
                </label>

                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="example: ai agent hackathons with open submissions"
                  className="w-full rounded-2xl border border-red-950/80 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-red-500/70"
                />

                <p className="text-xs leading-5 text-zinc-500">
                  Scout will search the web, summarise relevant opportunities,
                  and recommend where to focus.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <label className="block text-sm font-medium text-red-100">
                  Paste your brief
                </label>

                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Paste a hackathon brief, grant description, bounty prompt, or url here..."
                  className="min-h-56 w-full rounded-2xl border border-red-950/80 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-red-500/70"
                />

                <p className="text-xs leading-5 text-zinc-500">
                  You can paste a full brief or a live url. Scout will fetch the
                  page when a url is provided.
                </p>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading || !activeInput.trim()}
              className="rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Analyzing..."
                : mode === "search"
                  ? "Search with Scout"
                  : "Generate Scout Report"}
            </button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {analysisCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-red-950/60 bg-white/[0.03] p-4"
              >
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-red-200">
                  {card.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <aside className="rounded-3xl border border-red-950/70 bg-black/50 p-6 shadow-2xl shadow-red-950/15">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-red-200">
            scout report
          </h2>

          <div className="mt-4 min-h-[28rem] rounded-2xl border border-red-950/60 bg-black/40 p-4">
            {loading ? (
              <p className="text-sm text-zinc-400">Scout is thinking...</p>
            ) : error ? (
              <pre className="whitespace-pre-wrap text-sm leading-6 text-red-300">
                {error}
              </pre>
            ) : report ? (
              <div className="space-y-6 text-zinc-200 [&_h1]:mb-5 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-red-100 [&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-red-100 [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_li]:my-2 [&_li]:leading-7 [&_ol]:my-5 [&_p]:my-4 [&_p]:leading-7 [&_strong]:text-white [&_ul]:my-5">
                {sourceType && (
                  <p className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-200">
                    source:{" "}
                    {sourceType === "url"
                      ? "live url fetched"
                      : sourceType === "search"
                        ? "web search"
                        : "pasted brief"}
                  </p>
                )}

                <ReactMarkdown>{report}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <p className="max-w-sm text-sm leading-6 text-zinc-500">
                  Your analysis will appear here after you generate a Scout
                  report.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}