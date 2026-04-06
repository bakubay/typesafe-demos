import type { MastraDBMessage } from '@mastra/core/agent'
import type { InputProcessor, ProcessInputArgs } from '@mastra/core/processors'
import {
  getLastUserMessageId,
  makeGuardrailResultKey,
  storeGuardrailResults,
} from '@/lib/guardrail-results'
import type { GuardrailUiPayload } from '@/types/guardrail-ui'

type PipelineState = {
  pipelineStart: number
  stageStart: number
  events: GuardrailUiPayload[]
}

/** Request-scoped state keyed by last user message id. */
const requestState = new Map<string, PipelineState>()

function createUiProcessor(
  id: string,
  name: string,
  phase: 'before-injection' | 'after-injection' | 'after-moderation'
): InputProcessor {
  return {
    id,
    name,
    async processInput(args: ProcessInputArgs) {
      const { messages } = args
      const messageId = getLastUserMessageId(messages)
      const cacheKey = makeGuardrailResultKey('mastra', messageId)

      if (phase === 'before-injection') {
        requestState.set(cacheKey, {
          pipelineStart: Date.now(),
          stageStart: Date.now(),
          events: [],
        })
      }

      const state =
        requestState.get(cacheKey) ??
        ({
          pipelineStart: Date.now(),
          stageStart: Date.now(),
          events: [],
        } satisfies PipelineState)

      if (phase === 'after-injection') {
        const injDuration = Date.now() - state.stageStart
        state.events.push({
          pipeline: 'mastra',
          step: 'prompt-injection',
          status: 'passed',
          label: 'PromptInjectionDetector (GPT-4o-mini)',
          detail: `${injDuration}ms`,
          content: { durationMs: injDuration, model: 'openai/gpt-4o-mini' },
        })
        state.stageStart = Date.now() // reuse timer for moderation
        requestState.set(cacheKey, state)
        storeGuardrailResults(cacheKey, [...state.events])
      }

      if (phase === 'after-moderation') {
        const modDuration = Date.now() - state.stageStart
        const totalDuration = Date.now() - state.pipelineStart
        state.events.push({
          pipeline: 'mastra',
          step: 'moderation',
          status: 'passed',
          label: 'ModerationProcessor (GPT-4o-mini)',
          detail: `${modDuration}ms`,
          content: { durationMs: modDuration, model: 'openai/gpt-4o-mini', apiResponse: { totalDuration } },
        })
        storeGuardrailResults(cacheKey, [...state.events])
        requestState.delete(cacheKey)
      }

      return messages
    },
  } as InputProcessor
}

/**
 * Returns 3 UI-only processors that wrap around Mastra's built-in processors
 * to measure timing. They store results via the guardrail-results cache since
 * `writer.custom()` doesn't reach the UI stream from input processors.
 *
 * Order: [before-injection] → PromptInjectionDetector → [after-injection] → ModerationProcessor → [after-moderation]
 */
export function createMastraGuardrailUiProcessors(): [
  InputProcessor,
  InputProcessor,
  InputProcessor,
] {
  return [
    createUiProcessor('mastra-guardrail-ui-1', 'Guardrail UI (prompt injection)', 'before-injection'),
    createUiProcessor('mastra-guardrail-ui-2', 'Guardrail UI (moderation)', 'after-injection'),
    createUiProcessor('mastra-guardrail-ui-3', 'Guardrail UI (complete)', 'after-moderation'),
  ]
}
