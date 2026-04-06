import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const definitionTool = createTool({
  id: 'define-word',
  description: 'Look up the dictionary definition of a word or phrase',
  inputSchema: z.object({
    word: z.string().describe('Word or phrase to define'),
  }),
  outputSchema: z.object({
    word: z.string(),
    definition: z.string(),
    partOfSpeech: z.string(),
    example: z.string(),
  }),
  execute: async ({ word }) => ({
    word,
    definition: `A common English word meaning something related to "${word}".`,
    partOfSpeech: 'noun',
    example: `She used the word "${word}" in her sentence.`,
  }),
})
