# TypeSafe AI — Demos

A collection of demo projects showcasing the [TypeSafe AI](https://typesafe.ai) evaluation API across different platforms and use cases. Each demo shows how deterministic text evaluation — classification, scoring, and probability — can be integrated into real applications.

## Demos at a Glance

| Demo | What it does | Platform | TypeSafe primitives used |
|------|-------------|----------|--------------------------|
| [**Next.js Agent**](./typesafe-nextjs-agent/) | Multi-agent chat with guardrails and tool selection | Next.js + Mastra | Noul, Choice, Score |
| [**Google Sheets**](./typesafe-google-sheet/) | Custom spreadsheet functions for text analysis | Google Apps Script | Noul, Choice, Score |
| [**Observer for pi**](./typesafe-observer-pi/) | Real-time mood monitor that adapts agent behavior | pi extension (Node.js) | Noul, Choice, Score |

---

### [typesafe-nextjs-agent](./typesafe-nextjs-agent/)

Multi-agent AI chat application built with Next.js and Mastra. Features side-by-side model comparison, document chat, live tool-selection visualization, and TypeSafe guardrails for input validation and intelligent tool filtering.

**Stack:** Next.js 16, Mastra, Vercel AI SDK, TypeSafe AI, Tailwind CSS

### [typesafe-google-sheet](./typesafe-google-sheet/)

Google Sheets add-on that exposes TypeSafe AI as native custom functions. Analyze customer reviews, classify survey responses, score content quality — all with `=NOUL()`, `=CHOICE()`, and `=SCORE()` formulas you can drag across rows.

**Stack:** Google Apps Script, TypeSafe AI HTTP API

### [typesafe-observer-pi](./typesafe-observer-pi/)

Real-time coding session mood monitor for the [pi](https://github.com/badlogic/pi-mono) coding agent. Evaluates user frustration and agent helpfulness on every message, shows a live mood indicator, and adapts the agent's behavior when things get tense.

**Stack:** TypeScript, pi extension API, TypeSafe AI evaluation API

