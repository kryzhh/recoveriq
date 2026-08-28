import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { getMetrics, type Metrics } from '../lib/api'

const cardDelays = [0, 0.07, 0.14, 0.21]

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString('en-IN')
}

function LoadingSpinner() {
  return (
    <div className="flex min-h-full items-center justify-center bg-[#0a0f1a] p-8 text-slate-200">
      <div className="flex items-center gap-3 rounded-full border border-[#1a2540] bg-[#0d1424] px-4 py-3 text-sm text-slate-300">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-300" />
        Loading metrics
      </div>
    </div>
  )
}

function Panel({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay }}
      className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-5"
    >
      {children}
    </motion.div>
  )
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadMetrics() {
      try {
        const data = await getMetrics()

        if (active) {
          setMetrics(data)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadMetrics()

    return () => {
      active = false
    }
  }, [])

  if (loading || !metrics) {
    return <LoadingSpinner />
  }

  const totalEvents = Object.values(metrics.statusBreakdown).reduce((sum, value) => sum + value, 0)
  const recoveryRateColor =
    metrics.recoveryRate > 50
      ? 'text-emerald-400'
      : metrics.recoveryRate > 20
        ? 'text-amber-300'
        : 'text-rose-400'

  const statusChipColors: Record<string, string> = {
    PENDING: 'border-slate-700 bg-slate-900/80 text-slate-200',
    IN_PROGRESS: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    RECOVERED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    UNRECOVERABLE: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  }

  const interventionRows = Object.entries(metrics.interventionSuccessRate).sort(
    ([a], [b]) => a.localeCompare(b),
  )

  const topRootCauses = [...metrics.topRootCauses].sort((a, b) => b.count - a.count)
  const maxRootCauseCount = Math.max(...topRootCauses.map((item) => item.count), 1)
  const totalRootCauseCount = topRootCauses.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="min-h-full bg-[#0a0f1a] p-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-50">Revenue Recovery</h1>
              <p className="mt-2 text-sm text-slate-400">Live recovery operations across all payment events</p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="h-2.5 w-2.5 rounded-full bg-emerald-400"
              />
              Live
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Panel delay={cardDelays[0]}>
            <div className="text-sm text-slate-400">Total Events</div>
            <div className="mt-3 text-3xl font-semibold text-slate-50">{formatCount(totalEvents)}</div>
          </Panel>

          <Panel delay={cardDelays[1]}>
            <div className="text-sm text-slate-400">Amount at Risk</div>
            <div className="mt-3 text-3xl font-semibold text-slate-50">
              ₹{metrics.totalAmountAtRisk.rupees.toLocaleString('en-IN')}
            </div>
          </Panel>

          <Panel delay={cardDelays[2]}>
            <div className="text-sm text-slate-400">Amount Recovered</div>
            <div className="mt-3 text-3xl font-semibold text-emerald-400">
              ₹{metrics.totalAmountRecovered.rupees.toLocaleString('en-IN')}
            </div>
          </Panel>

          <Panel delay={cardDelays[3]}>
            <div className="text-sm text-slate-400">Recovery Rate</div>
            <div className={`mt-3 text-3xl font-semibold ${recoveryRateColor}`}>
              {metrics.recoveryRate}%
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Panel>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-50">Intervention Breakdown</h2>
              <span className="text-xs text-slate-500">Success rate by type</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#1a2540] bg-[#0b1120]">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-[#1a2540] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Count</th>
                    <th className="px-4 py-3 font-medium">Success Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {interventionRows.map(([type, data]) => {
                    const successRateColor = data.percentage > 50 ? 'text-emerald-400' : 'text-amber-300'

                    return (
                      <tr key={type} className="border-b border-white/5 last:border-b-0">
                        <td className="px-4 py-3 font-medium text-slate-100">{type}</td>
                        <td className="px-4 py-3 text-slate-300">{formatCount(data.total)}</td>
                        <td className={`px-4 py-3 font-medium ${successRateColor}`}>
                          {data.percentage}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-50">Top Root Causes</h2>
              <span className="text-xs text-slate-500">Ranked by count</span>
            </div>

            <div className="space-y-4">
              {topRootCauses.map((item, index) => {
                const width = totalRootCauseCount > 0 ? (item.count / totalRootCauseCount) * 100 : 0

                return (
                  <div key={`${item.rootCause ?? 'unknown'}-${index}`} className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <div className="min-w-0 flex-1 text-slate-100">
                        <span className="mr-2 text-slate-500">{index + 1}.</span>
                        <span className="truncate">{item.rootCause ?? 'Unknown'}</span>
                      </div>
                      <div className="shrink-0 text-slate-400">{formatCount(item.count)}</div>
                    </div>
                    <div className="h-2 rounded-full bg-[#0b1120]">
                      <div
                        className="h-2 rounded-full bg-sky-400/70"
                        style={{
                          width: `${Math.max(width, item.count > 0 ? (item.count / maxRootCauseCount) * 100 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
        </section>

        <section>
          <Panel>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-50">Status Breakdown</h2>
              <span className="text-xs text-slate-500">Event health distribution</span>
            </div>

            <div className="flex flex-wrap gap-3">
              {['PENDING', 'IN_PROGRESS', 'RECOVERED', 'UNRECOVERABLE'].map((status) => (
                <motion.div
                  key={status}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${statusChipColors[status]}`}
                >
                  <span className="mr-2 text-slate-400">{status}</span>
                  <span>{formatCount(metrics.statusBreakdown[status])}</span>
                </motion.div>
              ))}
            </div>
          </Panel>
        </section>
      </div>
    </div>
  )
}