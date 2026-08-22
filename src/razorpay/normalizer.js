export function normalizePayment(payment) {
  return {
    razorpayId: payment.id,
    type: 'PAYMENT_FAILED',
    status: 'PENDING',
    amount: payment.amount, // already in paise
    currency: payment.currency || 'INR',
    errorCode: payment.error_code || 'UNKNOWN',
    rootCause: null,
    rawPayload: payment,
  }
}

export function normalizeOrder(order) {
  return {
    razorpayId: order.id,
    type: 'ORDER_ABANDONED',
    status: 'PENDING',
    amount: order.amount,
    currency: order.currency || 'INR',
    errorCode: null,
    rootCause: null,
    rawPayload: order,
  }
}

export function normalizeMandate(subscription) {
  return {
    razorpayId: subscription.id,
    type: 'MANDATE_FAILED',
    status: 'PENDING',
    amount: subscription.plan_id ? 0 : 0, // amount lives on the plan, set to 0 for now
    currency: 'INR',
    errorCode: subscription.status === 'halted' ? 'MANDATE_HALTED' : 'MANDATE_CANCELLED',
    rootCause: null,
    rawPayload: subscription,
  }
}