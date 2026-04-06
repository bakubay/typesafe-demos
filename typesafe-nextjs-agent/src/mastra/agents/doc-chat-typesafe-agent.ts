import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { scoreSectionsTool, getPageContentTool } from '../tools/doc-chat-tools'

export const docChatTypeSafeAgent = new Agent({
  id: 'doc-chat-typesafe',
  name: 'Document Chat (TypeSafe Reasoning)',
  instructions: `
    You answer questions about documents using TypeSafe AI reasoning-based retrieval.
    The document tree structure is provided in the user message as [Document Tree Structure].
    The document ID is provided as [Document ID: ...].

    Follow this process:

    1. Parse the tree structure from the message. Each node has: node_id, title, summary, page_index, and children.

    2. Call score-sections with the TOP-LEVEL sections to find which are relevant.
       Pass the question and the sections array (nodeId, title, summary).
       This uses TypeSafe AI Noul prompts — each section gets an independent relevance score 0-1.

    3. RECURSIVELY drill into winners (score > 0.5):
       - If a winning section has children, call score-sections on its children.
       - Keep drilling deeper until you reach leaf nodes or have drilled 4 levels.
       - At each level, take the top 3 sections above 0.5 (or the single best if none pass).
       - Score sibling groups in parallel when possible.

    4. For the final leaf targets, collect their page numbers PLUS the adjacent pages
       (page-1 and page+1) for context continuity. Take the top 12 pages by walk score.

    5. Call get-page-content to fetch the actual text of those pages.

    6. Read the content and answer the user's question with page citations.

    Important:
    - score-sections is extremely fast (milliseconds) — call it multiple times to drill deep.
    - If no sections score above 0.5 at any level, use the highest-scoring one.
    - Always cite page numbers in your answer.
    - Keep answers thorough but concise.
  `,
  model: 'openai/gpt-4o-mini',
  tools: { scoreSectionsTool, getPageContentTool },
  memory: new Memory(),
})
