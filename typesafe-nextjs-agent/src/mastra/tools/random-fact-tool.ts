import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

const facts = [
  'Honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs that was still edible.',
  'Octopuses have three hearts and blue blood.',
  'A group of flamingos is called a "flamboyance."',
  'The shortest war in history lasted 38 minutes between Britain and Zanzibar.',
  'Venus is the only planet that spins clockwise.',
  'Bananas are berries, but strawberries are not.',
]

export const randomFactTool = createTool({
  id: 'get-random-fact',
  description: 'Get a random fun fact or piece of trivia',
  inputSchema: z.object({
    topic: z.string().optional().describe('Optional topic hint'),
  }),
  outputSchema: z.object({
    fact: z.string(),
  }),
  execute: async () => ({
    fact: facts[Math.floor(Math.random() * facts.length)],
  }),
})
