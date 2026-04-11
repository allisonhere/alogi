import { useState, useRef, useEffect } from 'react';
import { Send, User, Sparkles, Bot, AlertCircle, CheckCircle, ChevronDown, ChevronRight, X, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeAiError, type AiErrorState } from '@/lib/aiErrors';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  initialSummary?: {
    summary: string;
    key_findings: string[];
    recommendation: string;
    severity: 'low' | 'medium' | 'high';
  } | null;
  errorState?: AiErrorState | null;
  logContext: string;
  onCollapse?: () => void;
  onClose?: () => void;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
}

export function ChatPanel({ initialSummary, errorState, logContext, onCollapse, onClose, onReanalyze, isReanalyzing }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [chatError, setChatError] = useState<AiErrorState | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when messages change
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!exportRef.current) return;
      if (exportRef.current.contains(event.target as Node)) return;
      setExportOpen(false);
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice(`${label} copied`);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopyNotice(`${label} copied`);
    } finally {
      setExportOpen(false);
      setTimeout(() => setCopyNotice(null), 1600);
    }
  };

  const summaryData = initialSummary ?? { summary: '', key_findings: [], recommendation: '', severity: 'low' as const };
  const hasSummary = Boolean(initialSummary && (initialSummary.summary || initialSummary.key_findings?.length || initialSummary.recommendation));
  const summaryPlain = summaryData.summary || '';
  const summaryMarkdown = [
    `# Summary`,
    `${summaryData.summary || ''}`,
    ``,
    `## Key findings`,
    ...(summaryData.key_findings || []).map((finding) => `- ${finding}`),
    ``,
    `## Recommendation`,
    `${summaryData.recommendation || ''}`,
    ``,
    `**Severity:** ${summaryData.severity || 'low'}`,
  ].join('\n');

  const summaryJson = JSON.stringify(initialSummary ?? {}, null, 2);

  const cliPrompt = [
    `You are an expert DevOps engineer. Analyze the following log data (truncated).`,
    `Return plain text (no JSON, no markdown code blocks).`,
    ``,
    `Format:`,
    `Summary: <one sentence>`,
    `Key findings:`,
    `- <2-4 concrete events/errors/patterns with evidence if possible>`,
    `Actionable steps:`,
    `- <2-3 clear, imperative steps; or 'Monitor' if healthy>`,
    `Severity: high | medium | low`,
    ``,
    `Log Data:`,
    logContext.slice(-15000),
  ].join('\n');

  const sendMessage = async (userMsg: Message, opts?: { appendUser?: boolean }) => {
    const appendUser = opts?.appendUser ?? true;
    const nextMessages = appendUser ? [...messages, userMsg] : messages;

    if (appendUser) {
      setMessages(prev => [...prev, userMsg]);
    }

    setLastUserMessage(userMsg);
    setInput('');
    setLoading(true);
    setChatError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          context: logContext,
        }),
      });

      const data = await res.json();

      if (data.error) {
        const errState = normalizeAiError(String(data.error));
        setChatError(errState);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      }
    } catch (err) {
      const errState = normalizeAiError(err instanceof Error ? err.message : String(err));
      setChatError(errState);
    } finally {
      setLoading(false);
    }
  };

  const chatBlocked = Boolean(errorState?.blocking || chatError?.blocking);

  const handleSend = async () => {
    if (!input.trim() || loading || chatBlocked) return;
    await sendMessage({ role: 'user', content: input });
  };

  const handleRetry = async () => {
    if (!lastUserMessage || loading) return;
    await sendMessage(lastUserMessage, { appendUser: false });
  };

  return (
    <div className="theme-ai-panel flex flex-col h-full app-panel border-l border-subtle w-96 transition-colors">
      {/* Header */}
      <div className="theme-pane-header border-b border-subtle bg-[var(--panel-bg-strong)]">
        {/* Title row */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onCollapse && (
              <button
                onClick={onCollapse}
                className="theme-toolbar-button ui-control-icon ui-control-ghost p-1"
                title="Collapse panel"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <Sparkles className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-primary text-sm">AI Investigator</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="theme-toolbar-button ui-control-icon ui-control-ghost ui-control-danger p-1"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* Actions row */}
        <div className="px-3 pb-2 flex items-center gap-1.5">
          {onReanalyze && (
            <button
              type="button"
              onClick={onReanalyze}
              disabled={isReanalyzing}
              className={cn(
                "theme-toolbar-button ui-control px-3 py-1.5 text-xs font-medium",
                isReanalyzing
                  ? "bg-[var(--surface-bg)] text-muted cursor-not-allowed"
                  : "ui-control-active hover:brightness-110"
              )}
              title="Re-analyze with fresh data"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isReanalyzing && "animate-spin")} />
              {isReanalyzing ? 'Analyzing...' : 'Re-Analyze'}
            </button>
          )}
          {hasSummary && (
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setExportOpen((prev) => !prev)}
                className="theme-toolbar-button ui-control ui-control-secondary px-2.5 py-1.5 text-xs font-medium"
              >
                Export
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-subtle app-panel-strong overflow-hidden z-10">
                  <button
                    className="theme-list-row w-full text-left text-xs px-3 py-2 hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2"
                    onClick={() => copyToClipboard(summaryPlain, 'Summary')}
                  >
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    Copy summary (plain)
                  </button>
                  <button
                    className="theme-list-row w-full text-left text-xs px-3 py-2 hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2"
                    onClick={() => copyToClipboard(summaryMarkdown, 'Summary + findings')}
                  >
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    Copy summary + key findings (markdown)
                  </button>
                  <button
                    className="theme-list-row w-full text-left text-xs px-3 py-2 hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2"
                    onClick={() => copyToClipboard(summaryJson, 'Analysis JSON')}
                  >
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    Copy full analysis JSON
                  </button>
                  <button
                    className="theme-list-row w-full text-left text-xs px-3 py-2 hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2 border-t border-subtle"
                    onClick={() => copyToClipboard(cliPrompt, 'CLI prompt')}
                  >
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    Copy CLI-ready prompt
                  </button>
                  {copyNotice && (
                    <div className="px-3 py-2 text-[11px] text-emerald-600 dark:text-emerald-400 border-t border-zinc-200 dark:border-zinc-800">
                      {copyNotice}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages & Summary */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar" ref={scrollRef}>

        {errorState && (
          <div className={cn(
            "p-3 rounded-lg border text-sm",
            errorState.blocking
              ? "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-100"
              : "bg-red-50 text-red-900 border-red-200 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-100"
          )}>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{errorState.title}</div>
            <p className="text-sm leading-relaxed">{errorState.message}</p>
            {errorState.retryable && onReanalyze && (
              <button
                type="button"
                onClick={onReanalyze}
                disabled={isReanalyzing}
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors",
                  isReanalyzing
                    ? "bg-zinc-200 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700 cursor-not-allowed"
                    : "bg-white/80 hover:bg-white border-red-200 text-red-700 dark:bg-zinc-900 dark:border-red-500/30 dark:text-red-200"
                )}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isReanalyzing && "animate-spin")} />
                {isReanalyzing ? 'Retrying...' : 'Retry analysis'}
              </button>
            )}
          </div>
        )}
        
        {/* The "Old Look" Structured Summary */}
        {hasSummary && (
          <div className="space-y-4 animate-in fade-in duration-500">
              <div className={cn(
                  "p-3 rounded-lg border",
                  summaryData.severity === 'high' ? "bg-red-50 text-red-900 border-red-200 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-200" :
                  "bg-white text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
              )}>
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Summary</div>
                  <p className="text-sm leading-relaxed">{summaryData.summary}</p>
              </div>

              <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Key Findings</div>
                  <ul className="space-y-2">
                      {(summaryData.key_findings || []).map((finding, i) => (
                          <li key={i} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300 items-start">
                              <AlertCircle className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0 mt-0.5" />
                              <span>{finding}</span>
                          </li>
                      ))}
                  </ul>
              </div>

              <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Recommendation</div>
                  <div className="flex gap-2 text-sm text-indigo-700 bg-indigo-50 border-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/5 p-3 rounded border dark:border-indigo-500/10 items-start">
                      <CheckCircle className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                      <span>{summaryData.recommendation || "No specific recommendation provided."}</span>
                  </div>
              </div>

              <div className="border-b border-zinc-200 dark:border-zinc-800/50 pt-2" />
          </div>
        )}

        {/* Chat Thread */}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
            <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                msg.role === 'user' ? "bg-zinc-200 dark:bg-zinc-700" : "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
            )}>
                {msg.role === 'user' ? <User className="w-3 h-3 text-zinc-500 dark:text-zinc-300" /> : <Bot className="w-3 h-3" />}
            </div>
            <div className={cn(
                "rounded-lg p-3 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed shadow-sm",
                msg.role === 'user' ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "bg-white border-zinc-200 text-zinc-800 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300 border"
            )}>
                {msg.content}
            </div>
          </div>
        ))}

        {loading && (
            <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400 animate-pulse" />
                </div>
                <div className="text-xs text-zinc-500 flex items-center">Investigating...</div>
            </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        {chatError && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest opacity-70">Chat unavailable</div>
              <div className="text-xs">{chatError.message}</div>
            </div>
            {chatError.retryable && (
              <button
                type="button"
                onClick={handleRetry}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-zinc-900 dark:text-red-200 dark:hover:bg-red-500/20"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        )}
        <div className="relative">
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={chatBlocked ? "AI unavailable — check Settings" : "Ask follow-up questions..."}
                disabled={loading || chatBlocked}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md py-2.5 pl-3 pr-10 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button 
                onClick={handleSend}
                disabled={loading || !input.trim() || chatBlocked}
                className="absolute right-2 top-2.5 text-zinc-400 dark:text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 disabled:opacity-50 transition-colors"
            >
                <Send className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
}
