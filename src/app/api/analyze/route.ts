import { NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/auto";

type ScoutMode = "analyze" | "ideas" | "submission" | "search";
type SourceType = "pasted brief" | "live url" | "live search";

type RequestBody = {
  brief?: string;
  mode?: ScoutMode;
  searchQuery?: string;
};

const scoutModes = new Set<ScoutMode>(["analyze", "ideas", "submission", "search"]);

function normalizeMode(mode: unknown): ScoutMode {
  return typeof mode === "string" && scoutModes.has(mode as ScoutMode)
    ? (mode as ScoutMode)
    : "analyze";
}

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
  // Try Jina Reader first: free, no key, handles JS-rendered pages.
  try {
    const jina = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "User-Agent": "ScoutOpportunityAgent/1.0" },
    });
    if (jina.ok) {
      const text = (await jina.text()).trim();
      if (text.length > 200) return text.slice(0, 12000);
    }
  } catch {}

  // Fallback to direct fetch + stripHtml.
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ScoutOpportunityAgent/1.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Could not fetch that URL. The page returned HTTP ${response.status}.`
    );
  }

  const html = await response.text();
  return stripHtml(html);
}

async function tavilySearch(query: string) {
  if (!TAVILY_API_KEY) {
    throw new Error(
      "Search is not configured. Add TAVILY_API_KEY to .env.local."
    );
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
    throw new Error(
      "Search failed. Check the Tavily key or try a narrower query."
    );
  }

  const data = await response.json();

  const results = Array.isArray(data.results)
    ? data.results
        .map(
          (
            item: { title?: string; url?: string; content?: string },
            index: number
          ) =>
            `${index + 1}. ${item.title || "Untitled"}\nURL: ${item.url || "n/a"}\nSummary: ${
              item.content || "No summary"
            }`
        )
        .join("\n\n")
    : "";

  return [data.answer ? `Search answer: ${data.answer}` : "", results]
    .filter(Boolean)
    .join("\n\n");
}

function buildModeInstruction(mode: ScoutMode) {
  if (mode === "ideas") {
    return "Generate differentiated project ideas that fit the sponsor, prize incentives, judging criteria, and technical constraints. Rank ideas by likely submission strength and buildability.";
  }

  if (mode === "submission") {
    return "Focus on final submission strategy: pitch, demo flow, README, screenshots, judging narrative, risk reduction, and the exact polish needed before deadline.";
  }

  if (mode === "search") {
    return "Evaluate the search results as builder opportunities. Rank the best opportunities, explain fit, identify deadlines or missing data when present, and recommend where to focus first.";
  }

  return "Focus on strategic fit, prize alignment, judging criteria, strongest positioning, recommended MVP, risks, and the best submission angle.";
}

function buildReportFormat(mode: ScoutMode) {
  if (mode === "ideas") {
    return `Return a Scout ideas report with:
1. Executive recommendation
2. Top project concepts ranked
3. Strongest concept and why
4. MVP scope
5. Technical architecture
6. Differentiation and judging angle
7. Build risks and next steps`;
  }

  if (mode === "submission") {
    return `Return a Scout submission plan with:
1. Submission verdict
2. Strongest pitch angle
3. Demo narrative
4. README and documentation checklist
5. Product polish checklist
6. Judging risks and fixes
7. Final 24-hour action plan`;
  }

  if (mode === "search") {
    return `Return a Scout opportunity search report with:
1. Best opportunity to pursue
2. Ranked opportunities
3. Why each opportunity fits or does not fit
4. Likely build angles
5. Required follow-up research
6. Risks and constraints
7. Recommended next move`;
  }

  return `Return a Scout report with:
1. Executive verdict
2. What the opportunity is really rewarding
3. Strongest project angle
4. Recommended MVP
5. Technical build plan
6. Risks and mitigations
7. Submission checklist`;
}

async function askOpenRouter(
  content: string,
  mode: ScoutMode,
  sourceType: SourceType
) {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "Analysis is not configured. Add OPENROUTER_API_KEY to .env.local."
    );
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
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
            content: `You are Scout, an opportunity strategy analyst for hackathons, grants, bounties, and builder competitions.

Important constraint: you do not assume you can browse the web or fetch live pages unless the runtime explicitly provides those tools. Your primary job is to analyze the opportunity details the user provides.

Your job is to help a builder decide whether an opportunity is worth entering, what angle gives them the best chance of winning, and what they should build or submit.

Style rules:
- Be direct and practical
- Do not be generic
- Do not overhype weak ideas
- Prefer concrete product strategy over vague inspiration
- Explain tradeoffs clearly
- Use simple language
- Optimize for winning, shipping, and judge clarity
- Always produce clean markdown

If the user gives incomplete information, make reasonable assumptions, state them briefly, and continue.`,
          },
          {
            role: "user",
            content: `Source type: ${sourceType}

Mode instruction: ${buildModeInstruction(mode)}

Analyze this opportunity content:

${content}

${buildReportFormat(mode)}`,
          },
        ],
        temperature: 0.35,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Scout could not generate a report. Check the OpenRouter key or selected model."
    );
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "No report returned.";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const brief = body.brief?.trim() || "";
    const mode = normalizeMode(body.mode);
    const searchQuery = (
      body.searchQuery ||
      (mode === "search" ? brief : "")
    ).trim();

    let content = "";
    let sourceType: SourceType = "pasted brief";

    if (mode === "search") {
      if (!searchQuery) {
        return NextResponse.json(
          {
            error: "missing input",
            details:
              "Enter a search query before asking Scout to find opportunities.",
          },
          { status: 400 }
        );
      }

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
        {
          error: "missing input",
          details: "Paste a brief, URL, or search query.",
        },
        { status: 400 }
      );
    }

    const report = await askOpenRouter(content, mode, sourceType);

    return NextResponse.json({
      report,
      sourceType,
      mode,
    });
  } catch (error) {
    console.error("Failed to handle /api/analyze", error);

    return NextResponse.json(
      {
        error: "request failed",
        details:
          error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 500 }
    );
  }
}
