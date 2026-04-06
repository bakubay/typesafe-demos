import { Agent } from '@mastra/core/agent'
import { BaseProcessor } from '@mastra/core/processors'
import type {
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '@mastra/core/processors'
import type { MastraDBMessage } from '@mastra/core/agent'
import { z } from 'zod'
import type { ToolSearchUiPayload } from '@/types/tool-search-ui'

type ToolCatalog = Record<string, unknown>

type GptToolSearchOptions = {
  tools: ToolCatalog
  threshold?: number
  topK?: number
  model?: string
}

const selectionSchema = z.object({
  tools: z.array(
    z.object({
      name: z.string(),
      score: z.number().min(0).max(1),
    }),
  ),
})

type SelectionResult = z.infer<typeof selectionSchema>

function extractTextFromMessage(message: MastraDBMessage): string {
  let text = ''
  if (message.content?.parts) {
    for (const part of message.content.parts) {
      if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
        text += part.text + ' '
      }
    }
  }
  if (!text.trim() && typeof message.content?.content === 'string') {
    text = message.content.content
  }
  return text.trim()
}

function getToolDescription(tool: unknown): string {
  if (tool && typeof tool === 'object' && 'description' in tool) {
    const value = (tool as { description?: unknown }).description
    if (typeof value === 'string') return value
  }
  return ''
}

export class GptToolSearchProcessor extends BaseProcessor<'gpt-tool-search'> {
  readonly id = 'gpt-tool-search' as const
  readonly name = 'GPT Tool Search Processor'

  private readonly allTools: ToolCatalog
  private readonly threshold: number
  private readonly topK: number
  private readonly selectorAgent: Agent
  private readonly stateKey = 'gptToolSearch:selectedToolNames'

  constructor(options: GptToolSearchOptions) {
    super()
    this.allTools = options.tools
    this.threshold = options.threshold ?? 0.3
    this.topK = options.topK ?? 5
    this.selectorAgent = new Agent({
      id: 'gpt-tool-selector',
      name: 'GPT Tool Selector',
      instructions: [
        'You select which tools an AI assistant should use to answer a user request.',
        'For each candidate tool, assign a relevance score from 0.0 to 1.0:',
        '- 0.8–1.0: the tool directly addresses part of the request (e.g. get-weather for "weather in Rome")',
        '- 0.4–0.7: the tool is plausibly useful (e.g. convert-currency for a travel request)',
        '- 0.0–0.3: the tool is unrelated to the request',
        'Focus on what the user is ASKING FOR, not superficial word overlap.',
        'A travel planning request needs travel tools (weather, flights, hotels, restaurants), not random trivia.',
      ].join(' '),
      model: options.model ?? 'openai/gpt-4o-mini',
    })
  }

  private async emitResult(args: ProcessInputStepArgs, payload: ToolSearchUiPayload) {
    await args.writer?.custom({
      type: 'data-tool-search' as `data-${string}`,
      id: `tool-search-mastra-${Date.now()}`,
      data: payload,
      transient: true,
    })
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | void> {
    const { stepNumber, messages, tools, state, tracingContext } = args
    const baseTools = tools ?? {}

    if (stepNumber === 0) {
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
      const text = lastUserMessage ? extractTextFromMessage(lastUserMessage) : ''
      const searchStart = Date.now()

      const emptyPayload = (): ToolSearchUiPayload => ({
        pipeline: 'mastra',
        step: 'result',
        totalTools: Object.keys(this.allTools).length,
        selectedTools: [],
        threshold: this.threshold,
        topK: this.topK,
        durationMs: Date.now() - searchStart,
      })

      if (!text) {
        state[this.stateKey] = []
        await this.emitResult(args, emptyPayload())
        return
      }

      const candidates = Object.entries(this.allTools).map(([name, tool]) => ({
        name,
        description: getToolDescription(tool),
      }))

      if (candidates.length === 0) {
        state[this.stateKey] = []
        await this.emitResult(args, emptyPayload())
        return
      }

      try {
        const candidateText = candidates
          .map(c => `- ${c.name}: ${c.description || 'No description provided.'}`)
          .join('\n')

        const response = await this.selectorAgent.generate(
          [
            `User request: "${text}"`,
            'Candidate tools:',
            candidateText,
            'Return scores for tools. You can include all tools, but keep scores realistic.',
          ].join('\n\n'),
          {
            structuredOutput: { schema: selectionSchema },
            modelSettings: { temperature: 0 },
            ...(tracingContext ? { tracingContext } : {}),
          },
        )

        const result = response.object as SelectionResult
        const scored = result.tools
          .filter(t => t.score >= this.threshold && this.allTools[t.name])
          .sort((a, b) => b.score - a.score)
          .slice(0, this.topK)

        const selectedNames = scored.map(t => t.name)
        state[this.stateKey] = selectedNames

        await this.emitResult(args, {
          pipeline: 'mastra',
          step: 'result',
          totalTools: Object.keys(this.allTools).length,
          selectedTools: scored.map(t => ({ name: t.name, score: +t.score.toFixed(3) })),
          threshold: this.threshold,
          topK: this.topK,
          durationMs: Date.now() - searchStart,
        })
      } catch {
        state[this.stateKey] = []
        await this.emitResult(args, emptyPayload())
      }
    }

    const selectedNames = Array.isArray(state[this.stateKey])
      ? (state[this.stateKey] as string[])
      : []

    if (selectedNames.length === 0) return

    const selectedTools: Record<string, unknown> = {}
    for (const name of selectedNames) {
      const tool = this.allTools[name]
      if (tool) selectedTools[name] = tool
    }

    return {
      tools: {
        ...baseTools,
        ...selectedTools,
      },
    }
  }
}
