import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEvents, type Event } from '../lib/api'

const statusOptions = ['ALL', 'PENDING', 'IN_PROGRESS', 'RECOVERED', 'UNRECOVERABLE']
const typeOptions = ['ALL', 'PAYMENT_FAILED', 'ORDER_ABANDONED', 'MANDATE_FAILED']

function formatRelativeTime(dateValue: string) {
  const date = new Date(dateValue)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000))

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <tr key={index} className="border-b border-[#1a2540] last:border-b-0">
          {Array.from({ length: 7 }).map((__, cellIndex) => (
            <td key={cellIndex} className="px-4 py-3">
              <div className="h-4 rounded-2xl bg-[#1a2540] animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function Events() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [sortField, setSortField] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    let active = true

    async function loadEvents() {
      setLoading(true)

      try {
        const filters: { status?: string; type?: string } = {}

        if (statusFilter !== 'ALL') {
          filters.status = statusFilter
        }

        if (typeFilter !== 'ALL') {
          filters.type = typeFilter
        }

        const data = await getEvents(Object.keys(filters).length > 0 ? filters : undefined)

        if (active) {
          setEvents(data)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadEvents()

    return () => {
      active = false
    }
  }, [statusFilter, typeFilter])

  const typeBadgeColors: Record<string, string> = {
    PAYMENT_FAILED: 'border-red-500/20 bg-red-500/10 text-red-200',
    ORDER_ABANDONED: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-200',
    MANDATE_FAILED: 'border-orange-500/20 bg-orange-500/10 text-orange-200',
  }

  const statusBadgeColors: Record<string, string> = {
    PENDING: 'border-slate-700 bg-slate-900/80 text-slate-200',
    IN_PROGRESS: 'border-blue-500/20 bg-blue-500/10 text-blue-200',
    RECOVERED: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    UNRECOVERABLE: 'border-red-500/20 bg-red-500/10 text-red-200',
  }

  return (
    <div className="min-h-full bg-[#0a0f1a] p-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-50">Events</h1>
            <p className="mt-2 text-sm text-slate-400">All detected revenue loss events</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="min-w-44 rounded-xl border border-[#1a2540] bg-[#0d1424] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-sky-400"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              Type
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="min-w-48 rounded-xl border border-[#1a2540] bg-[#0d1424] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-sky-400"
              >
                {typeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#1a2540] bg-[#0d1424]">
          <table className="w-full border-collapse">
            <thead>
                  <tr className="border-b border-[#1a2540] text-left">
                    <th
                      onClick={() => {
                        if (sortField === 'type') setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                        else {
                          setSortField('type')
                          setSortDirection('asc')
                        }
                      }}
                      className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400 cursor-pointer select-none"
                    >
                      Type {sortField === 'type' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (sortField === 'amount') setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                        else {
                          setSortField('amount')
                          setSortDirection('asc')
                        }
                      }}
                      className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400 cursor-pointer select-none"
                    >
                      Amount {sortField === 'amount' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (sortField === 'rootCause') setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                        else {
                          setSortField('rootCause')
                          setSortDirection('asc')
                        }
                      }}
                      className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400 cursor-pointer select-none"
                    >
                      Root Cause {sortField === 'rootCause' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (sortField === 'status') setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                        else {
                          setSortField('status')
                          setSortDirection('asc')
                        }
                      }}
                      className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400 cursor-pointer select-none"
                    >
                      Status {sortField === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (sortField === 'errorCode') setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                        else {
                          setSortField('errorCode')
                          setSortDirection('asc')
                        }
                      }}
                      className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400 cursor-pointer select-none"
                    >
                      Error Code {sortField === 'errorCode' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (sortField === 'interventions') setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                        else {
                          setSortField('interventions')
                          setSortDirection('asc')
                        }
                      }}
                      className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400 cursor-pointer select-none"
                    >
                      Interventions {sortField === 'interventions' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (sortField === 'createdAt') setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                        else {
                          setSortField('createdAt')
                          setSortDirection('desc')
                        }
                      }}
                      className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400 cursor-pointer select-none"
                    >
                      Created At {sortField === 'createdAt' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : (
                (() => {
                  const sorted = [...events].sort((a, b) => {
                    const dir = sortDirection === 'asc' ? 1 : -1

                    function str(v: any) {
                      if (v == null) return ''
                      return String(v)
                    }

                    switch (sortField) {
                      case 'amount':
                        return dir * ((a.amount ?? 0) - (b.amount ?? 0))
                      case 'createdAt':
                        return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                      case 'type':
                        return dir * str(a.type).localeCompare(str(b.type))
                      case 'status':
                        return dir * str(a.status).localeCompare(str(b.status))
                      case 'errorCode':
                        return dir * str(a.errorCode).localeCompare(str(b.errorCode))
                      case 'rootCause':
                        return dir * str(a.rootCause).localeCompare(str(b.rootCause))
                      case 'interventions':
                        return dir * ((a._count?.interventions ?? 0) - (b._count?.interventions ?? 0))
                      default:
                        return 0
                    }
                  })

                  return sorted.map((event) => (
                    <tr
                      key={event.id}
                      onClick={() => navigate(`/events/${event.id}`)}
                      className="cursor-pointer border-b border-[#1a2540] transition-colors hover:bg-[#111d35] last:border-b-0"
                    >
                      <td className="px-4 py-3 text-sm text-slate-200">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${typeBadgeColors[event.type] ?? 'border-slate-700 bg-slate-900/80 text-slate-200'}`}>
                          {event.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-200">
                        ₹{(event.amount / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-200">
                        <span title={event.rootCause ?? 'Unknown'}>
                          {(event.rootCause ?? 'Unknown').length > 24
                            ? `${(event.rootCause ?? 'Unknown').slice(0, 24)}…`
                            : (event.rootCause ?? 'Unknown')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-200">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeColors[event.status] ?? 'border-slate-700 bg-slate-900/80 text-slate-200'}`}>
                          {event.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-200">{event.errorCode ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-200">{event._count?.interventions ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-slate-200">
                        {formatRelativeTime(event.createdAt)}
                      </td>
                    </tr>
                  ))
                })()
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}