import type { TreeNode as PageIndexTreeNode } from '@pageindex/sdk'

/** Re-export the SDK's TreeNode for convenience. */
export type { PageIndexTreeNode }

/** Document info returned to the client. */
export type DocumentInfo = {
  id: string
  name: string
  status: 'processing' | 'completed' | 'failed' | string
  pageNum?: number
  description?: string | null
}

import type { GuardrailUiPayload } from './guardrail-ui'

/** A step in the TypeSafe reasoning chain — same shape as GuardrailUiPayload. */
export type ReasoningStep = GuardrailUiPayload
