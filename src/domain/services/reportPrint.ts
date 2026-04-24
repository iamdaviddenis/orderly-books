import { format } from 'date-fns'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatSignedCurrency(amount: number, formatCurrency: (n: number) => string) {
  return `${amount < 0 ? '-' : ''}${formatCurrency(Math.abs(amount))}`
}

export function printMonthlyReportToPdf(input: {
  monthLabel: string
  incomeTzs: number
  targets: { t1: number; t2: number; t3: number; t4: number }
  actuals: { t1: number; t2: number; t3: number; t4: number }
  transactions: Array<{
    date: string
    tier: number
    payee: string
    category: string
    amountTzs: number
    notes?: string
  }>
}) {
  const w = window.open('about:blank', '_blank')
  if (!w) {
    window.alert('Popup blocked. Please allow popups to export PDF, or use your browser’s Print → Save as PDF.')
    return
  }

  const fmtTzs = (n: number) =>
    new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(Math.trunc(n))

  const targetTotal = input.targets.t1 + input.targets.t2 + input.targets.t3 + input.targets.t4
  const actualTotal = input.actuals.t1 + input.actuals.t2 + input.actuals.t3 + input.actuals.t4
  const variance = targetTotal - actualTotal
  const remainingCash = input.incomeTzs - actualTotal

  const categoryTotals = new Map<string, number>()
  for (const tx of input.transactions) {
    categoryTotals.set(tx.category, (categoryTotals.get(tx.category) ?? 0) + tx.amountTzs)
  }
  const topCategories = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const tierRows = [
    { label: 'Tier 1', theme: 'critical', target: input.targets.t1, actual: input.actuals.t1 },
    { label: 'Tier 2', theme: 'growth', target: input.targets.t2, actual: input.actuals.t2 },
    { label: 'Tier 3', theme: 'warning', target: input.targets.t3, actual: input.actuals.t3 },
    { label: 'Tier 4', theme: 'locked', target: input.targets.t4, actual: input.actuals.t4 },
  ]

  const tierSummaryRows = tierRows
    .map((row) => {
      const varianceTzs = row.target - row.actual
      const achievementPct = row.target > 0 ? Math.round((row.actual / row.target) * 100) : 0
      return `<tr>
        <td><span class="pill ${row.theme}">${escapeHtml(row.label)}</span></td>
        <td class="right">${escapeHtml(fmtTzs(row.target))}</td>
        <td class="right">${escapeHtml(fmtTzs(row.actual))}</td>
        <td class="right ${varianceTzs < 0 ? 'negative' : 'positive'}">${escapeHtml(formatSignedCurrency(varianceTzs, fmtTzs))}</td>
        <td class="right">${row.target > 0 ? `${achievementPct}%` : '—'}</td>
      </tr>`
    })
    .join('\n')

  const categoryRows = topCategories
    .map(
      ([name, amount]) => `<tr>
        <td>${escapeHtml(name)}</td>
        <td class="right">${escapeHtml(fmtTzs(amount))}</td>
      </tr>`,
    )
    .join('\n')

  const rows = input.transactions
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((t) => {
      const date = escapeHtml(format(new Date(t.date), 'MMM d, yyyy'))
      const tier = `T${t.tier}`
      const payee = escapeHtml(t.payee)
      const category = escapeHtml(t.category)
      const amount = escapeHtml(fmtTzs(t.amountTzs))
      const notes = escapeHtml(t.notes ?? '')
      return `<tr>
        <td>${date}</td>
        <td>${tier}</td>
        <td>${payee}</td>
        <td>${category}</td>
        <td class="right">${amount}</td>
        <td>${notes}</td>
      </tr>`
    })
    .join('\n')

  const summaryNote =
    remainingCash >= 0
      ? 'Spending stayed within logged income for the month.'
      : 'Logged spending exceeded logged income. Review transfers, obligations, or missing income entries.'

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.monthLabel)} - Orderly Books Monthly Report</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f3ec;
        --panel: #fffaf4;
        --ink: #1b2438;
        --muted: #667085;
        --line: #e7dac6;
        --critical: #d44b43;
        --growth: #2a995c;
        --warning: #d69f2a;
        --locked: #7a88a4;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 28px;
        background:
          radial-gradient(circle at top left, rgba(214, 159, 42, 0.18), transparent 22%),
          radial-gradient(circle at top right, rgba(42, 153, 92, 0.1), transparent 20%),
          var(--bg);
        color: var(--ink);
        font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      }
      .sheet {
        max-width: 1080px;
        margin: 0 auto;
      }
      .hero {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 16px;
        margin-bottom: 18px;
      }
      .hero-card, .card {
        background: rgba(255, 250, 244, 0.96);
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 18px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .mark {
        width: 46px;
        height: 46px;
        border-radius: 16px;
        background: var(--ink);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        letter-spacing: 0.06em;
      }
      h1 {
        margin: 0;
        font-size: 30px;
        line-height: 1.05;
      }
      h2 {
        margin: 0 0 12px 0;
        font-size: 16px;
      }
      .subtle {
        color: var(--muted);
        font-size: 12px;
      }
      .metric-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }
      .metric {
        background: rgba(255,255,255,0.62);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 14px;
      }
      .metric .label {
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .metric .value {
        margin-top: 8px;
        font-size: 22px;
        font-weight: 700;
      }
      .sections {
        display: grid;
        grid-template-columns: 1.3fr 0.7fr;
        gap: 16px;
        margin-bottom: 16px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 5px 10px;
        font-size: 11px;
        font-weight: 700;
        border: 1px solid currentColor;
      }
      .critical { color: var(--critical); background: rgba(212, 75, 67, 0.10); }
      .growth { color: var(--growth); background: rgba(42, 153, 92, 0.10); }
      .warning { color: var(--warning); background: rgba(214, 159, 42, 0.12); }
      .locked { color: var(--locked); background: rgba(122, 136, 164, 0.12); }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      th, td {
        padding: 10px 8px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      th {
        color: var(--muted);
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: left;
      }
      .right { text-align: right; white-space: nowrap; }
      .positive { color: var(--growth); }
      .negative { color: var(--critical); }
      .note {
        margin-top: 12px;
        border-radius: 16px;
        background: rgba(255,255,255,0.6);
        border: 1px solid var(--line);
        padding: 12px 14px;
        font-size: 12px;
        color: var(--muted);
      }
      .statement.card {
        padding-top: 14px;
      }
      .footer {
        margin-top: 18px;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        color: var(--muted);
        font-size: 11px;
      }
      @media print {
        body { padding: 16px; background: white; }
        .sheet { max-width: none; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <section class="hero">
        <div class="hero-card">
          <div class="brand">
            <div class="mark">OB</div>
            <div>
              <div class="subtle">Orderly Books</div>
              <h1>${escapeHtml(input.monthLabel)} Report</h1>
            </div>
          </div>
          <div class="note">${escapeHtml(summaryNote)}</div>
        </div>
        <div class="hero-card">
          <h2>Monthly Snapshot</h2>
          <div class="subtle">Goals, actual spending, and remaining cash for the month.</div>
          <div style="margin-top: 14px; display: grid; gap: 8px;">
            <div style="display:flex; justify-content:space-between; gap:12px;"><span class="subtle">Income</span><strong>${escapeHtml(fmtTzs(input.incomeTzs))}</strong></div>
            <div style="display:flex; justify-content:space-between; gap:12px;"><span class="subtle">Targets total</span><strong>${escapeHtml(fmtTzs(targetTotal))}</strong></div>
            <div style="display:flex; justify-content:space-between; gap:12px;"><span class="subtle">Actual spent</span><strong>${escapeHtml(fmtTzs(actualTotal))}</strong></div>
            <div style="display:flex; justify-content:space-between; gap:12px;"><span class="subtle">Variance</span><strong class="${variance < 0 ? 'negative' : 'positive'}">${escapeHtml(formatSignedCurrency(variance, fmtTzs))}</strong></div>
            <div style="display:flex; justify-content:space-between; gap:12px;"><span class="subtle">Remaining cash</span><strong class="${remainingCash < 0 ? 'negative' : 'positive'}">${escapeHtml(formatSignedCurrency(remainingCash, fmtTzs))}</strong></div>
          </div>
        </div>
      </section>

      <section class="metric-grid">
        <div class="metric">
          <div class="label">Tier 1</div>
          <div class="value">${escapeHtml(fmtTzs(input.actuals.t1))}</div>
        </div>
        <div class="metric">
          <div class="label">Tier 2</div>
          <div class="value">${escapeHtml(fmtTzs(input.actuals.t2))}</div>
        </div>
        <div class="metric">
          <div class="label">Tier 3</div>
          <div class="value">${escapeHtml(fmtTzs(input.actuals.t3))}</div>
        </div>
        <div class="metric">
          <div class="label">Tier 4</div>
          <div class="value">${escapeHtml(fmtTzs(input.actuals.t4))}</div>
        </div>
      </section>

      <section class="sections">
        <div class="card">
          <h2>Tier Summary</h2>
          <table>
            <thead>
              <tr>
                <th>Tier</th>
                <th class="right">Target</th>
                <th class="right">Actual</th>
                <th class="right">Variance</th>
                <th class="right">Progress</th>
              </tr>
            </thead>
            <tbody>
              ${tierSummaryRows}
            </tbody>
          </table>
        </div>
        <div class="card">
          <h2>Top Categories</h2>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th class="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${categoryRows || `<tr><td colspan="2" class="subtle">No transactions logged for this month.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="statement card">
        <h2>Statement</h2>
        <div class="subtle">Every logged expense included in the monthly total.</div>
        <table style="margin-top: 10px;">
          <thead>
            <tr>
              <th style="width: 92px;">Date</th>
              <th style="width: 50px;">Tier</th>
              <th>Payee</th>
              <th style="width: 160px;">Category</th>
              <th class="right" style="width: 120px;">Amount</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="6" class="subtle">No transactions logged for this month.</td></tr>`}
          </tbody>
        </table>
      </section>

      <div class="footer">
        <div>Generated by Orderly Books</div>
        <div>Use browser Print -> Save as PDF</div>
      </div>
    </div>
  </body>
</html>`

  const tryPrint = () => {
    try {
      w.focus()
      w.print()
    } catch {
      // ignore
    }
  }

  try {
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    w.location.href = blobUrl
    w.addEventListener(
      'load',
      () => {
        window.setTimeout(tryPrint, 250)
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2_000)
      },
      { once: true },
    )
  } catch {
    try {
      w.document.open()
      w.document.write(html)
      w.document.close()
      window.setTimeout(tryPrint, 350)
    } catch {
      window.alert('Unable to render the printable report. Try Export PDF in a normal Chrome window, or use Print → Save as PDF.')
    }
  }
}
