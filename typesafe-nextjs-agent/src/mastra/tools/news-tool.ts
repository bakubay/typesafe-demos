import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const newsTool = createTool({
  id: 'get-news',
  description: 'Get top headlines for a topic',
  inputSchema: z.object({
    topic: z.string().describe('Topic like technology, finance, sports'),
  }),
  outputSchema: z.object({
    topic: z.string(),
    headlines: z.array(z.string()),
  }),
  execute: async ({ topic }) => {
    const normalized = topic.toLowerCase()

    const canned: Record<string, string[]> = {
      technology: [
        'AI assistant adoption rises among engineering teams',
        'Chip makers announce next-generation efficiency gains',
        'Open-source tooling sees strong enterprise growth',
      ],
      finance: [
        'Markets close higher amid lower inflation expectations',
        'Fintech firms focus on fraud prevention upgrades',
        'Central banks signal cautious policy stance',
      ],
      sports: [
        'Late comeback secures dramatic win in final minutes',
        'Coach confirms lineup changes for next fixture',
        'Injury update suggests key player may return soon',
      ],
    }

    const headlines =
      canned[normalized] ??
      [
        `Top story: New updates in ${topic}`,
        `Analysts discuss latest trends in ${topic}`,
        `What to watch next in ${topic}`,
      ]

    return { topic, headlines }
  },
})
