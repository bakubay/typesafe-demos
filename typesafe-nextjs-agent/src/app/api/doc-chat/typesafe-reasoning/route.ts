import { createUIMessageStream, createUIMessageStreamResponse, streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { getPageIndexClient } from '@/lib/pageindex-client'
import {
  walkTreeRecursive,
  collectTargetPages,
  findNode,
} from '@/lib/typesafe-tree-reasoning'
import type { TreeNode } from '@pageindex/sdk'
import { NextResponse } from 'next/server'

const PAGE_BUDGET = 12

export async function POST(req: Request) {
  const body = await req.json()
  const { messages, docId, treeJson } = body

  console.log(
    `[TypeSafe Reasoning] POST — docId=${docId}, treeJson=${treeJson ? `${treeJson.length} chars` : 'MISSING'}, messages=${messages?.length}, bodyKeys=${Object.keys(body).join(',')}`,
  )

  if (!docId || !treeJson) {
    return NextResponse.json({ error: 'docId and treeJson are required' }, { status: 400 })
  }

  const typesafeKey = process.env.TYPESAFE_API_KEY
  if (!typesafeKey) {
    return NextResponse.json({ error: 'TYPESAFE_API_KEY not set' }, { status: 500 })
  }

  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
  const question =
    lastUserMsg?.parts?.find((p: { type: string }) => p.type === 'text')?.text ??
    lastUserMsg?.content ??
    ''

  const tree: TreeNode[] = JSON.parse(treeJson)

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const pipelineStart = Date.now()

      const emitStep = (step: string, status: string, label: string, detail?: string, extra?: Record<string, unknown>) => {
        writer.write({
          type: 'data-reasoning' as `data-${string}`,
          id: `ts-${step}-${Date.now()}`,
          data: { step, status, label, detail, ...extra },
          transient: true,
        })
      }

      // ── Step 1: Recursive tree walk (scores top-level + drills) ───────
      emitStep('walk', 'running', `Walking ${tree.length} top-level sections...`)

      const walkResult = await walkTreeRecursive(tree, question, typesafeKey, {
        threshold: 0.5,
        maxWinnersPerLevel: 3,
        maxDepth: 4,
      })

      emitStep('score-top', 'done', `Scored ${tree.length} sections`, `${walkResult.topDurationMs}ms — ${walkResult.winners.length} winners`, {
        scores: walkResult.topScores.map(s => `${s.title}: ${(s.probability * 100).toFixed(0)}%`),
      })

      for (const drill of walkResult.drills) {
        emitStep('drill', 'done', `Drilled into "${drill.parentTitle}" (depth ${drill.depth})`, `${drill.durationMs}ms`, {
          scores: drill.childScores.map(s => `${s.title}: ${(s.probability * 100).toFixed(0)}%`),
        })
      }

      emitStep('walk', 'done', `Walk complete — ${walkResult.leafTargets.length} leaf targets`)

      // ── Step 2: Collect pages and fetch content ───────────────────────
      const candidatePages = collectTargetPages(walkResult.leafTargets)
      const finalPages = candidatePages.slice(0, PAGE_BUDGET).map(p => p.page)

      emitStep('pages', 'running', `Fetching ${finalPages.length} pages...`)

      let pageTexts: Array<{ page: number; text: string }> = []
      const pageStart = Date.now()

      try {
        const client = getPageIndexClient()
        await client.connect()
        const result = await client.tools.getPageContent({
          docName: docId,
          pages: finalPages.join(','),
        })
        pageTexts = result.content.map(p => ({ page: p.page, text: p.text }))
      } catch {
        for (const p of finalPages) {
          const node = walkResult.leafTargets.find(t => t.pageIndex === p)
          if (node) {
            const treeNode = findNode(tree, node.nodeId)
            const text = (treeNode as TreeNode & { text?: string })?.text || treeNode?.summary || ''
            if (text) pageTexts.push({ page: p, text })
          }
        }
      }

      const pageFetchMs = Date.now() - pageStart
      emitStep('pages', 'done', `Fetched ${pageTexts.length} pages`, `${pageFetchMs}ms`)

      // ── Step 3: Build context from final pages ────────────────────────
      const context = pageTexts
        .sort((a, b) => a.page - b.page)
        .map(p => `--- Page ${p.page} ---\n${p.text}`)
        .join('\n\n')

      const totalRetrievalMs = Date.now() - pipelineStart
      emitStep('total', 'done', 'Retrieval complete', `${totalRetrievalMs}ms total — ${finalPages.length} pages`)

      // ── Step 4: Stream answer via LLM ─────────────────────────────────
      const llmSystemPrompt = `Answer the user's question based on the following document content. Cite page numbers. Be thorough but concise.\n\nDocument content:\n${context}`
      emitStep(
        'llm-input',
        'done',
        'Prepared final LLM input',
        `${context.length} context chars`,
        {
          llmInput: {
            model: 'openai/gpt-4.1',
            userQuestion: question,
            pages: finalPages,
            contextChars: context.length,
            systemPromptPreview:
              llmSystemPrompt.length > 2000
                ? `${llmSystemPrompt.slice(0, 2000)}\n\n...<truncated>`
                : llmSystemPrompt,
          },
        },
      )

      const answerResult = streamText({
        model: openai('gpt-4.1'),
        messages: [
          { role: 'system' as const, content: llmSystemPrompt },
          { role: 'user' as const, content: question },
        ],
      })

      const partId = `answer-${Date.now()}`
      writer.write({ type: 'text-start', id: partId })

      for await (const chunk of answerResult.textStream) {
        writer.write({ type: 'text-delta', id: partId, delta: chunk })
      }

      writer.write({ type: 'text-end', id: partId })
    },
  })

  return createUIMessageStreamResponse({ stream })
}
