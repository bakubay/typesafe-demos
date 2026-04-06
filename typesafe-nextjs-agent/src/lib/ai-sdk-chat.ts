/**
 * Shared helpers for AI SDK `useChat` usage in this app.
 * See `docs/ai-sdk-notes.md` for conventions and links.
 */

import type { Dispatch, SetStateAction } from 'react'
import type { GuardrailUiPayload } from '@/types/guardrail-ui'
import type { ToolSearchUiPayload } from '@/types/tool-search-ui'

function sanitizeTripwireReason(reason: string | undefined): string {
  if (!reason) return 'This message was blocked by safety checks.'
  const withoutScores = reason.replace(/\s*Scores:\s*.+$/i, '')
  return withoutScores.length > 220
    ? `${withoutScores.slice(0, 217).trimEnd()}...`
    : withoutScores
}

/** Parses `data-guardrail` and Mastra `data-tripwire` chunks into one UI payload shape. */
export function parseGuardrailDataPart(
  part: unknown,
  pipeline: GuardrailUiPayload['pipeline']
): GuardrailUiPayload | null {
  if (typeof part !== 'object' || part === null || !('type' in part)) return null
  const typedPart = part as { type: string; data?: unknown }

  if (typedPart.type === 'data-tripwire') {
    const data = (typedPart.data ?? {}) as {
      reason?: string
      processorId?: string
    }
    const processorId = data.processorId || 'guardrail'
    return {
      pipeline,
      step: 'decision',
      status: 'blocked',
      label: `Blocked (${processorId})`,
      detail: sanitizeTripwireReason(data.reason),
      content: { apiResponse: { processorId } },
    }
  }

  if (
    typedPart.type === 'data-guardrail' &&
    'data' in typedPart
  ) {
    return typedPart.data as GuardrailUiPayload
  }

  return null
}

/** Factory for `useChat({ onData })` — appends guardrail events for one pipeline. */
export function createGuardrailOnDataHandler(
  pipeline: GuardrailUiPayload['pipeline'],
  setEvents: Dispatch<SetStateAction<GuardrailUiPayload[]>>
) {
  return (part: unknown) => {
    const payload = parseGuardrailDataPart(part, pipeline)
    if (payload?.pipeline === pipeline) {
      setEvents(prev => [...prev, payload])
    }
  }
}

export function parseToolSearchDataPart(part: unknown): ToolSearchUiPayload | null {
  if (typeof part !== 'object' || part === null || !('type' in part)) return null
  const typed = part as { type: string; data?: unknown }
  if (typed.type === 'data-tool-search' && typed.data) {
    return typed.data as ToolSearchUiPayload
  }
  return null
}

/** Factory for `useChat({ onData })` — captures tool-search results for one pipeline. */
export function createToolSearchOnDataHandler(
  pipeline: string,
  setResult: Dispatch<SetStateAction<ToolSearchUiPayload | null>>,
) {
  return (part: unknown) => {
    const payload = parseToolSearchDataPart(part)
    if (payload && payload.pipeline === pipeline) {
      setResult(payload)
    }
  }
}

/** Combines multiple onData handlers into one. */
export function combineOnDataHandlers(
  ...handlers: Array<(part: unknown) => void>
): (part: unknown) => void {
  return (part: unknown) => {
    for (const h of handlers) h(part)
  }
}

/** Standard `onError` logger for chat transports (network / stream failures). */
export function logChatTransportError(scope: string) {
  return (error: Error) => {
    console.error(`[useChat:${scope}]`, error)
  }
}
