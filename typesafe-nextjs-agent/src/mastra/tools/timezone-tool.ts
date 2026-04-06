import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const timezoneTool = createTool({
  id: 'get-timezone',
  description: 'Get the current time and timezone offset for a city',
  inputSchema: z.object({
    city: z.string().describe('City name'),
  }),
  outputSchema: z.object({
    city: z.string(),
    timezone: z.string(),
    currentTime: z.string(),
    utcOffset: z.string(),
  }),
  execute: async ({ city }) => {
    const offsets: Record<string, [string, string]> = {
      'new york': ['America/New_York', 'UTC-5'],
      london: ['Europe/London', 'UTC+0'],
      tokyo: ['Asia/Tokyo', 'UTC+9'],
      sydney: ['Australia/Sydney', 'UTC+11'],
      paris: ['Europe/Paris', 'UTC+1'],
      rome: ['Europe/Rome', 'UTC+1'],
    }
    const key = city.toLowerCase()
    const [tz, offset] = offsets[key] ?? ['Unknown', 'UTC+0']
    return {
      city,
      timezone: tz,
      currentTime: new Date().toLocaleString('en-US', { timeZone: tz !== 'Unknown' ? tz : undefined }),
      utcOffset: offset,
    }
  },
})
