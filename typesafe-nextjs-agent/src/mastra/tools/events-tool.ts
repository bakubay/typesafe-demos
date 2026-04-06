import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const eventsTool = createTool({
  id: 'find-events',
  description: 'Find upcoming events, concerts, and activities in a city',
  inputSchema: z.object({
    city: z.string().describe('City to search'),
    category: z.string().optional().describe('Event type: concerts, sports, art, food'),
  }),
  outputSchema: z.object({
    city: z.string(),
    events: z.array(
      z.object({ name: z.string(), date: z.string(), venue: z.string(), category: z.string() }),
    ),
  }),
  execute: async ({ city, category }) => ({
    city,
    events: [
      { name: `${city} Jazz Night`, date: '2025-06-15', venue: 'Blue Note Hall', category: 'concerts' },
      { name: 'Street Food Festival', date: '2025-06-18', venue: 'Central Park', category: 'food' },
      { name: 'Modern Art Exhibition', date: '2025-06-20', venue: 'City Gallery', category: 'art' },
    ].filter(e => !category || e.category === category.toLowerCase()),
  }),
})
