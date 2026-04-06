import type { UIMessageChunk } from 'ai'
import type { GuardrailUiPayload } from '@/types/guardrail-ui'
import { takeGuardrailResults } from './guardrail-results'

/**
 * Wraps a Mastra agent stream to inject guardrail results before the first
 * model chunk.
 *
 * Guardrails use `processInput` which has no `writer`, so they store results
 * in a module-level cache. This wrapper reads them and injects custom chunks.
 *
 * Tool search uses `processInputStep` which has `writer.custom()` and streams
 * results directly — no injection needed here.
 */
export function injectGuardrailResults(
  stream: ReadableStream<UIMessageChunk>,
  pipeline: GuardrailUiPayload['pipeline'],
  startTime: number,
): ReadableStream<UIMessageChunk> {
  return new ReadableStream({
    async start(controller) {
      const reader = stream.getReader()
      try {
        const first = await reader.read()
        if (first.done) {
          controller.close()
          return
        }

        const totalMs = Date.now() - startTime
        const cachedEvents = takeGuardrailResults(pipeline)
        const totalStatus: GuardrailUiPayload['status'] = cachedEvents.some(
          e => e.status === 'blocked'
        )
          ? 'blocked'
          : cachedEvents.some(e => e.status === 'failed')
            ? 'failed'
            : 'passed'

        for (const ev of cachedEvents) {
          controller.enqueue({
            type: 'data-guardrail',
            id: `guardrail-${pipeline}-${ev.step}-${Date.now()}`,
            data: ev,
            transient: true,
          } as UIMessageChunk)
        }

        controller.enqueue({
          type: 'data-guardrail',
          id: `guardrail-${pipeline}-total-${Date.now()}`,
          data: {
            pipeline,
            step: 'total',
            status: totalStatus,
            label: 'Total guardrail time',
            detail: `${totalMs}ms`,
            content: { durationMs: totalMs },
          } satisfies GuardrailUiPayload,
          transient: true,
        } as UIMessageChunk)

        controller.enqueue(first.value)

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }
      } finally {
        reader.releaseLock()
      }
      controller.close()
    },
  })
}
