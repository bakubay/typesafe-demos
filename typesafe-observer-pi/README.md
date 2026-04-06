# TypeSafe Observer

A [pi](https://github.com/badlogic/pi-mono) extension that monitors your coding session mood in real time. It evaluates user frustration, agent helpfulness, and adapts the agent's behavior when things get tense.

Powered by the [TypeSafe AI](https://typesafe.ai) evaluation API.

![Session mood report and `/mood` command in pi](cli-image.jpg)

## What it does

- Evaluates every user message for frustration, intent, specificity, and whether it's a correction
- Evaluates every agent response for hedging, over-explanation, helpfulness, and response type
- Shows a live mood indicator in the pi status bar
- Adapts the system prompt when frustration rises (more direct responses, and at high frustration, gently suggests taking a break)
- Detects patterns like "short inputs correlate with frustration" or "hedged responses lead to corrections"
- Provides `/mood` command for a full session mood report with sparklines and gauges
- Provides `/mood-debug` command to test API connectivity

## Get pi

Install the [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) (the `pi` CLI):

```bash
npm install -g @mariozechner/pi-coding-agent
```

Authenticate with a provider API key or `/login` as described in the [pi quick start](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#quick-start).

## Install and activate

Register this extension with pi so it loads on startup:

```bash
pi install git:github.com/Typesafe-ai/typesafe-observer
```

That installs the package and enables the extension. If it does not appear right away, run `/reload` in pi or check **Extensions** in `/settings` / `pi config`.

To try it once without persisting the install:

```bash
pi -e git:github.com/Typesafe-ai/typesafe-observer
```

## Setup

Set your TypeSafe API key:

```bash
export TYPESAFE_API_KEY=your-key-here
```

Get a key at [typesafe.ai](https://typesafe.ai). The extension disables itself gracefully if the key is missing.

## Commands

| Command | Description |
|---------|-------------|
| `/mood` | Full session mood report with frustration gauges, helpfulness scores, intent breakdown, trajectory sparklines, and detected patterns |
| `/mood reset` | Clear all mood stats for the current session |
| `/mood-debug` | Run a diagnostic call to the TypeSafe API |

## How it works

The extension uses TypeSafe AI's evaluation API to classify text without using your LLM provider's tokens. Evaluations run asynchronously and don't block your interaction with pi.

**Frustration tiers:**
- **Calm** (avg < 2.5) -- no system prompt changes
- **Tense** (avg 2.5-3.5) -- nudges agent to be more direct
- **Frustrated** (avg 3.5-4.2) -- agent becomes solution-focused, no hedging
- **Very frustrated** (avg 4.2+ or 3+ frustrated messages in a row) -- maximum directness, may suggest taking a break

## License

MIT
