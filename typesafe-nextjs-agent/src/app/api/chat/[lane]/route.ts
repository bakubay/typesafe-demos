import { handleChatStream } from "@mastra/ai-sdk";
import { toAISdkV5Messages } from "@mastra/ai-sdk/ui";
import { TripWire } from "@mastra/core/agent";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { injectGuardrailResults } from "@/lib/guardrail-stream-ping";
import { mastra } from "@/mastra";
import { MAX_STEPS } from "@/mastra/agents/super-agents";
import { NextResponse } from "next/server";

const LANES = {
  gpt: {
    agentId: "super-agent-gpt" as const,
    threadId: "super-gpt-thread",
    resourceId: "super-chat-gpt",
    pipeline: "mastra" as const,
  },
  typesafe: {
    agentId: "super-agent-typesafe" as const,
    threadId: "super-typesafe-thread",
    resourceId: "super-chat-typesafe",
    pipeline: "typesafe" as const,
  },
};

type LaneConfig = (typeof LANES)[keyof typeof LANES];

function getLane(lane: string): LaneConfig | null {
  return (LANES as Record<string, LaneConfig>)[lane] ?? null;
}

export async function POST(req: Request, { params }: { params: Promise<{ lane: string }> }) {
  const { lane } = await params;
  const config = getLane(lane);
  if (!config) return NextResponse.json({ error: `Unknown lane: ${lane}` }, { status: 404 });

  const { messages, trigger, model } = await req.json();
  const startTime = Date.now();

  const prepareStep = model
    ? async ({ stepNumber }: { stepNumber: number }) => {
        if (stepNumber === 0) return { model: model as string };
      }
    : undefined;

  try {
    const stream = await handleChatStream({
      mastra,
      agentId: config.agentId,
      defaultOptions: { maxSteps: MAX_STEPS, prepareStep },
      params: {
        messages,
        trigger,
        memory: { thread: config.threadId, resource: config.resourceId },
      },
    });
    return createUIMessageStreamResponse({
      stream: injectGuardrailResults(stream as unknown as ReadableStream<import("ai").UIMessageChunk>, config.pipeline, startTime),
    });
  } catch (err) {
    if (err instanceof TripWire) {
      const blockedStream = createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({
            type: "data-guardrail" as `data-${string}`,
            id: `guardrail-${config.pipeline}-blocked-${Date.now()}`,
            data: {
              pipeline: config.pipeline,
              step: "decision",
              status: "blocked",
              label: "Blocked",
              detail: "Message blocked by safety policy.",
              content: { durationMs: Date.now() - startTime },
            },
            transient: true,
          });
          const partId = `blocked-${Date.now()}`;
          writer.write({ type: "text-start", id: partId });
          writer.write({
            type: "text-delta",
            id: partId,
            delta: "Sorry, this message was blocked by safety checks. Please ask a safe question.",
          });
          writer.write({ type: "text-end", id: partId });
        },
      });
      return createUIMessageStreamResponse({ stream: blockedStream });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ lane: string }> }) {
  const { lane } = await params;
  const config = getLane(lane);
  if (!config) return NextResponse.json({ error: `Unknown lane: ${lane}` }, { status: 404 });

  const agent = mastra.getAgentById(config.agentId);
  const memory = await agent.getMemory();
  try {
    const response = await memory?.recall({
      threadId: config.threadId,
      resourceId: config.resourceId,
    });
    return NextResponse.json(toAISdkV5Messages(response?.messages || []));
  } catch {
    return NextResponse.json([]);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ lane: string }> }) {
  const { lane } = await params;
  const config = getLane(lane);
  if (!config) return NextResponse.json({ error: `Unknown lane: ${lane}` }, { status: 404 });

  const agent = mastra.getAgentById(config.agentId);
  const memory = await agent.getMemory();
  await memory?.deleteThread(config.threadId);
  return NextResponse.json({ ok: true });
}
