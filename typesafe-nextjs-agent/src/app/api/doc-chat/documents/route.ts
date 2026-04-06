import { getPageIndexClient } from '@/lib/pageindex-client'
import { NextResponse } from 'next/server'
import type { DocumentInfo } from '@/types/doc-chat'

/** GET /api/doc-chat/documents?docId=xxx — get document status */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const docId = searchParams.get('docId')

  const client = getPageIndexClient()

  if (docId) {
    const doc = await client.api.getDocument(docId)
    return NextResponse.json({
      id: doc.id,
      name: doc.name,
      status: doc.status,
      pageNum: doc.pageNum,
      description: doc.description,
    } satisfies DocumentInfo)
  }

  // List recent documents
  const { documents } = await client.api.listDocuments({ limit: 20 })
  const items: DocumentInfo[] = documents.map(d => ({
    id: d.id,
    name: d.name,
    status: d.status,
    pageNum: d.pageNum,
    description: d.description,
  }))
  return NextResponse.json(items)
}

/** POST /api/doc-chat/documents — upload a PDF */
export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const client = getPageIndexClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const { doc_id } = await client.api.submitDocument(buffer, file.name)

  return NextResponse.json({ docId: doc_id })
}
