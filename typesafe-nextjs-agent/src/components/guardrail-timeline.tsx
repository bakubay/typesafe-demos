'use client'

import { CheckIcon, CircleDotIcon, Loader2Icon, MinusIcon, ShieldAlertIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GuardrailUiContent, GuardrailUiPayload } from '@/types/guardrail-ui'

function GuardrailContentDetails({ content }: { content: GuardrailUiContent }) {
  const hasPreview = Boolean(content.inputPreview)
  const hasEval = content.typeSafeEvaluation !== undefined
  if (!hasPreview && !hasEval) return null

  let json = ''
  if (hasEval) {
    try {
      json = JSON.stringify(content.typeSafeEvaluation, null, 2)
    } catch {
      json = String(content.typeSafeEvaluation)
    }
  }

  return (
    <details className="mt-1 rounded border border-border/60 bg-background/50">
      <summary className="cursor-pointer select-none px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground">
        View guardrail content
      </summary>
      <div className="space-y-1.5 border-t border-border/40 p-1.5">
        {hasPreview ? (
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Input preview
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words rounded bg-muted/40 px-1.5 py-1 text-[10px] text-foreground/90">
              {content.inputPreview}
            </p>
          </div>
        ) : null}
        {hasEval ? (
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Evaluation JSON
            </div>
            <pre className="mt-0.5 max-h-40 overflow-auto rounded bg-muted/50 p-1.5 text-[9px] leading-relaxed text-foreground/90">
              {json}
            </pre>
          </div>
        ) : null}
      </div>
    </details>
  )
}

function StatusIcon({ status }: { status: GuardrailUiPayload['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2Icon className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
    case 'passed':
      return <CheckIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
    case 'blocked':
      return <ShieldAlertIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
    case 'failed':
      return <XIcon className="size-3.5 shrink-0 text-destructive" aria-hidden />
    case 'skipped':
      return <MinusIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
    default:
      return <CircleDotIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
  }
}

export function GuardrailTimeline({
  events,
  title,
  pipelineActive,
  streamError,
  className,
}: {
  events: GuardrailUiPayload[]
  title: string
  /** True while the request is in flight but before any `data-guardrail` chunk arrived. */
  pipelineActive?: boolean
  /** Tripwire / transport error (often includes Mastra scores when `includeScores: true`). */
  streamError?: Error | null
  className?: string
}) {
  if (events.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-border/80 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground',
          className
        )}
      >
        <span className="font-medium text-foreground/80">{title}</span>
        {pipelineActive ? (
          <span className="flex items-center gap-1.5 mt-1.5 text-foreground/70">
            <Loader2Icon className="size-3.5 animate-spin shrink-0" aria-hidden />
            Running guardrails…
          </span>
        ) : (
          <span className="block mt-0.5">Send a message to see how guardrails run on this path.</span>
        )}
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-border/80 bg-muted/15 px-2.5 py-2', className)}>
      <div className="text-[11px] font-medium text-foreground/90 mb-1.5">{title}</div>
      {streamError ? (
        <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">
          <span className="font-semibold">Stream error / tripwire</span>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-destructive/95">{streamError.message}</p>
        </div>
      ) : null}
      <ul className="space-y-1.5 max-h-52 overflow-y-auto">
        {events.map((ev, i) => (
          <li
            key={`${ev.step}-${ev.status}-${i}`}
            className="flex items-start gap-2 text-[11px] leading-snug"
          >
            <StatusIcon status={ev.status} />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-foreground/90">
                {ev.label ?? ev.step.replace(/-/g, ' ')}
              </span>
              <span className="text-muted-foreground"> — {ev.status}</span>
              {ev.detail ? (
                <span className="block text-muted-foreground mt-0.5 break-words">{ev.detail}</span>
              ) : null}
              {ev.content ? <GuardrailContentDetails content={ev.content} /> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
