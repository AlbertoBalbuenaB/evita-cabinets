import type { ProjectPurchaseItemWithDetails } from '../types';
import { formatCurrency } from '../lib/calculations';
import { format } from 'date-fns';

const PRIORITY_COLOR: Record<string, string> = {
  Urgent: '#dc2626',
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#22c55e',
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  Ordered:        { bg: '#f1f5f9', text: '#475569' },
  Pending:        { bg: '#fef9c3', text: '#854d0e' },
  Paid:           { bg: '#dbeafe', text: '#1d4ed8' },
  'In Transit':   { bg: '#fef3c7', text: '#92400e' },
  'In Warehouse': { bg: '#dcfce7', text: '#166534' },
  Delay:          { bg: '#ffedd5', text: '#9a3412' },
  Return:         { bg: '#fee2e2', text: '#991b1b' },
};

export function printPurchaseList(
  items: ProjectPurchaseItemWithDetails[],
  projectName: string,
  statusFilter: string,
  priorityFilter: string,
  teamMembers: { id: string; name: string }[]
) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to print the purchase list.');
    return;
  }

  const total = items.reduce((sum, i) => sum + (i.subtotal ?? i.quantity * (i.price ?? 0)), 0);
  const dateStr = format(new Date(), 'MMMM d, yyyy');

  const filterInfo = [
    statusFilter !== 'All' ? `Status: ${statusFilter}` : null,
    priorityFilter !== 'All' ? `Priority: ${priorityFilter}` : null,
  ].filter(Boolean).join(' · ');

  function memberName(id: string | null): string {
    if (!id) return '—';
    return teamMembers.find((m) => m.id === id)?.name ?? '—';
  }

  const rows = items.map((item) => {
    const status = item.status ?? 'Ordered';
    const priority = item.priority ?? 'Medium';
    const sc = STATUS_COLOR[status] ?? STATUS_COLOR['Ordered'];
    const pColor = PRIORITY_COLOR[priority] ?? PRIORITY_COLOR['Medium'];
    const deadline = item.deadline ? format(new Date(item.deadline + 'T00:00:00'), 'MMM d, yyyy') : '—';
    const provider = (item as any).supplier?.name ?? '—';
    return `
      <tr>
        <td>${item.concept || '—'}</td>
        <td class="num">${item.quantity}</td>
        <td>${item.unit ?? '—'}</td>
        <td class="num">${formatCurrency(item.price ?? 0)}</td>
        <td class="num">${formatCurrency(item.subtotal ?? item.quantity * (item.price ?? 0))}</td>
        <td>
          <span class="dot" style="background:${pColor}"></span>
          ${priority}
        </td>
        <td>
          <span class="badge" style="background:${sc.bg};color:${sc.text}">${status}</span>
        </td>
        <td>${deadline}</td>
        <td>${memberName(item.assigned_to_member_id)}</td>
        <td>${provider}</td>
      </tr>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Purchase List — ${projectName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 24px 32px; }
    h1 { font-size: 18px; font-weight: 700; color: #0f172a; }
    .meta { font-size: 10px; color: #64748b; margin-top: 2px; }
    .filters { font-size: 10px; color: #94a3b8; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    thead tr { border-bottom: 2px solid #e2e8f0; }
    th { text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
    th.num, td.num { text-align: right; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 500; }
    .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    tfoot td { font-weight: 700; border-top: 2px solid #e2e8f0; padding-top: 8px; }
    @media print {
      body { padding: 12px 20px; }
      @page { margin: 15mm 15mm; }
    }
  </style>
</head>
<body>
  <h1>${projectName}</h1>
  <p class="meta">Purchase List · Printed ${dateStr}</p>
  ${filterInfo ? `<p class="filters">Filters: ${filterInfo}</p>` : ''}
  <table>
    <thead>
      <tr>
        <th>Concept</th>
        <th class="num">Qty</th>
        <th>Unit</th>
        <th class="num">Price</th>
        <th class="num">Subtotal</th>
        <th>Priority</th>
        <th>Status</th>
        <th>Deadline</th>
        <th>Assigned</th>
        <th>Provider</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="text-align:right;font-size:11px;color:#475569;">Total</td>
        <td class="num">${formatCurrency(total)}</td>
        <td colspan="4"></td>
      </tr>
    </tfoot>
  </table>
  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
