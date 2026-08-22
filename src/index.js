import express from 'express'
import { handleWebhook } from './routes/webhook.js'
import { startPoller } from './poller.js'
import { enrichPendingEvents } from './agent/enrichEvents.js'

const app = express()
app.use(express.json())

app.post('/webhook/razorpay', handleWebhook)
app.get('/health', (req, res) => res.json({ status: 'ok' }))
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