import prisma from '../db/client.js'

const EVENT_TYPES = ['PAYMENT_FAILED', 'ORDER_ABANDONED', 'MANDATE_FAILED']
const EVENT_STATUSES = ['PENDING', 'IN_PROGRESS', 'RECOVERED', 'UNRECOVERABLE']
const INTERVENTION_TYPES = ['PAYMENT_LINK', 'RETRY', 'DUNNING_MESSAGE', 'ESCALATE']

function asCountMap(rows, keyField, keys) {
  const map = Object.fromEntries(keys.map((key) => [key, 0]))

  for (const row of rows) {
    const key = row[keyField]
    if (key in map) {
      map[key] = row._count[keyField]
    }
  }

  return map
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100
}

export async function loadMetricsData() {
  const [
    eventTypeRows,
    eventStatusRows,
    interventionTypeRows,
    eventAmountAggregate,
    recoveredAmountAggregate,
    recoveryLatencyAggregate,
    topRootCauseRows,
    interventionRows,
  ] = await Promise.all([
    prisma.event.groupBy({
      by: ['type'],
      where: { type: { in: EVENT_TYPES } },
      _count: { _all: true },
    }),
    prisma.event.groupBy({
      by: ['status'],
      where: { status: { in: EVENT_STATUSES } },
      _count: { _all: true },
    }),
    prisma.intervention.groupBy({
      by: ['type'],
      where: { type: { in: INTERVENTION_TYPES } },
      _count: { _all: true },
    }),
    prisma.event.aggregate({
      _sum: { amount: true },
    }),
    prisma.outcome.aggregate({
      where: { recovered: true },
      _sum: { amountRecovered: true },
    }),
    prisma.outcome.aggregate({
      where: { recovered: true },
      _avg: { recoveryLatencyMs: true },
    }),
    prisma.event.groupBy({
      by: ['rootCause'],
      where: { rootCause: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { rootCause: 'desc' } },
      take: 5,
    }),
    prisma.intervention.findMany({
      select: {
        type: true,
        outcome: {
          select: {
            recovered: true,
          },
        },
      },
    }),
  ])

  const eventBreakdown = asCountMap(eventTypeRows, 'type', EVENT_TYPES)
  const statusBreakdown = asCountMap(eventStatusRows, 'status', EVENT_STATUSES)
  const interventionBreakdown = asCountMap(interventionTypeRows, 'type', INTERVENTION_TYPES)

  const totalEvents = EVENT_STATUSES.reduce((sum, status) => sum + statusBreakdown[status], 0)
  const processedEvents = totalEvents - statusBreakdown.PENDING
  const recoveryRate = processedEvents > 0
    ? roundToTwo((statusBreakdown.RECOVERED / processedEvents) * 100)
    : 0

  const totalAmountAtRiskPaise = eventAmountAggregate._sum.amount ?? 0
  const totalAmountRecoveredPaise = recoveredAmountAggregate._sum.amountRecovered ?? 0
  const avgRecoveryLatencyMs = recoveryLatencyAggregate._avg.recoveryLatencyMs ?? 0

  const topRootCauses = topRootCauseRows.map((row) => ({
    rootCause: row.rootCause,
    count: row._count.rootCause,
  }))

  const successAccumulator = Object.fromEntries(
    INTERVENTION_TYPES.map((type) => [type, { total: 0, recovered: 0 }])
  )

  for (const intervention of interventionRows) {
    const bucket = successAccumulator[intervention.type]
    if (!bucket) continue

    bucket.total += 1
    if (intervention.outcome?.recovered) {
      bucket.recovered += 1
    }
  }

  const interventionSuccessRate = Object.fromEntries(
    INTERVENTION_TYPES.map((type) => {
      const bucket = successAccumulator[type]
      const rate = bucket.total > 0 ? roundToTwo((bucket.recovered / bucket.total) * 100) : 0

      return [type, {
        percentage: rate,
        recovered: bucket.recovered,
        total: bucket.total,
      }]
    })
  )

  return {
    eventBreakdown,
    statusBreakdown,
    interventionBreakdown,
    recoveryRate,
    totalAmountAtRisk: {
      paise: totalAmountAtRiskPaise,
      rupees: roundToTwo(totalAmountAtRiskPaise / 100),
    },
    totalAmountRecovered: {
      paise: totalAmountRecoveredPaise,
      rupees: roundToTwo(totalAmountRecoveredPaise / 100),
    },
    avgRecoveryLatencyMs,
    topRootCauses,
    interventionSuccessRate,
    totalEvents,
  }
}

export async function getMetrics(req, res) {
  const data = await loadMetricsData()

  return res.json({
    eventBreakdown: data.eventBreakdown,
    statusBreakdown: data.statusBreakdown,
    interventionBreakdown: data.interventionBreakdown,
    recoveryRate: data.recoveryRate,
    totalAmountAtRisk: data.totalAmountAtRisk,
    totalAmountRecovered: data.totalAmountRecovered,
    avgRecoveryLatencyMs: data.avgRecoveryLatencyMs,
    topRootCauses: data.topRootCauses,
    interventionSuccessRate: data.interventionSuccessRate,
  })
}

export default getMetrics