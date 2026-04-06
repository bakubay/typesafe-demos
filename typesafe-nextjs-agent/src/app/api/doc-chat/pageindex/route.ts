import { getPageIndexClient } from '@/lib/pageindex-client'
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { messages, docId } = await req.json()

  if (!docId) {
    return NextResponse.json({ error: 'docId is required' }, { status: 400 })
  }

  console.log(`[PageIndex] Chat request — docId=${docId}, messages=${messages.length}`)

  const client = getPageIndexClient()

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const startTime = Date.now()

      try {
        const piStream = await client.api.chatCompletions({
          messages: messages.map((m: { role: string; content?: string; parts?: Array<{ type: string; text: string }> }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content ?? m.parts?.find((p: { type: string }) => p.type === 'text')?.text ?? '',
          })),
          doc_id: docId,
          stream: true,
        })

        console.log(`[PageIndex] Stream started in ${Date.now() - startTime}ms`)

        const partId = `pi-${Date.now()}`
        writer.write({ type: 'text-start', id: partId })

        for await (const chunk of piStream) {
          const delta = chunk.choices?.[0]?.delta?.content
          if (delta) {
            writer.write({ type: 'text-delta', id: partId, delta })
          }
        }

        writer.write({ type: 'text-end', id: partId })
        console.log(`[PageIndex] Stream completed in ${Date.now() - startTime}ms`)
      } catch (err) {
        console.error(`[PageIndex] Error:`, err)
        const partId = `pi-err-${Date.now()}`
        writer.write({ type: 'text-start', id: partId })
        writer.write({
          type: 'text-delta',
          id: partId,
          delta: `**PageIndex error:** ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
        writer.write({ type: 'text-end', id: partId })
      }
    },
  })

  return createUIMessageStreamResponse({ stream })
}
