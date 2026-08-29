import 'dotenv/config'

import { logger } from '../utils/logger.js'


const SYSTEM_PROMPT = `You are RecoverIQ, a revenue recovery agent for a Razorpay merchant.

You will be given a failed payment event. Your job is to decide the single best recovery intervention.

ALLOWED interventions (pick exactly one):
- PAYMENT_LINK: Resend a new payment link to the customer
- RETRY: Automatically retry the payment (only for transient/gateway errors)
- DUNNING_MESSAGE: Send a message asking customer to retry with different method
- ESCALATE: Flag for human review — do not attempt automated recovery

RULES you must never break:
- Never select RETRY for insufficient funds or invalid UPI — it will fail again
- Never select RETRY if retryCount >= 3
- Never attempt any intervention if optedOut is true — always ESCALATE
- Never select RETRY for ORDER_ABANDONED — there is no payment to retry
- Prefer PAYMENT_LINK over DUNNING_MESSAGE when the customer just needs a nudge
- ESCALATE if rootCause is UNKNOWN

Respond ONLY in this exact JSON format. Do not think out loud. Do not explain. Do not use markdown. Output the raw JSON object and nothing else:
{
  "intervention": "PAYMENT_LINK" | "RETRY" | "DUNNING_MESSAGE" | "ESCALATE",
  "reasoning": "max 10 words explaining why"
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}
You must output ONLY the JSON object. No thinking. No analysis. No explanation. Start your response with { and end with }. Any response not starting with { will be rejected.  
`

export async function decideIntervention(event, stoppingRule) {
  const userMessage = `
Event ID: ${event.id}
Type: ${event.type}
Amount: ₹${(event.amount / 100).toFixed(2)}
Error Code: ${event.errorCode || 'none'}
Root Cause: ${event.rootCause}
Intervention Hint: ${event.rawPayload?.interventionHint || 'none'}
Retry Count: ${stoppingRule?.retryCount ?? 0}
Opted Out: ${stoppingRule?.optedOut ?? false}
Cooldown Active: ${
    stoppingRule?.cooldownUntil
      ? new Date(stoppingRule.cooldownUntil) > new Date()
      : false
  }
Raw Description: ${
    event.rawPayload?.desc ||
    event.rawPayload?.payment?.error?.description ||
    event.rawPayload?.abandonment?.reason ||
    'none'
  }
`.trim()

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'RecoverIQ',
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-nano-30b-a3b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
    }),
  })

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content

    if (!text) throw new Error(`Openrouter returned no content: ${JSON.stringify(data)}`)
    console.log('[DecisionEngine] Raw Openrouter text:', JSON.stringify(text))

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object found in response')

    const parsed = JSON.parse(jsonMatch[0])

    const validInterventions = ['PAYMENT_LINK', 'RETRY', 'DUNNING_MESSAGE', 'ESCALATE']
    if (!validInterventions.includes(parsed.intervention)) {
      throw new Error(`Invalid intervention: ${parsed.intervention}`)
    }

    return parsed

  } catch (err) {
    logger.error('[DecisionEngine] Openrouter request failed:', { error: err.message })
    return {
      intervention: 'ESCALATE',
      reasoning: 'LLM request failed — defaulting to human review',
      confidence: 'LOW',
    }
  }
}
