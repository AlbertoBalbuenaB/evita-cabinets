import type { LucideIcon } from 'lucide-react';

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}

export function ComingSoon({ icon: Icon, title, subtitle }: ComingSoonProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] page-enter">
      <div className="glass-white p-10 max-w-md w-full text-center">
        <div
          className="mx-auto mb-5 w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundImage: 'linear-gradient(135deg, #6366f1, #3b82f6)' }}
        >
          <Icon className="h-7 w-7 text-white" strokeWidth={1.75} />
        </div>
        <h1 className="text-xl font-semibold text-fg-900 mb-2">{title}</h1>
        {subtitle && (
          <p className="text-sm text-fg-500 leading-relaxed">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
