import { prisma } from '../db/client.js'
import { logger } from '../utils/logger.js'
import { writeAuditOutcome } from './interventionRunner.js'
import razorpay from '../razorpay/client.js'

// ----------------------------------------------------------
// Execution handlers — one per intervention type
// ----------------------------------------------------------

async function executePaymentLink(event, intervention) {
  const order = await razorpay.orders.create({
    amount: event.amount,
    currency: event.currency,
    receipt: `recover_${event.id.slice(0, 8)}`,
  })

  const paymentLink = await razorpay.paymentLink.create({
    amount: event.amount,
    currency: event.currency,
    description: `Recovery payment for order ${event.razorpayId}`,
    reminder_enable: true,
    notify: { sms: false, email: false }, // test mode — no real notifications
    notes: {
      recoveriq_event_id: event.id,
      recoveriq_intervention_id: intervention.id,
      original_razorpay_id: event.razorpayId,
    },
  })

  return {
    executionPayload: {
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.short_url,
      orderId: order.id,
      amount: event.amount,
    },
    reversalPayload: {
      action: 'cancel_payment_link',
      paymentLinkId: paymentLink.id,
    },
  }
}

async function executeRetry(event, intervention) {
  // In test mode there's no direct "retry payment" API —
  // we create a fresh order as a retry signal
  const order = await razorpay.orders.create({
    amount: event.amount,
    currency: event.currency,
    receipt: `retry_${event.id.slice(0, 8)}`,
    notes: {
      recoveriq_event_id: event.id,
      recoveriq_intervention_id: intervention.id,
      retry_of: event.razorpayId,
    },
  })

  return {
    executionPayload: {
      retryOrderId: order.id,
      amount: event.amount,
      originalRazorpayId: event.razorpayId,
    },
    reversalPayload: {
      action: 'cancel_order',
      orderId: order.id,
    },
  }
}

async function executeDunningMessage(event, intervention) {
  // In production this would send SMS/email via Razorpay notify or your own provider.
  // In test mode we simulate and log it.
  const message = buildDunningMessage(event)

  logger.info(`[Executor] Dunning message for ${event.razorpayId}`, { message })

  return {
    executionPayload: {
      messageType: 'DUNNING',
      message,
      simulatedAt: new Date().toISOString(),
    },
    reversalPayload: {
      action: 'none', // messages can't be unsent, log it only
      note: 'Dunning message already delivered — no reversal possible',
    },
  }
}

async function executeEscalate(event, intervention) {
  // Flag for human review — no Razorpay API call, just mark it
  logger.warn(`[Executor] Escalating event ${event.id} for human review`, {
    rootCause: event.rootCause,
    amount: event.amount,
  })

  return {
    executionPayload: {
      escalatedAt: new Date().toISOString(),
      reason: intervention.reasoning,
    },
    reversalPayload: {
      action: 'none',
      note: 'Escalation is informational — no reversal needed',
    },
  }
}

function buildDunningMessage(event) {
  const amount = `₹${(event.amount / 100).toFixed(2)}`
  const messages = {
    INSUFFICIENT_FUNDS: `Your payment of ${amount} failed due to insufficient funds. Please try with a different payment method.`,
    INVALID_UPI_ID: `Your payment of ${amount} failed — the UPI ID provided appears invalid. Please retry with the correct UPI ID.`,
    CHECKOUT_ABANDONED: `You left your checkout incomplete. Your order of ${amount} is still waiting. Complete your payment here.`,
    PAYMENT_LIMIT_EXCEEDED: `Your payment of ${amount} failed because your daily UPI limit was reached. Try after midnight or use a different method.`,
    BANK_DECLINED: `Your bank declined the payment of ${amount}. Please try a different card or UPI ID.`,
  }

  return messages[event.rootCause] || `Your payment of ${amount} could not be processed. Please retry with a different payment method.`
}

// ----------------------------------------------------------
// Main executor
// ----------------------------------------------------------

export async function executeIntervention(intervention, event) {
  logger.info(`[Executor] Executing ${intervention.type} for event ${event.id}`)

  const handlers = {
    PAYMENT_LINK: executePaymentLink,
    RETRY: executeRetry,
    DUNNING_MESSAGE: executeDunningMessage,
    ESCALATE: executeEscalate,
  }

  const handler = handlers[intervention.type]
  if (!handler) {
    throw new Error(`No handler for intervention type: ${intervention.type}`)
  }

  let executionResult
  let success = false

  try {
    executionResult = await handler(event, intervention)
    success = true
  } catch (err) {
    logger.error(`[Executor] Execution failed for ${intervention.id}`, { error: err.message })

    // write failure to audit log
    await writeAuditOutcome(intervention.id, 'FAILED', {
      error: err.message,
      interventionType: intervention.type,
    })

    // mark intervention failed
    await prisma.intervention.update({
      where: { id: intervention.id },
      data: { status: 'FAILED', executedAt: new Date() }
    })

    // mark event unrecoverable if executor keeps failing
    await prisma.event.update({
      where: { id: event.id },
      data: { status: 'UNRECOVERABLE' }
    })

    return { success: false, error: err.message }
  }

  // write execution payloads to intervention
  await prisma.intervention.update({
    where: { id: intervention.id },
    data: {
      status: 'EXECUTED',
      executedAt: new Date(),
      executionPayload: executionResult.executionPayload,
      reversalPayload: executionResult.reversalPayload,
    }
  })

  // write success audit log entry
  await writeAuditOutcome(intervention.id, 'SUCCESS', executionResult.executionPayload)

  // create outcome row
  await prisma.outcome.create({
    data: {
      interventionId: intervention.id,
      recovered: false, // will be updated by outcome tracker later
      amountRecovered: null,
      recoveryLatencyMs: null,
    }
  })

  logger.success(`[Executor] ${intervention.type} executed for event ${event.id}`)

  return { success: true, result: executionResult.executionPayload }
}