import { Building2 } from 'lucide-react';
import type { KbSupplier } from '../../lib/kb/kbTypes';

interface KbSupplierChipProps {
  supplier: KbSupplier;
  compact?: boolean;
}

export function KbSupplierChip({ supplier, compact }: KbSupplierChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/70 bg-emerald-50/60 text-emerald-800 font-medium ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
      title={supplier.name}
    >
      <Building2 className="w-3 h-3" />
      <span>{supplier.name}</span>
    </span>
  );
}
