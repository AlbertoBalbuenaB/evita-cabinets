import type { KbProposal } from '../../lib/kb/kbTypes';

const STATE_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  draft:              { label: 'Draft',              bg: 'bg-slate-100/70',   text: 'text-slate-700',   border: 'border-slate-300/70' },
  open:               { label: 'Open',               bg: 'bg-indigo-100/70',  text: 'text-indigo-800',  border: 'border-indigo-300/70' },
  changes_requested:  { label: 'Changes requested',  bg: 'bg-amber-100/70',   text: 'text-amber-800',   border: 'border-amber-300/70' },
  approved:           { label: 'Approved',           bg: 'bg-emerald-100/70', text: 'text-emerald-800', border: 'border-emerald-300/70' },
  rejected:           { label: 'Rejected',           bg: 'bg-rose-100/70',    text: 'text-rose-800',    border: 'border-rose-300/70' },
  merged:             { label: 'Merged',             bg: 'bg-violet-100/70',  text: 'text-violet-800',  border: 'border-violet-300/70' },
  withdrawn:          { label: 'Withdrawn',          bg: 'bg-slate-100/70',   text: 'text-slate-500',   border: 'border-slate-300/70' },
};

interface KbProposalStateBadgeProps {
  state: KbProposal['state'];
  compact?: boolean;
}

export function KbProposalStateBadge({ state, compact }: KbProposalStateBadgeProps) {
  const style = STATE_STYLES[state] ?? STATE_STYLES.draft;
  return (
    <span
      className={`inline-flex items-center rounded-lg border font-medium ${style.bg} ${style.text} ${style.border} ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      {style.label}
    </span>
  );
}
