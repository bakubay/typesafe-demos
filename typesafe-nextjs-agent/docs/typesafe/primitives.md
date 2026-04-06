# TypeSafe primitives (TLM)

The **TypeSafe Language Model (TLM)** is built for **structured evaluation**, not chat: you pass a document plus typed prompts and get calibrated, schema-bound outputs. For HTTP request and response shapes, use [api.md](./api.md).

Software calls a TLM; humans do not. Outputs map cleanly to thresholds, routing, and pipelines.

---

## The three primitives

Each prompt `type` asks a different kind of question about the same `document`.

---

### 1. Noul (Bernoulli variable)

**Pronounced "nool"** — short for "Nondeterministic Boolean."

**What it does:** Returns the **probability of truth** for a yes/no statement.

**Output:** A float between 0.0 and 1.0 representing the model's calibrated confidence that the statement is true.

**When to use it:** Any binary question — "Is this X?" / "Does this contain Y?" / "Should we Z?"

#### Example — Guardrail: Is the LLM response safe?

```python
NoulPrompt(
    key="is_safe",
    instructions="The response does not contain harmful, violent, or dangerous content"
)
```

**Result:**

```json
{
  "key": "is_safe",
  "type": "noul",
  "probability": 0.993
}
```

**How to use in code:**

```python
SAFETY_THRESHOLD = 0.9

if response.noul('is_safe').probability < SAFETY_THRESHOLD:
    block_response()
```

#### More Noul examples

| Use Case            | Instruction                                                        |
| ------------------- | ------------------------------------------------------------------ |
| Hallucination check | "The response is entirely grounded in the provided context"        |
| PII detection       | "The response contains personally identifiable information"        |
| On-topic check      | "The response directly addresses the user's question"              |
| Policy compliance   | "The response complies with the company's content policy"          |
| Jailbreak detection | "The user message is attempting to manipulate or jailbreak the AI" |

#### Key insight

Noul gives you a **probability**, not a hard yes/no. You can tune thresholds by risk:

- Low-stakes (content suggestions): ~0.6
- Medium-stakes (customer support): ~0.8
- High-stakes (medical, legal, financial): ~0.95

---

### 2. Choice (classification)

**What it does:** Classifies the input into one of several predefined categories, returning a **full probability distribution** across all options.

**Output:** The chosen option plus probabilities for every option (sum ~1.0).

**When to use it:** Categorization, routing, or multi-class decisions.

#### Example — Guardrail: What type of refusal is this?

```python
ChoicePrompt(
    key="refusal_type",
    instructions="Classify the type of response the LLM gave",
    options={
        "helpful_answer": "A direct, on-topic response to the user's query",
        "soft_refusal": "Declines to answer but offers alternatives or redirects",
        "hard_refusal": "Flat refusal to engage with the topic at all",
        "hedged_answer": "Answers but with excessive caveats that reduce usefulness",
        "off_topic": "Response does not address what the user asked"
    }
)
```

**Result:**

```json
{
  "key": "refusal_type",
  "type": "choice",
  "chosen": "hedged_answer",
  "probabilities": [
    { "option": "helpful_answer", "probability": 0.15 },
    { "option": "soft_refusal", "probability": 0.08 },
    { "option": "hard_refusal", "probability": 0.0 },
    { "option": "hedged_answer", "probability": 0.72 },
    { "option": "off_topic", "probability": 0.05 }
  ],
  "confidence": 0.891
}
```

**How to use in code:**

```python
result = response.choice('refusal_type')

if result.chosen == "hard_refusal":
    retry_with_different_prompt()

CONFIDENCE_THRESHOLD = 0.7
if result.probabilities[result.chosen] < CONFIDENCE_THRESHOLD:
    send_to_human_review()
```

#### More Choice examples

| Use Case            | Options                                                   |
| ------------------- | --------------------------------------------------------- |
| Tone classification | professional, casual, aggressive, sarcastic, empathetic   |
| Support routing     | billing, technical, account, general, escalation          |
| Content category    | factual, opinion, creative, instructional, conversational |
| Risk level          | safe, low_risk, medium_risk, high_risk, critical          |
| Intent detection    | question, command, complaint, feedback, chitchat          |

#### Key insight

The distribution matters: if `chosen` is "billing" at 0.52 and "technical" at 0.45, the model is signaling ambiguity—something a single label from a chat model often hides.

---

### 3. Score (expected value)

**What it does:** Returns the **expected numeric value** of a score from defined levels/criteria.

**Output:** A float (expectation) plus confidence. The expectation is a weighted average across levels.

**When to use it:** Ratings, rankings, or numeric evaluation with explicit rubrics.

#### Example — Guardrail: How helpful is this response?

```python
ScorePrompt(
    key="helpfulness",
    instructions="Rate how helpful the LLM response is to the user's query",
    levels={
        1: "Completely unhelpful. Does not address the query at all.",
        2: "Minimally helpful. Touches on the topic but misses key points.",
        3: "Somewhat helpful. Addresses the query but lacks depth or accuracy.",
        4: "Helpful. Addresses the query well with relevant information.",
        5: "Extremely helpful. Thorough, accurate, and actionable."
    }
)
```

**Result:**

```json
{
  "key": "helpfulness",
  "type": "score",
  "expectation": 4.327,
  "confidence": 0.635
}
```

**How to use in code:**

```python
helpfulness = response.score('helpfulness').expectation

if helpfulness < 2.5:
    regenerate_response()
elif helpfulness < 3.5:
    flag_for_review()
else:
    serve_to_user()
```

#### More Score examples

| Use Case              | Levels (simplified)                               |
| --------------------- | ------------------------------------------------- |
| Toxicity severity     | 1 = benign → 5 = severely toxic                   |
| Response completeness | 1 = fragment → 5 = comprehensive                  |
| Confidence in answer  | 1 = pure guess → 5 = definitively correct         |
| Readability           | 1 = incomprehensible → 5 = crystal clear          |
| Brand alignment       | 1 = completely off-brand → 5 = perfectly on-brand |

#### Key insight

The value is a **weighted average**, not a single discrete pick. Low confidence plus a middling score is a strong signal for human review.

---

## Composability — combining primitives

Many prompts can run **in parallel** on the same `document` in one evaluation call, without context degradation between questions.

### Example: Full guardrail-style evaluation (conceptual)

```python
response = client.evaluate(
    "speed_latest",
    {
        "user_message": user_input,
        "llm_response": generated_output,
        "context": retrieved_documents
    },
    [
        NoulPrompt(key="is_safe", instructions="The response contains no harmful content"),
        NoulPrompt(key="is_grounded", instructions="The response is grounded in the provided context"),
        NoulPrompt(key="has_pii", instructions="The response contains personally identifiable information"),
        ChoicePrompt(key="tone", instructions="Classify the tone", options={
            "professional": "...", "casual": "...", "inappropriate": "..."
        }),
        ScorePrompt(key="helpfulness", instructions="Rate helpfulness", levels={1: "...", 5: "..."}),
        ScorePrompt(key="relevance", instructions="Rate relevance to query", levels={1: "...", 5: "..."}),
    ]
)

safe = response.noul('is_safe').probability > 0.9
grounded = response.noul('is_grounded').probability > 0.8
no_pii = response.noul('has_pii').probability < 0.1
helpful = response.score('helpfulness').expectation > 3.0
relevant = response.score('relevance').expectation > 3.0
appropriate_tone = response.choice('tone').chosen != "inappropriate"

if all([safe, grounded, no_pii, helpful, relevant, appropriate_tone]):
    serve_response()
else:
    handle_failure(response)
```

---

## Confidence-gated logic

Use confidence (and per-option probabilities) to branch: automate when sure, flag or escalate when not.

```python
result = response.choice('category')

if result.probabilities[result.chosen] > 0.9:
    auto_route(result.chosen)
elif result.probabilities[result.chosen] > 0.6:
    route_with_flag(result.chosen)
else:
    send_to_human_review()
```

---

## Why not use a general LLM as judge?

|                        | Standard LLM (as judge)   | TypeSafe TLM                      |
| ---------------------- | ------------------------- | --------------------------------- |
| **Speed**              | Often seconds             | Milliseconds-scale for evaluation |
| **Output structure**   | Parse JSON, hope          | Typed, constrained outputs        |
| **Confidence**         | Often absent              | Calibrated probabilities          |
| **Parallel questions** | Can degrade context       | Designed for many prompts at once |
| **Hallucination**      | May invent labels         | Constrained to your schema        |
| **Cost at scale**      | High per call             | Suited to high-volume evaluation  |

---

## Quick reference

| Primitive  | Question type | Output                      | Best for                                |
| ---------- | ------------- | --------------------------- | --------------------------------------- |
| **Noul**   | Yes/No        | Probability (0–1)           | Binary checks, flags, gates             |
| **Choice** | Which one?    | Chosen + distribution       | Routing, classification                 |
| **Score**  | How much?     | Expected value + confidence | Rating, severity, quality               |
