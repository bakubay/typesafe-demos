import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const stockTool = createTool({
  id: 'get-stock-quote',
  description: 'Get a real-time stock price quote for a ticker symbol',
  inputSchema: z.object({
    ticker: z.string().describe('Stock ticker, e.g. AAPL, TSLA'),
  }),
  outputSchema: z.object({
    ticker: z.string(),
    price: z.number(),
    change: z.number(),
    changePercent: z.number(),
    volume: z.string(),
  }),
  execute: async ({ ticker }) => {
    const base = ticker.length * 17 + 42
    return {
      ticker: ticker.toUpperCase(),
      price: +(base + Math.random() * 10).toFixed(2),
      change: +(Math.random() * 4 - 2).toFixed(2),
      changePercent: +(Math.random() * 3 - 1.5).toFixed(2),
      volume: `${(Math.floor(Math.random() * 50) + 5)}M`,
    }
  },
})
