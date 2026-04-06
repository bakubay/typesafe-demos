# TypeSafe HTTP API (v0.2.0)

**Base URL:** `https://api.typesafe.ai/`

For product context and when to use Noul / Choice / Score, see [primitives.md](./primitives.md).

**Authentication:** Bearer token in the `Authorization` header.

```
Authorization: Bearer <your_api_key>
```

---

## POST `/preview/evaluation`

Evaluate one or more prompts against a document.

### Request body (`application/json`)

| Field      | Type                         | Required | Description                                                                                                  |
| ---------- | ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `document` | string \| object \| object[] | ✅       | The document to evaluate prompts against. Can be a plain string, a key-value object, or an array of objects. |
| `model`    | string                       | ✅       | The model to use for evaluation.                                                                             |
| `prompts`  | Prompt[]                     | ✅       | Non-empty array of prompt descriptors.                                                                       |

#### `document` variants

- **string** — plain text
- **object** — free-form key/value object (`{ [key: string]: any }`)
- **object[]** — array of the above objects

#### `prompts[]` fields

| Field          | Type                                 | Required | Default    | Description                                                           |
| -------------- | ------------------------------------ | -------- | ---------- | --------------------------------------------------------------------- |
| `key`          | string                               | ✅       | —          | Name used to identify this prompt in the response. Must be non-empty. |
| `type`         | `"choice"` \| `"noul"` \| `"score"`  | —        | `"choice"` | Discriminator for the prompt type (see variants below).               |
| `instructions` | string \| object \| object[] \| null | —        | `null`     | Overall description of the output. Can be a dict for structured info. |

**When `type = "choice"` (default)**

| Field                   | Type                                 | Required | Description                                                           |
| ----------------------- | ------------------------------------ | -------- | --------------------------------------------------------------------- |
| `options`               | Option[]                             | ✅       | Options to evaluate.                                                  |
| `options[].option`      | string                               | ✅       | Value returned if criterion matches. Must match the output type.      |
| `options[].description` | string \| object \| object[] \| null | —        | Evaluation rubric for this option. Optional but improves performance. |

**When `type = "noul"`** _(probability of a yes/no statement)_

No `options` field. Use `key`, `type: "noul"`, and `instructions`.

**When `type = "score"`** _(numeric scoring)_

| Field                  | Type                         | Required | Description                                  |
| ---------------------- | ---------------------------- | -------- | -------------------------------------------- |
| `levels`               | Level[]                      | ✅       | Scoring criteria.                            |
| `levels[].level`       | integer                      | ✅       | Numerical value for the score at this level. |
| `levels[].description` | string \| object \| object[] | ✅       | Evaluation rubric for this level.            |

---

### Responses

#### `200 OK`

```json
{
  "model": "speed_latest",
  "responses": [
    {
      "key": "sentiment",
      "type": "choice",
      "chosen": "positive",
      "probabilities": [
        { "option": "positive", "probability": 0.91 },
        { "option": "negative", "probability": 0.06 },
        { "option": "neutral", "probability": 0.03 }
      ],
      "confidence": 0.91
    }
  ],
  "usage": { "billing_units": 1 }
}
```

| Field                 | Type       | Required | Description                                |
| --------------------- | ---------- | -------- | ------------------------------------------ |
| `model`               | string     | ✅       | The model used.                            |
| `responses`           | Response[] | ✅       | One response per prompt, matched by `key`. |
| `usage.billing_units` | integer    | ✅       | Billing units consumed. Default: `1`.      |

**`responses[]` variants (discriminated by `type`):**

**`type = "choice"`**

| Field                         | Type           | Required | Description                              |
| ----------------------------- | -------------- | -------- | ---------------------------------------- |
| `key`                         | string         | ✅       | Matches the prompt key.                  |
| `type`                        | `"choice"`     | —        | —                                        |
| `chosen`                      | string         | ✅       | The option with the highest probability. |
| `probabilities`               | Probability[]  | ✅       | All options and their probabilities.     |
| `probabilities[].option`      | string         | ✅       | The option.                              |
| `probabilities[].probability` | number         | ✅       | Probability this option is chosen.       |
| `confidence`                  | number \| null | ✅       | Model confidence, 0–1.                   |

**`type = "noul"`**

| Field         | Type     | Required | Description                                                |
| ------------- | -------- | -------- | ---------------------------------------------------------- |
| `key`         | string   | ✅       | Matches the prompt key.                                    |
| `type`        | `"noul"` | —        | —                                                          |
| `probability` | number   | ✅       | Probability the statement is true / question answered yes. |

**`type = "score"`**

| Field         | Type           | Required | Description                                                         |
| ------------- | -------------- | -------- | ------------------------------------------------------------------- |
| `key`         | string         | ✅       | Matches the prompt key.                                             |
| `type`        | `"score"`      | —        | —                                                                   |
| `expectation` | number         | ✅       | Expected score, averaged by probability across all possible values. |
| `confidence`  | number \| null | ✅       | Model confidence, 0–1.                                              |

#### `422 Unprocessable Entity`

Validation error from malformed request body.

---

## GET `/preview/models`

List available models.

### Request

No body. Auth header required.

### Response `200 OK`

```json
{
  "models": [
    {
      "name": "string",
      "description": "string",
      "release_date": "string",
      "tags": ["string"]
    }
  ]
}
```

| Field                   | Type     | Required | Description                     |
| ----------------------- | -------- | -------- | ------------------------------- |
| `models`                | Model[]  | ✅       | List of available models.       |
| `models[].name`         | string   | ✅       | Model identifier.               |
| `models[].description`  | string   | ✅       | Human-readable description.     |
| `models[].release_date` | string   | ✅       | Release date of the model.      |
| `models[].tags`         | string[] | ✅       | Tags associated with the model. |

#### `422 Unprocessable Entity`

---

## Examples

### cURL — `choice`

```bash
curl -X POST https://api.typesafe.ai/preview/evaluation \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "document": "The product arrived on time and worked great.",
    "model": "your-model-name",
    "prompts": [
      {
        "key": "sentiment",
        "type": "choice",
        "instructions": "Rate the sentiment of the review",
        "options": [
          { "option": "positive", "description": "The review is positive" },
          { "option": "negative", "description": "The review is negative" },
          { "option": "neutral",  "description": "The review is neutral" }
        ]
      }
    ]
  }'
```

### TypeScript — `fetch` (no SDK)

```typescript
const res = await fetch("https://api.typesafe.ai/preview/evaluation", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
  },
  body: JSON.stringify({
    model: "speed_latest",
    document: userMessage,
    prompts: [
      {
        key: "safety",
        type: "choice",
        instructions: "Is this message safe for an AI assistant to respond to?",
        options: [
          { option: "safe", description: "Appropriate, on-topic message" },
          { option: "unsafe", description: "Harmful, jailbreak, or off-topic content" },
        ],
      },
    ],
  }),
});
const data = await res.json();
const chosen = data.responses.find((r: { key: string }) => r.key === "safety")?.chosen;
```

### cURL — `noul`

```bash
curl -X POST https://api.typesafe.ai/preview/evaluation \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "document": "User wants the weather in Paris tomorrow.",
    "model": "your-model-name",
    "prompts": [
      {
        "key": "relevant_to_weather",
        "type": "noul",
        "instructions": "The user is asking about weather or forecasts."
      }
    ]
  }'
```
