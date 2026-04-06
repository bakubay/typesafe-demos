export type ToolSearchUiPayload = {
  pipeline: 'mastra' | 'typesafe'
  step: 'result' | 'total'
  totalTools: number
  selectedTools: Array<{ name: string; score: number }>
  threshold: number
  topK: number
  durationMs: number
}
