import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getMetrics, type Metrics } from '../lib/api'

const cardDelays = [0, 0.07, 0.14, 0.21]

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString('en-IN')
}

function LoadingSkeleton() {
  return (
    <div className="min-h-full bg-[#0a0f1a] p-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="h-10 w-72 rounded-2xl bg-[#1a2540] animate-pulse" />
              <div className="h-4 w-[28rem] rounded-2xl bg-[#1a2540] animate-pulse" />
            </div>
            <div className="h-8 w-24 rounded-full bg-[#1a2540] animate-pulse" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-5">
              <div className="h-4 w-24 rounded-2xl bg-[#1a2540] animate-pulse" />
              <div className="mt-3 h-8 w-32 rounded-2xl bg-[#1a2540] animate-pulse" />
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="h-5 w-44 rounded-2xl bg-[#1a2540] animate-pulse" />
                <div className="h-4 w-24 rounded-2xl bg-[#1a2540] animate-pulse" />
              </div>
              <div className="space-y-4">
                <div className="h-12 rounded-xl bg-[#1a2540] animate-pulse" />
                <div className="h-12 rounded-xl bg-[#1a2540] animate-pulse" />
                <div className="h-12 rounded-xl bg-[#1a2540] animate-pulse" />
                <div className="h-12 rounded-xl bg-[#1a2540] animate-pulse" />
              </div>
            </div>
          ))}
        </section>

        <section>
          <div className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="h-5 w-40 rounded-2xl bg-[#1a2540] animate-pulse" />
              <div className="h-4 w-28 rounded-2xl bg-[#1a2540] animate-pulse" />
            </div>

            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-10 w-40 rounded-full bg-[#1a2540] animate-pulse" />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-6">{children}</div>
}

const interventionColors: Record<string, string> = {
  PAYMENT_LINK: '#3b82f6',
  RETRY: '#8b5cf6',
  DUNNING_MESSAGE: '#eab308',
  ESCALATE: '#ef4444',
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
    return <LoadingSkeleton />
  }

  const totalEvents = Object.values(metrics.statusBreakdown).reduce((sum, value) => sum + value, 0)
  const recoveryRateColor =
    metrics.recoveryRate > 50
      ? 'text-emerald-400'
      : metrics.recoveryRate > 20
        ? 'text-amber-300'
        : 'text-rose-400'

  const interventionChartData = Object.entries(metrics.interventionBreakdown)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value,
    }))

  const interventionRadialChartData = [
    ...Object.entries(metrics.interventionBreakdown).map(([name, value]) => ({
      name,
      value,
      fill: interventionColors[name as keyof typeof interventionColors],
    })),
    ...(metrics.interventionBreakdown.DUNNING_MESSAGE === 0
      ? [{ name: 'DUNNING_MESSAGE', value: 0, fill: interventionColors.DUNNING_MESSAGE }]
      : []),
  ]

  const statusChartData = Object.entries(metrics.statusBreakdown)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value,
    }))

  const statusColors = {
    PENDING: '#64748b',
    IN_PROGRESS: '#3b82f6',
    RECOVERED: '#22c55e',
    UNRECOVERABLE: '#ef4444',
  }

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
          <Panel>
            <div className="text-sm text-slate-400">Total Events</div>
            <div className="mt-3 text-3xl font-semibold text-slate-50">{formatCount(totalEvents)}</div>
          </Panel>

          <Panel>
            <div className="text-sm text-slate-400">Amount at Risk</div>
            <div className="mt-3 text-3xl font-semibold text-slate-50">
              ₹{metrics.totalAmountAtRisk.rupees.toLocaleString('en-IN')}
            </div>
          </Panel>

          <Panel>
            <div className="text-sm text-slate-400">Amount Recovered</div>
            <div className="mt-3 text-3xl font-semibold text-emerald-400">
              ₹{metrics.totalAmountRecovered.rupees.toLocaleString('en-IN')}
            </div>
          </Panel>

          <Panel>
            <div className="text-sm text-slate-400">Recovery Rate</div>
            <div className={`mt-3 text-3xl font-semibold ${recoveryRateColor}`}>
              {metrics.recoveryRate}%
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Panel>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Intervention Breakdown</h2>
              <span className="text-xs text-slate-400">Success rate by type</span>
            </div>

            <div className="flex gap-4">
              <div className="w-[60%]">
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height={200}>
                    <RadialBarChart
                      data={interventionRadialChartData.filter((entry) => entry.value > 0 || entry.name === 'DUNNING_MESSAGE')}
                      innerRadius="20%"
                      outerRadius="90%"
                      barSize={18}
                    >
                      <RadialBar dataKey="value" background cornerRadius={10} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="w-[40%]">
                <div className="space-y-3 text-sm">
                  {interventionRows.map(([type, data]) => {
                    const dotColor =
                      interventionColors[type as keyof typeof interventionColors] ?? '#94a3b8'
                    const successRateColor =
                      data.percentage > 50
                        ? 'text-emerald-400'
                        : data.percentage > 20
                          ? 'text-amber-300'
                          : 'text-rose-400'

                    return (
                      <div key={type} className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
                          <span className="truncate text-slate-100">{type}</span>
                        </div>

                        <div className="flex items-center gap-3 text-right">
                          <span className="text-slate-300">{formatCount(data.total)}</span>
                          <span className={`font-medium ${successRateColor}`}>{data.percentage}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </Panel>

          {topRootCauses.length > 0 ? (
            <Panel>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Top Root Causes</h2>
              </div>

              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topRootCauses}
                    margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: '#8ea0b5', fontSize: 11 }}
                      tickLine={{ stroke: '#1a2540' }}
                    />
                    <YAxis
                      dataKey="rootCause"
                      type="category"
                      width={220}
                      tick={{ fill: '#8ea0b5', fontSize: 11 }}
                      tickLine={{ stroke: '#1a2540' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0d1424',
                        border: '1px solid #1a2540',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" background={{ fill: '#1a2540' }} radius={[0, 4, 4, 0]}>
                      {topRootCauses.map((entry, index) => (
                        <Cell key={`${entry.rootCause ?? 'unknown'}-${index}`} fill="#3b82f6" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          ) : null}
        </section>

        <section className="mt-6">
          <Panel>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Status Breakdown</h2>
              <span className="text-xs text-slate-400">Event health distribution</span>
            </div>

            <div className="flex flex-wrap gap-3">
              {['PENDING', 'IN_PROGRESS', 'RECOVERED', 'UNRECOVERABLE'].map((status) => (
                <div key={status} className={`rounded-full border px-4 py-2 text-sm font-medium ${statusChipColors[status]}`}>
                  <span className="mr-2 text-slate-400">{status}</span>
                  <span>{formatCount(metrics.statusBreakdown[status])}</span>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid grid-cols-2 gap-6">
          <div className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">Intervention Distribution</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="45%"
                    data={interventionChartData}
                    dataKey="value"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {interventionChartData.map((entry) => (
                      <Cell key={entry.name} fill={interventionColors[entry.name as keyof typeof interventionColors]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0d1424',
                      border: '1px solid #1a2540',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={30}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ color: '#8ea0b5', fontSize: '12px' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-[#1a2540] bg-[#0d1424] p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">Event Status Distribution</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="45%"
                    data={statusChartData}
                    dataKey="value"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {statusChartData.map((entry) => (
                      <Cell key={entry.name} fill={statusColors[entry.name as keyof typeof statusColors]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0d1424',
                      border: '1px solid #1a2540',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={30}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ color: '#8ea0b5', fontSize: '12px' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}