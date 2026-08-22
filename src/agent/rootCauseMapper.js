// Maps Razorpay error codes + descriptions to structured root causes
// Each entry tells the agent: what happened, is it retryable, what's the right intervention class

const rootCauseMap = [
  // --- BAD_REQUEST_ERROR ---
  {
    match: { errorCode: 'BAD_REQUEST_ERROR', keywords: ['insufficient', 'funds', 'balance'] },
    rootCause: 'INSUFFICIENT_FUNDS',
    retryable: false,
    interventionHint: 'DUNNING_MESSAGE', // nudge customer to use different payment method
    explanation: 'Customer account lacks sufficient balance. Retry will fail — prompt alternate method.',
  },
  {
    match: { errorCode: 'BAD_REQUEST_ERROR', keywords: ['upi', 'timeout', 'expired'] },
    rootCause: 'UPI_TIMEOUT',
    retryable: true,
    interventionHint: 'PAYMENT_LINK',
    explanation: 'UPI request timed out. Customer likely did not respond in time. Resend payment link.',
  },
  {
    match: { errorCode: 'BAD_REQUEST_ERROR', keywords: ['invalid', 'upi', 'vpa'] },
    rootCause: 'INVALID_UPI_ID',
    retryable: false,
    interventionHint: 'DUNNING_MESSAGE',
    explanation: 'UPI VPA is invalid or does not exist. Need customer to provide correct UPI ID.',
  },
  {
    match: { errorCode: 'BAD_REQUEST_ERROR', keywords: ['limit', 'exceeded', 'daily'] },
    rootCause: 'PAYMENT_LIMIT_EXCEEDED',
    retryable: false,
    interventionHint: 'DUNNING_MESSAGE',
    explanation: 'Customer hit UPI/bank daily transaction limit. Suggest trying after midnight or different method.',
  },
  {
    match: { errorCode: 'BAD_REQUEST_ERROR', keywords: ['mandate', 'invalid', 'details'] },
    rootCause: 'INVALID_MANDATE',
    retryable: false,
    interventionHint: 'ESCALATE',
    explanation: 'Mandate details are malformed. Requires manual intervention to re-register.',
  },
  {
    match: { errorCode: 'BAD_REQUEST_ERROR', keywords: [] },
    rootCause: 'BAD_REQUEST_GENERIC',
    retryable: false,
    interventionHint: 'DUNNING_MESSAGE',
    explanation: 'Generic bad request — likely customer-side issue. Prompt to retry with correct details.',
  },

  // --- GATEWAY_ERROR ---
  {
    match: { errorCode: 'GATEWAY_ERROR', keywords: ['timeout', 'connection', 'network'] },
    rootCause: 'GATEWAY_TIMEOUT',
    retryable: true,
    interventionHint: 'RETRY',
    explanation: 'Gateway timed out — transient infrastructure issue. Safe to retry automatically.',
  },
  {
    match: { errorCode: 'GATEWAY_ERROR', keywords: ['bank', 'declined', 'rejected'] },
    rootCause: 'BANK_DECLINED',
    retryable: false,
    interventionHint: 'DUNNING_MESSAGE',
    explanation: 'Bank hard-declined the transaction. Retry will likely fail — prompt alternate method.',
  },
  {
    match: { errorCode: 'GATEWAY_ERROR', keywords: ['unreachable', 'server', 'bank'] },
    rootCause: 'BANK_UNREACHABLE',
    retryable: true,
    interventionHint: 'RETRY',
    explanation: 'Bank server temporarily unreachable. Transient — safe to retry after delay.',
  },
  {
    match: { errorCode: 'GATEWAY_ERROR', keywords: ['mandate', 'registration', 'timeout'] },
    rootCause: 'MANDATE_TIMEOUT',
    retryable: true,
    interventionHint: 'PAYMENT_LINK',
    explanation: 'Mandate registration timed out. Re-initiate mandate flow for customer.',
  },
  {
    match: { errorCode: 'GATEWAY_ERROR', keywords: [] },
    rootCause: 'GATEWAY_GENERIC',
    retryable: true,
    interventionHint: 'RETRY',
    explanation: 'Generic gateway error — usually transient. Retry once before escalating.',
  },

  // --- SERVER_ERROR ---
  {
    match: { errorCode: 'SERVER_ERROR', keywords: ['unavailable', 'service', 'processor'] },
    rootCause: 'PROCESSOR_DOWN',
    retryable: true,
    interventionHint: 'RETRY',
    explanation: 'Payment processor temporarily down. Queue for retry when service recovers.',
  },
  {
    match: { errorCode: 'SERVER_ERROR', keywords: ['unexpected', 'gateway'] },
    rootCause: 'UNEXPECTED_GATEWAY_ERROR',
    retryable: true,
    interventionHint: 'RETRY',
    explanation: 'Unexpected gateway-side error. Retry once — escalate if it persists.',
  },
  {
    match: { errorCode: 'SERVER_ERROR', keywords: [] },
    rootCause: 'SERVER_GENERIC',
    retryable: true,
    interventionHint: 'RETRY',
    explanation: 'Generic server error. Likely transient — retry with backoff.',
  },

  // --- ORDER_ABANDONED (no errorCode) ---
  {
    match: { errorCode: null, keywords: ['abandoned', 'cancelled', 'left', 'expired'] },
    rootCause: 'CHECKOUT_ABANDONED',
    retryable: false,
    interventionHint: 'DUNNING_MESSAGE',
    explanation: 'Customer left checkout without paying. Send recovery message with direct payment link.',
  },

  // --- MANDATE specific ---
  {
    match: { errorCode: 'MANDATE_HALTED', keywords: [] },
    rootCause: 'MANDATE_HALTED',
    retryable: false,
    interventionHint: 'ESCALATE',
    explanation: 'Subscription mandate halted by bank or Razorpay. Requires re-registration.',
  },
  {
    match: { errorCode: 'MANDATE_CANCELLED', keywords: [] },
    rootCause: 'MANDATE_CANCELLED',
    retryable: false,
    interventionHint: 'ESCALATE',
    explanation: 'Mandate was cancelled. Customer needs to re-subscribe.',
  },
]

// Fallback if nothing matches
const FALLBACK = {
  rootCause: 'UNKNOWN',
  retryable: false,
  interventionHint: 'ESCALATE',
  explanation: 'Could not determine root cause. Flagged for manual review.',
}

/**
 * Given an event's errorCode and a description string,
 * returns structured root cause data.
 */
export function mapRootCause(errorCode, description = '') {
  const descLower = description.toLowerCase()

  for (const entry of rootCauseMap) {
    const codeMatches = entry.match.errorCode === errorCode

    const keywordsMatch =
      entry.match.keywords.length === 0 ||
      entry.match.keywords.some(k => descLower.includes(k))

    if (codeMatches && keywordsMatch) {
      return {
        rootCause: entry.rootCause,
        retryable: entry.retryable,
        interventionHint: entry.interventionHint,
        explanation: entry.explanation,
      }
    }
  }

  return FALLBACK
}