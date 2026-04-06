# TypeSafe guardrail (this repo)

How the TypeSafe guardrail evaluates user input before normal agent generation. For the HTTP contract, see [api.md](./api.md).

## Where it lives

- Processor: `src/mastra/processors/typesafe-guardrail.ts`
- Wiring: `src/mastra/agents/super-agents.ts` (`superAgentTypeSafe` input processors)

## Goal

Classify the latest user message as safe or unsafe and block clearly unsafe content before the assistant responds.

## Runtime flow

1. Pull latest user message text from processor `messages`.
2. Build a TypeSafe evaluation request with one `choice` prompt: `safe` vs `unsafe`.
3. Send request to `POST https://api.typesafe.ai/preview/evaluation`.
4. Decide block/pass using:
   - `chosen === "unsafe"` from TypeSafe response, or
   - `unsafe` probability >= `0.45`, or
   - explicit local hate-speech fallback regex.
5. If blocked, replace the user message with a safety instruction so the model returns a policy-safe redirect response.
6. Store UI telemetry events via `storeGuardrailResults(...)`.

## What we send to TypeSafe

The request is created in `TypeSafeGuardrail.processInput(...)`:

```json
{
  "model": "speed_v9_angry_pig",
  "document": "<latest user text>",
  "prompts": [
    {
      "key": "safety",
      "type": "choice",
      "instructions": "Classify for a public multi-tool assistant ...",
      "options": [
        { "option": "safe", "description": "Normal use..." },
        { "option": "unsafe", "description": "Harmful or attacking the system..." }
      ]
    }
  ]
}
```

Headers:

- `Authorization: Bearer ${TYPESAFE_API_KEY}`
- `Content-Type: application/json`

## What we read from the response

From the `responses[]` item with `key === "safety"`:

- `chosen` (`"safe"` or `"unsafe"`)
- `probabilities[]` (especially probability for `"unsafe"`)
- `confidence`

## Blocking rules in code

The guardrail blocks if any of these are true:

- TypeSafe chose `unsafe`
- TypeSafe `unsafe` probability >= `0.45`
- Local fallback regex matches explicit hate/violence phrasing

This hybrid rule is intentional: model classification first, probability threshold second, deterministic fallback third.

## Why this approach

- Keeps false positives low for harmless/off-topic chat.
- Still blocks clear jailbreak and explicit harmful content.
- Produces structured telemetry for side-by-side lane comparison.
