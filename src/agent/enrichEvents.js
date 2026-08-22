// src/agent/enrichEvents.js
import { prisma } from '../db/client.js'
import { mapRootCause } from './rootCauseMapper.js'

export async function enrichPendingEvents() {
  const events = await prisma.event.findMany({
    where: {
      status: 'PENDING',
      rootCause: null,
    }
  })

  console.log(`[Enricher] Found ${events.length} unenriched events`)

  for (const event of events) {
    const desc = event.rawPayload?.desc
      || event.rawPayload?.payment?.error?.description
      || event.rawPayload?.abandonment?.reason
      || ''

    const { rootCause, retryable, interventionHint, explanation } =
      mapRootCause(event.errorCode, desc)

    await prisma.event.update({
      where: { id: event.id },
      data: { rootCause }
    })

    console.log(`  [${event.type}] ${event.razorpayId} → ${rootCause} (hint: ${interventionHint})`)
  }

  console.log('[Enricher] Done')
}