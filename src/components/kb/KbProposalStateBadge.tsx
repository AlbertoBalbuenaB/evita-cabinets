import type { KbProposal } from '../../lib/kb/kbTypes';

const STATE_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  draft:              { label: 'Draft',              bg: 'bg-surf-muted',   text: 'text-fg-700',   border: 'border-border-solid' },
  open:               { label: 'Open',               bg: 'bg-accent-tint-strong',  text: 'text-indigo-800',  border: 'border-indigo-300/70' },
  changes_requested:  { label: 'Changes requested',  bg: 'bg-status-amber-bg',   text: 'text-amber-800',   border: 'border-status-amber-brd' },
  approved:           { label: 'Approved',           bg: 'bg-status-emerald-bg', text: 'text-emerald-800', border: 'border-status-emerald-brd' },
  rejected:           { label: 'Rejected',           bg: 'bg-status-red-bg',    text: 'text-rose-800',    border: 'border-status-red-brd' },
  merged:             { label: 'Merged',             bg: 'bg-accent-tint-soft',  text: 'text-violet-800',  border: 'border-accent-tint-border' },
  withdrawn:          { label: 'Withdrawn',          bg: 'bg-surf-muted',   text: 'text-fg-500',   border: 'border-border-solid' },
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
