import { NextResponse } from "next/server";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TAVILY_URL = "https://api.tavily.com/search";

type AnalyzeBody = {
  brief?: string;
  mode?: "analyze" | "ideas" | "submission" | "search";
};

function isUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchPageText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ScoutOpportunityAgent/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`could not fetch url: ${response.status}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();

  return [
    article?.title ? `title: ${article.title}` : "",
    article?.excerpt ? `excerpt: ${article.excerpt}` : "",
    article?.textContent || dom.window.document.body.textContent || "",
  ]
    .join("\n\n")
    .replace(/\s+/g, " ")
    .slice(0, 12000);
}

async function searchOpportunities(query: string) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("missing TAVILY_API_KEY in .env.local");
  }

  const response = await fetch(TAVILY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      max_results: 6,
      include_answer: true,
      include_raw_content: false,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "tavily search failed");
  }

  const results = Array.isArray(data.results) ? data.results : [];

  return [
    data.answer ? `search summary:\n${data.answer}` : "",
    "search results:",
    ...results.map((item: any, index: number) => {
      return `${index + 1}. ${item.title || "untitled"}\nurl: ${item.url || "n/a"}\nsummary: ${
        item.content || "no summary"
      }`;
    }),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function getModeInstruction(mode: AnalyzeBody["mode"]) {
  if (mode === "ideas") {
    return `
focus on generating 3 strong project ideas.
for each idea include:
- name
- one-sentence pitch
- why it fits the brief
- core features
- easiest mvp
- strongest judging angle
- implementation risk
`;
  }

  if (mode === "submission") {
    return `
focus on turning the project into a submission plan.
include:
- submission positioning
- missing requirements
- final checklist
- demo/pitch structure
- what to polish first
- what not to waste time on
`;
  }

  if (mode === "search") {
    return `
focus on opportunity discovery.
include:
- the best relevant opportunities found
- prize/deadline/sponsor details where available
- why each opportunity is worth considering
- what kind of project would fit
- which opportunity is strongest and why
`;
  }

  return `
focus on analysing the opportunity.
include:
- plain-English summary
- what judges or sponsors likely care about
- hidden requirements
- strongest possible build angle
- risks and traps
- recommended next steps
`;
}

async function generateReport({
  content,
  mode,
  sourceType,
}: {
  content: string;
  mode: AnalyzeBody["mode"];
  sourceType: string;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("missing OPENROUTER_API_KEY in .env.local");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Scout",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openrouter/auto",
      messages: [
        {
          role: "system",
          content:
            "you are scout, an opportunity strategy agent for hackathons, grants, bounties, and builder competitions. be specific, practical, and direct. do not pretend to know facts not present in the provided material. if information is missing, say so. format the response in clear markdown.",
        },
        {
          role: "user",
          content: `
source type: ${sourceType}
mode: ${mode || "analyze"}

${getModeInstruction(mode)}

material:
${content}
`,
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "openrouter request failed");
  }

  return (
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    "no analysis returned."
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeBody;
    const input = body.brief?.trim() || "";
    const mode = body.mode || "analyze";

    if (!input) {
      return NextResponse.json(
        { error: "please provide a brief, url, or search query." },
        { status: 400 },
      );
    }

    let content = input;
    let sourceType = "pasted brief";

    if (mode === "search") {
      content = await searchOpportunities(input);
      sourceType = "live search";
    } else if (isUrl(input)) {
      content = await fetchPageText(input);
      sourceType = "live url fetched";
    }

    const report = await generateReport({
      content,
      mode,
      sourceType,
    });

    return NextResponse.json({
      report,
      sourceType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";

    return NextResponse.json(
      {
        error: "request failed",
        details: message,
      },
      { status: 500 },
    );
  }
}