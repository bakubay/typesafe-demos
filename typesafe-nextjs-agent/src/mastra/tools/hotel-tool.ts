import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const hotelTool = createTool({
  id: 'search-hotels',
  description: 'Search hotel availability and pricing for a destination and dates',
  inputSchema: z.object({
    city: z.string().describe('Destination city'),
    checkIn: z.string().describe('Check-in date YYYY-MM-DD'),
    checkOut: z.string().describe('Check-out date YYYY-MM-DD'),
  }),
  outputSchema: z.object({
    city: z.string(),
    checkIn: z.string(),
    checkOut: z.string(),
    hotels: z.array(
      z.object({
        name: z.string(),
        stars: z.number(),
        pricePerNight: z.number(),
        rating: z.number(),
      }),
    ),
  }),
  execute: async ({ city, checkIn, checkOut }) => ({
    city,
    checkIn,
    checkOut,
    hotels: [
      { name: `${city} Grand Hotel`, stars: 5, pricePerNight: 289, rating: 4.7 },
      { name: `${city} Inn & Suites`, stars: 3, pricePerNight: 109, rating: 4.2 },
      { name: 'The Traveler Lodge', stars: 4, pricePerNight: 179, rating: 4.5 },
    ],
  }),
})
