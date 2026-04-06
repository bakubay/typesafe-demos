# TypeSafe AI — Demos

A collection of demo projects showcasing the [TypeSafe AI](https://typesafe.ai) evaluation API across different platforms and use cases. Each demo shows how deterministic text evaluation — classification, scoring, and probability — can be integrated into real applications.

## Demos

### [typesafe-nextjs-agent](./typesafe-nextjs-agent/)

Multi-agent AI chat application built with Next.js and Mastra. Features side-by-side model comparison, document chat, live tool-selection visualization, and TypeSafe guardrails for input validation and intelligent tool filtering.

**Stack:** Next.js 16, Mastra, Vercel AI SDK, TypeSafe AI, Tailwind CSS

### [typesafe-google-sheet](./typesafe-google-sheet/)

Google Sheets add-on that exposes TypeSafe AI as native custom functions. Analyze customer reviews, classify survey responses, score content quality — all with `=NOUL()`, `=CHOICE()`, and `=SCORE()` formulas you can drag across rows.

**Stack:** Google Apps Script, TypeSafe AI HTTP API

### [typesafe-observer-pi](./typesafe-observer-pi/)

Real-time coding session mood monitor for the [pi](https://github.com/badlogic/pi-mono) coding agent. Evaluates user frustration and agent helpfulness on every message, shows a live mood indicator, and adapts the agent's behavior when things get tense.

**Stack:** TypeScript, pi extension API, TypeSafe AI evaluation API

## What is TypeSafe AI?

TypeSafe AI provides deterministic text evaluation — classify, score, and measure probability over text without consuming LLM tokens. All three demos use the same HTTP API (`https://api.typesafe.ai/preview`) with three core primitives:

- **Noul** — probability (0-1) that a yes/no statement is true about a text
- **Choice** — classify text into one of several options, with optional confidence and full probability distributions
- **Score** — rate text on a numeric scale, returning an expected value

Get an API key at [typesafe.ai](https://typesafe.ai).

## License

MIT
