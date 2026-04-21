import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import type { KbSupplier } from '../../lib/kb/kbTypes';
import { pickText, useLocaleStore } from '../../lib/localeStore';

interface KbSupplierChipProps {
  supplier: KbSupplier;
  compact?: boolean;
  as?: 'link' | 'span';
}

export function KbSupplierChip({ supplier, compact, as = 'link' }: KbSupplierChipProps) {
  const { locale } = useLocaleStore();
  const name = pickText(supplier, 'name', locale);
  const cls = `inline-flex items-center gap-1.5 rounded-lg border border-status-emerald-brd bg-status-emerald-bg text-status-emerald-fg font-medium ${
    compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
  }`;
  const body = (
    <>
      <Building2 className="w-3 h-3" />
      <span>{name}</span>
    </>
  );
  if (as === 'link') {
    return (
      <Link to={`/kb/suppliers/${supplier.slug}`} className={`${cls} hover:bg-status-emerald-bg transition`} title={name}>
        {body}
      </Link>
    );
  }
  return (
    <span className={cls} title={name}>
      {body}
    </span>
  );
}
