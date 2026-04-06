import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

const safeMathPattern = /^[\d+\-*/().\s]+$/

function evaluateExpression(expression: string): number {
  if (!safeMathPattern.test(expression)) {
    throw new Error('Expression contains invalid characters')
  }

  // Restrict execution to arithmetic symbols validated above.
  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${expression});`)()
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Expression did not produce a valid number')
  }
  return result
}

export const calculatorTool = createTool({
  id: 'calculate',
  description: 'Evaluate a basic math expression',
  inputSchema: z.object({
    expression: z.string().describe('Math expression, e.g. (15 + 3) / 2'),
  }),
  outputSchema: z.object({
    expression: z.string(),
    result: z.number(),
  }),
  execute: async ({ expression }) => {
    const result = evaluateExpression(expression)
    return { expression, result }
  },
})
