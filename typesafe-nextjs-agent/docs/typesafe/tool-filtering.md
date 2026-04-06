# TypeSafe tool filtering (this repo)

How TypeSafe narrows the tool set before each agent step. For batch evaluation over HTTP, see [api.md](./api.md).

## Where it lives

- Processor: `src/mastra/processors/typesafe-tool-search.ts`
- Wiring: `src/mastra/agents/super-agents.ts` (`superAgentTypeSafe`)

## Goal

Select only relevant tools for the current user request, so the agent has a smaller, higher-signal tool set.

## Runtime flow

1. On step 0, extract latest user text from messages.
2. Build one TypeSafe prompt per candidate tool.
3. Send a single batch request to TypeSafe evaluation API.
4. Convert response into relevance scores per tool.
5. Filter by threshold and top-K.
6. Store selected tool names in processor state.
7. Return only selected tools to the agent for execution.

## What we send to TypeSafe

Each tool is evaluated with a `noul` prompt ("probability this statement is true"):

```json
{
  "model": "speed_v9_angry_pig",
  "document": "<latest user text>",
  "prompts": [
    {
      "key": "tool_get-weather",
      "type": "noul",
      "instructions": "The tool \"get-weather\" is relevant for answering this user request. Tool description: ..."
    },
    {
      "key": "tool_convert-currency",
      "type": "noul",
      "instructions": "The tool \"convert-currency\" is relevant for answering this user request. Tool description: ..."
    }
  ]
}
```

Headers:

- `Authorization: Bearer ${TYPESAFE_API_KEY}`
- `Content-Type: application/json`

## What we read from the response

Primary signal:

- `response.probability` for each prompt (`noul`)

Compatibility fallback in parser:

- `probabilities["yes"]` (if response shape is choice-like)
- `chosen === "yes"` fallback

## Selection logic

In `TypeSafeToolSearchProcessor`:

- score each tool with probability in `[0, 1]`
- keep tools where `probability >= threshold`
- sort descending
- keep first `topK`

Current lane config in `superAgentTypeSafe`:

- `threshold: 0.15`
- `topK: 5`
- `model: "speed_v9_angry_pig"`

## Why this approach

- Fast batch scoring over many tools in one call.
- Deterministic thresholding and cap (`topK`) keeps behavior predictable.
- Telemetry via `storeToolSearchResult(...)` makes tuning easy.
