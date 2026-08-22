import express from 'express'
import { handleWebhook } from './routes/webhook.js'
import { startPoller } from './poller.js'

const app = express()
app.use(express.json())

app.post('/webhook/razorpay', handleWebhook)
app.get('/health', (req, res) => res.json({ status: 'ok' }))
app.listen(3000, () => {
  console.log('RecoverIQ running on port 3000')
  startPoller(5 * 60 * 1000) // poll every 5 mins
})