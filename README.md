# Scout

Scout is an opportunity strategy agent for builders. It analyzes hackathon briefs, grant descriptions, bounty prompts, URLs, and live opportunity searches, then turns them into practical build and submission guidance.

The app is built for the Swarms ACM hackathon context and is intentionally focused: it helps a builder decide what to build, how to position it, what risks to reduce, and how to package the final submission.

## What Scout Does

- Analyzes pasted opportunity briefs.
- Fetches and analyzes live URL content.
- Searches the web for relevant opportunities through Tavily.
- Generates project ideas matched to sponsor and prize incentives.
- Produces submission plans with pitch, demo, README, and polish checklists.
- Renders structured markdown reports in the app.

Scout is not a generic chatbot. It is a focused opportunity analysis workflow for hackathons, grants, bounties, and builder programs.

## Modes

| Mode | Purpose |
| --- | --- |
| Analyze brief | Understand requirements, judging criteria, strategic fit, MVP scope, and risks. |
| Generate ideas | Produce ranked project concepts with build scope and differentiation. |
| Submission plan | Turn a nearly finished project into a final pitch, demo, README, and polish plan. |
| Search opportunities | Use live search results to find and rank relevant opportunities. |

## Architecture

```text
src/app/page.tsx
  Client UI for entering briefs, URLs, or search queries.

src/app/api/analyze/route.ts
  Next.js Route Handler that fetches URL/search context and calls OpenRouter.

OpenRouter
  Generates the Scout report from structured context.

Tavily
  Provides live search results for opportunity discovery.
```

The API route keeps API keys on the server side. The client only calls `/api/analyze`.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- React Markdown
- OpenRouter
- Tavily Search API

## Environment Variables

Create `.env.local`:

```bash
OPENROUTER_API_KEY=your_openrouter_api_key
TAVILY_API_KEY=your_tavily_api_key
OPENROUTER_MODEL=openrouter/auto
```

`OPENROUTER_MODEL` is optional. If omitted, Scout uses `openrouter/auto`.

## Setup

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## Notes

- Search mode requires `TAVILY_API_KEY`.
- All report generation requires `OPENROUTER_API_KEY`.
- If a URL cannot be fetched, paste the brief text directly.
- Scout only analyzes provided content and search results; it does not claim to browse beyond that context.

## Product Direction

Scout is designed to help builders make sharper opportunity decisions:

- Is this opportunity worth pursuing?
- What is the strongest submission angle?
- What should the MVP include?
- What risks could hurt judging?
- What needs to be done before submission?

The goal is practical builder leverage, not open-ended conversation.
