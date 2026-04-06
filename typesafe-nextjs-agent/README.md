# TypeSafe AI — Next.js Agent Demo

A multi-agent AI chat application built with [Next.js](https://nextjs.org), [Mastra](https://mastra.ai), and [TypeSafe AI](https://typesafe.ai). Features multiple chat interfaces, document chat, live agent decision visualization, and TypeSafe guardrails for input validation and intelligent tool selection.

## Features

- **Multi-model chat** — side-by-side conversations with different AI models (GPT-4o variants + TypeSafe-enhanced agents)
- **Document chat** — upload documents and chat with them using intelligent tool filtering
- **Walk pipeline** — live visualization of how the agent selects and calls tools
- **TypeSafe guardrails** — input validation and tool selection powered by deterministic evaluation
- **20+ tools** — weather, flights, hotels, restaurants, news, currency, stocks, and more
- **Streaming responses** — real-time streamed output with tool use visualization

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Agent framework:** Mastra
- **AI:** Vercel AI SDK, OpenAI, TypeSafe AI evaluation API
- **UI:** Tailwind CSS 4, shadcn/ui, Radix UI, Rive animations
- **Storage:** LibSQL (Turso)

## Prerequisites

- Node.js >= 22
- [pnpm](https://pnpm.io/)
- An [OpenAI API key](https://platform.openai.com)
- A [TypeSafe AI API key](https://typesafe.ai)

## Getting Started

1. Copy the environment template and add your API keys:

   ```bash
   cp .env.example .env
   ```

   Fill in `OPENAI_API_KEY` and `TYPESAFE_API_KEY` at minimum. `PAGEINDEX_API_KEY` is optional (used for document chat).

2. Install dependencies and run:

   ```bash
   pnpm install
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

| Path | Description |
|------|-------------|
| `src/mastra/agents/` | Agent definitions (super agents, doc-chat agent) |
| `src/mastra/tools/` | 20+ tool definitions (weather, news, flights, etc.) |
| `src/mastra/processors/` | Input guardrails and tool filtering via TypeSafe AI |
| `src/mastra/workflows/` | Multi-step orchestration workflows |
| `src/app/chat/` | Multi-model chat interface |
| `src/app/doc-chat/` | Document upload and chat |
| `src/app/walk-pipeline/` | Agent decision visualization |
| `src/components/` | Reusable UI components |

## License

See [LICENSE](../LICENSE) in the root of this repository.
