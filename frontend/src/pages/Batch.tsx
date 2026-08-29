import { useState } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'recoveriq_last_batch'

type BatchResultItem = {
  eventId: string
  status: 'ok' | 'error'
  error?: string
  result?: {
    intervention?: {
      type?: string | null
      reasoning?: string | null
    }
  }
}

type BatchSummary = {
  processed: number
  succeeded: number
  failed: number
  results: BatchResultItem[]
}

function truncateId(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}…` : value
}

function truncateText(value: string | null | undefined, length = 40) {
  if (!value) return '—'
  return value.length > length ? `${value.slice(0, length)}…` : value
}

function loadPersistedBatch(): { limit: number; summary: BatchSummary } | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as { limit: number; summary: BatchSummary }
  } catch {
    return null
  }
}

function savePersistedBatch(payload: { limit: number; summary: BatchSummary }) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export default function Batch() {
  const persisted = loadPersistedBatch()
  const [limit, setLimit] = useState(persisted?.limit ?? 10)
  const [summary, setSummary] = useState<BatchSummary | null>(persisted?.summary ?? null)
  const [running, setRunning] = useState(false)
  const [activeLimit, setActiveLimit] = useState<number | null>(null)
  const [streamingResults, setStreamingResults] = useState<BatchResultItem[]>([])
  const [streamingProcessed, setStreamingProcessed] = useState(0)
  let latestResults: BatchResultItem[] = streamingResults

  async function handleRunBatch() {
    setRunning(true)
    setActiveLimit(limit)
    setStreamingResults([])
    setStreamingProcessed(0)
    latestResults = []

    try {
      const response = await fetch('/api/agent/run-batch-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit }),
      })

      if (!response.body) throw new Error('ReadableStream not supported')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue

          const json = trimmed.slice(5).trim()
          if (!json) continue

          const payload = JSON.parse(json) as BatchResultItem & { done?: boolean; processed?: number; succeeded?: number; failed?: number }

          if (payload.done) {
            const finalSummary: BatchSummary = {
              processed: payload.processed ?? latestResults.length,
              succeeded: payload.succeeded ?? latestResults.filter(item => item.status === 'ok').length,
              failed: payload.failed ?? latestResults.filter(item => item.status === 'error').length,
              results: latestResults,
            }

            setSummary(finalSummary)
            setRunning(false)
            setActiveLimit(null)
            savePersistedBatch({ limit, summary: finalSummary })
            return
          }

          if (payload.eventId) {
            setStreamingResults((prev) => {
              const next = [...prev, payload as BatchResultItem]
              latestResults = next

              const summaryPayload: BatchSummary = {
                processed: next.length,
                succeeded: next.filter(item => item.status === 'ok').length,
                failed: next.filter(item => item.status === 'error').length,
                results: next,
              }

              setSummary(summaryPayload)
              savePersistedBatch({ limit, summary: summaryPayload })
              return next
            })

            setStreamingProcessed((prev) => prev + 1)
          }
        }
      }
    } catch (error) {
      console.error('Failed to stream batch run', error)
      setSummary({
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      })
      setRunning(false)
      setActiveLimit(null)
    }
  }

  function handleReset() {
    setSummary(null)
    setRunning(false)
    setActiveLimit(null)
    setStreamingResults([])
    setStreamingProcessed(0)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }

  return (
    <div className="min-h-full bg-[#0a0f1a] p-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50">Batch Runner</h1>
          <p className="mt-2 text-sm text-slate-400">Trigger the recovery agent across multiple pending events</p>
        </section>

        <section className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-6">
          <div className="max-w-xl space-y-5">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
              Events to process
              <input
                type="number"
                min={1}
                max={60}
                value={limit}
                onChange={(event) => setLimit(Math.min(60, Math.max(1, Number(event.target.value) || 1)))}
                className="w-40 rounded-xl border border-[#1a2540] bg-[#0b1120] px-3 py-2 text-slate-100 outline-none transition-colors focus:border-sky-400"
              />
            </label>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleRunBatch}
                disabled={running}
                className="inline-flex items-center justify-center gap-3 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Running Batch
                  </>
                ) : (
                  'Run Batch'
                )}
              </button>

              {running && activeLimit != null && (
                <div className="text-sm text-slate-400">
                  Processing... {streamingProcessed}/{activeLimit}
                </div>
              )}
            </div>
          </div>
        </section>

        {summary && (
          <section className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <div className="rounded-full border border-[#1a2540] bg-[#0d1424] px-4 py-2 text-sm text-slate-200">
                Processed <span className="ml-2 text-slate-50">{summary.processed}</span>
              </div>
              <div className="rounded-full border border-[#1a2540] bg-[#0d1424] px-4 py-2 text-sm text-emerald-200">
                Succeeded <span className="ml-2 text-emerald-400">{summary.succeeded}</span>
              </div>
              <div className="rounded-full border border-[#1a2540] bg-[#0d1424] px-4 py-2 text-sm text-red-200">
                Failed <span className="ml-2 text-red-400">{summary.failed}</span>
              </div>
            </div>

            <section className="overflow-hidden rounded-2xl border border-[#1a2540] bg-[#0d1424]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#1a2540] text-left">
                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400">Event ID</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400">Intervention</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400">Reasoning</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400">Status</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400">Error Message</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.results.map((item) => {
                    const interventionType = item.result?.intervention?.type
                    const reasoning = item.result?.intervention?.reasoning
                    const interventionClass =
                      interventionType === 'PAYMENT_LINK'
                        ? 'border-blue-500/20 bg-blue-500/10 text-blue-200'
                        : interventionType === 'RETRY'
                          ? 'border-purple-500/20 bg-purple-500/10 text-purple-200'
                          : interventionType === 'DUNNING_MESSAGE'
                            ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-200'
                            : interventionType === 'ESCALATE'
                              ? 'border-red-500/20 bg-red-500/10 text-red-200'
                              : 'border-slate-700 bg-slate-900/80 text-slate-200'

                    return (
                      <tr
                        key={item.eventId}
                        className="border-b border-[#1a2540] text-sm text-slate-200 last:border-b-0 hover:bg-[#111d35]"
                      >
                        <td className="px-4 py-3 border-b-0">
                          <Link
                            to={`/events/${item.eventId}`}
                            className="font-medium text-slate-100 transition-colors hover:text-sky-300"
                            title={item.eventId}
                          >
                            {truncateId(item.eventId)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 border-b-0">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${interventionType ? interventionClass : 'border-slate-700 bg-slate-900/80 text-slate-200'}`}
                          >
                            {interventionType ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b-0 text-slate-300">
                          <span title={reasoning ?? undefined}>
                            {truncateText(reasoning, 40)}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b-0">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                              item.status === 'ok'
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                                : 'border-red-500/20 bg-red-500/10 text-red-200'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b-0 text-slate-300">
                          {item.status === 'error' ? item.error ?? 'Unknown error' : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>

            <button
              type="button"
              onClick={handleReset}
              className="rounded-2xl border border-[#1a2540] bg-[#0d1424] px-5 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-[#111d35]"
            >
              Run Again
            </button>
          </section>
        )}
      </div>
    </div>
  )
}