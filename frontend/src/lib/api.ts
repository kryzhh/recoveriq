import axios from 'axios'

export interface AuditLog {
  id: string
  interventionId: string
  action: string
  result: string
  metadata: unknown | null
  timestamp: string
}

export interface Outcome {
  id: string
  interventionId: string
  recovered: boolean
  amountRecovered: number | null
  recoveryLatencyMs: number | null
  resolvedAt: string
}

export interface Intervention {
  id: string
  eventId: string
  type: string
  reasoning: string
  status: string
  retryCount: number
  executedAt: string | null
  createdAt: string
  executionPayload: unknown | null
  reversalPayload: unknown | null
  auditLogs?: AuditLog[]
  outcome?: Outcome | null
}

export interface Event {
  id: string
  razorpayId: string
  type: string
  status: string
  amount: number
  currency: string
  errorCode: string | null
  rootCause: string | null
  rawPayload: unknown
  createdAt: string
  updatedAt: string
  interventions?: Intervention[]
  _count?: {
    interventions: number
  }
}

export interface Metrics {
  eventBreakdown: Record<string, number>
  statusBreakdown: Record<string, number>
  interventionBreakdown: Record<string, number>
  recoveryRate: number
  totalAmountAtRisk: {
    paise: number
    rupees: number
  }
  totalAmountRecovered: {
    paise: number
    rupees: number
  }
  avgRecoveryLatencyMs: number
  topRootCauses: Array<{
    rootCause: string | null
    count: number
  }>
  interventionSuccessRate: Record<
    string,
    {
      percentage: number
      recovered: number
      total: number
    }
  >
}

const api = axios.create({
  baseURL: '/api',
})

export default api

export async function getMetrics(): Promise<Metrics> {
  const response = await api.get<Metrics>('/metrics')
  return response.data
}

export async function getEvents(filters?: { status?: string; type?: string }): Promise<Event[]> {
  const response = await api.get<Event[]>('/events', {
    params: filters,
  })

  return response.data
}

export async function getEvent(id: string): Promise<Event> {
  const response = await api.get<Event>(`/events/${id}`)
  return response.data
}

export async function runAgent(eventId: string): Promise<unknown> {
  const response = await api.post(`/agent/run/${eventId}`)
  return response.data
}

export async function runBatch(limit: number): Promise<unknown> {
  const response = await api.post('/agent/run-batch', { limit })
  return response.data
}