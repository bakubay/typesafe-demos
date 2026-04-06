# Documentation

Internal notes and references for this repo.

## Project stack

| Doc | Purpose |
| --- | --- |
| [ai-sdk-notes.md](./ai-sdk-notes.md) | Vercel AI SDK patterns used here (`useChat`, transport, streaming, theming). Referenced from `src/lib/ai-sdk-chat.ts`. |

## TypeSafe AI

| Doc | Purpose |
| --- | --- |
| [typesafe/api.md](./typesafe/api.md) | HTTP API reference (`/preview/evaluation`, `/preview/models`). |
| [typesafe/primitives.md](./typesafe/primitives.md) | TLM concepts: Noul, Choice, Score, composability, when to use vs a general LLM. |
| [typesafe/guardrail.md](./typesafe/guardrail.md) | How the input guardrail processor works in this codebase. |
| [typesafe/tool-filtering.md](./typesafe/tool-filtering.md) | How TypeSafe tool search narrows tools before each agent step. |
