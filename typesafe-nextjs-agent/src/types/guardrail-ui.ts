/** Extra structured data for the UI (JSON-safe). */
export type GuardrailUiContent = {
  /** Truncated last user message text being checked. */
  inputPreview?: string
  /** Full TypeSafe `/preview/evaluation` payload when available. */
  typeSafeEvaluation?: unknown
  /** Raw API request body sent to the guardrail service. */
  apiRequest?: unknown
  /** Raw API response body received from the guardrail service. */
  apiResponse?: unknown
  /** How long this step took (ms). */
  durationMs?: number
  /** Confidence score from the evaluation. */
  confidence?: number
  /** The model used for evaluation. */
  model?: string
  /** Selected tree nodes (for doc-chat reasoning). */
  selectedNodes?: Array<{ nodeId: string; title: string; confidence?: number }>
  /** Page numbers extracted (for doc-chat reasoning). */
  pageNumbers?: number[]
}

/** Payload streamed as `data-guardrail` parts from input processors (server → client). */
export type GuardrailUiPayload = {
  pipeline: 'mastra' | 'typesafe' | 'typesafe-reasoning' | 'pageindex'
  step: string
  status: 'running' | 'passed' | 'failed' | 'skipped' | 'blocked'
  label?: string
  detail?: string
  /** Expandable payload in the timeline (previews, API JSON). */
  content?: GuardrailUiContent
}
