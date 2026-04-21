import { useState } from 'react';
import { ProjectHeader } from '../../components/project/ProjectHeader';
import type { QuoteStatus } from '../../components/project/StatusChip';
import type { TotalMode } from '../../lib/quotationUiStore';

interface DemoCase {
  title: string;
  description: string;
  variantName: string;
  status: QuoteStatus;
  isStale: boolean;
  delta?: { value: number; label: 'Optimizer' | 'FT²' };
  totalMode: TotalMode;
  pricingMethod: 'sqft' | 'optimizer';
}

const DEMO_CASES: DemoCase[] = [
  {
    title: 'Default',
    description: 'Estimating, no stale, MXN only, no delta',
    variantName: 'Value Engineering',
    status: 'Estimating',
    isStale: false,
    totalMode: 'MXN',
    pricingMethod: 'optimizer',
  },
  {
    title: 'Stale + delta',
    description: 'Sent, stale optimizer, MXN, −36% vs FT²',
    variantName: 'Value Engineering',
    status: 'Sent',
    isStale: true,
    delta: { value: -0.36, label: 'FT²' },
    totalMode: 'MXN',
    pricingMethod: 'optimizer',
  },
  {
    title: 'Both mode + positive delta',
    description: 'Awarded, no stale, Both, +12% vs Optimizer',
    variantName: 'Original',
    status: 'Awarded',
    isStale: false,
    delta: { value: 0.12, label: 'Optimizer' },
    totalMode: 'Both',
    pricingMethod: 'sqft',
  },
];

const TOTAL_MXN = 3_906_949.32;
const EXCHANGE_RATE = 18;
const TOTAL_USD = TOTAL_MXN / EXCHANGE_RATE;

export function ProjectHeaderDemo() {
  return (
    <div className="space-y-8 py-4">
      <div className="glass-indigo rounded-2xl p-5">
        <h1 className="text-xl font-bold text-slate-900 mb-1">ProjectHeader · Option B · Dev Preview</h1>
        <p className="text-sm text-slate-600">
          Three canonical states for design QA. Real page at <code className="text-[11px] px-1 py-0.5 rounded bg-white/70 border border-slate-200">/projects/:id/quotations/:quotationId</code>.
        </p>
      </div>

      {DEMO_CASES.map((demo, i) => (
        <DemoBlock key={i} demo={demo} />
      ))}
    </div>
  );
}

function DemoBlock({ demo }: { demo: DemoCase }) {
  const [status, setStatus] = useState<QuoteStatus>(demo.status);
  const [totalMode, setTotalMode] = useState<TotalMode>(demo.totalMode);

  return (
    <div className="space-y-3">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-indigo-700">
          {demo.title}
        </div>
        <div className="text-xs text-slate-500">{demo.description}</div>
      </div>

      {/* Remove the Layout padding so the sticky header spans edge-to-edge,
          as it does on the real quotation page. The wrapper below is just
          a stacking context; the header's inner `max-w-7xl` handles alignment. */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 border-y border-slate-200/60">
        <ProjectHeader
          variant="inline"
          projectName="BHS Kona"
          projectId="demo-project-id"
          variantName={demo.variantName}
          status={status}
          isStale={demo.isStale}
          projectType="Custom"
          address="12223 Farm to Market 529 Rd, Houston, TX 77041"
          quotedAt="2026-04-20"
          total={{ usd: TOTAL_USD, mxn: TOTAL_MXN }}
          totalMode={totalMode}
          onTotalModeChange={setTotalMode}
          pricingMethod={demo.pricingMethod}
          delta={demo.delta}
          onBack={() => console.log('[demo] back')}
          onEdit={() => console.log('[demo] edit')}
          onStatusChange={(s) => {
            console.log('[demo] status change', s);
            setStatus(s);
          }}
        />

        {/* Spacer so sticky behavior is perceptible inside each block */}
        <div className="h-32 bg-gradient-to-b from-white/40 to-transparent" />
      </div>
    </div>
  );
}
