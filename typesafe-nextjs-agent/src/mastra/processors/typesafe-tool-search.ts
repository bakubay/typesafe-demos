import { BaseProcessor } from "@mastra/core/processors";
import type { ProcessInputStepArgs, ProcessInputStepResult } from "@mastra/core/processors";
import type { MastraDBMessage } from "@mastra/core/agent";
import type { ToolSearchUiPayload } from "@/types/tool-search-ui";

type ToolCatalog = Record<string, unknown>;

type TypeSafeToolSearchOptions = {
  tools: ToolCatalog;
  threshold?: number;
  topK?: number;
  model?: string;
};

type TypeSafeEvaluationResponse = {
  model: string;
  responses: Array<{
    key: string;
    type: string;
    probability?: number;
    chosen?: string;
    confidence?: number | null;
    probabilities?: Array<{
      option: string;
      probability: number;
    }>;
  }>;
};

function extractTextFromMessage(message: MastraDBMessage): string {
  let text = "";
  if (message.content?.parts) {
    for (const part of message.content.parts) {
      if (part.type === "text" && "text" in part && typeof part.text === "string") {
        text += part.text + " ";
      }
    }
  }
  if (!text.trim() && typeof message.content?.content === "string") {
    text = message.content.content;
  }
  return text.trim();
}

function getToolDescription(tool: unknown): string {
  if (tool && typeof tool === "object" && "description" in tool) {
    const value = (tool as { description?: unknown }).description;
    if (typeof value === "string") return value;
  }
  return "";
}

function getToolRelevanceProbability(response: TypeSafeEvaluationResponse["responses"][number]): number {
  if (typeof response.probability === "number") return response.probability;

  const yesProbability = response.probabilities?.find(
    (option) => option.option.toLowerCase() === "yes",
  )?.probability;
  if (typeof yesProbability === "number") return yesProbability;

  if (response.chosen?.toLowerCase() === "yes") {
    return 1;
  }

  return 0;
}

export class TypeSafeToolSearchProcessor extends BaseProcessor<"typesafe-tool-search"> {
  readonly id = "typesafe-tool-search" as const;
  readonly name = "TypeSafe Tool Search Processor";

  private readonly allTools: ToolCatalog;
  private readonly threshold: number;
  private readonly topK: number;
  private readonly model: string;
  private readonly stateKey = "typesafeToolSearch:selectedToolNames";

  constructor(options: TypeSafeToolSearchOptions) {
    super();
    this.allTools = options.tools;
    this.threshold = options.threshold ?? 0.3;
    this.topK = options.topK ?? 5;
    this.model = options.model ?? "speed_v9_angry_pig";
  }

  private async emitResult(args: ProcessInputStepArgs, payload: ToolSearchUiPayload) {
    await args.writer?.custom({
      type: "data-tool-search" as `data-${string}`,
      id: `tool-search-typesafe-${Date.now()}`,
      data: payload,
      transient: true,
    });
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | void> {
    const { stepNumber, messages, tools, state } = args;
    const baseTools = tools ?? {};

    if (stepNumber === 0) {
      const apiKey = process.env.TYPESAFE_API_KEY;
      const searchStart = Date.now();

      const emptyPayload = (): ToolSearchUiPayload => ({
        pipeline: "typesafe",
        step: "result",
        totalTools: Object.keys(this.allTools).length,
        selectedTools: [],
        threshold: this.threshold,
        topK: this.topK,
        durationMs: Date.now() - searchStart,
      });

      if (!apiKey) {
        state[this.stateKey] = [];
        await this.emitResult(args, emptyPayload());
        return;
      }

      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
      const text = lastUserMessage ? extractTextFromMessage(lastUserMessage) : "";
      if (!text) {
        state[this.stateKey] = [];
        await this.emitResult(args, emptyPayload());
        return;
      }

      const toolEntries = Object.entries(this.allTools);
      if (toolEntries.length === 0) {
        state[this.stateKey] = [];
        await this.emitResult(args, emptyPayload());
        return;
      }

      const prompts = toolEntries.map(([name, tool]) => ({
        key: `tool_${name}`,
        type: "noul" as const,
        instructions: `The tool "${name}" is relevant for answering this user request. Tool description: ${getToolDescription(tool) || "No description."}`,
      }));

      const requestBody = {
        model: this.model,
        document: text,
        prompts,
      };

      try {
        const response = await fetch("https://api.typesafe.ai/preview/evaluation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          state[this.stateKey] = [];
          await this.emitResult(args, emptyPayload());
          return;
        }

        const data = (await response.json()) as TypeSafeEvaluationResponse;

        const allScored: Array<{ name: string; probability: number }> = [];
        for (const r of data.responses) {
          const toolName = r.key.replace(/^tool_/, "");
          if (!this.allTools[toolName]) continue;
          allScored.push({ name: toolName, probability: getToolRelevanceProbability(r) });
        }

        const selected = allScored
          .filter((t) => t.probability >= this.threshold)
          .sort((a, b) => b.probability - a.probability)
          .slice(0, this.topK);

        const selectedNames = selected.map((t) => t.name);
        state[this.stateKey] = selectedNames;

        await this.emitResult(args, {
          pipeline: "typesafe",
          step: "result",
          totalTools: toolEntries.length,
          selectedTools: selected.map((t) => ({ name: t.name, score: +t.probability.toFixed(3) })),
          threshold: this.threshold,
          topK: this.topK,
          durationMs: Date.now() - searchStart,
        });
      } catch {
        state[this.stateKey] = [];
        await this.emitResult(args, emptyPayload());
      }
    }

    const selectedNames = Array.isArray(state[this.stateKey]) ? (state[this.stateKey] as string[]) : [];

    if (selectedNames.length === 0) return;

    const selectedTools: Record<string, unknown> = {};
    for (const name of selectedNames) {
      const tool = this.allTools[name];
      if (tool) selectedTools[name] = tool;
    }

    return {
      tools: {
        ...baseTools,
        ...selectedTools,
      },
    };
  }
}
