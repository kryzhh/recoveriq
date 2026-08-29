import { useEffect, useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useNavigate, useParams } from 'react-router-dom'
import { getEvent, type Event, type Intervention } from '../lib/api'

const interventionColors: Record<string, string> = {
  PAYMENT_LINK: 'bg-blue-400',
  RETRY: 'bg-purple-400',
  DUNNING_MESSAGE: 'bg-yellow-400',
  ESCALATE: 'bg-red-400',
}

const statusColors: Record<string, string> = {
  PENDING: 'border-slate-700 bg-slate-900/80 text-slate-200',
  IN_PROGRESS: 'border-blue-500/20 bg-blue-500/10 text-blue-200',
  RECOVERED: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  UNRECOVERABLE: 'border-red-500/20 bg-red-500/10 text-red-200',
}

function formatLatency(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(months / 12)

  if (years > 0) return `${years}y ${months % 12}mo ${days % 30}d`
  if (months > 0) return `${months}mo ${days % 30}d`
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

const auditResultColors: Record<string, string> = {
  SUCCESS: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  FAILED: 'border-red-500/20 bg-red-500/10 text-red-200',
  PENDING_EXECUTION: 'border-slate-700 bg-slate-900/80 text-slate-200',
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'

  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatDuration(milliseconds: number | null | undefined) {
  if (milliseconds == null) return '—'

  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}m ${seconds}s`
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2)
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded-2xl bg-[#1a2540] animate-pulse ${className}`} />
}

function LoadingSkeleton() {
  return (
    <div className="min-h-full bg-[#0a0f1a] p-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <SkeletonBlock className="h-10 w-32" />

        <div className="grid gap-6 lg:grid-cols-[60%_40%]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-5 space-y-4">
              <SkeletonBlock className="h-6 w-40" />
              <SkeletonBlock className="h-5 w-64" />
              <SkeletonBlock className="h-5 w-28" />
              <SkeletonBlock className="h-5 w-52" />
              <SkeletonBlock className="h-5 w-36" />
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="h-5 w-48" />
            </div>

            <div className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-5 space-y-4">
              <SkeletonBlock className="h-6 w-36" />
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex gap-4">
                  <SkeletonBlock className="h-4 w-4 rounded-full mt-1" />
                  <div className="flex-1 space-y-3">
                    <SkeletonBlock className="h-4 w-40" />
                    <SkeletonBlock className="h-4 w-72" />
                    <SkeletonBlock className="h-4 w-24" />
                    <SkeletonBlock className="h-4 w-28" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-5 space-y-4">
              <SkeletonBlock className="h-6 w-44" />
              <SkeletonBlock className="h-5 w-20" />
              <SkeletonBlock className="h-5 w-32" />
              <SkeletonBlock className="h-5 w-40" />
            </div>

            <div className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-5 space-y-4">
              <SkeletonBlock className="h-6 w-44" />
              <SkeletonBlock className="h-40 w-full rounded-xl" />
            </div>

            <div className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-5 space-y-4">
              <SkeletonBlock className="h-6 w-44" />
              <SkeletonBlock className="h-40 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-5">{children}</div>
}

function AuditItem({ intervention, index }: { intervention: Intervention; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: index * 0.08 }}
      className="relative pl-7"
    >
      <div className="absolute left-[9px] top-2 h-full w-px bg-[#1a2540]" />
      <div
        className={`absolute left-0 top-1.5 h-4 w-4 rounded-full ${interventionColors[intervention.type] ?? 'bg-slate-400'}`}
      />

      <div className="space-y-3 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-semibold text-slate-50">{intervention.type}</div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusColors[intervention.status] ?? 'border-slate-700 bg-slate-900/80 text-slate-200'}`}>
            {intervention.status}
          </span>
          <div className="text-xs text-slate-500">{formatDateTime(intervention.executedAt)}</div>
        </div>

        <p className="text-sm leading-6 text-slate-400">{intervention.reasoning}</p>

        <div className="space-y-3 border-l border-[#1a2540] pl-4">
          {(intervention.auditLogs ?? []).map((auditLog) => (
            <div key={auditLog.id} className="space-y-2">
              <div className="text-sm text-slate-200">{auditLog.action}</div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${auditResultColors[auditLog.result] ?? 'border-slate-700 bg-slate-900/80 text-slate-200'}`}
                >
                  {auditLog.result}
                </span>
                <span className="text-xs text-slate-500">{formatDateTime(auditLog.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadEvent() {
      if (!id) {
        setLoading(false)
        return
      }

      try {
        const data = await getEvent(id)
        if (active) {
          setEvent(data)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadEvent()

    return () => {
      active = false
    }
  }, [id])

  const latestIntervention = useMemo(() => event?.interventions?.[0] ?? null, [event])

  if (loading || !event) {
    return <LoadingSkeleton />
  }

  return (
    <div className="min-h-full bg-[#0a0f1a] p-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate('/events')}
          className="w-fit text-sm font-medium text-slate-300 transition-colors hover:text-slate-50"
        >
          ← Events
        </button>

        <div className="grid gap-6 lg:grid-cols-[60%_40%]">
          <div className="space-y-6">
            <Card>
              <div className="space-y-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">Razorpay ID</div>
                <div className="text-lg font-semibold text-slate-50">{event.razorpayId}</div>

                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-200">
                    {event.type}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusColors[event.status] ?? 'border-slate-700 bg-slate-900/80 text-slate-200'}`}>
                    {event.status}
                  </span>
                </div>

                <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                  <div>
                    <div className="text-slate-500">Amount</div>
                    <div className="mt-1">₹{(event.amount / 100).toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Error Code</div>
                    <div className="mt-1">{event.errorCode ?? '—'}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-slate-500">Root Cause</div>
                    <div className="mt-1">{event.rootCause ?? '—'}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-slate-500">Created At</div>
                    <div className="mt-1">{formatDateTime(event.createdAt)}</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="mb-5 text-lg font-semibold text-slate-50">Audit Trail</div>

              <div className="relative">
                <div className="absolute left-[9px] top-0 h-full w-px bg-[#1a2540]" />
                <div className="space-y-1">
                  {(event.interventions ?? []).map((intervention, index) => (
                    <AuditItem key={intervention.id} intervention={intervention} index={index} />
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <div className="mb-4 text-lg font-semibold text-slate-50">Recovery Outcome</div>
              {latestIntervention?.outcome ? (
                <div className="space-y-4 text-sm text-slate-300">
                  <div className="flex items-center gap-2 text-base font-semibold text-slate-50">
                    {latestIntervention.outcome.recovered ? (
                      <Check className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <X className="h-5 w-5 text-red-400" />
                    )}
                    {latestIntervention.outcome.recovered ? 'Recovered' : 'Not Recovered'}
                  </div>
                  <div>
                    <span className="text-slate-500">Amount Recovered:</span>{' '}
                    ₹{Number((latestIntervention.outcome.amountRecovered ?? 0)/ 100).toLocaleString('en-IN')}
                  </div>
                  <div>
                    <span className="text-slate-500">Recovery Latency:</span>{' '}
                    {formatLatency(Number(latestIntervention.outcome.recoveryLatencyMs))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">Awaiting outcome</div>
              )}
            </Card>

            <Card>
              <div className="mb-4 text-lg font-semibold text-slate-50">Execution Payload</div>
              <pre className="overflow-auto rounded-xl bg-[#0b1120] p-4 font-mono text-xs leading-6 text-slate-300">
                {formatJson(latestIntervention?.executionPayload)}
              </pre>
            </Card>

            <Card>
              <div className="mb-4 text-lg font-semibold text-slate-50">Reversal Instructions</div>
              <pre className="overflow-auto rounded-xl bg-[#0b1120] p-4 font-mono text-xs leading-6 text-slate-300">
                {formatJson(latestIntervention?.reversalPayload)}
              </pre>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}