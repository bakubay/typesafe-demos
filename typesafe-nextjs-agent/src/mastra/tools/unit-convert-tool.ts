import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

const conversions: Record<string, number> = {
  'km-miles': 0.621371, 'miles-km': 1.60934,
  'kg-lbs': 2.20462, 'lbs-kg': 0.453592,
  'celsius-fahrenheit': 1, 'fahrenheit-celsius': 1,
  'liters-gallons': 0.264172, 'gallons-liters': 3.78541,
  'meters-feet': 3.28084, 'feet-meters': 0.3048,
}

export const unitConvertTool = createTool({
  id: 'convert-units',
  description: 'Convert between common measurement units (distance, weight, temperature, volume)',
  inputSchema: z.object({
    value: z.number().describe('Numeric value to convert'),
    from: z.string().describe('Source unit, e.g. km, celsius, kg'),
    to: z.string().describe('Target unit, e.g. miles, fahrenheit, lbs'),
  }),
  outputSchema: z.object({
    value: z.number(),
    from: z.string(),
    to: z.string(),
    result: z.number(),
  }),
  execute: async ({ value, from, to }) => {
    const key = `${from.toLowerCase()}-${to.toLowerCase()}`
    if (key === 'celsius-fahrenheit') return { value, from, to, result: +(value * 9 / 5 + 32).toFixed(2) }
    if (key === 'fahrenheit-celsius') return { value, from, to, result: +((value - 32) * 5 / 9).toFixed(2) }
    const factor = conversions[key] ?? 1
    return { value, from, to, result: +(value * factor).toFixed(4) }
  },
})
