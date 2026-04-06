import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const flightTool = createTool({
  id: 'search-flights',
  description: 'Search sample flights between two cities',
  inputSchema: z.object({
    from: z.string().describe('Departure city'),
    to: z.string().describe('Arrival city'),
    date: z.string().describe('Travel date in YYYY-MM-DD format'),
  }),
  outputSchema: z.object({
    from: z.string(),
    to: z.string(),
    date: z.string(),
    flights: z.array(
      z.object({
        airline: z.string(),
        flightNumber: z.string(),
        departureTime: z.string(),
        arrivalTime: z.string(),
        priceUsd: z.number(),
      }),
    ),
  }),
  execute: async ({ from, to, date }) => {
    return {
      from,
      to,
      date,
      flights: [
        {
          airline: 'AeroBlue',
          flightNumber: 'AB214',
          departureTime: `${date}T08:30:00`,
          arrivalTime: `${date}T11:05:00`,
          priceUsd: 219,
        },
        {
          airline: 'SkyJet',
          flightNumber: 'SJ407',
          departureTime: `${date}T13:10:00`,
          arrivalTime: `${date}T15:40:00`,
          priceUsd: 264,
        },
      ],
    }
  },
})
