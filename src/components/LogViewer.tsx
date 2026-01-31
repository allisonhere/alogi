import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BarChart3, Sparkles, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VibeCheckBar } from './VibeCheckBar';
import { ChatPanel } from './ChatPanel';
import { InsightsPanel } from './InsightsPanel';

// Helper to highlight log parts
function LogLine({
  line,
  index,
  wrapLines,
  fontSizeClass,
  searchQuery,
}: {
  line: string;
  index: number;
  wrapLines: boolean;
  fontSizeClass: string;
  searchQuery: string;
}) {
  const lower = line.toLowerCase();
  const isError = lower.includes('error') || lower.includes('critical') || lower.includes('fatal') || lower.includes('failed') || lower.includes('denied');
  const isWarn = lower.includes('warn') || lower.includes('warning') || lower.includes('block') || lower.includes('conflict') || lower.includes('timeout') || lower.includes('retrying');
  const query = searchQuery.trim();
  const queryLower = query.toLowerCase();

  const highlightMatches = (text: string) => {
    if (!query) return text;
    const lowerText = text.toLowerCase();
    const parts: Array<string | React.ReactElement> = [];
    let startIndex = 0;
    let matchIndex = lowerText.indexOf(queryLower, startIndex);
    let keyIndex = 0;
    while (matchIndex !== -1) {
      if (matchIndex > startIndex) {
        parts.push(text.slice(startIndex, matchIndex));
      }
      const matchText = text.slice(matchIndex, matchIndex + query.length);
      parts.push(
        <mark
          key={`${matchIndex}-${keyIndex}`}
          className="rounded px-0.5"
          style={{ backgroundColor: 'oklch(43.2% 0.232 292.759)', color: '#fff' }}
        >
          {matchText}
        </mark>
      );
      keyIndex += 1;
      startIndex = matchIndex + query.length;
      matchIndex = lowerText.indexOf(queryLower, startIndex);
    }
    if (startIndex < text.length) {
      parts.push(text.slice(startIndex));
    }
    return parts;
  };

  // 1. Try JSON
  let parsedJson: unknown | null = null;
  if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
    try {
      parsedJson = JSON.parse(line);
    } catch {
      // Not valid JSON, fall through
    }
  }

  if (parsedJson !== null) {
    return (
      <div className={cn(
        "flex hover:bg-zinc-100 dark:hover:bg-zinc-800/30 -mx-4 px-4 py-1 transition-colors",
        isError ? "bg-red-50 dark:bg-red-950/20" : "bg-transparent"
      )}>
        <span className="w-10 text-zinc-400 dark:text-zinc-600 select-none text-right mr-4 flex-shrink-0 text-xs mt-0.5 font-mono">{index + 1}</span>
        <pre className={cn(
          "font-mono text-emerald-600 dark:text-emerald-400 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded w-full overflow-x-auto border border-zinc-200 dark:border-zinc-800",
          fontSizeClass
        )}>
          {highlightMatches(JSON.stringify(parsedJson, null, 2))}
        </pre>
      </div>
    );
  }

  // 2. Standard Highlighting matching pic.png style
  // Catching: [Timestamp], [Component], Keywords, and HTTP Methods
  const parts = line.split(/(\[.*?\]|ERROR|WARN|WARNING|INFO|CRITICAL|FATAL|debug|Failed|failed|GET|POST|PUT|DELETE|Accepted|Started|Stopped|BLOCK|conflict|timeout|retrying|Reached|Listening|Created|Mounted|Connected)/gi);

  return (
    <div className={cn(
        "flex hover:bg-zinc-100 dark:hover:bg-zinc-800/40 -mx-4 px-4 py-0.5 transition-colors group border-l-2",
        isError ? "bg-red-50 border-red-500/30 dark:bg-red-950/30 dark:border-red-500/50" : 
        isWarn ? "bg-orange-50 border-orange-500/30 dark:bg-orange-950/20 dark:border-orange-500/40" :
        "bg-transparent border-transparent"
    )}>
        <span className="w-10 text-zinc-400 dark:text-zinc-700 select-none text-right mr-4 flex-shrink-0 text-xs mt-[3px] font-mono group-hover:text-zinc-500">{index + 1}</span>
        <span className={cn(
          "text-zinc-700 dark:text-zinc-300 break-all flex-1 font-mono leading-tight tracking-tight",
          wrapLines ? "whitespace-pre-wrap" : "whitespace-pre",
          fontSizeClass
        )}>
            {parts.map((part, i) => {
                const lowerPart = part.toLowerCase();
                const highlightPart = () => highlightMatches(part);
                
                // Brackets [Timestamp] or [Component] -> Zinc 500 (Gray)
                if (part.startsWith('[') && part.endsWith(']')) return <span key={i} className="text-zinc-400 dark:text-zinc-500">{highlightPart()}</span>;
                
                // Keywords matching vibrant pic.png colors - NOW AS LARGER, BRIGHTER PILLS
                if (['info', 'started', 'reached', 'listening', 'created', 'mounted', 'accepted', 'connected'].includes(lowerPart)) {
                    return <span key={i} className="inline-block mx-2 px-2.5 py-1 rounded-md text-[11px] font-black bg-[#00f5d4]/10 dark:bg-[#00f5d4]/20 text-emerald-600 dark:text-[#00f5d4] leading-none select-none tracking-tight uppercase shadow-sm shadow-[#00f5d4]/10">{highlightPart()}</span>;
                }
                
                if (['warn', 'warning', 'block', 'conflict', 'timeout', 'retrying'].includes(lowerPart)) {
                    return <span key={i} className="inline-block mx-2 px-2.5 py-1 rounded-md text-[11px] font-black bg-[#ff9f1c]/10 dark:bg-[#ff9f1c]/25 text-orange-600 dark:text-[#ff9f1c] leading-none select-none tracking-tight uppercase shadow-sm shadow-[#ff9f1c]/10">{highlightPart()}</span>;
                }
                
                if (['error', 'critical', 'fatal', 'failed'].includes(lowerPart)) {
                    return <span key={i} className="inline-block mx-2 px-2.5 py-1 rounded-md text-[11px] font-black bg-[#ff5d5d]/10 dark:bg-[#ff5d5d]/25 text-red-600 dark:text-[#ff5d5d] leading-none select-none tracking-tight uppercase shadow-sm shadow-[#ff5d5d]/10">{highlightPart()}</span>;
                }

                // HTTP Methods & Positive Actions (Remaining ones not covered by pills)
                if (['GET', 'POST', 'PUT', 'DELETE', 'Stopped'].includes(part)) return <span key={i} className="text-indigo-600 dark:text-indigo-400">{highlightPart()}</span>;
                
                return highlightPart();
            })}
        </span>
    </div>
  );
}

interface LogViewerProps {
  content: string | null;
  loading: boolean;
  filename: string | null;
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  showHosts: boolean;
  showFiles: boolean;
  onToggleHosts: () => void;
  onToggleFiles: () => void;
  liveButtonRef?: React.RefObject<HTMLButtonElement | null>;
  analyzeButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

interface AIAnalysis {
  summary: string;
  key_findings: string[];
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}

export function LogViewer({
  content,
  loading,
  filename,
  isLive,
  setIsLive,
  showHosts,
  showFiles,
  onToggleHosts,
  onToggleFiles,
  liveButtonRef,
  analyzeButtonRef,
}: LogViewerProps) {
  const FONT_SIZES = [11, 12, 13, 14, 15, 16];
  const PREF_KEY = 'alogi.logViewerPrefs';
  const MAX_RENDER_LINES = 5000;
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllLines, setShowAllLines] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);
  const [fontSize, setFontSize] = useState(13);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [viewportRange, setViewportRange] = useState({ start: 0, end: 0 });
  const [insightsOpen, setInsightsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const updateViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= 0) {
      setViewportRange({ start: 0, end: 1 });
      return;
    }
    const start = el.scrollTop / el.scrollHeight;
    const end = (el.scrollTop + el.clientHeight) / el.scrollHeight;
    setViewportRange({
      start: Math.max(0, Math.min(1, start)),
      end: Math.max(0, Math.min(1, end)),
    });
  }, []);

  const viewportRaf = useRef<number | null>(null);
  const scheduleViewportUpdate = useCallback(() => {
    if (viewportRaf.current !== null) return;
    viewportRaf.current = requestAnimationFrame(() => {
      viewportRaf.current = null;
      updateViewport();
    });
  }, [updateViewport]);

  // Reset analysis and search when file changes
  useEffect(() => {
    setAnalysis(null);
    setIsAiPanelOpen(false);
    setSearchQuery('');
    setShowAllLines(false);
  }, [filename]);

  // Auto-scroll to bottom in live mode
  useEffect(() => {
    if (isLive && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, isLive]);

  useEffect(() => {
    updateViewport();
    window.addEventListener('resize', scheduleViewportUpdate);
    return () => window.removeEventListener('resize', scheduleViewportUpdate);
  }, [updateViewport, scheduleViewportUpdate, content, searchQuery, showAllLines, isLive]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') as {
        wrapLines?: boolean;
        fontSize?: number;
        insightsOpen?: boolean;
      };
      if (typeof stored.wrapLines === 'boolean') {
        setWrapLines(stored.wrapLines);
      }
      if (typeof stored.fontSize === 'number') {
        const nearest = FONT_SIZES.reduce((prev, curr) =>
          Math.abs(curr - stored.fontSize!) < Math.abs(prev - stored.fontSize!) ? curr : prev
        , FONT_SIZES[2]);
        setFontSize(nearest);
      }
      if (typeof stored.insightsOpen === 'boolean') {
        setInsightsOpen(stored.insightsOpen);
      }
    } catch {
      // Ignore invalid stored values
    }
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    localStorage.setItem(
      PREF_KEY,
      JSON.stringify({ wrapLines, fontSize, insightsOpen })
    );
  }, [wrapLines, fontSize, insightsOpen, prefsLoaded]);

  const fontSizeClass = `text-[${fontSize}px]`;

  const adjustFontSize = (delta: number) => {
    const index = FONT_SIZES.indexOf(fontSize);
    const nextIndex = Math.min(FONT_SIZES.length - 1, Math.max(0, index + delta));
    setFontSize(FONT_SIZES[nextIndex]);
  };

  const getSeverity = (line: string) => {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('critical') || lower.includes('fatal') || lower.includes('failed')) {
      return 'error';
    }
    if (lower.includes('warn') || lower.includes('warning')) {
      return 'warn';
    }
    return 'info';
  };

  const normalizeMessage = (line: string) => {
    return line
      .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
      .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>')
      .replace(/\b\d+\b/g, '<#>')
      .replace(/\s+/g, ' ')
      .trim();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const isTyping = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (isTyping) return;

      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && (key === '/' || key === 'f')) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && key === 'w') {
        event.preventDefault();
        setWrapLines(prev => !prev);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && (key === '+' || key === '=')) {
        event.preventDefault();
        adjustFontSize(1);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === '-') {
        event.preventDefault();
        adjustFontSize(-1);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === '0') {
        event.preventDefault();
        setFontSize(13);
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && key === 'l') {
        event.preventDefault();
        setIsLive(!isLive);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLive, setIsLive, fontSize]);

  const handleAnalyze = async () => {
    if (!content) return;
    setIsLive(false); // Pause live tailing
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      
      if (data.error) {
        // Handle API errors (e.g. rate limits)
        console.error("Analysis Error:", data.error);
        alert(`Analysis failed: ${data.error}`);
        return;
      }
      
      setAnalysis(data);
      setIsAiPanelOpen(true);
    } catch (err) {
      console.error(err);
      alert("Failed to connect to analysis service.");
    } finally {
      setAnalyzing(false);
    }
  };

  const lines = content ? content.split('\n') : [];
  const filteredLines = searchQuery 
    ? lines.map((line, index) => ({ line, index })).filter(item => item.line.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines.map((line, index) => ({ line, index }));
  const shouldWindow = !searchQuery && filteredLines.length > MAX_RENDER_LINES && !showAllLines;
  const windowStart = shouldWindow ? filteredLines.length - MAX_RENDER_LINES : 0;
  const windowedLines = shouldWindow ? filteredLines.slice(windowStart) : filteredLines;
  const allWindowed = lines.length > MAX_RENDER_LINES && !showAllLines
    ? lines.map((line, index) => ({ line, index })).slice(lines.length - MAX_RENDER_LINES)
    : lines.map((line, index) => ({ line, index }));
  const insightsLines = searchQuery ? windowedLines : allWindowed;

  const insightsData = useMemo(() => {
    const errorMap = new Map<string, { count: number; index: number; sample: string }>();
    const warnMap = new Map<string, { count: number; index: number; sample: string }>();
    const bucketCount = Math.min(36, Math.max(12, Math.ceil(insightsLines.length / 140)));
    const bucketSize = Math.max(1, Math.ceil(insightsLines.length / bucketCount));
    const buckets: Array<{ start: number; end: number; errors: number; warns: number }> = [];

    for (let i = 0; i < bucketCount; i += 1) {
      buckets.push({ start: i * bucketSize, end: Math.min(insightsLines.length, (i + 1) * bucketSize), errors: 0, warns: 0 });
    }

    insightsLines.forEach((item, idx) => {
      const severity = getSeverity(item.line);
      if (severity === 'error' || severity === 'warn') {
        const key = normalizeMessage(item.line);
        const sample = item.line.trim().slice(0, 140);
        const map = severity === 'error' ? errorMap : warnMap;
        const entry = map.get(key);
        if (entry) {
          entry.count += 1;
        } else {
          map.set(key, { count: 1, index: item.index, sample });
        }
        const bucketIndex = Math.min(buckets.length - 1, Math.floor(idx / bucketSize));
        if (severity === 'error') buckets[bucketIndex].errors += 1;
        if (severity === 'warn') buckets[bucketIndex].warns += 1;
      }
    });

    const toSorted = (map: Map<string, { count: number; index: number; sample: string }>) =>
      Array.from(map.entries())
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    const totals = buckets.map(bucket => bucket.errors + bucket.warns);
    const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const spikes = buckets
      .map((bucket, i) => ({ ...bucket, idx: i, total: bucket.errors + bucket.warns }))
      .filter(bucket => bucket.total >= Math.max(3, avg * 2))
      .slice(0, 4)
      .map(bucket => ({
        index: insightsLines[Math.min(bucket.start, insightsLines.length - 1)]?.index ?? 0,
        count: bucket.total,
        range: `${bucket.start + 1}-${Math.min(bucket.end, insightsLines.length)}`,
      }));

    return {
      topErrors: toSorted(errorMap),
      topWarns: toSorted(warnMap),
      buckets: buckets.map((bucket, i) => ({
        index: insightsLines[Math.min(bucket.start, insightsLines.length - 1)]?.index ?? 0,
        total: bucket.errors + bucket.warns,
        errors: bucket.errors,
        warns: bucket.warns,
        range: `${bucket.start + 1}-${Math.min(bucket.end, insightsLines.length)}`,
        id: `${i}-${bucket.start}`,
      })),
      spikes,
      totalLines: insightsLines.length,
    };
  }, [insightsLines]);

  if (loading && !content) { // Only show full loading if no content yet
    return <div className="flex-1 flex items-center justify-center text-zinc-500">Loading content...</div>;
  }

  if (!content) {
    return <div className="flex-1 flex items-center justify-center text-zinc-600">Select a file to view logs.</div>;
  }

    return (

      <div className="flex-1 flex flex-col bg-white dark:bg-[#09090b] h-screen overflow-hidden transition-colors">

        {/* Header */}

        <div className="min-h-[3.5rem] border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center px-6 py-2 bg-zinc-50 dark:bg-zinc-950 gap-3">

          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 min-w-0 flex-[1_1_240px]">

              <img src="/logo.svg" alt="Alogi logo" className="w-5 h-5 flex-shrink-0" />
              <Terminal className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />

              <span className="font-mono text-sm truncate">{filename}</span>

              {isLive && (

                  <span className="flex h-2 w-2 relative ml-2">

                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>

                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>

                  </span>

              )}

          </div>

  

          <div className="flex items-center gap-3 flex-1 flex-wrap justify-end min-w-0">

              <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                      onClick={onToggleHosts}
                      className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                          showHosts
                              ? "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                              : "border-indigo-300 dark:border-indigo-500/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                      )}
                  >
                      {showHosts ? 'Hide Hosts' : 'Show Hosts'}
                  </button>
                  <button
                      onClick={onToggleFiles}
                      className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                          showFiles
                              ? "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                              : "border-emerald-300 dark:border-emerald-500/60 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                      )}
                  >
                      {showFiles ? 'Hide Files' : 'Show Files'}
                  </button>
              </div>

              <button
                  ref={liveButtonRef}

                  onClick={() => setIsLive(!isLive)}

                  className={cn(

                      "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border whitespace-nowrap",

                      isLive 

                          ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/20" 

                          : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"

                  )}

              >

                  {isLive ? 'Live On' : 'Go Live'}

              </button>

              <button
                  ref={analyzeButtonRef}

                  onClick={handleAnalyze}

                  disabled={analyzing}

                  className={cn(

                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0",

                      analyzing

                          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed" 

                          : "bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 hover:from-indigo-500 hover:to-purple-500 dark:hover:from-indigo-400 dark:hover:to-purple-400 text-white shadow-lg shadow-indigo-500/20 cursor-pointer"

                  )}

              >

                  <Sparkles className="w-3 h-3" />

                  {analyzing ? 'Analyzing...' : analysis ? 'Re-Analyze' : 'AI Analyze'}

              </button>

              {analysis && (
                  <button
                      onClick={() => setIsAiPanelOpen(prev => !prev)}
                      className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                          isAiPanelOpen
                              ? "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                              : "border-indigo-300 dark:border-indigo-500/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                      )}
                  >
                      {isAiPanelOpen ? 'Hide AI' : 'Show AI'}
                  </button>
              )}

              <div className="relative flex-1 min-w-[220px] order-last w-full md:order-none md:min-w-[180px]">

                  <input 
                      ref={searchInputRef}

                      type="text" 

                      placeholder="Filter logs..." 

                      value={searchQuery}

                      onChange={(e) => setSearchQuery(e.target.value)}

                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md py-1.5 pl-8 pr-3 text-xs text-zinc-800 dark:text-zinc-200 dark:focus:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600"

                  />

                  <div className="absolute left-2.5 top-2 text-zinc-400 dark:text-zinc-500">

                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>

                  </div>

                  {searchQuery && (

                      <button 

                          onClick={() => setSearchQuery('')}

                          className="absolute right-2 top-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"

                      >

                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>

                      </button>

                  )}

              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                      onClick={() => setInsightsOpen(prev => !prev)}
                      className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border flex items-center gap-1",
                          insightsOpen
                              ? "border-indigo-300 dark:border-indigo-500/60 text-indigo-600 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-500/10"
                              : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                      )}
                      title="Toggle insights"
                  >
                      <BarChart3 className="w-3 h-3" />
                      Insights
                  </button>
                  <button
                      onClick={() => setWrapLines(prev => !prev)}
                      className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border",
                          wrapLines
                              ? "border-indigo-300 dark:border-indigo-500/60 text-indigo-600 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-500/10"
                              : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                      )}
                      title="Toggle line wrap (W)"
                  >
                      Wrap
                  </button>
                  <button
                      onClick={() => adjustFontSize(-1)}
                      disabled={fontSize <= FONT_SIZES[0]}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold transition-colors border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 disabled:opacity-40"
                      title="Decrease font size (Ctrl/Cmd -)"
                  >
                      A-
                  </button>
                  <button
                      onClick={() => setFontSize(13)}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold transition-colors border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                      title="Reset font size (Ctrl/Cmd 0)"
                  >
                      A
                  </button>
                  <button
                      onClick={() => adjustFontSize(1)}
                      disabled={fontSize >= FONT_SIZES[FONT_SIZES.length - 1]}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold transition-colors border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 disabled:opacity-40"
                      title="Increase font size (Ctrl/Cmd +)"
                  >
                      A+
                  </button>
              </div>

              

          </div>

        </div>

      {filteredLines.length > MAX_RENDER_LINES && !searchQuery && (
        <div className="px-6 py-2 text-xs bg-amber-50 text-amber-900 border-b border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/20 flex items-center justify-between">
          <span>
            Large log: {shouldWindow ? `showing last ${MAX_RENDER_LINES} of ${filteredLines.length} lines` : `showing all ${filteredLines.length} lines`}
          </span>
          <button
            onClick={() => setShowAllLines(!showAllLines)}
            className="text-xs px-2 py-1 rounded border border-amber-300 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
          >
            {shouldWindow ? 'Show all' : 'Show latest only'}
          </button>
        </div>
      )}

      <VibeCheckBar 
        lines={windowedLines.map(l => l.line)} 
        onScrollTo={(index) => {
            const container = scrollRef.current;
            if (!container) return;
            const child = container.children[index] as HTMLElement | undefined;
            if (!child) return;
            const targetTop = child.offsetTop - container.clientHeight / 2 + child.clientHeight / 2;
            container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        }}
        onScrub={(ratio) => {
            const container = scrollRef.current;
            if (!container) return;
            const totalScrollable = container.scrollHeight - container.clientHeight;
            if (totalScrollable <= 0) return;
            container.scrollTop = Math.max(0, Math.min(totalScrollable, ratio * totalScrollable));
        }}
        viewportStart={viewportRange.start}
        viewportEnd={viewportRange.end}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Code View */}
        <div 
            ref={scrollRef}
            onScroll={scheduleViewportUpdate}
            className="flex-1 overflow-auto p-4 font-mono text-sm text-zinc-300 leading-relaxed custom-scrollbar"
        >
            {windowedLines.length > 0 ? windowedLines.map(({ line, index }) => (
                <LogLine
                  key={index}
                  line={line}
                  index={index}
                  wrapLines={wrapLines}
                  fontSizeClass={fontSizeClass}
                  searchQuery={searchQuery}
                />
            )) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-2">
                    <div className="text-sm italic">No matches found for {`"${searchQuery}"`}</div>
                    <button onClick={() => setSearchQuery('')} className="text-xs text-indigo-400 hover:underline">Clear search</button>
                </div>
            )}
        </div>

        {insightsOpen && (
            <div className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0b0d12]">
                <InsightsPanel
                  data={insightsData}
                  onJump={(index) => {
                    const position = windowedLines.findIndex(item => item.index === index);
                    if (position === -1) return;
                    const child = scrollRef.current?.children[position] as HTMLElement | undefined;
                    if (child) {
                      const targetTop = child.offsetTop - scrollRef.current!.clientHeight / 2 + child.clientHeight / 2;
                      scrollRef.current?.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
                    }
                  }}
                />
            </div>
        )}

        {/* AI Panel (Slide in) */}
        {analysis && content && isAiPanelOpen && (
            <div className="animate-in slide-in-from-right duration-300 h-full border-l border-zinc-800">
                <ChatPanel initialSummary={analysis} logContext={content} />
            </div>
        )}
      </div>
    </div>
  );
}
