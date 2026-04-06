import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { typesafeEvaluate, getNoul, getChosen, getScore } from "./typesafe-client";
import { getUserInputPrompts, getAssistantResponsePrompts } from "./prompts";
import { SessionStats } from "./stats";
import { formatStatusLine, formatMoodReport } from "./ui";

const FRUSTRATION_THRESHOLD = 3.5;
const CUSTOM_ENTRY_TYPE = "typesafe-observer-stats";

interface ContentBlock {
  type?: string;
  text?: string;
}

interface AgentMessage {
  role?: string;
  content?: unknown;
  usage?: { input: number; output: number; cost: { total: number } };
}

function extractAssistantText(messages: AgentMessage[]): string {
  const textParts: string[] = [];

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const content = msg.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const b = block as ContentBlock;
      if (b.type === "text" && typeof b.text === "string" && b.text.trim()) {
        textParts.push(b.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

export default function (pi: ExtensionAPI) {
  const apiKey = process.env.TYPESAFE_API_KEY;
  const stats = new SessionStats();
  let enabled = !!apiKey;

  // --- Session lifecycle ---

  pi.on("session_start", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    for (const entry of entries) {
      if (
        entry.type === "custom" &&
        (entry as { customType?: string }).customType === CUSTOM_ENTRY_TYPE
      ) {
        stats.deserialize((entry as { data?: unknown }).data);
      }
    }

    if (!apiKey && ctx.hasUI) {
      ctx.ui.notify(
        "TypeSafe Observer: TYPESAFE_API_KEY not set — extension disabled",
        "warning",
      );
      enabled = false;
      return;
    }

    if (ctx.hasUI) {
      const statusText = formatStatusLine(stats, ctx.ui.theme);
      ctx.ui.setStatus("typesafe-mood", statusText);
    }
  });

  pi.on("session_shutdown", async () => {
    if (stats.records.length > 0) {
      pi.appendEntry(CUSTOM_ENTRY_TYPE, stats.serialize());
    }
  });

  // --- Turn tracking ---

  pi.on("turn_start", async () => {
    stats.incrementTurn();
  });

  // --- User input evaluation ---

  pi.on("input", async (event, ctx) => {
    if (!enabled) return { action: "continue" as const };

    const text = event.text;
    const inputLength = text.length;
    const turn = stats.turnCount;

    void typesafeEvaluate(text, getUserInputPrompts())
      .then((resp) => {
        stats.addRecord({
          timestamp: Date.now(),
          turn,
          type: "user",
          isFrustrated: getNoul(resp, "is_frustrated"),
          isCorrection: getNoul(resp, "is_correction"),
          isVague: getNoul(resp, "is_vague"),
          intent: getChosen(resp, "intent"),
          frustration: getScore(resp, "frustration"),
          specificity: getScore(resp, "specificity"),
          inputLength,
        });

        if (ctx.hasUI) {
          ctx.ui.setStatus("typesafe-mood", formatStatusLine(stats, ctx.ui.theme));
        }
      })
      .catch(() => {});

    return { action: "continue" as const };
  });

  // --- Agent response evaluation (at end of full agent cycle) ---

  pi.on("agent_end", async (event, ctx) => {
    if (!enabled) return;

    const messages = event.messages as AgentMessage[];
    const assistantText = extractAssistantText(messages);

    if (!assistantText || assistantText.length < 10) return;

    const turn = stats.turnCount;

    void typesafeEvaluate(assistantText, getAssistantResponsePrompts())
      .then((resp) => {
        stats.addRecord({
          timestamp: Date.now(),
          turn,
          type: "assistant",
          isHedged: getNoul(resp, "is_hedged"),
          isOverExplained: getNoul(resp, "is_over_explained"),
          responseType: getChosen(resp, "response_type"),
          helpfulness: getScore(resp, "helpfulness"),
        });

        if (ctx.hasUI) {
          ctx.ui.setStatus("typesafe-mood", formatStatusLine(stats, ctx.ui.theme));
        }
      })
      .catch(() => {});
  });

  // --- Adaptive behavior ---

  pi.on("before_agent_start", async (event) => {
    if (!enabled) return;

    const avg = stats.getFrustrationMovingAverage();
    const consecutive = stats.getConsecutiveFrustratedCount();

    if (avg >= 2.5 && avg < FRUSTRATION_THRESHOLD) {
      return {
        systemPrompt:
          event.systemPrompt +
          "\n\n[Observer note: The user is getting a bit tense. Be more direct and concise than usual. Skip preamble. Lead with the solution.]",
      };
    }

    if (avg >= FRUSTRATION_THRESHOLD && avg < 4.2) {
      return {
        systemPrompt:
          event.systemPrompt +
          "\n\n[Observer note: The user is frustrated (frustration avg: " + avg.toFixed(1) + "/5). " +
          "Be extremely direct and solution-focused. No hedging, no caveats, no filler. " +
          "If you've been going in circles, acknowledge it briefly and try a different approach. " +
          "If the task is genuinely blocked, say so clearly instead of guessing.]",
      };
    }

    if (avg >= 4.2 || consecutive >= 3) {
      const nudges = [
        "Gently suggest the user might benefit from a short break — a glass of water, a walk, some fresh air. Sometimes stepping away for 5 minutes makes the problem obvious when you come back.",
        "If appropriate, kindly suggest the user touch some grass — take a breather, stretch, grab a coffee. Bugs don't get fixed faster when we're fuming at them.",
        "The user has been grinding hard. If the moment feels right, warmly suggest they step outside for a minute — the code will still be here. A reset often beats brute force.",
      ];
      const nudge = nudges[stats.turnCount % nudges.length];

      return {
        systemPrompt:
          event.systemPrompt +
          "\n\n[Observer note: The user is very frustrated (frustration avg: " + avg.toFixed(1) + "/5, " +
          consecutive + " frustrated messages in a row). " +
          "Be maximally direct. Zero fluff. " +
          nudge + " " +
          "Do NOT be patronizing about it — keep it light and human. " +
          "Most importantly, actually solve their problem if you can.]",
      };
    }
  });

  // --- Commands ---

  pi.registerCommand("mood", {
    description: "Show session mood stats and frustration patterns",
    getArgumentCompletions: (prefix: string) => {
      const options = [{ value: "reset", label: "reset — clear all mood stats" }];
      const filtered = options.filter((o) => o.value.startsWith(prefix));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      if (args.trim() === "reset") {
        stats.reset();
        ctx.ui.setStatus("typesafe-mood", undefined);
        if (ctx.hasUI) ctx.ui.notify("Mood stats reset", "info");
        pi.sendMessage({
          customType: "typesafe-mood-report",
          content: "Mood stats reset",
          display: true,
        });
        return;
      }

      const lines = formatMoodReport(stats);
      if (ctx.hasUI) {
        for (const line of lines) {
          ctx.ui.notify(line, "info");
        }
      }

      pi.sendMessage({
        customType: "typesafe-mood-report",
        content: lines.join("\n"),
        display: true,
        details: { source: "mood-report" },
      });
    },
  });

  pi.registerCommand("mood-debug", {
    description: "Run a live TypeSafe Observer diagnostic",
    handler: async (_args, ctx) => {
      if (!enabled) {
        const text = "TypeSafe Observer diagnostic unavailable: TYPESAFE_API_KEY is missing.";
        if (ctx.hasUI) ctx.ui.notify(text, "error");
        pi.sendMessage({
          customType: "typesafe-mood-report",
          content: text,
          display: true,
          details: { source: "mood-debug", status: "missing-key" },
        });
        return;
      }

      const runningText = "Running TypeSafe Observer diagnostic...";
      if (ctx.hasUI) ctx.ui.notify(runningText, "info");

      try {
        const resp = await typesafeEvaluate("Diagnostic ping from /mood-debug", getUserInputPrompts());
        const summaryLines = [
          `model: ${resp.model}`,
          `responses: ${resp.responses.length}`,
          `billing units: ${resp.usage?.billing_units ?? "unknown"}`,
          "---",
          ...resp.responses.map((r) => {
            if (r.type === "choice") {
              return `${r.key}: choice=${r.chosen ?? "n/a"}`;
            }
            if (r.type === "score") {
              return `${r.key}: score=${r.expectation?.toFixed(2) ?? "n/a"}`;
            }
            return `${r.key}: probability=${r.probability?.toFixed(2) ?? "n/a"}`;
          }),
        ];

        if (ctx.hasUI) ctx.ui.notify("TypeSafe Observer diagnostic succeeded", "success");

        pi.sendMessage({
          customType: "typesafe-mood-report",
          content: summaryLines.join("\n"),
          display: true,
          details: { source: "mood-debug", status: "ok" },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const text = `TypeSafe Observer diagnostic failed: ${message}`;
        if (ctx.hasUI) ctx.ui.notify(text, "error");
        pi.sendMessage({
          customType: "typesafe-mood-report",
          content: text,
          display: true,
          details: { source: "mood-debug", status: "error" },
        });
      }
    },
  });
}
