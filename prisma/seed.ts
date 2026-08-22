import * as crypto from 'node:crypto'
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import "dotenv/config"

type SeedEventType = 'PAYMENT_FAILED' | 'ORDER_ABANDONED' | 'MANDATE_FAILED'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter,
})

// ------------------------------------------------------------
// Failure scenarios
// ------------------------------------------------------------

const paymentFailures = [
  {
    errorCode: 'BAD_REQUEST_ERROR',
    rootCause: 'UPI timeout',
  },
  {
    errorCode: 'GATEWAY_ERROR',
    rootCause: 'Bank unreachable',
  },
  {
    errorCode: 'BAD_REQUEST_ERROR',
    rootCause: 'Insufficient funds',
  },
  {
    errorCode: 'SERVER_ERROR',
    rootCause: 'Payment gateway down',
  },
  {
    errorCode: 'GATEWAY_ERROR',
    rootCause: 'Gateway connection timeout',
  },
  {
    errorCode: 'BAD_REQUEST_ERROR',
    rootCause: 'Invalid UPI ID',
  },
  {
    errorCode: 'SERVER_ERROR',
    rootCause: 'Payment service unavailable',
  },
  {
    errorCode: 'GATEWAY_ERROR',
    rootCause: 'Transaction declined by bank',
  },
  {
    errorCode: 'BAD_REQUEST_ERROR',
    rootCause: 'Invalid payment request',
  },
  {
    errorCode: 'GATEWAY_ERROR',
    rootCause: 'Bank server timeout',
  },
  {
    errorCode: 'SERVER_ERROR',
    rootCause: 'Payment processor unavailable',
  },
  {
    errorCode: 'BAD_REQUEST_ERROR',
    rootCause: 'Payment limit exceeded',
  },
  {
    errorCode: 'GATEWAY_ERROR',
    rootCause: 'Network error while contacting bank',
  },
  {
    errorCode: 'SERVER_ERROR',
    rootCause: 'Unexpected gateway error',
  },
  {
    errorCode: 'BAD_REQUEST_ERROR',
    rootCause: 'Invalid payment credentials',
  },
]

const mandateFailures = [
  {
    errorCode: 'BAD_REQUEST_ERROR',
    rootCause: 'Invalid mandate details',
  },
  {
    errorCode: 'GATEWAY_ERROR',
    rootCause: 'Bank rejected mandate',
  },
  {
    errorCode: 'SERVER_ERROR',
    rootCause: 'Mandate service unavailable',
  },
  {
    errorCode: 'GATEWAY_ERROR',
    rootCause: 'Mandate registration timeout',
  },
  {
    errorCode: 'BAD_REQUEST_ERROR',
    rootCause: 'Mandate limit exceeded',
  },
]

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomAmount() {
  // Amount in paise.
  //
  // Examples:
  // 49900  = ₹499
  // 149900 = ₹1,499
  // 999900 = ₹9,999

  const rupees = randomInt(199, 15000)

  // Occasionally generate a non-round amount.
  const paise = Math.random() < 0.2
    ? randomInt(1, 99)
    : 0

  return rupees * 100 + paise
}

function randomTimestamp() {
  const now = Date.now()

  const thirtyDaysAgo =
    now - 30 * 24 * 60 * 60 * 1000

  return new Date(
    randomInt(thirtyDaysAgo, now)
  )
}

function generateRazorpayId(type: SeedEventType): string {
  const prefix: Record<SeedEventType, string> = {
    PAYMENT_FAILED: 'pay',
    ORDER_ABANDONED: 'order',
    MANDATE_FAILED: 'mandate',
  }

  return `seed_${prefix[type]}_${crypto.randomUUID()}`
}

// ------------------------------------------------------------
// Event generators
// ------------------------------------------------------------

function createPaymentFailedEvent() {
  const failure = randomItem(paymentFailures)
  const amount = randomAmount()
  const createdAt = randomTimestamp()

  return {
    razorpayId: generateRazorpayId('PAYMENT_FAILED'),

    type: 'PAYMENT_FAILED',

    status: 'PENDING',

    amount,

    currency: 'INR',

    errorCode: failure.errorCode,

    rootCause: failure.rootCause,

    rawPayload: {
      source: 'seed',
      event: 'payment.failed',

      payment: {
        id: generateRazorpayId('PAYMENT_FAILED'),
        amount,
        currency: 'INR',
        status: 'failed',

        error: {
          code: failure.errorCode,
          description: failure.rootCause,
        },
      },

      seededAt: createdAt.toISOString(),
    },

    createdAt,
  }
}

function createOrderAbandonedEvent() {
  const amount = randomAmount()
  const createdAt = randomTimestamp()

  const reasons = [
    'Customer abandoned checkout',
    'Checkout session expired',
    'Customer left payment page',
    'Payment not completed',
    'Customer cancelled checkout',
    'Customer abandoned cart',
  ]

  const reason = randomItem(reasons)

  return {
    razorpayId: generateRazorpayId('ORDER_ABANDONED'),

    type: 'ORDER_ABANDONED',

    status: 'PENDING',

    amount,

    currency: 'INR',

    errorCode: null,

    rootCause: reason,

    rawPayload: {
      source: 'seed',
      event: 'order.abandoned',

      order: {
        id: generateRazorpayId('ORDER_ABANDONED'),
        amount,
        currency: 'INR',
        status: 'created',
      },

      abandonment: {
        reason,
      },

      seededAt: createdAt.toISOString(),
    },

    createdAt,
  }
}

function createMandateFailedEvent() {
  const failure = randomItem(mandateFailures)
  const amount = randomAmount()
  const createdAt = randomTimestamp()

  return {
    razorpayId: generateRazorpayId('MANDATE_FAILED'),

    type: 'MANDATE_FAILED',

    status: 'PENDING',

    amount,

    currency: 'INR',

    errorCode: failure.errorCode,

    rootCause: failure.rootCause,

    rawPayload: {
      source: 'seed',
      event: 'mandate.failed',

      mandate: {
        id: generateRazorpayId('MANDATE_FAILED'),
        amount,
        currency: 'INR',
        status: 'failed',

        error: {
          code: failure.errorCode,
          description: failure.rootCause,
        },
      },

      seededAt: createdAt.toISOString(),
    },

    createdAt,
  }
}

// ------------------------------------------------------------
// Shuffle
// ------------------------------------------------------------

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))

    ;[array[i], array[j]] = [array[j], array[i]]
  }

  return array
}

// ------------------------------------------------------------
// Main seed function
// ------------------------------------------------------------

async function main() {
  console.log('Starting database seed...\n')

  const events = []

  // 40 PAYMENT_FAILED
  for (let i = 0; i < 40; i++) {
    events.push(createPaymentFailedEvent())
  }

  // 12 ORDER_ABANDONED
  for (let i = 0; i < 12; i++) {
    events.push(createOrderAbandonedEvent())
  }

  // 8 MANDATE_FAILED
  for (let i = 0; i < 8; i++) {
    events.push(createMandateFailedEvent())
  }

  // Randomize ordering
  shuffle(events)

  // ----------------------------------------------------------
  // Insert events
  // ----------------------------------------------------------

  const result = await prisma.event.createMany({
    data: events,
  })

  // ----------------------------------------------------------
  // Summary
  // ----------------------------------------------------------

  const summary = events.reduce<Record<SeedEventType, number>>((acc, event) => {
    const eventType = event.type as SeedEventType
    acc[eventType] = (acc[eventType] || 0) + 1
    return acc
  }, {
    PAYMENT_FAILED: 0,
    ORDER_ABANDONED: 0,
    MANDATE_FAILED: 0,
  })

  const totalAmount = events.reduce(
    (sum, event) => sum + event.amount,
    0
  )

  console.log(`Created ${result.count} events\n`)

  console.log('Event breakdown:')
  console.log(
    `   PAYMENT_FAILED:  ${summary.PAYMENT_FAILED || 0}`
  )
  console.log(
    `   ORDER_ABANDONED: ${summary.ORDER_ABANDONED || 0}`
  )
  console.log(
    `   MANDATE_FAILED:  ${summary.MANDATE_FAILED || 0}`
  )
  console.log(`   ----------------`)
  console.log(`   TOTAL:           ${events.length}`)

  console.log(
    `\nTotal affected amount: ₹${(
      totalAmount / 100
    ).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  )

  console.log('\nSeed completed successfully!')
}

// ------------------------------------------------------------
// Execute
// ------------------------------------------------------------

main()
  .catch((error) => {
    console.error('\nSeed failed:')
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })