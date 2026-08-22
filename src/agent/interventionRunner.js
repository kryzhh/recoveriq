import { prisma } from '../db/client.js'
import { decideIntervention } from './decisionEngine.js'

export async function runIntervention(event) {
  // 1. get or create stopping rule
  let stoppingRule = await prisma.stoppingRule.findUnique({
    where: { eventId: event.id }
  })

  if (!stoppingRule) {
    stoppingRule = await prisma.stoppingRule.create({
      data: { eventId: event.id }
    })
  }

  // 2. check stopping conditions before even calling LLM
  if (stoppingRule.optedOut) {
    console.log(`  [SKIP] ${event.id} — opted out`)
    return null
  }

  if (stoppingRule.retryCount >= 3) {
    console.log(`  [SKIP] ${event.id} — max retries reached`)
    await prisma.event.update({
      where: { id: event.id },
      data: { status: 'UNRECOVERABLE' }
    })
    return null
  }

  if (stoppingRule.cooldownUntil && new Date(stoppingRule.cooldownUntil) > new Date()) {
    console.log(`  [SKIP] ${event.id} — in cooldown until ${stoppingRule.cooldownUntil}`)
    return null
  }

  // 3. ask LLM for decision
  console.log(`  [DECIDING] ${event.id} (${event.rootCause})`)
  const decision = await decideIntervention(event, stoppingRule)
  console.log(`  [DECISION] → ${decision.intervention} (${decision.confidence}) — ${decision.reasoning}`)

  // 4. write intervention row BEFORE executing anything
  const intervention = await prisma.intervention.create({
    data: {
      eventId: event.id,
      type: decision.intervention,
      reasoning: decision.reasoning,
      status: 'PENDING',
      retryCount: stoppingRule.retryCount,
    }
  })

  // 5. write audit log entry — action about to happen
  await prisma.auditLog.create({
    data: {
      interventionId: intervention.id,
      action: `${decision.intervention} selected by LLM`,
      result: 'PENDING_EXECUTION',
      metadata: {
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        rootCause: event.rootCause,
        retryCount: stoppingRule.retryCount,
      }
    }
  })

  // 6. update stopping rule
  await prisma.stoppingRule.update({
    where: { eventId: event.id },
    data: {
      retryCount: { increment: 1 },
      lastAttempt: new Date(),
      cooldownUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24hr cooldown
    }
  })

  // 7. update event status
  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'IN_PROGRESS' }
  })

  return { intervention, decision }
}