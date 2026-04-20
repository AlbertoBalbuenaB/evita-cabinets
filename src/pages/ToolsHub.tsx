import { Link } from 'react-router-dom';
import { Ruler, LayoutDashboard, ArrowLeft, Pencil } from 'lucide-react';
import { usePageChrome } from '../contexts/PageChromeContext';

const tools = [
  {
    title: 'Evita Draft',
    description: 'Floorplans and elevations with AWI/NAAWS diamond tags, bilingual PDF export',
    icon: Pencil,
    path: '/tools/draft',
    color: 'violet',
  },
  {
    title: 'Evita Takeoff',
    description: 'Upload PDFs or images, calibrate scale, and take measurements for takeoff',
    icon: Ruler,
    path: '/tools/takeoff',
    color: 'blue',
  },
  {
    title: 'Cutting Optimizer',
    description: 'Optimize panel material cutting layouts for minimum waste',
    icon: LayoutDashboard,
    path: '/optimizer',
    color: 'indigo',
  },
];

const colorMap: Record<string, { bg: string; iconBg: string; iconText: string; border: string }> = {
  blue: {
    bg: 'hover:border-blue-300',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    border: 'border-blue-200',
  },
  indigo: {
    bg: 'hover:border-indigo-300',
    iconBg: 'bg-indigo-100',
    iconText: 'text-indigo-600',
    border: 'border-indigo-200',
  },
  violet: {
    bg: 'hover:border-violet-300',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
    border: 'border-violet-200',
  },
};

export function ToolsHub() {
  usePageChrome(
    { title: 'Tools', crumbs: [{ label: 'Tools' }] },
    [],
  );
  return (
    <div className="page-enter">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 mt-2">Tools</h1>
        <p className="text-slate-500 text-sm mt-1">Standalone utility tools for your projects</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool, i) => {
          const c = colorMap[tool.color];
          const Icon = tool.icon;
          return (
            <Link
              key={tool.path}
              to={tool.path}
              className={`card-enter stagger-${i + 1} glass-white rounded-xl border border-slate-200 ${c.bg} p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-md group`}
            >
              <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${c.iconText}`} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 group-hover:text-slate-900">{tool.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{tool.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
