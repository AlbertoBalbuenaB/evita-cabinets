import type { KbCategory } from '../../lib/kb/kbTypes';
import { pickText, useLocaleStore } from '../../lib/localeStore';

interface KbCategoryChipProps {
  category: KbCategory | undefined;
  onClick?: () => void;
  active?: boolean;
}

export function KbCategoryChip({ category, onClick, active }: KbCategoryChipProps) {
  const { locale } = useLocaleStore();
  if (!category) return null;
  const baseCls = active
    ? 'bg-indigo-600 text-white border-indigo-600'
    : 'glass-white text-slate-700 hover:bg-indigo-50';
  const name = pickText(category, 'name', locale);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200/70 text-xs font-medium transition ${baseCls}`}
    >
      {category.section_num && <span className="text-xs opacity-70">{category.section_num}</span>}
      <span>{name}</span>
    </button>
  );
}
