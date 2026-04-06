import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const uvIndexTool = createTool({
  id: 'get-uv-index',
  description: 'Get the current UV index and sun safety recommendations for a location',
  inputSchema: z.object({
    location: z.string().describe('City or region'),
  }),
  outputSchema: z.object({
    location: z.string(),
    uvIndex: z.number(),
    level: z.string(),
    recommendation: z.string(),
  }),
  execute: async ({ location }) => {
    const uv = +(Math.random() * 11).toFixed(1)
    const level = uv <= 2 ? 'Low' : uv <= 5 ? 'Moderate' : uv <= 7 ? 'High' : uv <= 10 ? 'Very High' : 'Extreme'
    const rec = uv <= 2 ? 'No protection needed' : uv <= 5 ? 'Wear sunglasses' : 'Apply SPF 30+ sunscreen, seek shade'
    return { location, uvIndex: uv, level, recommendation: rec }
  },
})
