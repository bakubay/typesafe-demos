import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import type { ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors'
import { BaseProcessor } from '@mastra/core/processors'
import { weatherTool } from '../tools/weather-tool'
import { newsTool } from '../tools/news-tool'
import { calculatorTool } from '../tools/calculator-tool'
import { restaurantTool } from '../tools/restaurant-tool'
import { flightTool } from '../tools/flight-tool'
import { hotelTool } from '../tools/hotel-tool'
import { carRentalTool } from '../tools/car-rental-tool'
import { eventsTool } from '../tools/events-tool'
import { currencyTool } from '../tools/currency-tool'
import { stockTool } from '../tools/stock-tool'
import { cryptoTool } from '../tools/crypto-tool'
import { translateTool } from '../tools/translate-tool'
import { timezoneTool } from '../tools/timezone-tool'
import { uvIndexTool } from '../tools/uv-index-tool'
import { airQualityTool } from '../tools/air-quality-tool'
import { unitConvertTool } from '../tools/unit-convert-tool'
import { definitionTool } from '../tools/definition-tool'
import { randomFactTool } from '../tools/random-fact-tool'
import { MastraGuardrail } from '../processors/mastra-guardrail'
import { GptToolSearchProcessor } from '../processors/gpt-tool-search'
import { TypeSafeGuardrail } from '../processors/typesafe-guardrail'
import { TypeSafeToolSearchProcessor } from '../processors/typesafe-tool-search'

class EnsureFinalResponseProcessor extends BaseProcessor<'ensure-final-response'> {
  readonly id = 'ensure-final-response' as const
  readonly name = 'Ensure Final Response'

  private maxSteps: number

  constructor(maxSteps: number) {
    super()
    this.maxSteps = maxSteps
  }

  async processInputStep({
    stepNumber,
    systemMessages,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult | void> {
    if (stepNumber >= this.maxSteps - 1) {
      return {
        tools: {},
        toolChoice: 'none' as const,
        systemMessages: [
          ...systemMessages,
          {
            role: 'system' as const,
            content:
              'You have reached the maximum number of steps. Summarize your progress so far and provide a best-effort response using the tool results you already have. If the task is incomplete, clearly indicate what remains.',
          },
        ],
      }
    }
  }
}

const searchableTools = {
  'get-weather': weatherTool,
  'get-news': newsTool,
  calculate: calculatorTool,
  'find-restaurants': restaurantTool,
  'search-flights': flightTool,
  'search-hotels': hotelTool,
  'search-car-rentals': carRentalTool,
  'find-events': eventsTool,
  'convert-currency': currencyTool,
  'get-stock-quote': stockTool,
  'get-crypto-price': cryptoTool,
  'translate-text': translateTool,
  'get-timezone': timezoneTool,
  'get-uv-index': uvIndexTool,
  'get-air-quality': airQualityTool,
  'convert-units': unitConvertTool,
  'define-word': definitionTool,
  'get-random-fact': randomFactTool,
}

const SHARED_INSTRUCTIONS = `You are a helpful assistant. You have a large catalog of tools, but only those relevant to each request are made available.
Use the tools exposed to you when they help provide a concrete answer.
If a request does not require tools, answer directly.
Keep responses concise and useful.
Once you receive tool results, synthesize them into a response — never re-call the same tool expecting different output.
`

const SHARED_MODEL = 'openai/gpt-4.1' as const

export const MAX_STEPS = 5

const sharedMemory = () => new Memory({ options: { lastMessages: 20 } })

export const superAgentGpt = new Agent({
  id: 'super-agent-gpt',
  name: 'Super Agent (GPT)',
  instructions: SHARED_INSTRUCTIONS,
  model: SHARED_MODEL,
  tools: {},
  memory: sharedMemory(),
  inputProcessors: [
    new MastraGuardrail(),
    new GptToolSearchProcessor({ tools: searchableTools, threshold: 0.3, topK: 5 }),
    new EnsureFinalResponseProcessor(MAX_STEPS),
  ],
})

export const superAgentTypeSafe = new Agent({
  id: 'super-agent-typesafe',
  name: 'Super Agent (TypeSafe)',
  instructions: SHARED_INSTRUCTIONS,
  model: SHARED_MODEL,
  tools: {},
  memory: sharedMemory(),
  inputProcessors: [
    new TypeSafeGuardrail(),
    new TypeSafeToolSearchProcessor({
      tools: searchableTools,
      threshold: 0.15,
      topK: 5,
      model: 'speed_v9_angry_pig',
    }),
    new EnsureFinalResponseProcessor(MAX_STEPS),
  ],
})
