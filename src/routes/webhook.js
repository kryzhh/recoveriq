import { prisma } from '../db/client.js'

export async function handleWebhook(req, res) {
  const event = req.body.event
  const payload = req.body.payload

  const typeMap = {
    'payment.failed': 'PAYMENT_FAILED',
    'order.paid': null,
    'subscription.charged': null,
    'subscription.charge.failed': 'MANDATE_FAILED'
  }

  const type = typeMap[event]
  if (!type) return res.json({ received: true })

  await prisma.event.create({
    data: {
      razorpayId: payload.payment?.entity?.id || payload.order?.entity?.id,
      type,
      status: 'PENDING',
      amount: payload.payment?.entity?.amount || 0,
      errorCode: payload.payment?.entity?.error_code || null,
      rawPayload: payload
    }
  })

  res.json({ received: true })
}