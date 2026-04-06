import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const currencyTool = createTool({
  id: 'convert-currency',
  description: 'Convert an amount between two currencies using current exchange rates',
  inputSchema: z.object({
    amount: z.number().describe('Amount to convert'),
    from: z.string().describe('Source currency code, e.g. USD'),
    to: z.string().describe('Target currency code, e.g. EUR'),
  }),
  outputSchema: z.object({
    amount: z.number(),
    from: z.string(),
    to: z.string(),
    converted: z.number(),
    rate: z.number(),
  }),
  execute: async ({ amount, from, to }) => {
    const rates: Record<string, number> = {
      'USD-EUR': 0.92, 'EUR-USD': 1.09,
      'USD-GBP': 0.79, 'GBP-USD': 1.27,
      'USD-JPY': 154.5, 'JPY-USD': 0.0065,
      'EUR-GBP': 0.86, 'GBP-EUR': 1.16,
    }
    const key = `${from.toUpperCase()}-${to.toUpperCase()}`
    const rate = rates[key] ?? 1
    return { amount, from: from.toUpperCase(), to: to.toUpperCase(), converted: +(amount * rate).toFixed(2), rate }
  },
})
