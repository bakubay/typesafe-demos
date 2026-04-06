import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const airQualityTool = createTool({
  id: 'get-air-quality',
  description: 'Get current air quality index (AQI) and pollutant levels for a location',
  inputSchema: z.object({
    location: z.string().describe('City or region'),
  }),
  outputSchema: z.object({
    location: z.string(),
    aqi: z.number(),
    level: z.string(),
    mainPollutant: z.string(),
    advice: z.string(),
  }),
  execute: async ({ location }) => {
    const aqi = Math.floor(Math.random() * 200) + 10
    const level = aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy for Sensitive Groups' : 'Unhealthy'
    return {
      location,
      aqi,
      level,
      mainPollutant: aqi > 100 ? 'PM2.5' : 'O3',
      advice: aqi <= 50 ? 'Air quality is satisfactory' : 'Consider reducing outdoor activities',
    }
  },
})
