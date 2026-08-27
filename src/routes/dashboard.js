import { Router } from 'express'
import { loadMetricsData } from './metrics.js'
import { prisma } from '../db/client.js'

const router = Router()

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function truncate(value, length) {
  const text = String(value ?? '')
  return text.length > length ? `${text.slice(0, length - 1)}…` : text
}

function renderCard(label, value, sublabel = '') {
  return `
    <div class="card">
      <div class="card-label">${escapeHtml(label)}</div>
      <div class="card-value">${escapeHtml(value)}</div>
      ${sublabel ? `<div class="card-subvalue">${escapeHtml(sublabel)}</div>` : ''}
    </div>
  `
}

router.get('/', async (req, res) => {
  const [metricsData, recentInterventions] = await Promise.all([
    loadMetricsData(),
    prisma.intervention.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        type: true,
        reasoning: true,
        status: true,
        executedAt: true,
        event: {
          select: {
            id: true,
          },
        },
      },
    }),
  ])

  const totalEvents = metricsData.totalEvents
  const amountAtRisk = `₹${metricsData.totalAmountAtRisk.rupees.toFixed(2)}`
  const amountRecovered = `₹${metricsData.totalAmountRecovered.rupees.toFixed(2)}`
  const recoveryRate = `${metricsData.recoveryRate.toFixed(2)}%`

  const recentRows = recentInterventions.map((intervention) => `
    <tr>
      <td title="${escapeHtml(intervention.event.id)}">${escapeHtml(truncate(intervention.event.id, 12))}</td>
      <td>${escapeHtml(intervention.type)}</td>
      <td title="${escapeHtml(intervention.reasoning)}">${escapeHtml(truncate(intervention.reasoning, 60))}</td>
      <td>${escapeHtml(intervention.status)}</td>
      <td>${escapeHtml(intervention.executedAt ? new Date(intervention.executedAt).toLocaleString() : '—')}</td>
    </tr>
  `).join('')

  const rootCauseRows = metricsData.topRootCauses.map((rootCause) => `
    <tr>
      <td>${escapeHtml(rootCause.rootCause ?? 'Unknown')}</td>
      <td>${escapeHtml(rootCause.count)}</td>
    </tr>
  `).join('')

  const html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="30" />
  <title>RecoverIQ Dashboard</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0f14;
      --panel: #111824;
      --panel-2: #0f1621;
      --text: #e7edf5;
      --muted: #8ea0b5;
      --line: #223044;
      --accent: #7dd3fc;
      --good: #34d399;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at top left, rgba(125, 211, 252, 0.12), transparent 30%),
        radial-gradient(circle at top right, rgba(52, 211, 153, 0.08), transparent 28%),
        var(--bg);
      color: var(--text);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    }
    .wrap {
      max-width: 1400px;
      margin: 0 auto;
      padding: 32px 24px 48px;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: end;
      margin-bottom: 28px;
    }
    h1 {
      margin: 0;
      font-size: clamp(28px, 4vw, 46px);
      letter-spacing: -0.04em;
    }
    .subtle {
      color: var(--muted);
      font-size: 14px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .card {
      background: linear-gradient(180deg, rgba(17, 24, 36, 0.96), rgba(15, 22, 33, 0.96));
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28);
      min-height: 124px;
    }
    .card-label { color: var(--muted); font-size: 13px; margin-bottom: 12px; }
    .card-value { font-size: 30px; font-weight: 700; letter-spacing: -0.04em; }
    .card-subvalue { color: var(--good); margin-top: 8px; font-size: 14px; }
    .grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 18px;
      align-items: start;
    }
    .panel {
      background: rgba(17, 24, 36, 0.9);
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
    }
    .panel h2 {
      margin: 0;
      padding: 16px 18px;
      font-size: 16px;
      border-bottom: 1px solid var(--line);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      text-align: left;
      padding: 12px 18px;
      border-bottom: 1px solid rgba(34, 48, 68, 0.75);
      vertical-align: top;
      font-size: 13px;
    }
    th { color: var(--muted); font-weight: 600; }
    tr:last-child td { border-bottom: 0; }
    td { color: var(--text); }
    .note { color: var(--muted); margin-top: 14px; font-size: 13px; }
    @media (max-width: 1100px) {
      .cards, .grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 720px) {
      .wrap { padding: 20px 14px 34px; }
      header, .grid, .cards { grid-template-columns: 1fr; display: grid; }
      .cards { gap: 12px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>RecoverIQ — Revenue Recovery Dashboard</h1>
        <div class="subtle">Auto-refreshes every 30 seconds</div>
      </div>
      <div class="subtle">Recovered outcomes and live recovery health</div>
    </header>

    <section class="cards">
      ${renderCard('Total Events', totalEvents.toString())}
      ${renderCard('Amount at Risk (₹)', amountAtRisk, `${metricsData.totalAmountAtRisk.paise.toLocaleString()} paise`)}
      ${renderCard('Amount Recovered (₹)', amountRecovered, `${metricsData.totalAmountRecovered.paise.toLocaleString()} paise`)}
      ${renderCard('Recovery Rate (%)', recoveryRate)}
    </section>

    <section class="grid">
      <div class="panel">
        <h2>Recent Interventions</h2>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Type</th>
              <th>Reasoning</th>
              <th>Status</th>
              <th>Executed At</th>
            </tr>
          </thead>
          <tbody>
            ${recentRows || '<tr><td colspan="5">No interventions found</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="panel">
        <h2>Top Root Causes</h2>
        <table>
          <thead>
            <tr>
              <th>Root Cause</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            ${rootCauseRows || '<tr><td colspan="2">No root causes recorded</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    <div class="note">Intervention success rates are available via the /metrics endpoint.</div>
  </div>
</body>
</html>
  `

  res.send(html)
})

export default router