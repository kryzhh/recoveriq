import razorpay from './client.js'

// Fetch failed payments from last 24hrs
async function fetchFailedPayments() {
  const from = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
  const to = Math.floor(Date.now() / 1000)

  const response = await razorpay.payments.all({
    from,
    to,
    count: 100,
  })

  return (response.items || []).filter(p => p.status === 'failed')
}

// Fetch abandoned orders — created but never paid
async function fetchAbandonedOrders() {
  const from = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
  const to = Math.floor(Date.now() / 1000)

  const response = await razorpay.orders.all({
    from,
    to,
    count: 100,
  })

  return (response.items || []).filter(o =>
    o.status === 'created' &&
    o.attempts === 0 &&
    !o.receipt?.startsWith('recover_') &&
    !o.receipt?.startsWith('retry_')
  )
}

// Fetch failed subscription charges
async function fetchFailedMandates() {
  const response = await razorpay.subscriptions.all({
    count: 100,
  })

  return (response.items || []).filter(s =>
    s.status === 'halted' || s.status === 'cancelled'
  )
}

export { fetchFailedPayments, fetchAbandonedOrders, fetchFailedMandates }