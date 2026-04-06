import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const carRentalTool = createTool({
  id: 'search-car-rentals',
  description: 'Search car rental options at a given city or airport',
  inputSchema: z.object({
    location: z.string().describe('Pick-up city or airport code'),
    pickUpDate: z.string().describe('Pick-up date YYYY-MM-DD'),
    dropOffDate: z.string().describe('Drop-off date YYYY-MM-DD'),
  }),
  outputSchema: z.object({
    location: z.string(),
    cars: z.array(
      z.object({ type: z.string(), company: z.string(), dailyRate: z.number() }),
    ),
  }),
  execute: async ({ location, pickUpDate, dropOffDate }) => ({
    location,
    cars: [
      { type: 'Economy', company: 'BudgetGo', dailyRate: 39 },
      { type: 'SUV', company: 'DriveMax', dailyRate: 78 },
      { type: 'Luxury', company: 'EliteCar', dailyRate: 149 },
    ],
  }),
})
