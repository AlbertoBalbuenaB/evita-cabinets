import { Users } from 'lucide-react';
import { ComingSoon } from '../components/ComingSoon';
import { usePageChrome } from '../contexts/PageChromeContext';

export function CrmPlaceholder() {
  usePageChrome(
    {
      title: 'CRM',
      crumbs: [{ label: 'CRM' }],
    },
    [],
  );
  return (
    <ComingSoon
      icon={Users}
      title="CRM"
      subtitle="Coming soon — customer relationship management is in design."
    />
  );
}
