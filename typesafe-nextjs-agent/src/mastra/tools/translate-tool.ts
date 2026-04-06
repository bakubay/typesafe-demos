import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const translateTool = createTool({
  id: 'translate-text',
  description: 'Translate text from one language to another',
  inputSchema: z.object({
    text: z.string().describe('Text to translate'),
    from: z.string().describe('Source language, e.g. English'),
    to: z.string().describe('Target language, e.g. Spanish'),
  }),
  outputSchema: z.object({
    original: z.string(),
    translated: z.string(),
    from: z.string(),
    to: z.string(),
  }),
  execute: async ({ text, from, to }) => ({
    original: text,
    translated: `[${to} translation of "${text}"]`,
    from,
    to,
  }),
})
