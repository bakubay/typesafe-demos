import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const restaurantTool = createTool({
  id: 'find-restaurants',
  description: 'Find nearby restaurant recommendations for a location',
  inputSchema: z.object({
    location: z.string().describe('City or neighborhood'),
    cuisine: z.string().optional().describe('Optional cuisine preference'),
  }),
  outputSchema: z.object({
    location: z.string(),
    cuisine: z.string().nullable(),
    results: z.array(
      z.object({
        name: z.string(),
        rating: z.number(),
        priceLevel: z.enum(['$', '$$', '$$$']),
      }),
    ),
  }),
  execute: async ({ location, cuisine }) => {
    const preference = cuisine?.trim() || null
    const results: Array<{ name: string; rating: number; priceLevel: '$' | '$$' | '$$$' }> = [
      { name: `${location} Bistro`, rating: 4.6, priceLevel: '$$' },
      {
        name: preference ? `${preference} Corner` : `${location} Kitchen`,
        rating: 4.4,
        priceLevel: '$$',
      },
      { name: 'Sunset Table', rating: 4.3, priceLevel: '$$$' },
    ]

    return {
      location,
      cuisine: preference,
      results,
    }
  },
})
