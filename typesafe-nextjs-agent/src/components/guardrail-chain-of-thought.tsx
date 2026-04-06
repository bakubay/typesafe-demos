'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { GuardrailUiPayload } from '@/types/guardrail-ui'
import {
  CheckCircle2Icon,
  Loader2Icon,
  OctagonXIcon,
  ShieldAlertIcon,
  TimerIcon,
} from 'lucide-react'

/** Live-ticking elapsed timer in ms. */
function LiveTimer({ running }: { running: boolean }) {
  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!running) return
    startRef.current = Date.now()
    setElapsed(0)
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 16)
    return () => clearInterval(id)
  }, [running])

  if (!running && elapsed === 0) return null

  return (
    <span className="tabular-nums font-mono text-lg font-bold text-foreground">
      {elapsed.toLocaleString()}ms
    </span>
  )
}

export function GuardrailChainOfThought({
  events,
  title,
  pipelineActive,
  streamError,
  className,
}: {
  events: GuardrailUiPayload[]
  title: string
  pipelineActive?: boolean
  streamError?: Error | null
  className?: string
}) {
  const totalEvent = events.find(e => e.step === 'total')
  const stepEvents = events.filter(e => e.step !== 'total')
  const isBlocked = events.some(e => e.status === 'blocked')
  const isFailed = events.some(e => e.status === 'failed')
  const totalMs = totalEvent?.content?.durationMs
  const isDone = totalEvent !== undefined
  const isRunning = pipelineActive && !isDone

  return (
    <div className={cn(
      'rounded-lg border px-4 py-3 transition-colors',
      isDone && !isBlocked && !isFailed && 'border-emerald-200 bg-emerald-50/60',
      isDone && isBlocked && 'border-amber-200 bg-amber-50/60',
      isDone && !isBlocked && isFailed && 'border-red-200 bg-red-50/60',
      isRunning && 'border-blue-200 bg-blue-50/40',
      !isDone && !isRunning && 'border-border bg-muted/20',
      className,
    )}>
      {/* Header row: title + big timer */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {isRunning && <Loader2Icon className="size-4 animate-spin text-blue-600" />}
          {isDone && !isBlocked && !isFailed && <CheckCircle2Icon className="size-4 text-emerald-600" />}
          {isDone && isBlocked && <ShieldAlertIcon className="size-4 text-amber-600" />}
          {isDone && !isBlocked && isFailed && <OctagonXIcon className="size-4 text-red-600" />}
          {!isDone && !isRunning && <TimerIcon className="size-4 text-muted-foreground" />}
          <span>{title}</span>
        </div>

        <div className="text-right">
          {isRunning && <LiveTimer running={true} />}
          {isDone && totalMs !== undefined && (
            <span className={cn(
              'tabular-nums font-mono text-2xl font-bold',
              isBlocked
                ? 'text-amber-700'
                : isFailed
                  ? 'text-red-700'
                  : 'text-emerald-700',
            )}>
              {totalMs.toLocaleString()}ms
            </span>
          )}
        </div>
      </div>

      {/* Steps */}
      {stepEvents.length > 0 && (
        <div className="mt-2 space-y-1">
          {stepEvents.map((ev, i) => (
            <div
              key={`${ev.step}-${i}`}
              className="flex items-baseline justify-between gap-2 text-xs"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className={cn(
                  'inline-block size-1.5 rounded-full shrink-0',
                  ev.status === 'passed' && 'bg-emerald-500',
                  ev.status === 'blocked' && 'bg-amber-500',
                  ev.status === 'failed' && 'bg-red-500',
                  ev.status === 'running' && 'bg-blue-500 animate-pulse',
                  ev.status === 'skipped' && 'bg-gray-400',
                )} />
                <span className="text-foreground/80 truncate">
                  {ev.label ?? ev.step}
                </span>
              </span>
              {ev.content?.durationMs !== undefined && (
                <span className="tabular-nums font-mono text-muted-foreground shrink-0">
                  {ev.content.durationMs}ms
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Idle state */}
      {!isDone && !isRunning && stepEvents.length === 0 && !streamError && (
        <p className="mt-1 text-xs text-muted-foreground">
          Send a message to see guardrail timing.
        </p>
      )}

      {/* Error */}
      {streamError && (
        <div className="mt-2 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {streamError.message}
        </div>
      )}
    </div>
  )
}
