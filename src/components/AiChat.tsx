import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Sparkles, ChevronRight, RotateCcw, Loader2, History, ArrowLeft, MessageSquare } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAiChatContext } from '../stores/aiChatContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  created_at: string;
  title: string;
  messages: Message[];
}

type PanelView = 'chat' | 'history';

function getOrCreateSessionKey(): string {
  const key = 'evita_ia_session_key';
  let val = localStorage.getItem(key);
  if (!val) {
    val = crypto.randomUUID();
    localStorage.setItem(key, val);
  }
  return val;
}

function resolvePageKey(
  currentPage: string,
  projectId: string | null,
  activeProjectTab?: string | null
): string {
  if (currentPage === 'projects' && projectId) {
    if (activeProjectTab === 'info') return 'project-info';
    if (activeProjectTab === 'pricing') return 'project-pricing';
    if (activeProjectTab === 'analytics') return 'project-analytics';
    if (activeProjectTab === 'history') return 'project-history';
    if (activeProjectTab === 'management') return 'project-management';
    return 'project-pricing';
  }
  if (currentPage === 'projects') return 'projects';
  if (currentPage === 'prices') return 'prices';
  if (currentPage === 'products') return 'products';
  if (currentPage === 'settings') return 'settings';
  return 'dashboard';
}

const SUGGESTIONS = [
  { icon: '📋', text: 'Quick estimate' },
  { icon: '💰', text: 'Active projects' },
  { icon: '🔧', text: 'How does pricing work?' },
  { icon: '📦', text: 'Search a SKU' },
];

function formatInline(text: string, keyPrefix: string = ''): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={`${keyPrefix}b${idx}`} className="font-semibold text-slate-900">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<code key={`${keyPrefix}c${idx}`} className="font-mono text-xs bg-slate-100 text-slate-700 px-1 py-0.5 rounded">{match[3]}</code>);
    }
    last = match.index + match[0].length;
    idx++;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function isTableLine(line: string): boolean {
  const t = line.trim();
  return t.includes('|') && t.startsWith('|') && t.endsWith('|');
}

function isAmountCell(text: string): boolean {
  const t = text.trim();
  return /^\$/.test(t) || /^-?\d[\d,.]+%?$/.test(t);
}

function renderTable(tableLines: string[], keyBase: number): React.ReactNode {
  const rows = tableLines.filter(l => !isTableSeparator(l));
  if (rows.length === 0) return null;

  const parseRow = (line: string) =>
    line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

  const headerCells = parseRow(rows[0]);
  const hasSeparator = tableLines.length > 1 && isTableSeparator(tableLines[1]);
  const dataRows = hasSeparator ? rows.slice(1) : rows.slice(1);

  return (
    <div key={`tbl-${keyBase}`} className="my-1 overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse">
        {hasSeparator && (
          <thead>
            <tr>
              {headerCells.map((cell, ci) => (
                <th key={ci} className={`py-1 px-2 text-left font-semibold text-slate-700 border-b border-slate-200 ${isAmountCell(cell) ? 'text-right' : ''}`}>
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {(hasSeparator ? dataRows : rows).map((row, ri) => {
            const cells = parseRow(row);
            return (
              <tr key={ri} className="border-b border-slate-100 last:border-0">
                {cells.map((cell, ci) => (
                  <td key={ci} className={`py-1 px-2 text-slate-600 ${isAmountCell(cell) ? 'text-right tabular-nums' : ''}`}>
                    {formatInline(cell, `t${keyBase}-${ri}-${ci}-`)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatMessage(text: string): React.ReactNode {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Group consecutive table lines
    if (isTableLine(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableLine(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      result.push(renderTable(tableLines, i));
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      result.push(<p key={i} className="font-semibold text-slate-900 my-1 text-sm">{formatInline(line.slice(4), `h${i}-`)}</p>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      result.push(<p key={i} className="font-semibold text-slate-900 my-1">{formatInline(line.slice(3), `h${i}-`)}</p>);
      i++; continue;
    }

    // Bullets
    if (line.startsWith('• ') || line.startsWith('- ')) {
      result.push(
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-blue-500 flex-shrink-0">•</span>
          <span>{formatInline(line.slice(2), `bl${i}-`)}</span>
        </div>
      );
      i++; continue;
    }

    // Numbered lists
    const numMatch = line.match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      result.push(
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-blue-500 flex-shrink-0 min-w-[1.2em] text-right">{numMatch[1]}.</span>
          <span>{formatInline(numMatch[2], `nl${i}-`)}</span>
        </div>
      );
      i++; continue;
    }

    // Empty line
    if (line === '') {
      result.push(<div key={i} className="h-2" />);
      i++; continue;
    }

    // Plain text with inline formatting
    result.push(<p key={i} className="my-0.5 leading-relaxed">{formatInline(line, `p${i}-`)}</p>);
    i++;
  }

  return result;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const EVITA_IA_PASSWORD = import.meta.env.VITE_EVITA_IA_PASSWORD || 'EvitaCabinets';

function derivePageContext(pathname: string): { currentPage: string; projectId: string | null } {
  if (pathname.startsWith('/projects/')) {
    const id = pathname.split('/')[2];
    return { currentPage: 'projects', projectId: id || null };
  }
  if (pathname.startsWith('/projects')) return { currentPage: 'projects', projectId: null };
  if (pathname.startsWith('/prices')) return { currentPage: 'prices', projectId: null };
  if (pathname.startsWith('/products')) return { currentPage: 'products', projectId: null };
  if (pathname.startsWith('/settings')) return { currentPage: 'settings', projectId: null };
  if (pathname.startsWith('/templates')) return { currentPage: 'templates', projectId: null };
  return { currentPage: 'dashboard', projectId: null };
}

export function AiChat() {
  const { pathname } = useLocation();
  const { currentPage, projectId } = derivePageContext(pathname);
  const activeProjectTab = useAiChatContext(s => s.activeProjectTab);
  const [isOpen, setIsOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('evita-ia-unlocked') === '1');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem('evita-ia-messages');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [view, setView] = useState<PanelView>('chat');
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pageKey = resolvePageKey(currentPage, projectId, activeProjectTab);

  const EDGE_URL = import.meta.env.VITE_EVITA_IA_URL as string;
  const EDGE_KEY = import.meta.env.VITE_EVITA_IA_SECRET as string;

  useEffect(() => {
    try {
      sessionStorage.setItem('evita-ia-messages', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setSlowLoad(true), 5000);
      return () => clearTimeout(t);
    } else {
      setSlowLoad(false);
    }
  }, [loading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 10);
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (messagesEndRef.current && view === 'chat') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, view]);

  useEffect(() => {
    if (!unlocked) return;
    const saved = sessionStorage.getItem('evita-ia-messages');
    if (saved) return;

    (async () => {
      const sessionKey = getOrCreateSessionKey();
      const { data } = await supabase
        .from('ai_chat_sessions')
        .select('id, created_at, messages')
        .eq('session_key', sessionKey)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data?.length) {
        const session = data[0];
        const age = Date.now() - new Date(session.created_at).getTime();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        if (age < TWENTY_FOUR_HOURS && Array.isArray(session.messages) && session.messages.length > 0) {
          setMessages(session.messages as Message[]);
          setCurrentSessionId(session.id);
        }
      }
    })();
  }, [unlocked]);

  async function saveSession(msgs: Message[]) {
    if (msgs.length === 0) return;
    const sessionKey = getOrCreateSessionKey();
    const firstUser = msgs.find(m => m.role === 'user');
    const title = firstUser
      ? firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? '...' : '')
      : 'Conversation';

    if (currentSessionId) {
      await supabase.from('ai_chat_sessions')
        .update({ messages: msgs, title })
        .eq('id', currentSessionId);
    } else {
      const { data } = await supabase.from('ai_chat_sessions').insert({
        session_key: sessionKey,
        title,
        messages: msgs,
      }).select('id').single();
      if (data?.id) setCurrentSessionId(data.id);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    const sessionKey = getOrCreateSessionKey();
    const { data } = await supabase
      .from('ai_chat_sessions')
      .select('id, created_at, title, messages')
      .eq('session_key', sessionKey)
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory((data as ChatSession[]) ?? []);
    setHistoryLoading(false);
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMessage = text.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-evita-key': EDGE_KEY,
        },
        body: JSON.stringify({
          messages: newMessages,
          projectId,
          pageKey,
        }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const reply = data.content ?? 'Sorry, I could not get a response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      const updatedMsgs = [...newMessages, { role: 'assistant' as const, content: reply }];
      if (updatedMsgs.length >= 2) {
        saveSession(updatedMsgs);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Connection error. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, EDGE_URL, EDGE_KEY, projectId, pageKey]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleOpen() {
    setIsOpen(true);
    setHasUnread(false);
    setView('chat');
  }

  function handleClose() {
    if (messages.length > 0) {
      saveSession(messages);
    }
    setIsVisible(false);
    setTimeout(() => setIsOpen(false), 250);
  }

  async function handleReset() {
    if (messages.length > 0) await saveSession(messages);
    setMessages([]);
    setCurrentSessionId(null);
    try { sessionStorage.removeItem('evita-ia-messages'); } catch {}
  }

  function handleUnlock() {
    if (passwordInput === EVITA_IA_PASSWORD) {
      sessionStorage.setItem('evita-ia-unlocked', '1');
      setUnlocked(true);
      setPasswordError(false);
      setPasswordInput('');
    } else {
      setPasswordError(true);
    }
  }

  async function handleShowHistory() {
    setView('history');
    await loadHistory();
  }

  function handleLoadSession(session: ChatSession) {
    setMessages(session.messages);
    setView('chat');
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          style={{
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 250ms ease',
          }}
          onClick={handleClose}
        />
      )}

      {/* Floating Panel */}
      {isOpen && (
        <div
          className="fixed z-50 flex flex-col"
          style={{
            width: 'min(420px, calc(100vw - 24px))',
            height: 'min(680px, calc(100vh - 100px))',
            bottom: '80px',
            right: '16px',
            transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
            opacity: isVisible ? 1 : 0,
            transition: 'transform 280ms cubic-bezier(0.34,1.56,0.64,1), opacity 250ms ease',
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: '0 8px 32px rgba(99,102,241,0.12), 0 2px 12px rgba(0,0,0,0.08)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{
              background: 'rgba(255,255,255,0.5)',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '20px 20px 0 0',
            }}
          >
            <div className="flex items-center gap-3">
              {view === 'history' ? (
                <button
                  onClick={() => setView('chat')}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
              ) : (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                    boxShadow: '0 0 16px rgba(99,102,241,0.35)',
                  }}
                >
                  <Sparkles size={15} className="text-white" />
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-900 text-sm leading-tight tracking-wide">
                  {view === 'history' ? 'Conversation History' : 'Evita IA'}
                </p>
                <p className="text-xs text-slate-500">
                  {view === 'history' ? 'Past conversations' : 'Quotation Assistant'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {view === 'chat' && (
                <>
                  <button
                    onClick={handleShowHistory}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                    title="View conversation history"
                  >
                    <History size={14} />
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                    title="New conversation"
                  >
                    <RotateCcw size={14} />
                  </button>
                </>
              )}
              <button
                onClick={handleClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Password Gate */}
          {!unlocked && (
            <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.12) 100%)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}
              >
                <Sparkles size={24} style={{ color: '#6366f1' }} />
              </div>
              <div className="text-center">
                <p className="text-slate-900 font-semibold text-base mb-1">Evita IA</p>
                <p className="text-xs text-slate-500">
                  Enter your access password to continue
                </p>
              </div>
              <div className="w-full space-y-3">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
                  onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                  placeholder="Password"
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-800 placeholder-slate-400"
                  style={{
                    background: 'rgba(255,255,255,0.8)',
                    border: `1px solid ${passwordError ? 'rgba(239,68,68,0.6)' : 'rgba(0,0,0,0.12)'}`,
                  }}
                />
                {passwordError && (
                  <p className="text-xs text-center text-red-500">
                    Incorrect password. Please try again.
                  </p>
                )}
                <button
                  onClick={handleUnlock}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Unlock
                </button>
              </div>
            </div>
          )}

          {/* History View */}
          {unlocked && view === 'history' && (
            <div
              className="flex-1 overflow-y-auto px-4 py-4"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}
            >
              {historyLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={20} className="text-blue-500 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-16">
                  <MessageSquare size={32} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-500">No saved conversations yet</p>
                  <p className="text-xs mt-1 text-slate-400">
                    Start a chat and use the reset button to save it
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(session => (
                    <button
                      key={session.id}
                      onClick={() => handleLoadSession(session)}
                      className="w-full text-left px-4 py-3 rounded-xl transition-all hover:bg-blue-50 hover:border-blue-200"
                      style={{
                        background: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(0,0,0,0.07)',
                      }}
                    >
                      <p className="text-sm font-medium truncate text-slate-800">
                        {session.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">
                          {formatDate(session.created_at)}
                        </span>
                        <span className="text-xs text-slate-300">
                          · {session.messages.length} messages
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chat View */}
          {unlocked && view === 'chat' && (
            <>
              <div
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}
              >
                {messages.length === 0 && (
                  <div className="space-y-5">
                    <div className="text-center pt-4 pb-2">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{
                          background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.12) 100%)',
                          border: '1px solid rgba(99,102,241,0.2)',
                        }}
                      >
                        <Sparkles size={24} style={{ color: '#6366f1' }} />
                      </div>
                      <p className="text-slate-900 font-semibold text-base mb-1">
                        Hi, I'm Evita IA
                      </p>
                      <p className="text-xs leading-relaxed text-slate-500">
                        Your quotation assistant. Ask me for estimates,<br />
                        project data, or how the system works.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs px-1 text-slate-400 uppercase tracking-wide">
                        TRY ASKING
                      </p>
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(s.text)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:bg-blue-50 hover:border-blue-200"
                          style={{
                            background: 'rgba(255,255,255,0.6)',
                            border: '1px solid rgba(0,0,0,0.07)',
                          }}
                        >
                          <span className="text-base">{s.icon}</span>
                          <span className="flex-1 text-sm text-slate-600">
                            {s.text}
                          </span>
                          <ChevronRight size={14} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                        }}
                      >
                        <Sparkles size={11} className="text-white" />
                      </div>
                    )}
                    <div
                      className="max-w-[82%] rounded-2xl px-4 py-3 text-sm"
                      style={
                        msg.role === 'user'
                          ? {
                              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                              color: 'white',
                              borderBottomRightRadius: '6px',
                            }
                          : {
                              background: 'rgba(255,255,255,0.8)',
                              border: '1px solid rgba(0,0,0,0.07)',
                              color: '#374151',
                              borderBottomLeftRadius: '6px',
                            }
                      }
                    >
                      {msg.role === 'assistant'
                        ? formatMessage(msg.content)
                        : <p className="leading-relaxed">{msg.content}</p>
                      }
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-start gap-2">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}
                    >
                      <Sparkles size={11} className="text-white" />
                    </div>
                    <div
                      className="px-4 py-3 rounded-2xl rounded-bl-md"
                      style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}
                    >
                      <div className="flex gap-1 items-center h-4">
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              background: 'rgba(59,130,246,0.6)',
                              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                            }}
                          />
                        ))}
                      </div>
                      {slowLoad && (
                        <p className="text-xs mt-2 text-slate-400">
                          Working on it... complex requests may take 15–20s
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div
                className="flex-shrink-0 px-4 pb-4 pt-3"
                style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
              >
                <div
                  className="flex items-end gap-2 rounded-2xl px-4 py-3 bg-white"
                  style={{
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => {
                      setInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Evita IA..."
                    rows={1}
                    className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed text-slate-800 placeholder-slate-400"
                    style={{
                      maxHeight: '120px',
                      overflowY: 'auto',
                    }}
                    disabled={loading}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || loading}
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background:
                        input.trim() && !loading
                          ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                          : 'rgba(0,0,0,0.06)',
                      cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {loading ? (
                      <Loader2 size={14} className="text-blue-500 animate-spin" />
                    ) : (
                      <Send
                        size={14}
                        style={{ color: input.trim() ? 'white' : 'rgba(0,0,0,0.25)' }}
                      />
                    )}
                  </button>
                </div>
                <p className="text-center text-xs mt-2 text-slate-400">
                  Evita Cabinets · Powered by Claude AI
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB Button - only shows when panel is closed */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-4 z-50 flex items-center justify-center transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            boxShadow: '0 4px 24px rgba(59,130,246,0.4)',
            transform: 'scale(1)',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          title="Evita IA"
        >
          <Sparkles size={18} className="text-white" />
          {hasUnread && (
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white"
              style={{ background: '#ef4444' }}
            />
          )}
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
