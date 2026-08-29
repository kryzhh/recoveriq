import prisma from '../db/client.js'
import razorpay from '../razorpay/client.js'
import logger from '../utils/logger.js'

const TEN_MINUTES_MS = 10 * 60 * 1000

function getRecoveryDetails(intervention, entity) {
  const amountRecovered = Number(entity.amount ?? 0)
  const recoveredAt = new Date(intervention.outcome.resolvedAt)
  const createdAt = new Date(intervention.event.createdAt)
  const recoveryLatencyMs = recoveredAt.getTime() - createdAt.getTime()

  return {
    amountRecovered,
    recoveryLatencyMs,
  }
}

async function checkIntervention(intervention) {
  const { event, outcome, type } = intervention

  if (type === 'DUNNING_MESSAGE' || type === 'ESCALATE') {
    logger.info(`[OutcomeTracker] Skipping ${type} for event ${event.id}`)
    return { checked: true, recovered: false, amountRecovered: 0 }
  }

  let entity

  if (type === 'PAYMENT_LINK') {
    const paymentLinkId = intervention.executionPayload?.paymentLinkId
    if (!paymentLinkId) throw new Error(`Missing paymentLinkId for intervention ${intervention.id}`)
    entity = await razorpay.paymentLink.fetch(paymentLinkId)
  } else if (type === 'RETRY') {
    const retryOrderId = intervention.executionPayload?.retryOrderId
    if (!retryOrderId) throw new Error(`Missing retryOrderId for intervention ${intervention.id}`)
    entity = await razorpay.orders.fetch(retryOrderId)
  } else {
    logger.info(`[OutcomeTracker] Unknown intervention type ${type} for event ${event.id}`)
    return { checked: true, recovered: false, amountRecovered: 0 }
  }

  if (entity.status !== 'paid') {
    logger.info(`[OutcomeTracker] ${type} not paid yet for event ${event.id}`, {
      interventionId: intervention.id,
      entityStatus: entity.status,
    })
    return { checked: true, recovered: false, amountRecovered: 0 }
  }

  const { amountRecovered, recoveryLatencyMs } = getRecoveryDetails(intervention, entity)
  console.log('[OutcomeTracker] entity fields:', {
    amount: entity.amount,
    amountPaid: entity.amount_paid,
    id: entity.id,
    status: entity.status,
  })
  await prisma.outcome.update({
    where: { id: outcome.id },
    data: {
      recovered: true,
      amountRecovered,
      recoveryLatencyMs,
    },
  })

  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'RECOVERED' },
  })

  logger.success(`[OutcomeTracker] Recovered event ${event.id}`, {
    interventionId: intervention.id,
    type,
    amountRecovered,
    recoveryLatencyMs,
  })

  return { checked: true, recovered: true, amountRecovered }
}

export async function trackOutcomes() {
  const interventions = await prisma.intervention.findMany({
    where: {
      status: 'EXECUTED',
      type: {
        not: 'ESCALATE',
      },
      outcome: {
        is: {
          recovered: false,
        },
      },
    },
    include: {
      event: true,
      outcome: true,
    },
  })

  let totalChecked = 0
  let totalRecovered = 0
  let totalAmountRecoveredPaise = 0

  for (const intervention of interventions) {
    totalChecked += 1

    try {
      const result = await checkIntervention(intervention)
      if (result.recovered) {
        totalRecovered += 1
        totalAmountRecoveredPaise += result.amountRecovered
      }
    } catch (error) {
      logger.error(`[OutcomeTracker] Failed to track intervention ${intervention.id}`, {
        error: error.message,
        eventId: intervention.eventId,
        type: intervention.type,
      })
    }
  }

  logger.success('[OutcomeTracker] Summary', {
    totalChecked,
    totalRecovered,
    totalAmountRecoveredRupees: (totalAmountRecoveredPaise / 100).toFixed(2),
  })

  return {
    totalChecked,
    totalRecovered,
    totalAmountRecoveredPaise,
  }
}

export function startOutcomeTracker() {
  void trackOutcomes().catch((error) => {
    logger.error('[OutcomeTracker] Initial run failed', { error: error.message })
  })

  return setInterval(() => {
    void trackOutcomes().catch((error) => {
      logger.error('[OutcomeTracker] Scheduled run failed', { error: error.message })
    })
  }, TEN_MINUTES_MS)
}