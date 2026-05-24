import { NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/auto";

type RequestBody = {
  brief?: string;
  mode?: "strategy" | "build" | "risks";
  searchQuery?: string;
};

function isLikelyUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

async function fetchUrlText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ScoutOpportunityAgent/1.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`failed to fetch url: ${response.status}`);
  }

  const html = await response.text();
  return stripHtml(html);
}

async function tavilySearch(query: string) {
  if (!TAVILY_API_KEY) {
    throw new Error("missing TAVILY_API_KEY");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "basic",
      include_answer: true,
      include_raw_content: false,
      max_results: 5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`tavily search failed: ${errorText}`);
  }

  const data = await response.json();

  const results = Array.isArray(data.results)
    ? data.results
        .map(
          (item: { title?: string; url?: string; content?: string }, index: number) =>
            `${index + 1}. ${item.title || "untitled"}\nurl: ${item.url || "n/a"}\nsummary: ${
              item.content || "no summary"
            }`
        )
        .join("\n\n")
    : "";

  return [data.answer ? `search answer: ${data.answer}` : "", results].filter(Boolean).join("\n\n");
}

function buildModeInstruction(mode: RequestBody["mode"]) {
  if (mode === "build") {
    return "focus on concrete product concepts, mvp scope, core features, technical architecture, and what to build first.";
  }

  if (mode === "risks") {
    return "focus on feasibility risks, weak assumptions, missing data, judging gaps, technical blockers, and mitigation steps.";
  }

  return "focus on strategic fit, prize alignment, judging criteria, strongest positioning, and the best submission angle.";
}

async function askOpenRouter(content: string, mode: RequestBody["mode"], sourceType: string) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("missing OPENROUTER_API_KEY");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://scout.local",
      "X-Title": "Scout",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "you are scout, an opportunity strategy agent for builders. you analyse hackathons, grants, bounties, and market opportunities. be specific, practical, and submission-oriented. do not pretend to browse beyond the provided content/search results. if information is missing, state assumptions clearly. always produce markdown.",
        },
        {
          role: "user",
          content: `source type: ${sourceType}

mode instruction: ${buildModeInstruction(mode)}

analyse this opportunity content:

${content}

return a scout report with:
1. executive verdict
2. what the opportunity is really rewarding
3. strongest project angle
4. recommended mvp
5. technical build plan
6. risks and mitigations
7. submission checklist`,
        },
      ],
      temperature: 0.35,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`openrouter failed: ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "no report returned.";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const brief = body.brief?.trim() || "";
    const searchQuery = body.searchQuery?.trim() || "";
    const mode = body.mode || "strategy";

    let content = "";
    let sourceType = "brief";

    if (searchQuery) {
      content = await tavilySearch(searchQuery);
      sourceType = "live search";
    } else if (brief && isLikelyUrl(brief)) {
      content = await fetchUrlText(brief);
      sourceType = "live url";
    } else {
      content = brief;
      sourceType = "pasted brief";
    }

    if (!content) {
      return NextResponse.json(
        { error: "missing input", details: "paste a brief, url, or search query." },
        { status: 400 }
      );
    }

    const report = await askOpenRouter(content, mode, sourceType);

    return NextResponse.json({
      report,
      sourceType,
    });
  } catch (error) {
    console.error("Failed to handle /api/analyze", error);

    return NextResponse.json(
      {
        error: "request failed",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 }
    );
  }
}