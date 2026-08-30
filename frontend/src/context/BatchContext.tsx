import React, { createContext, useContext, useState, useRef } from 'react'

export type BatchResult = {
  eventId: string
  status: 'ok' | 'error'
  error?: string
  result?: {
    intervention?: { type?: string | null; reasoning?: string | null }
  }
}

export interface BatchState {
  isRunning: boolean
  results: BatchResult[]
  processed: number
  succeeded: number
  failed: number
  total: number
}

type ContextValue = {
  state: BatchState
  startBatch: (limit: number) => Promise<void>
  resetBatch: () => void
}

const defaultState: BatchState = {
  isRunning: false,
  results: [],
  processed: 0,
  succeeded: 0,
  failed: 0,
  total: 0,
}

const BatchContext = createContext<ContextValue | undefined>(undefined)

export function BatchProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BatchState>(defaultState)
  const latestResults = useRef<BatchResult[]>([])

  function resetBatch() {
    latestResults.current = []
    setState({ ...defaultState })
  }

  async function startBatch(limit: number) {
    resetBatch()
    setState((s) => ({ ...s, isRunning: true, total: limit }))

    try {
      const res = await fetch('/api/agent/run-batch-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit }),
      })

      if (!res.body) throw new Error('Streaming not supported')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''

        for (const chunk of chunks) {
          const line = chunk.trim()
          if (!line.startsWith('data:')) continue
          const json = line.slice(5).trim()
          if (!json) continue

          const payload = JSON.parse(json) as BatchResult & { done?: boolean; processed?: number; succeeded?: number; failed?: number }

          if (payload.done) {
            // finalize from payload or accumulated results
            const finalResults = latestResults.current
            const processed = payload.processed ?? finalResults.length
            const succeeded = payload.succeeded ?? finalResults.filter(r => r.status === 'ok').length
            const failed = payload.failed ?? finalResults.filter(r => r.status === 'error').length

            setState({ isRunning: false, results: finalResults, processed, succeeded, failed, total: limit })
            return
          }

          if (payload.eventId) {
            latestResults.current = [...latestResults.current, payload as BatchResult]
            const processed = latestResults.current.length
            const succeeded = latestResults.current.filter(r => r.status === 'ok').length
            const failed = latestResults.current.filter(r => r.status === 'error').length

            setState({ isRunning: true, results: latestResults.current, processed, succeeded, failed, total: limit })
          }
        }
      }
    } catch (err) {
      console.error('Batch stream failed', err)
      setState((s) => ({ ...s, isRunning: false }))
    }
  }

  return (
    <BatchContext.Provider value={{ state, startBatch, resetBatch }}>{children}</BatchContext.Provider>
  )
}

export function useBatch() {
  const ctx = useContext(BatchContext)
  if (!ctx) throw new Error('useBatch must be used within BatchProvider')
  return ctx
}

export default BatchContext
