import type { TreeNode } from '@pageindex/sdk'

type NoulResponse = {
  model: string
  responses: Array<{
    key: string
    type: string
    probability?: number
    confidence: number | null
  }>
}

/** Score each section independently using TypeSafe Noul prompts (one call, all parallel). */
export async function scoreSections(
  sections: Array<{ nodeId: string; title: string; summary?: string }>,
  question: string,
  apiKey: string,
): Promise<{ scores: Array<{ nodeId: string; title: string; probability: number }>; durationMs: number }> {
  const prompts = sections.map(s => ({
    key: s.nodeId,
    type: 'noul' as const,
    instructions: `The section "${s.title}"${s.summary ? ` (${s.summary.slice(0, 200)})` : ''} contains information relevant to: "${question}"`,
  }))

  const start = Date.now()
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

  const durationMs = Date.now() - start

  if (!res.ok) throw new Error(`TypeSafe API ${res.status} after ${durationMs}ms`)

  const data = (await res.json()) as NoulResponse

  const scores = data.responses
    .map(r => ({
      nodeId: r.key,
      title: sections.find(s => s.nodeId === r.key)?.title ?? r.key,
      probability: r.probability ?? 0,
    }))
    .sort((a, b) => b.probability - a.probability)

  return { scores, durationMs }
}

/** Collect page numbers from selected tree nodes (including all descendants). */
export function collectPageNumbers(tree: TreeNode[], selectedIds: string[]): number[] {
  const pages = new Set<number>()

  function walk(nodes: TreeNode[]) {
    for (const node of nodes) {
      if (selectedIds.includes(node.node_id)) {
        // Collect this node and ALL descendants
        function addAll(n: TreeNode) {
          pages.add(n.page_index)
          n.nodes?.forEach(addAll)
        }
        addAll(node)
      } else if (node.nodes) {
        walk(node.nodes)
      }
    }
  }

  walk(tree)
  return Array.from(pages).sort((a, b) => a - b)
}

/** Find a node by ID in the tree. */
export function findNode(tree: TreeNode[], id: string): TreeNode | undefined {
  for (const n of tree) {
    if (n.node_id === id) return n
    if (n.nodes) {
      const found = findNode(n.nodes, id)
      if (found) return found
    }
  }
  return undefined
}

// ── Improved pipeline ────────────────────────────────────────────────────────

export type LeafTarget = { nodeId: string; title: string; pageIndex: number; score: number }

export type DrillStep = {
  parentNodeId: string
  parentTitle: string
  depth: number
  durationMs: number
  childScores: Array<{ nodeId: string; title: string; probability: number }>
  selectedChildren: string[]
}

export type WalkResult = {
  topScores: Array<{ nodeId: string; title: string; probability: number }>
  topDurationMs: number
  winners: Array<{ nodeId: string; title: string; probability: number }>
  drills: DrillStep[]
  leafTargets: LeafTarget[]
}

export type WalkOptions = {
  threshold?: number
  maxWinnersPerLevel?: number
  maxDepth?: number
}

/**
 * Recursively walk the tree, scoring at each level and drilling into winners
 * until we reach leaf nodes or maxDepth. Sibling groups at each level are
 * scored in parallel.
 */
export async function walkTreeRecursive(
  tree: TreeNode[],
  question: string,
  apiKey: string,
  opts: WalkOptions = {},
): Promise<WalkResult> {
  const threshold = opts.threshold ?? 0.5
  const maxWinnersPerLevel = opts.maxWinnersPerLevel ?? 3
  const maxDepth = opts.maxDepth ?? 4

  const drills: DrillStep[] = []
  const leafTargets: LeafTarget[] = []

  const topSections = tree.map(n => ({ nodeId: n.node_id, title: n.title, summary: n.summary }))
  const { scores: topScores, durationMs: topDurationMs } = await scoreSections(topSections, question, apiKey)

  const relevant = topScores.filter(s => s.probability >= threshold)
  const winners = (relevant.length > 0 ? relevant : topScores).slice(0, maxWinnersPerLevel)

  async function drill(nodeId: string, score: number, depth: number): Promise<void> {
    const node = findNode(tree, nodeId)
    if (!node) return

    if (!node.nodes || node.nodes.length <= 1 || depth >= maxDepth) {
      leafTargets.push({ nodeId: node.node_id, title: node.title, pageIndex: node.page_index, score })
      return
    }

    const childSections = node.nodes.map(c => ({ nodeId: c.node_id, title: c.title, summary: c.summary }))
    const { scores: childScores, durationMs } = await scoreSections(childSections, question, apiKey)

    const relevantChildren = childScores.filter(s => s.probability >= threshold)
    const selected = (relevantChildren.length > 0 ? relevantChildren : childScores).slice(0, maxWinnersPerLevel)

    drills.push({
      parentNodeId: node.node_id,
      parentTitle: node.title,
      depth,
      durationMs,
      childScores,
      selectedChildren: selected.map(s => s.nodeId),
    })

    await Promise.all(selected.map(s => drill(s.nodeId, s.probability, depth + 1)))
  }

  await Promise.all(winners.map(w => drill(w.nodeId, w.probability, 1)))

  return { topScores, topDurationMs, winners, drills, leafTargets }
}

/**
 * Collect pages from leaf targets — only the target's own page plus +/-1
 * neighbors for context continuity. Returns de-duped pages with their best score.
 */
export function collectTargetPages(
  leafTargets: LeafTarget[],
  totalDocPages?: number,
): Array<{ page: number; score: number }> {
  const pageScores = new Map<number, number>()

  for (const t of leafTargets) {
    const neighbors = [t.pageIndex - 1, t.pageIndex, t.pageIndex + 1]
    for (const p of neighbors) {
      if (p < 0) continue
      if (totalDocPages !== undefined && p >= totalDocPages) continue
      const existing = pageScores.get(p) ?? 0
      const effectiveScore = p === t.pageIndex ? t.score : t.score * 0.5
      pageScores.set(p, Math.max(existing, effectiveScore))
    }
  }

  return Array.from(pageScores.entries())
    .map(([page, score]) => ({ page, score }))
    .sort((a, b) => b.score - a.score)
}

