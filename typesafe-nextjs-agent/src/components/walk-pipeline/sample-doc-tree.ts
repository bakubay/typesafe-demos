/** Shape aligned with PageIndex / doc-chat tree nodes (minimal fields for the explainer). */
export type SampleTreeNode = {
  node_id: string;
  title: string;
  summary?: string;
  page_index: number;
  nodes?: SampleTreeNode[];
};

/** Fixed “real” outline: question is about pricing & limits. */
export const SAMPLE_DOC_QUESTION = "What do we pay, and what are the usage limits?";

export const SAMPLE_TREE: SampleTreeNode[] = [
  {
    node_id: "n-intro",
    title: "1. Introduction",
    summary: "Why the product exists.",
    page_index: 1,
    nodes: [
      { node_id: "n-overview", title: "1.1 Overview", page_index: 1 },
      { node_id: "n-goals", title: "1.2 Goals", page_index: 2 },
    ],
  },
  {
    node_id: "n-pricing",
    title: "2. Pricing & limits",
    summary: "Plans, billing, caps.",
    page_index: 5,
    nodes: [
      { node_id: "n-plans", title: "2.1 Plans & pricing", page_index: 5 },
      { node_id: "n-limits", title: "2.2 Usage limits", page_index: 6 },
    ],
  },
  {
    node_id: "n-appendix",
    title: "3. Appendix",
    summary: "Glossary and legal.",
    page_index: 20,
    nodes: [{ node_id: "n-glossary", title: "3.1 Glossary", page_index: 20 }],
  },
];

export type PageStripItem = {
  page: number;
  walkHint?: number;
  contentScore?: number;
  fetching?: boolean;
  dropped?: boolean;
};

export type SamplePipelineVisual = {
  /** Strong highlight (ring). */
  hotIds: ReadonlySet<string>;
  /** Softer highlight (border). */
  warmIds: ReadonlySet<string>;
  /** Badges on these nodes (0–1). */
  scores: Record<string, number>;
  /** Leaf targets (emerald). */
  leafIds: ReadonlySet<string>;
  /** Opacity for nodes not in hot/warm/scores/leaf when dimOthers is true. */
  dimOthers: boolean;
  dimOpacity: number;
  /** Pulse the root row (beat: listing roots). */
  pulseRoots: boolean;
  /** Vertical “beam” on this parent while drilling children. */
  drillParentId: string | null;
  pageStrip: PageStripItem[];
  /** Fade tree to focus on page strip / answer. */
  treeOpacity: number;
};

function setOf(...ids: string[]) {
  return new Set(ids);
}

/** One visual state per micro-step beat (index matches MICRO_STEPS order in explainer). */
export function getSamplePipelineVisual(beat: number): SamplePipelineVisual {
  const roots = ["n-intro", "n-pricing", "n-appendix"];
  const pricingKids = ["n-plans", "n-limits"];

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
  });

  switch (beat) {
    case 0:
      return base({
        warmIds: setOf(...roots),
      });
    case 1:
      return base({
        pulseRoots: true,
        warmIds: setOf(...roots),
      });
    case 2:
      return base({
        warmIds: setOf(...roots),
        scores: { "n-intro": 0.18, "n-pricing": 0.94, "n-appendix": 0.08 },
      });
    case 3:
      return base({
        hotIds: setOf("n-pricing"),
        warmIds: setOf("n-intro", "n-appendix"),
        scores: { "n-intro": 0.18, "n-pricing": 0.94, "n-appendix": 0.08 },
        dimOthers: true,
      });
    case 4:
      return base({
        hotIds: setOf("n-pricing"),
        drillParentId: "n-pricing",
        scores: { "n-intro": 0.18, "n-pricing": 0.94, "n-appendix": 0.08 },
        dimOthers: true,
      });
    case 5:
      return base({
        hotIds: setOf("n-pricing"),
        warmIds: setOf(...pricingKids),
        drillParentId: "n-pricing",
        scores: { "n-intro": 0.18, "n-pricing": 0.94, "n-appendix": 0.08 },
        dimOthers: true,
      });
    case 6:
      return base({
        hotIds: setOf("n-pricing"),
        warmIds: setOf(...pricingKids),
        drillParentId: "n-pricing",
        scores: {
          "n-intro": 0.18,
          "n-pricing": 0.94,
          "n-appendix": 0.08,
          "n-plans": 0.87,
          "n-limits": 0.91,
        },
        dimOthers: true,
      });
    case 7:
    case 8:
      return base({
        leafIds: setOf(...pricingKids),
        scores: {
          "n-plans": 0.87,
          "n-limits": 0.91,
        },
        dimOthers: true,
      });
    case 9:
      return base({
        leafIds: setOf(...pricingKids),
        scores: { "n-plans": 0.87, "n-limits": 0.91 },
        dimOthers: true,
        pageStrip: [
          { page: 4, walkHint: 0.44 },
          { page: 5, walkHint: 0.87 },
          { page: 6, walkHint: 0.91 },
          { page: 7, walkHint: 0.46 },
        ],
      });
    case 10:
      return base({
        leafIds: setOf(...pricingKids),
        dimOthers: true,
        pageStrip: [
          { page: 6, walkHint: 0.91 },
          { page: 5, walkHint: 0.87 },
          { page: 4, walkHint: 0.44 },
          { page: 7, walkHint: 0.46 },
        ],
      });
    case 11:
      return base({
        leafIds: setOf(...pricingKids),
        dimOthers: true,
        treeOpacity: 0.55,
        pageStrip: [
          { page: 6, walkHint: 0.91, fetching: true },
          { page: 5, walkHint: 0.87, fetching: true },
          { page: 4, walkHint: 0.44, fetching: true },
          { page: 7, walkHint: 0.46, fetching: true },
        ],
      });
    case 12:
      return base({
        dimOthers: true,
        treeOpacity: 0.45,
        pageStrip: [
          { page: 6, walkHint: 0.91, contentScore: 0.93 },
          { page: 5, walkHint: 0.87, contentScore: 0.89 },
          { page: 4, walkHint: 0.44, contentScore: 0.22 },
          { page: 7, walkHint: 0.46, contentScore: 0.31 },
        ],
      });
    case 13:
      return base({
        dimOthers: true,
        treeOpacity: 0.35,
        pageStrip: [
          { page: 6, contentScore: 0.93, dropped: false },
          { page: 5, contentScore: 0.89, dropped: false },
          { page: 4, contentScore: 0.22, dropped: true },
          { page: 7, contentScore: 0.31, dropped: true },
        ],
      });
    case 14:
      return base({
        treeOpacity: 0.25,
        pageStrip: [
          { page: 5, contentScore: 0.89, dropped: false },
          { page: 6, contentScore: 0.93, dropped: false },
        ],
      });
    case 15:
      return base({
        treeOpacity: 0.15,
        pageStrip: [
          { page: 5, contentScore: 0.89, dropped: false },
          { page: 6, contentScore: 0.93, dropped: false },
        ],
      });
    default:
      return base({ warmIds: setOf(...roots) });
  }
}
