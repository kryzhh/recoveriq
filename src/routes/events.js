import { Router } from 'express'
import { prisma } from '../db/client.js'

const router = Router()

router.get('/', async (req, res) => {
  const { status, type } = req.query

  const where = {}

  if (typeof status === 'string' && status.length > 0) {
    where.status = status
  }

  if (typeof type === 'string' && type.length > 0) {
    where.type = type
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      razorpayId: true,
      type: true,
      status: true,
      amount: true,
      currency: true,
      errorCode: true,
      rootCause: true,
      rawPayload: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          interventions: true,
        },
      },
    },
  })

  res.json(events)
})

router.get('/:id', async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      interventions: {
        orderBy: { createdAt: 'desc' },
        include: {
          auditLogs: {
            orderBy: { timestamp: 'desc' },
          },
          outcome: true,
        },
      },
    },
  })

  if (!event) {
    return res.status(404).json({ error: 'Event not found' })
  }

  res.json(event)
})

export default router