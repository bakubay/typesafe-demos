import { NextResponse } from 'next/server'
import type { TreeNode } from '@pageindex/sdk'
import { walkTreeRecursive, collectTargetPages } from '@/lib/typesafe-tree-reasoning'

type WalkRequestBody = {
  question?: string
  tree?: TreeNode[]
  threshold?: number
  maxWinners?: number
  maxPages?: number
  maxDepth?: number
}

export async function POST(req: Request) {
  const body = (await req.json()) as WalkRequestBody
  const question = body.question?.trim()
  const tree = body.tree
  const threshold = body.threshold ?? 0.5
  const maxWinners = body.maxWinners ?? 3
  const maxPages = body.maxPages ?? 12
  const maxDepth = body.maxDepth ?? 4

  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }
  if (!Array.isArray(tree) || tree.length === 0) {
    return NextResponse.json({ error: 'tree is required' }, { status: 400 })
  }

  const apiKey = process.env.TYPESAFE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'TYPESAFE_API_KEY not set' }, { status: 500 })
  }

  try {
    const walkResult = await walkTreeRecursive(tree, question, apiKey, {
      threshold,
      maxWinnersPerLevel: maxWinners,
      maxDepth,
    })

    const candidatePages = collectTargetPages(walkResult.leafTargets)
    const pages = candidatePages.slice(0, maxPages).map(p => p.page)

    return NextResponse.json({
      mode: 'typesafe-live',
      threshold,
      maxWinners,
      maxDepth,
      maxPages,
      question,
      topDurationMs: walkResult.topDurationMs,
      topScores: walkResult.topScores,
      winners: walkResult.winners,
      leafTargets: walkResult.leafTargets,
      targetNodeIds: walkResult.leafTargets.map(t => t.nodeId),
      pages,
      pagesTruncated: candidatePages.length > pages.length,
      totalPagesBeforeCap: candidatePages.length,
      drills: walkResult.drills.map(d => ({
        parentNodeId: d.parentNodeId,
        parentTitle: d.parentTitle,
        depth: d.depth,
        durationMs: d.durationMs,
        childScores: d.childScores,
        selectedChildren: d.selectedChildren,
      })),
      candidatePageScores: candidatePages.slice(0, maxPages).map(p => ({
        page: p.page,
        score: p.score,
      })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to run TypeSafe walk preview' },
      { status: 500 },
    )
  }
}
