import { prisma } from './db/client.js'
import {
  fetchFailedPayments,
  fetchAbandonedOrders,
  fetchFailedMandates,
} from './razorpay/fetchers.js'
import {
  normalizePayment,
  normalizeOrder,
  normalizeMandate,
} from './razorpay/normalizer.js'


async function poll() {
  console.log(`[${new Date().toISOString()}] Polling Razorpay...`)

  try {
    const [payments, orders, mandates] = await Promise.all([
      fetchFailedPayments(),
      fetchAbandonedOrders(),
      fetchFailedMandates(),
    ])

    const allEvents = [
      ...payments.map(normalizePayment),
      ...orders.map(normalizeOrder),
      ...mandates.map(normalizeMandate),
    ]

    let newCount = 0

    for (const event of allEvents) {
      const existing = await prisma.event.findUnique({
        where: { razorpayId: event.razorpayId }
      })

      if (!existing) {
        await prisma.event.create({ data: event })
        newCount++
        console.log(`  + New event: ${event.type} ${event.razorpayId}`)
      }
      // if it exists, skip — don't overwrite status that agent may have updated
    }

    console.log(`  Done. ${newCount} new events, ${allEvents.length - newCount} already known.`)

  } catch (err) {
    console.error('Poll failed:', err.message)
    // don't crash — log and wait for next interval
  }
}

async function startPoller(intervalMs = 5 * 60 * 1000) {
  console.log(`Poller starting, interval: ${intervalMs / 1000}s`)
  await poll() // run immediately on start
  setInterval(poll, intervalMs)
}

export { startPoller }