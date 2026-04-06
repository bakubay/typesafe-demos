import { getPageIndexClient } from '@/lib/pageindex-client'
import { NextResponse } from 'next/server'

/** GET /api/doc-chat/documents/[docId]/tree — get tree structure */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params
  const client = getPageIndexClient()
  const tree = await client.api.getTree(docId, { nodeSummary: true })
  return NextResponse.json(tree)
}
