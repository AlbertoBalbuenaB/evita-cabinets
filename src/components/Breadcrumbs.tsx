import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useChromeReader } from '../contexts/PageChromeContext';
import { deriveCrumbs } from '../lib/routeLabels';

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const { crumbs: override, hideCrumbs } = useChromeReader();
  const crumbs = override && override.length > 0 ? override : deriveCrumbs(pathname);

  if (hideCrumbs) return null;
  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm min-w-0"
    >
      <ol className="flex items-center gap-1.5 min-w-0 overflow-hidden">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          const labelNode = (
            <span className="truncate max-w-[220px]">{crumb.label}</span>
          );
          return (
            <Fragment key={`${crumb.label}-${idx}`}>
              {idx > 0 && (
                <span
                  aria-hidden
                  className="text-fg-300 select-none shrink-0"
                >
                  /
                </span>
              )}
              <li
                className={`min-w-0 ${
                  isLast
                    ? 'text-fg-900 font-semibold'
                    : 'text-fg-500'
                }`}
                aria-current={isLast ? 'page' : undefined}
              >
                {crumb.to && !isLast ? (
                  <Link
                    to={crumb.to}
                    className="inline-flex items-center gap-1 rounded hover:text-fg-800 hover:underline underline-offset-2 transition-colors"
                  >
                    {labelNode}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    {labelNode}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
