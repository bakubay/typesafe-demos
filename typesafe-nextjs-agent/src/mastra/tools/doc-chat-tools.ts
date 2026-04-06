import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

// ─── Tool 1: Score Sections with TypeSafe Nouls ─────────────────────────────

const SectionSchema = z.object({
  nodeId: z.string(),
  title: z.string(),
  summary: z.string().optional(),
})

type EvaluationResponse = {
  model: string
  responses: Array<{
    key: string
    type: string
    probability?: number
    confidence: number | null
  }>
}

export const scoreSectionsTool = createTool({
  id: 'score-sections',
  description:
    'Score how relevant each section is to a question using TypeSafe AI. Sends one Noul prompt per section in a single fast API call. Returns independent relevance probabilities (0-1) for each section. Use this to find which parts of the document are relevant.',
  inputSchema: z.object({
    question: z.string().describe('The user question to evaluate against'),
    sections: z.array(SectionSchema).describe('Array of sections to score'),
  }),
  outputSchema: z.object({
    scores: z.string().describe('JSON array of { nodeId, title, probability } sorted by relevance'),
    durationMs: z.number().describe('How long the TypeSafe API call took'),
  }),
  execute: async ({ question, sections }) => {
    const apiKey = process.env.TYPESAFE_API_KEY
    if (!apiKey) throw new Error('TYPESAFE_API_KEY is not set')

    // Build one Noul prompt per section
    const prompts = sections.map(s => ({
      key: s.nodeId,
      type: 'noul' as const,
      instructions: `The section titled "${s.title}"${s.summary ? ` (about: ${s.summary.slice(0, 200)})` : ''} contains information relevant to answering: "${question}"`,
    }))

    const startTime = Date.now()
    const res = await fetch('https://api.typesafe.ai/preview/evaluation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'speed_latest',
        document: `User question: "${question}"`,
        prompts,
      }),
    })

    const durationMs = Date.now() - startTime

    if (!res.ok) {
      throw new Error(`TypeSafe API returned ${res.status} after ${durationMs}ms`)
    }

    const data = (await res.json()) as EvaluationResponse

    const scores = data.responses
      .map(r => ({
        nodeId: r.key,
        title: sections.find(s => s.nodeId === r.key)?.title ?? r.key,
        probability: r.probability ?? 0,
      }))
      .sort((a, b) => b.probability - a.probability)

    return {
      scores: JSON.stringify(scores, null, 2),
      durationMs,
    }
  },
})

// ─── Tool 3: Get Page Content ────────────────────────────────────────────────

export const getPageContentTool = createTool({
  id: 'get-page-content',
  description:
    'Fetch the actual text content of specific pages from a document. Use this after identifying relevant sections to read their content. Pass page numbers as a comma-separated string like "1,3,5" or a range like "10-15".',
  inputSchema: z.object({
    docId: z.string().describe('The PageIndex document ID'),
    pages: z.string().describe('Page numbers to fetch, e.g. "1,3,5" or "10-15"'),
  }),
  outputSchema: z.object({
    content: z.string().describe('The text content of the requested pages'),
    pagesReturned: z.number().describe('Number of pages returned'),
  }),
  execute: async ({ docId, pages }) => {
    const { getPageIndexClient } = await import('@/lib/pageindex-client')
    const client = getPageIndexClient()

    const result = await client.api.chatCompletions({
      messages: [{ role: 'user', content: `Return the raw text content of pages ${pages}` }],
      doc_id: docId,
      stream: false,
    })

    // Fallback: try the tools API for page content
    // The chat API might not return raw pages, so we try tools
    try {
      await client.connect()
      const pageResult = await client.tools.getPageContent({
        docName: docId,
        pages,
      })

      const content = pageResult.content
        .map(p => `--- Page ${p.page} ---\n${p.text}`)
        .join('\n\n')

      return { content, pagesReturned: pageResult.content.length }
    } catch {
      // Fallback to chat response
      const text = result.choices?.[0]?.message?.content ?? 'No content returned'
      return { content: text, pagesReturned: 0 }
    }
  },
})
