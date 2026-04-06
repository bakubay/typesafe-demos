# AI SDK usage in this project

Documentation index: [README.md](./README.md).

This app uses the **Vercel AI SDK** (`ai`, `@ai-sdk/react`) for streaming chat UI. Prefer the official docs over blog posts; APIs change between majors.

## Canonical references

- [Chat UI (`useChat`, transport, messages)](https://ai-sdk.dev/docs/ai-sdk-ui/chat)
- [Message parts (text, tool, data)](https://ai-sdk.dev/docs/ai-sdk-ui/message-parts)
- [Stream protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)

## Patterns we follow

1. **`DefaultChatTransport`** — Use the built-in transport pointed at App Router API routes instead of ad-hoc `fetch` in `useChat` options (when possible), so streaming, resume, and error handling stay consistent.

2. **`onData`** — Custom `data-*` stream parts (e.g. `data-guardrail` from Mastra `writer.custom()`) are handled in `onData` and merged into local UI state; they are not assumed to live on `UIMessage` unless you persist them.

3. **`onError`** — Always attach an `onError` handler for debugging failed streams (logged in dev via `logChatTransportError` in `src/lib/ai-sdk-chat.ts`).

4. **Parallel chats** — Multiple `useChat` instances are independent; use `Promise.all` when you need to wait for both streams to finish in one submit handler.

5. **Server** — Mastra `handleChatStream` returns an AI SDK–compatible stream; keep API routes thin and delegate to Mastra agents.

## Theming

- Dark mode uses **next-themes** (`class` on `<html>`) and Tailwind `@custom-variant dark` in `src/app/globals.css`.
- Use **semantic** classes (`bg-background`, `border-border`, `text-muted-foreground`) in chat UI so light/dark tokens stay consistent.

## Guardrail visibility

- **TypeSafe** — Processors stream `data-guardrail` parts with **input preview** and full **evaluation JSON** (`content.typeSafeEvaluation`) when the API returns; expand **View guardrail content** on timeline rows.
- **Mastra** — UI processors stream the **same user text** being checked at each phase. Per-category scores from `ModerationProcessor` / `PromptInjectionDetector` are not re-emitted on success (Mastra does not expose them on the public API); when a processor **blocks**, the tripwire message is shown under **Stream error / tripwire** and includes scores if `includeScores: true` on the processor (see `weather-agent.ts`).
