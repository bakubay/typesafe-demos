import { collectTargetPages, type LeafTarget } from '@/lib/typesafe-tree-reasoning'

import type { SamplePipelineVisual, SampleTreeNode } from './sample-doc-tree'

/** Response shape from POST /api/doc-chat/typesafe-walk-preview */
export type WalkPreviewPayload = {
  topScores: Array<{ nodeId: string; title?: string; probability: number }>
  winners: Array<{ nodeId: string; title?: string; probability: number }>
  drills: Array<{
    parentNodeId: string
    parentTitle?: string
    depth: number
    childScores: Array<{ nodeId: string; title?: string; probability: number }>
    selectedChildren: string[]
  }>
  leafTargets: Array<{ nodeId: string; title: string; pageIndex: number; score: number }>
  pages: number[]
  pagesTruncated: boolean
  totalPagesBeforeCap: number
  candidatePageScores: Array<{ page: number; score: number }>
}

function setOf(...ids: string[]) {
  return new Set(ids)
}

function rootIds(tree: SampleTreeNode[]) {
  return tree.map(n => n.node_id)
}

const base = (v: Partial<SamplePipelineVisual>): SamplePipelineVisual => ({
  hotIds: new Set(),
  warmIds: new Set(),
  scores: {},
  leafIds: new Set(),
  dimOthers: false,
  dimOpacity: 0.35,
  pulseRoots: false,
  drillParentId: null,
  pageStrip: [],
  treeOpacity: 1,
  ...v,
})

/** Before a walk preview: only generic root emphasis (any PageIndex-shaped tree). */
export function buildNeutralPipelineVisual(beat: number, tree: SampleTreeNode[]): SamplePipelineVisual {
  const roots = rootIds(tree)
  if (beat <= 1) return base({ warmIds: setOf(...roots), pulseRoots: beat === 1 })
  return base({ warmIds: setOf(...roots) })
}

/**
 * Map the 16 explainer beats to highlights/page strip using a real walk preview.
 * Pages are selected by walk score and capped to the page budget.
 */
export function buildLivePipelineVisual(beat: number, tree: SampleTreeNode[], preview: WalkPreviewPayload): SamplePipelineVisual {
  const roots = rootIds(tree)
  const topMap = Object.fromEntries(preview.topScores.map(s => [s.nodeId, s.probability]))

  if (beat <= 1) {
    return base({ warmIds: setOf(...roots), pulseRoots: beat === 1 })
  }
  if (beat === 2) {
    return base({ warmIds: setOf(...roots), scores: { ...topMap } })
  }
  if (beat === 3) {
    const w = new Set(preview.winners.map(x => x.nodeId))
    return base({ hotIds: w, warmIds: setOf(...roots), scores: { ...topMap }, dimOthers: true })
  }

  const drills = preview.drills

  const leafTargets = preview.leafTargets as LeafTarget[]
  const leafIds = new Set(leafTargets.map(t => t.nodeId))
  const leafScoreMap = Object.fromEntries(leafTargets.map(t => [t.nodeId, t.score]))

  if (beat >= 4 && beat <= 6) {
    if (drills[0]) {
      const d = drills[0]
      const childMap = Object.fromEntries(d.childScores.map(c => [c.nodeId, c.probability]))
      const merged = { ...topMap, ...childMap }
      if (beat === 4) {
        return base({
          hotIds: setOf(d.parentNodeId),
          drillParentId: d.parentNodeId,
          scores: merged,
          dimOthers: true,
        })
      }
      if (beat === 5) {
        return base({
          hotIds: setOf(d.parentNodeId),
          drillParentId: d.parentNodeId,
          warmIds: new Set(d.childScores.map(c => c.nodeId)),
          scores: merged,
          dimOthers: true,
        })
      }
      return base({
        hotIds: setOf(d.parentNodeId),
        warmIds: new Set(d.selectedChildren),
        scores: merged,
        dimOthers: true,
      })
    }
    const merged = { ...topMap, ...leafScoreMap }
    return base({
      leafIds,
      scores: merged,
      dimOthers: beat >= 5,
    })
  }

  if (beat === 7 && drills[1]) {
    const d = drills[1]
    const childMap = Object.fromEntries(d.childScores.map(c => [c.nodeId, c.probability]))
    const merged = { ...topMap, ...childMap }
    return base({
      hotIds: setOf(d.parentNodeId),
      drillParentId: d.parentNodeId,
      warmIds: new Set(d.childScores.map(c => c.nodeId)),
      scores: merged,
      dimOthers: true,
    })
  }

  if (beat === 7 || beat === 8) {
    return base({
      leafIds,
      scores: beat === 7 ? { ...topMap, ...leafScoreMap } : { ...leafScoreMap },
      dimOthers: true,
    })
  }

  const candidates = collectTargetPages(leafTargets)
  const finalPages = new Set(preview.pages)

  if (beat === 9) {
    return base({
      leafIds,
      scores: leafScoreMap,
      dimOthers: true,
      pageStrip: candidates.map(c => ({ page: c.page, walkHint: c.score })),
    })
  }
  if (beat === 10) {
    return base({
      leafIds,
      dimOthers: true,
      pageStrip: [...candidates].map(c => ({ page: c.page, walkHint: c.score })),
    })
  }
  if (beat === 11) {
    return base({
      leafIds,
      dimOthers: true,
      treeOpacity: 0.55,
      pageStrip: candidates.map(c => ({ page: c.page, walkHint: c.score, fetching: true })),
    })
  }
  if (beat === 12) {
    return base({
      dimOthers: true,
      treeOpacity: 0.45,
      pageStrip: candidates.map(c => ({
        page: c.page,
        walkHint: c.score,
      })),
    })
  }
  if (beat === 13) {
    return base({
      dimOthers: true,
      treeOpacity: 0.35,
      pageStrip: candidates.map(c => ({
        page: c.page,
        walkHint: c.score,
        dropped: !finalPages.has(c.page),
      })),
    })
  }
  if (beat === 14) {
    return base({
      treeOpacity: 0.25,
      pageStrip: preview.candidatePageScores.map(c => ({ page: c.page, walkHint: c.score })),
    })
  }
  return base({
    treeOpacity: 0.15,
    pageStrip: preview.candidatePageScores.map(c => ({ page: c.page, walkHint: c.score })),
  })
}
