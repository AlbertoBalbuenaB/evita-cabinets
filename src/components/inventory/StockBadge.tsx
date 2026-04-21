interface StockBadgeProps {
  stock_quantity: number;
  min_stock_level: number;
}

export function StockBadge({ stock_quantity, min_stock_level }: StockBadgeProps) {
  if (stock_quantity === 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-red-bg text-status-red-fg">
        No Stock
      </span>
    );
  }

  if (stock_quantity <= min_stock_level) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-amber-bg text-status-amber-fg">
        Low Stock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-emerald-bg text-status-emerald-fg">
      OK
    </span>
  );
}
