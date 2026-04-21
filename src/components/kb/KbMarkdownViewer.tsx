import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Components } from 'react-markdown';
import { useNavigate } from 'react-router-dom';

const KB_LINK_REGEX = /\[\[(kb|supplier|material|project|wiki):([^|]+)\|([^\]]+)\]\]/g;

interface KbMarkdownViewerProps {
  source: string;
  className?: string;
}

function transformLinks(source: string): string {
  return source.replace(KB_LINK_REGEX, (_, kind: string, id: string, label: string) => {
    const safeLabel = label.replace(/\|/g, '\\|').replace(/\]/g, '\\]');
    const href =
      kind === 'kb'
        ? `/kb/${id}`
        : kind === 'supplier'
          ? `/kb/suppliers/${id}`
          : kind === 'material'
            ? `/prices/${id}`
            : kind === 'project'
              ? `/projects/${id}`
              : kind === 'wiki'
                ? `/wiki/${id}`
                : '#';
    return `[${safeLabel}](${href})`;
  });
}

export function KbMarkdownViewer({ source, className }: KbMarkdownViewerProps) {
  const navigate = useNavigate();
  const transformed = transformLinks(source);

  const components: Components = {
    a: ({ href, children }) => {
      if (!href) return <span>{children}</span>;
      const isInternal = href.startsWith('/');
      if (isInternal) {
        return (
          <button
            type="button"
            onClick={() => navigate(href)}
            className="text-accent-text hover:text-accent-text underline underline-offset-2 font-medium bg-transparent border-0 p-0 inline cursor-pointer"
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-text hover:text-accent-text underline">
          {children}
        </a>
      );
    },
    h1: ({ children }) => <h1 className="text-2xl font-bold text-fg-900 mt-6 mb-3">{children}</h1>,
    h2: ({ children }) => <h2 className="text-xl font-semibold text-fg-900 mt-5 mb-2">{children}</h2>,
    h3: ({ children }) => <h3 className="text-lg font-semibold text-fg-800 mt-4 mb-2">{children}</h3>,
    h4: ({ children }) => <h4 className="text-base font-semibold text-fg-800 mt-3 mb-1.5">{children}</h4>,
    p: ({ children }) => <p className="text-fg-700 leading-relaxed my-2">{children}</p>,
    ul: ({ children }) => <ul className="list-disc list-outside ml-6 space-y-1 my-2 text-fg-700">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-outside ml-6 space-y-1 my-2 text-fg-700">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="glass-indigo border-l-4 border-indigo-400 px-4 py-2 my-3 text-fg-700 italic rounded-r-lg">
        {children}
      </blockquote>
    ),
    code: ({ className, children }) => {
      const isBlock = /language-/.test(className ?? '');
      if (isBlock) {
        return (
          <pre className="glass-white rounded-xl p-4 my-3 overflow-x-auto">
            <code className="text-sm font-mono text-fg-800">{children}</code>
          </pre>
        );
      }
      return (
        <code className="px-1.5 py-0.5 rounded bg-accent-tint-soft text-accent-text text-sm font-mono">{children}</code>
      );
    },
    pre: ({ children }) => <>{children}</>,
    table: ({ children }) => (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-surf-app">{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className="border-b border-border-soft">{children}</tr>,
    th: ({ children }) => <th className="text-left px-3 py-2 font-semibold text-fg-800">{children}</th>,
    td: ({ children }) => <td className="px-3 py-2 text-fg-700 align-top">{children}</td>,
    strong: ({ children }) => <strong className="font-semibold text-fg-900">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    hr: () => <hr className="my-4 border-border-soft" />,
    img: ({ src, alt }) => (
      <img src={src} alt={alt ?? ''} className="rounded-xl my-3 max-w-full" />
    ),
  };

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {transformed}
      </ReactMarkdown>
    </div>
  );
}
