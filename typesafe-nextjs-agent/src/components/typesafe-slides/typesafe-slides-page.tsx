"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { DocumentInfo } from "@/types/doc-chat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TREE_SOURCE_LOCAL = "__local__" as const;

function SlideAppLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="outline" size="sm" className="h-auto w-fit gap-1.5 py-2" asChild>
      <Link href={href}>
        <span>{label}</span>
        <span aria-hidden className="text-muted-foreground">
          →
        </span>
        <span className="font-mono text-xs font-normal text-muted-foreground">{href}</span>
      </Link>
    </Button>
  );
}

type TreeNode = {
  node_id: string;
  title: string;
  summary?: string;
  page_index: number;
  nodes?: TreeNode[];
};

type ScoredNode = {
  nodeId: string;
  title: string;
  probability: number;
};

type LeafTarget = {
  nodeId: string;
  title: string;
  pageIndex: number;
  score: number;
};

type DrillResult = {
  parentNodeId: string;
  parentTitle: string;
  depth: number;
  durationMs: number;
  childScores: ScoredNode[];
  selectedChildren: string[];
};

type CandidatePageScore = {
  page: number;
  score: number;
};

type LiveWalkResult = {
  mode: "typesafe-live";
  threshold: number;
  maxWinners: number;
  maxDepth: number;
  maxPages: number;
  question: string;
  topDurationMs: number;
  topScores: ScoredNode[];
  winners: ScoredNode[];
  leafTargets: LeafTarget[];
  targetNodeIds: string[];
  pages: number[];
  pagesTruncated: boolean;
  totalPagesBeforeCap: number;
  drills: DrillResult[];
  candidatePageScores: CandidatePageScore[];
};

const STORAGE_KEY = "typesafe:docTree:v1";

function readSavedTree(): TreeNode[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tree?: TreeNode[] };
    return Array.isArray(parsed.tree) ? parsed.tree : null;
  } catch {
    return null;
  }
}

const guardrailPayload = `{
  "model": "speed_v9_angry_pig",
  "document": "<latest user text>",
  "prompts": [
    {
      "key": "safety",
      "type": "choice",
      "instructions": "Classify for a public multi-tool assistant...",
      "options": [
        { "option": "safe", "description": "Normal use..." },
        { "option": "unsafe", "description": "Harmful or system attacks..." }
      ]
    }
  ]
}`;

const toolFilterPayload = `{
  "model": "speed_v9_angry_pig",
  "document": "<latest user text>",
  "prompts": [
    {
      "key": "tool_get-weather",
      "type": "noul",
      "instructions": "The tool \\"get-weather\\" is relevant..."
    },
    {
      "key": "tool_convert-currency",
      "type": "noul",
      "instructions": "The tool \\"convert-currency\\" is relevant..."
    }
  ]
}`;

const docChatPayload = `{
  "model": "speed_latest",
  "document": "User question: \\"<question>\\"",
  "prompts": [
    {
      "key": "<node_id>",
      "type": "noul",
      "instructions": "The section \\"<title>\\" contains info relevant to <question>"
    }
  ]
}`;

function ScoreBadge({ probability }: { probability: number }) {
  const pct = Math.round(probability * 100);
  const color = pct >= 50 ? "bg-emerald-100 text-emerald-800 border-emerald-300" : pct >= 20 ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-zinc-100 text-zinc-500 border-zinc-200";
  return <span className={`inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-mono font-semibold ${color}`}>{pct}%</span>;
}

function WalkTreeView({ nodes, scores, winnerIds, targetIds, selectedPages, drillScores }: { nodes: TreeNode[]; scores: Map<string, number>; winnerIds: Set<string>; targetIds: Set<string>; selectedPages: Set<number>; drillScores: Map<string, number> }) {
  return (
    <ul className="space-y-1.5">
      {nodes.map((node) => {
        const isWinner = winnerIds.has(node.node_id);
        const isTarget = targetIds.has(node.node_id);
        const isPage = selectedPages.has(node.page_index);
        const topScore = scores.get(node.node_id);
        const drillScore = drillScores.get(node.node_id);
        const score = drillScore ?? topScore;

        let border = "border-border";
        let bg = "bg-background";
        if (isTarget) {
          border = "border-emerald-400";
          bg = "bg-emerald-50";
        } else if (isWinner) {
          border = "border-blue-400";
          bg = "bg-blue-50";
        } else if (isPage) {
          border = "border-violet-300";
          bg = "bg-violet-50/50";
        }

        return (
          <li key={node.node_id} className={`rounded-lg border ${border} ${bg} px-3 py-2 transition-colors duration-300`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium flex-1 min-w-0 truncate">{node.title}</span>
              {score !== undefined && <ScoreBadge probability={score} />}
              {isPage && <span className="rounded-full bg-violet-200 px-1.5 py-0.5 text-[10px] font-mono text-violet-800">p{node.page_index}</span>}
              {!isPage && <span className="text-[10px] text-muted-foreground/60 tabular-nums">p{node.page_index}</span>}
            </div>
            {node.nodes && node.nodes.length > 0 && (
              <div className="mt-1.5 border-l-2 border-border/50 pl-3 ml-1">
                <WalkTreeView nodes={node.nodes} scores={scores} winnerIds={winnerIds} targetIds={targetIds} selectedPages={selectedPages} drillScores={drillScores} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function StepTimeline({ result }: { result: LiveWalkResult }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-blue-800">Step 1: Score top-level</p>
          <span className="text-[11px] text-blue-600 tabular-nums">{result.topDurationMs}ms</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {result.topScores.map((s) => (
            <span key={s.nodeId} className={`rounded-md border px-2 py-0.5 text-xs ${result.winners.some((w) => w.nodeId === s.nodeId) ? "border-blue-400 bg-blue-100 text-blue-900 font-semibold" : "border-border bg-background text-muted-foreground"}`}>
              {s.title} {Math.round(s.probability * 100)}%
            </span>
          ))}
        </div>
      </div>

      {result.drills.map((drill, i) => (
        <div key={`${drill.parentNodeId}-${i}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-amber-800">Drill depth {drill.depth}: &ldquo;{drill.parentTitle}&rdquo;</p>
            <span className="text-[11px] text-amber-600 tabular-nums">{drill.durationMs}ms</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {drill.childScores.map((s) => (
              <span key={s.nodeId} className={`rounded-md border px-2 py-0.5 text-xs ${drill.selectedChildren.includes(s.nodeId) ? "border-emerald-400 bg-emerald-100 text-emerald-900 font-semibold" : "border-border bg-background text-muted-foreground"}`}>
                {s.title} {Math.round(s.probability * 100)}%
              </span>
            ))}
          </div>
        </div>
      ))}

      {result.leafTargets && result.leafTargets.length > 0 && (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
          <p className="text-xs font-semibold uppercase text-cyan-800">Leaf targets ({result.leafTargets.length})</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.leafTargets.map((t) => (
              <span key={t.nodeId} className="rounded-md border border-cyan-300 bg-cyan-100 px-2 py-0.5 text-xs text-cyan-900">
                {t.title} <span className="font-mono">{Math.round(t.score * 100)}%</span> <span className="text-cyan-600">p{t.pageIndex}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-xs font-semibold uppercase text-emerald-800">Selected pages (budget: {result.maxPages})</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {result.pages.map((page) => {
            const cs = result.candidatePageScores?.find((c) => c.page === page);
            return (
              <span key={page} className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-xs font-mono text-emerald-800">
                {page}{cs ? ` (${Math.round(cs.score * 100)}%)` : ""}
              </span>
            );
          })}
        </div>
        {result.pagesTruncated && (
          <p className="mt-1.5 text-[11px] text-emerald-700">
            Capped to {result.maxPages} pages (walk found {result.totalPagesBeforeCap} candidates)
          </p>
        )}
      </div>
    </div>
  );
}

export default function TypeSafeSlidesPage() {
  const [question, setQuestion] = useState("What does this document say about pricing and limits?");
  const [tree, setTree] = useState<TreeNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LiveWalkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverDocs, setServerDocs] = useState<DocumentInfo[]>([]);
  const [serverDocsLoading, setServerDocsLoading] = useState(false);
  const [docsListError, setDocsListError] = useState<string | null>(null);
  const [treeSource, setTreeSource] = useState<string>(TREE_SOURCE_LOCAL);
  const [treeLoading, setTreeLoading] = useState(false);

  // Hydrate tree from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const saved = readSavedTree();
    if (saved) setTree(saved);
  }, []);

  const loadFromStorage = useCallback(() => {
    setError(null);
    setResult(null);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setError("No saved tree in this browser. Pick a completed document from the server list, or open doc chat and select a ready document.");
        return;
      }
      const parsed = JSON.parse(raw) as { tree?: TreeNode[] };
      if (!Array.isArray(parsed.tree)) {
        setError("Saved data exists but does not contain a valid tree array.");
        return;
      }
      setTree(parsed.tree);
    } catch {
      setError("Failed to parse localStorage tree JSON.");
    }
  }, []);

  const refreshServerDocuments = useCallback(async () => {
    setServerDocsLoading(true);
    setDocsListError(null);
    try {
      const res = await fetch("/api/doc-chat/documents");
      const data = (await res.json()) as DocumentInfo[] | { error?: string };
      if (!res.ok) {
        setServerDocs([]);
        setDocsListError(typeof (data as { error?: string }).error === "string" ? (data as { error: string }).error : `Could not list documents (HTTP ${res.status}). Is PAGEINDEX_API_KEY set?`);
        return;
      }
      setServerDocs(Array.isArray(data) ? data : []);
    } catch {
      setServerDocs([]);
      setDocsListError("Network error while fetching the document list.");
    } finally {
      setServerDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshServerDocuments();
  }, [refreshServerDocuments]);

  const loadTree = useCallback(async () => {
    setError(null);
    setResult(null);
    if (treeSource === TREE_SOURCE_LOCAL) {
      loadFromStorage();
      return;
    }
    setTreeLoading(true);
    try {
      const res = await fetch(`/api/doc-chat/documents/${encodeURIComponent(treeSource)}/tree`);
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        setError("Tree API returned invalid JSON.");
        setTree(null);
        return;
      }
      if (!res.ok) {
        const errBody = body as { error?: string };
        setError(errBody?.error ?? `Could not load tree (HTTP ${res.status}).`);
        setTree(null);
        return;
      }
      const raw = Array.isArray(body) ? body : (body as { result?: TreeNode[] }).result;
      if (!Array.isArray(raw) || raw.length === 0) {
        setError("Server returned no tree. The document may still be processing—try again when status is completed.");
        setTree(null);
        return;
      }
      setTree(raw);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ docId: treeSource, savedAt: Date.now(), tree: raw }));
      } catch {
        // ignore quota / private mode
      }
    } catch {
      setError("Network error loading tree from API.");
      setTree(null);
    } finally {
      setTreeLoading(false);
    }
  }, [treeSource, loadFromStorage]);

  const runWalk = useCallback(async () => {
    if (!tree || !question.trim()) {
      setError("Tree and question are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/doc-chat/typesafe-walk-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tree, question, threshold: 0.5, maxWinners: 3, maxDepth: 4, maxPages: 12 }),
      });
      const data = (await res.json()) as LiveWalkResult | { error?: string };
      if (!res.ok) {
        setError("error" in data && data.error ? data.error : "Walk preview failed");
        setResult(null);
        return;
      }
      setResult(data as LiveWalkResult);
    } catch {
      setError("Network error calling walk preview.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [question, tree]);

  const topScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    result?.topScores.forEach((s) => map.set(s.nodeId, s.probability));
    return map;
  }, [result?.topScores]);

  const drillScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    result?.drills.forEach((drill) => {
      drill.childScores.forEach((s) => map.set(s.nodeId, s.probability));
    });
    return map;
  }, [result?.drills]);

  const winnerIds = useMemo(() => new Set(result?.winners.map((w) => w.nodeId) ?? []), [result?.winners]);
  const targetIds = useMemo(() => new Set(result?.targetNodeIds ?? []), [result?.targetNodeIds]);
  const selectedPages = useMemo(() => new Set(result?.pages ?? []), [result?.pages]);

  return (
    <main className="h-screen overflow-y-auto snap-y snap-mandatory bg-background text-foreground">
      <section className="snap-start min-h-screen p-8 md:p-14 flex flex-col justify-center gap-6">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Slide 1</p>
        <h1 className="text-3xl md:text-5xl font-semibold">TypeSafe Guardrail</h1>
        <p className="max-w-3xl text-base md:text-lg text-muted-foreground">
          We run TypeSafe before generation to classify user input as safe/unsafe. If blocked, we patch the user message into a policy-safe instruction so the model replies with a brief safety redirect instead of the blocked content.
        </p>
        <SlideAppLink href="/chat" label="Try guardrail in chat" />
        <ul className="space-y-2 text-sm md:text-base">
          <li>- Code: `src/mastra/processors/typesafe-guardrail.ts`</li>
          <li>- Prompt type: `choice` (`safe` vs `unsafe`)</li>
          <li>- Block if: chosen unsafe OR unsafe probability exceeds threshold OR local explicit-hate fallback</li>
        </ul>
        <pre className="rounded-xl border border-border bg-card p-4 text-xs overflow-x-auto">{guardrailPayload}</pre>
      </section>

      <section className="snap-start min-h-screen p-8 md:p-14 flex flex-col justify-center gap-6">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Slide 2</p>
        <h2 className="text-3xl md:text-5xl font-semibold">TypeSafe Tool Filtering</h2>
        <p className="max-w-3xl text-base md:text-lg text-muted-foreground">For each candidate tool, we ask TypeSafe for a relevance probability and keep only high-signal tools. This shrinks tool spam and improves tool-call precision.</p>
        <SlideAppLink href="/chat" label="Try tool filtering in chat" />
        <ul className="space-y-2 text-sm md:text-base">
          <li>- Code: `src/mastra/processors/typesafe-tool-search.ts`</li>
          <li>- Prompt type: `noul` (one prompt per tool)</li>
          <li>- Selection: probability {">="} threshold, sorted desc, take topK</li>
          <li>- Current lane config: threshold `0.15`, topK `5`</li>
        </ul>
        <pre className="rounded-xl border border-border bg-card p-4 text-xs overflow-x-auto">{toolFilterPayload}</pre>
      </section>

      <section className="snap-start min-h-screen p-8 md:p-14 flex flex-col justify-center gap-6">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Slide 3</p>
        <h2 className="text-3xl md:text-5xl font-semibold">TypeSafe Doc-Chat Reasoning</h2>
        <p className="max-w-3xl text-base md:text-lg text-muted-foreground">In doc-chat, TypeSafe scores tree nodes for relevance, then we fetch the winning pages and generate the final answer with citations.</p>
        <SlideAppLink href="/doc-chat" label="Open doc chat" />
        <ul className="space-y-2 text-sm md:text-base">
          <li>- Scoring helper: `src/lib/typesafe-tree-reasoning.ts`</li>
          <li>- Route: `src/app/api/doc-chat/typesafe-reasoning/route.ts`</li>
          <li>- Pattern: recursive drill to leaves, collect pages + neighbors, cap to budget, answer</li>
        </ul>
        <pre className="rounded-xl border border-border bg-card p-4 text-xs overflow-x-auto">{docChatPayload}</pre>
      </section>

      <section className="snap-start min-h-[100vh] p-6 md:p-10 flex flex-col gap-4">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Slide 4</p>
        <h2 className="text-2xl md:text-4xl font-semibold">Live Document Walk</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Load the section tree from <strong>this browser</strong> (same key doc chat uses) or <strong>any completed</strong> document from the PageIndex-backed API.
        </p>
        <SlideAppLink href="/doc-chat" label="Go to doc chat to load a document" />

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium">
            Question
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask anything about the document..." />
          </label>
          <Button type="button" onClick={() => void runWalk()} disabled={loading || !tree || !question.trim()}>
            {loading ? "Walking..." : "Walk the document"}
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-2 text-xs font-medium text-muted-foreground">
            <span>Tree source</span>
            <Select value={treeSource} onValueChange={setTreeSource}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="Choose source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TREE_SOURCE_LOCAL}>This browser (localStorage)</SelectItem>
                {serverDocs
                  .filter((d) => d.status === "completed")
                  .map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name || d.id}
                      {typeof d.pageNum === "number" ? ` · ${d.pageNum} pp.` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void refreshServerDocuments()} disabled={serverDocsLoading}>
              {serverDocsLoading ? "Refreshing…" : "Refresh document list"}
            </Button>
            <Button type="button" size="sm" onClick={() => void loadTree()} disabled={treeLoading}>
              {treeLoading ? "Loading tree…" : "Load tree"}
            </Button>
          </div>
          {docsListError && (
            <Alert className="w-full border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertDescription>{docsListError}</AlertDescription>
            </Alert>
          )}
          {serverDocs.length > 0 && serverDocs.every((d) => d.status !== "completed") && <p className="w-full text-xs text-muted-foreground">No completed documents yet—finish processing in doc chat or pick localStorage if you have a saved tree.</p>}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!tree && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center px-4">
            Choose a tree source and click <span className="font-medium text-foreground">Load tree</span>.
          </div>
        )}

        {tree && (
          <div className="flex-1 grid gap-4 lg:grid-cols-[1fr_340px] min-h-0 overflow-hidden">
            <div className="overflow-y-auto rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3 mb-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-sm bg-blue-200 border border-blue-400" /> top winner
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-sm bg-emerald-200 border border-emerald-400" /> final target
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-sm bg-violet-200 border border-violet-300" /> selected page
                </span>
              </div>
              <WalkTreeView nodes={tree} scores={topScoreMap} winnerIds={winnerIds} targetIds={targetIds} selectedPages={selectedPages} drillScores={drillScoreMap} />
            </div>

            <div className="overflow-y-auto">{result ? <StepTimeline result={result} /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4">Click &ldquo;Walk the document&rdquo; to see TypeSafe score every section live.</div>}</div>
          </div>
        )}
      </section>
    </main>
  );
}
