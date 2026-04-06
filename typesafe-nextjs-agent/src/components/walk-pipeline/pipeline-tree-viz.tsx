"use client";

import { motion } from "motion/react";

import type { SamplePipelineVisual, SampleTreeNode } from "./sample-doc-tree";

type Props = {
  tree: SampleTreeNode[];
  visual: SamplePipelineVisual;
  question: string;
  questionLabel?: string;
  playing: boolean;
};

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function PipelineTreeViz({ tree, visual: v, question, questionLabel = "Question", playing }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-3 py-3 md:px-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{questionLabel}</p>
        <p className="mt-1 text-sm text-foreground">&ldquo;{question}&rdquo;</p>
      </div>

      <motion.div
        className="bg-muted/20 px-3 py-3 md:px-4 md:py-4"
        animate={{ opacity: v.treeOpacity }}
        transition={{ duration: playing ? 0.5 : 0.25 }}
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Outline (same shape as PageIndex)</p>
        <ul className="space-y-0">
          {tree.map((node, i) => (
            <TreeBranch
              key={node.node_id}
              node={node}
              depth={0}
              insideDrillSubtree={false}
              visual={v}
              isRootRow
              rootIndex={i}
              rootCount={tree.length}
              playing={playing}
            />
          ))}
        </ul>
      </motion.div>

      {v.pageStrip.length > 0 && (
        <motion.div
          layout
          className="border-t border-dashed border-primary/30 bg-primary/5 px-3 py-3 md:px-4"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Pages</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {v.pageStrip.map((p, idx) => (
              <motion.span
                key={`${idx}-p${p.page}`}
                layout
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{
                  scale: p.dropped ? 0.95 : 1,
                  opacity: p.dropped ? 0.4 : 1,
                }}
                className={`inline-flex flex-col rounded-lg border px-2 py-1.5 text-[11px] tabular-nums ${
                  p.dropped
                    ? "border-border bg-muted/50 text-muted-foreground line-through"
                    : "border-primary/30 bg-background text-foreground"
                }`}
              >
                <span className="font-mono font-semibold">p.{p.page}</span>
                {p.walkHint != null && <span className="text-[10px] text-muted-foreground">walk {pct(p.walkHint)}</span>}
                {p.contentScore != null && <span className="text-[10px] text-violet-700 dark:text-violet-300">text {pct(p.contentScore)}</span>}
                {p.fetching && <span className="mt-0.5 text-[9px] font-medium text-primary animate-pulse">fetching…</span>}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function TreeBranch({
  node,
  depth,
  insideDrillSubtree,
  visual,
  isRootRow,
  rootIndex,
  rootCount,
  playing,
}: {
  node: SampleTreeNode;
  depth: number;
  insideDrillSubtree: boolean;
  visual: SamplePipelineVisual;
  isRootRow?: boolean;
  rootIndex?: number;
  rootCount?: number;
  playing: boolean;
}) {
  const id = node.node_id;
  const inHot = visual.hotIds.has(id);
  const inWarm = visual.warmIds.has(id);
  const score = visual.scores[id];
  const isLeafMark = visual.leafIds.has(id);
  const isDrillParent = visual.drillParentId === id;

  const highlighted = inHot || inWarm || score !== undefined || isLeafMark;
  const dimmed = visual.dimOthers && !highlighted && !insideDrillSubtree;
  const opacity = dimmed ? visual.dimOpacity : 1;

  const childInsideDrill = insideDrillSubtree || visual.drillParentId === id;

  const rootPulse =
    isRootRow &&
    visual.pulseRoots &&
    rootIndex !== undefined &&
    rootCount !== undefined;

  return (
    <li className="list-none">
      <div className="flex" style={{ paddingLeft: depth === 0 ? 0 : 12 }}>
        {depth > 0 && <span className="mr-2 w-2 shrink-0 border-l border-border text-transparent">.</span>}
        <div className="min-w-0 flex-1">
          <motion.div
            layout
            animate={{
              scale: inHot ? 1.02 : 1,
              opacity,
            }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className={`relative rounded-lg border px-2.5 py-2 text-sm ${
              inHot
                ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/25"
                : isLeafMark
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                  : inWarm
                    ? "border-amber-300/80 bg-amber-50/80 dark:bg-amber-950/25"
                    : "border-border bg-background"
            }`}
          >
            {rootPulse && (
              <motion.span
                className="pointer-events-none absolute inset-0 rounded-lg border-2 border-primary/40"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.25, 0.7, 0.25] }}
                transition={{ duration: playing ? 1.8 : 1.2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            {isDrillParent && (
              <motion.span
                className="pointer-events-none absolute -left-1 top-1 bottom-1 w-1 rounded-full bg-amber-500"
                layoutId="drill-beam"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{node.title}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">p{node.page_index}</span>
              {score !== undefined && (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-full border border-violet-300 bg-violet-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-violet-900 dark:border-violet-600 dark:bg-violet-950/60 dark:text-violet-100"
                >
                  {pct(score)}
                </motion.span>
              )}
              {isLeafMark && <span className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">leaf</span>}
            </div>
          </motion.div>
          {node.nodes && node.nodes.length > 0 && (
            <ul className="mt-1.5 space-y-1.5 border-l border-border/60 pl-2 ml-1">
              {node.nodes.map((ch) => (
                <TreeBranch
                  key={ch.node_id}
                  node={ch}
                  depth={depth + 1}
                  insideDrillSubtree={childInsideDrill}
                  visual={visual}
                  playing={playing}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
