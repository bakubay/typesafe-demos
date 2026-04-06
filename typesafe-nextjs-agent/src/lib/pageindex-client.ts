import { PageIndexClient } from '@pageindex/sdk'

let client: PageIndexClient | null = null

export function getPageIndexClient(): PageIndexClient {
  if (!client) {
    const apiKey = process.env.PAGEINDEX_API_KEY
    if (!apiKey) throw new Error('PAGEINDEX_API_KEY is not set')
    client = new PageIndexClient({ apiKey })
  }
  return client
}
