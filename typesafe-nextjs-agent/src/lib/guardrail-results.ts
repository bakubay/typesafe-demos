import type { GuardrailUiPayload } from '@/types/guardrail-ui'

/**
 * In-memory cache for request-scoped guardrail processor results.
 * Keyed by pipeline only — one active request per pipeline at a time.
 */
const cache = new Map<string, GuardrailUiPayload[]>()

/**
 * Compatibility helper retained for callers that still pass message IDs.
 * Pipeline-only caching ignores message IDs.
 */
export function makeGuardrailResultKey(
  pipeline: GuardrailUiPayload['pipeline'],
  _messageId?: string,
): string {
  return pipeline
}

/**
 * Compatibility helper for legacy callers.
 */
export function getLastUserMessageId(
  messages: Array<{ role?: string; id?: string }>,
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m?.role === 'user' && typeof m.id === 'string' && m.id.length > 0) {
      return m.id
    }
  }
  return undefined
}

export function storeGuardrailResults(pipeline: string, events: GuardrailUiPayload[]) {
  cache.set(pipeline, events)
}

export function takeGuardrailResults(pipeline: string): GuardrailUiPayload[] {
  const events = cache.get(pipeline) ?? []
  cache.delete(pipeline)
  return events
}
