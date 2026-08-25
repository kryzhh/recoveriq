import express from 'express'
import morgan from 'morgan'
import { handleWebhook } from './routes/webhook.js'
import { startPoller } from './poller.js'
import { enrichPendingEvents } from './agent/enrichEvents.js'
import { runIntervention } from './agent/interventionRunner.js'
import { prisma } from './db/client.js'
import { logger } from './utils/logger.js'
import { startOutcomeTracker } from './agent/outcomeTracker.js'

const app = express()
app.use(express.json())
app.use(morgan('[:date[iso]] :method :url :status :response-time ms'))

app.post('/webhook/razorpay', handleWebhook)

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// trigger agent on a single event — for testing
app.post('/agent/run/:eventId', async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.eventId }
  })

  if (!event) return res.status(404).json({ error: 'Event not found' })

  const result = await runIntervention(event)
  res.json(result)
})

// src/index.js
app.post('/agent/run-batch', async (req, res) => {
  const events = await prisma.event.findMany({
    where: { status: 'PENDING' },
    take: req.body.limit || 10,
  })

  logger.info(`[Batch] Running agent on ${events.length} events`)

  const results = []
  for (const event of events) {
    try {
      const result = await runIntervention(event)
      results.push({ eventId: event.id, status: 'ok', result })
    } catch (err) {
      logger.error(`[Batch] Failed for event ${event.id}`, { error: err.message })
      results.push({ eventId: event.id, status: 'error', error: err.message })
    }
  }

  res.json({
    processed: results.length,
    succeeded: results.filter(r => r.status === 'ok').length,
    failed: results.filter(r => r.status === 'error').length,
    results,
  })
})

app.listen(3000, async () => {
  console.log('RecoverIQ running on port 3000')

  try {
    await enrichPendingEvents()
    startOutcomeTracker()
    startPoller(5 * 60 * 1000)
  } catch (error) {
    console.error('Failed to enrich pending events:', error)
    startPoller(5 * 60 * 1000)
  }
})