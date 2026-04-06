import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const cryptoTool = createTool({
  id: 'get-crypto-price',
  description: 'Get the current price and 24h change of a cryptocurrency',
  inputSchema: z.object({
    coin: z.string().describe('Coin symbol, e.g. BTC, ETH, SOL'),
  }),
  outputSchema: z.object({
    coin: z.string(),
    priceUsd: z.number(),
    change24h: z.number(),
    marketCap: z.string(),
  }),
  execute: async ({ coin }) => {
    const prices: Record<string, number> = { BTC: 67420, ETH: 3510, SOL: 178, DOGE: 0.16 }
    const price = prices[coin.toUpperCase()] ?? 1.23
    return {
      coin: coin.toUpperCase(),
      priceUsd: price,
      change24h: +(Math.random() * 8 - 4).toFixed(2),
      marketCap: price > 1000 ? `$${(price * 19_000_000).toLocaleString()}` : '$1.2B',
    }
  },
})
