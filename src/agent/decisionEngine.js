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
  "reasoning": "one clear sentence explaining why this intervention was chosen",
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}
You must output ONLY the JSON object. No thinking. No analysis. No explanation. Start your response with { and end with }. Any response not starting with { will be rejected.  
`

const MODELS = ['nvidia/nemotron-3-ultra-550b-a55b:free', 'stealth/ox-alpha',]

async function callLLM(model, userMessage) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'RecoverIQ',
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
    }),
  })
  return response.json()
}

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
Cooldown Active: ${stoppingRule?.cooldownUntil ? new Date(stoppingRule.cooldownUntil) > new Date() : false}
Raw Description: ${
    event.rawPayload?.desc ||
    event.rawPayload?.payment?.error?.description ||
    event.rawPayload?.abandonment?.reason ||
    'none'
  }
`.trim()

  let data
    for (const model of MODELS) {
      data = await callLLM(model, userMessage)
      if (data.choices?.[0]?.message?.content) break
      logger.warn(`[DecisionEngine] Model ${model} failed, trying next...`)
    }

  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error(`All models failed: ${JSON.stringify(data)}`)


  try {
    console.log('[DecisionEngine] Raw LLM response:', text)
    // replace your current JSON.parse block with this
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object found in response')

    const parsed = JSON.parse(jsonMatch[0])

    // validate shape
    const validInterventions = ['PAYMENT_LINK', 'RETRY', 'DUNNING_MESSAGE', 'ESCALATE']
    if (!validInterventions.includes(parsed.intervention)) {
      throw new Error(`Invalid intervention: ${parsed.intervention}`)
    }

    return parsed
  } catch (err) {
    console.error('[DecisionEngine] Failed to parse LLM response:', text)
    // safe fallback — never crash, always escalate
    return {
      intervention: 'ESCALATE',
      reasoning: 'LLM response could not be parsed — defaulting to human review',
      confidence: 'LOW',
    }
  }
}