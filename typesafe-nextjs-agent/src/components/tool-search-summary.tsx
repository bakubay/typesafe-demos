'use client'

import { cn } from '@/lib/utils'
import type { ToolSearchUiPayload } from '@/types/tool-search-ui'
import { FilterIcon, PackageSearchIcon } from 'lucide-react'

export function ToolSearchSummary({
  result,
  className,
}: {
  result: ToolSearchUiPayload | null
  className?: string
}) {
  if (!result) return null

  const { totalTools, selectedTools, durationMs } = result
  const pct = totalTools > 0 ? Math.round((selectedTools.length / totalTools) * 100) : 0

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 transition-colors',
        selectedTools.length > 0
          ? 'border-sky-200 bg-sky-50/60'
          : 'border-zinc-200 bg-zinc-50/60',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <PackageSearchIcon className="size-4 text-sky-600" />
          <span>Tool search</span>
          <span className="text-xs font-normal text-muted-foreground">
            {selectedTools.length} of {totalTools} tools selected ({pct}%)
          </span>
        </div>
        <span className="tabular-nums font-mono text-2xl font-bold text-sky-700">
          {durationMs.toLocaleString()}ms
        </span>
      </div>

      {selectedTools.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedTools.map(t => (
            <span
              key={t.name}
              className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-100/80 px-2 py-0.5 text-xs font-medium text-sky-800"
            >
              <FilterIcon className="size-3 opacity-60" />
              {t.name}
              <span className="ml-0.5 tabular-nums font-mono text-[10px] text-sky-600">
                {t.score.toFixed(2)}
              </span>
            </span>
          ))}
        </div>
      )}

      {selectedTools.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          No tools passed the threshold — model will answer from context.
        </p>
      )}
    </div>
  )
}
