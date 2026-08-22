import express from 'express'
import { handleWebhook } from './routes/webhook.js'
import { startPoller } from './poller.js'
import { enrichPendingEvents } from './agent/enrichEvents.js'
import { runIntervention } from './agent/interventionRunner.js'
import { prisma } from './db/client.js'

const app = express()
app.use(express.json())

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

app.listen(3000, async () => {
  console.log('RecoverIQ running on port 3000')

  try {
    await enrichPendingEvents()
    startPoller(5 * 60 * 1000)
  } catch (error) {
    console.error('Failed to enrich pending events:', error)
    startPoller(5 * 60 * 1000)
  }
})