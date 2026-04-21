import { DollarSign, Clock, Warehouse, CreditCard } from 'lucide-react';
import { formatCurrency } from '../../lib/calculations';
import type { ProjectPurchaseItem } from '../../types';

interface PurchaseSummaryCardsProps {
  items: ProjectPurchaseItem[];
}

export function PurchaseSummaryCards({ items }: PurchaseSummaryCardsProps) {
  const estimatedTotal = items.reduce((sum, i) => sum + (i.subtotal ?? i.quantity * (i.price ?? 0)), 0);
  const pendingCount = items.filter((i) => i.status === 'Ordered' || i.status === 'In Transit').length;
  const inWarehouseCount = items.filter((i) => i.status === 'In Warehouse').length;
  const paidCount = items.filter((i) => i.status === 'Paid').length;

  const cards = [
    { label: 'Estimated Total', value: formatCurrency(estimatedTotal), icon: DollarSign, color: 'text-fg-700', bg: 'bg-surf-app border-border-soft' },
    { label: 'Pending', value: String(pendingCount), icon: Clock, color: 'text-status-amber-fg', bg: 'bg-status-amber-bg border-status-amber-brd' },
    { label: 'In Warehouse', value: String(inWarehouseCount), icon: Warehouse, color: 'text-status-emerald-fg', bg: 'bg-status-emerald-bg border-status-emerald-brd' },
    { label: 'Paid', value: String(paidCount), icon: CreditCard, color: 'text-accent-text', bg: 'bg-accent-tint-soft border-accent-tint-border' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${card.bg}`}>
            <Icon className={`h-5 w-5 ${card.color} flex-shrink-0`} />
            <div>
              <p className="text-xs text-fg-400 font-medium">{card.label}</p>
              <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
