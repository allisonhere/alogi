import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BarChart3, Bookmark, Clock, Sparkles, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractTimestamp } from '@/lib/logParser';
import { VibeCheckBar } from './VibeCheckBar';
import { ChatPanel } from './ChatPanel';
import { InsightsPanel } from './InsightsPanel';
import LogLine from '@/components/LogLine';
import { useLogScroller } from '@/hooks/useLogScroller';

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [showAllLines, setShowAllLines] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);
  const [fontSize, setFontSize] = useState(13);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [timeRange, setTimeRange] = useState<{ start: string; end: string } | null>(null);
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset analysis and search when file changes
  useEffect(() => {
    setAnalysis(null);
    setIsAiPanelOpen(false);
    setSearchQuery('');
    setDebouncedSearch('');
    setIsRegex(false);
    setShowAllLines(false);
    setBookmarks(new Set());
    setShowBookmarks(false);
    setTimeRange(null);
    setShowTimeFilter(false);
    setTimeStart('');
    setTimeEnd('');
  }, [filename]);

  const fontSizeClass = `text-[${fontSize}px]`;

  // Prepare lines data
  const lines = useMemo(() => content ? content.split('\n') : [], [content]);

  // Debounce search input — only debounce on large logs
  useEffect(() => {
    if (!searchQuery) { setDebouncedSearch(''); return; }
    if (lines.length < 5000) { setDebouncedSearch(searchQuery); return; }
    const id = setTimeout(() => setDebouncedSearch(searchQuery), 100);
    return () => clearTimeout(id);
  }, [searchQuery, lines.length]);

  // Precompute timestamps once per content change
  const lineTimestamps = useMemo(() => lines.map(line => extractTimestamp(line)), [lines]);

  const filterResult = useMemo(() => {
    const allLines = lines.map((line, index) => ({ line, index }));
    if (!debouncedSearch) return { lines: allLines, regexError: null };

    if (isRegex) {
        try {
            const regex = new RegExp(debouncedSearch, 'i');
            return { lines: allLines.filter(item => regex.test(item.line)), regexError: null };
        } catch (e) {
            const msg = e instanceof SyntaxError ? e.message.replace(/^Invalid regular expression: /, '') : 'Invalid regex';
            return { lines: allLines, regexError: msg };
        }
    }

    const lower = debouncedSearch.toLowerCase();
    return { lines: allLines.filter(item => item.line.toLowerCase().includes(lower)), regexError: null };
  }, [lines, debouncedSearch, isRegex]);

  const filteredLines = filterResult.lines;
  const regexError = filterResult.regexError;

  const timeFilteredLines = useMemo(() => {
    if (!timeRange) return filteredLines;
    const [startH, startM] = timeRange.start.split(':').map(Number);
    const [endH, endM] = timeRange.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return filteredLines.filter(item => {
      const ts = lineTimestamps[item.index];
      if (!ts) return true;
      const mins = ts.getHours() * 60 + ts.getMinutes();
      return startMinutes <= endMinutes
        ? mins >= startMinutes && mins <= endMinutes
        : mins >= startMinutes || mins <= endMinutes;
    });
  }, [filteredLines, timeRange, lineTimestamps]);

  // Detect time range in log — only computed when time filter dropdown is open
  const detectedTimeRange = useMemo(() => {
    if (!showTimeFilter || !lineTimestamps.length) return null;
    let earliest: string | null = null;
    let latest: string | null = null;
    for (const ts of lineTimestamps) {
      if (ts) {
        const hm = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`;
        if (!earliest) earliest = hm;
        latest = hm;
      }
    }
    if (!earliest || !latest) return null;
    return { earliest, latest };
  }, [showTimeFilter, lineTimestamps]);

  const shouldWindow = !debouncedSearch && !timeRange && timeFilteredLines.length > MAX_RENDER_LINES && !showAllLines;
  const windowStart = shouldWindow ? timeFilteredLines.length - MAX_RENDER_LINES : 0;
  const windowedLines = shouldWindow ? timeFilteredLines.slice(windowStart) : timeFilteredLines;
  const shouldVirtualize = !wrapLines && windowedLines.length > MAX_RENDER_LINES;
  const rowHeight = fontSize + 12;

  // Use the custom hook for scrolling logic
  const { 
    scrollRef, 
    viewportRange, 
    scheduleViewportUpdate, 
    scrollToBottom, 
    startIndex, 
    endIndex, 
    visibleCount 
  } = useLogScroller({
    contentLength: windowedLines.length,
    rowHeight,
    overscan: 12
  });

  const visibleLines = shouldVirtualize ? windowedLines.slice(startIndex, endIndex) : windowedLines;

  // Auto-scroll to bottom in live mode
  useEffect(() => {
    if (isLive) {
        scrollToBottom();
    }
  }, [content, isLive, scrollToBottom]);

  // Update viewport when content changes
  useEffect(() => {
    scheduleViewportUpdate();
  }, [content, debouncedSearch, showAllLines, isLive, scheduleViewportUpdate]);

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

  const toggleBookmark = useCallback((index: number) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const jumpToLine = useCallback((index: number) => {
    const position = windowedLines.findIndex(item => item.index === index);
    if (position === -1) return;
    const container = scrollRef.current;
    if (!container) return;
    if (shouldVirtualize) {
      const targetTop = position * rowHeight - container.clientHeight / 2 + rowHeight / 2;
      container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      return;
    }
    const child = container.children[position] as HTMLElement | undefined;
    if (child) {
      const targetTop = child.offsetTop - container.clientHeight / 2 + child.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    }
  }, [windowedLines, shouldVirtualize, rowHeight, scrollRef]);

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
      if ((event.metaKey || event.ctrlKey) && key === 'r') {
        event.preventDefault();
        setIsRegex(prev => !prev);
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
      if ((event.metaKey || event.ctrlKey) && key === 'b') {
        event.preventDefault();
        // Toggle bookmark on line closest to viewport center
        const container = scrollRef.current;
        if (container && windowedLines.length > 0) {
          const centerY = container.scrollTop + container.clientHeight / 2;
          let centerIndex: number;
          if (shouldVirtualize) {
            centerIndex = Math.min(windowedLines.length - 1, Math.max(0, Math.round(centerY / rowHeight)));
          } else {
            // Find child closest to center
            centerIndex = 0;
            let minDist = Infinity;
            for (let i = 0; i < container.children.length; i++) {
              const child = container.children[i] as HTMLElement;
              const childCenter = child.offsetTop + child.clientHeight / 2;
              const dist = Math.abs(childCenter - centerY);
              if (dist < minDist) { minDist = dist; centerIndex = i; }
            }
          }
          if (windowedLines[centerIndex]) {
            toggleBookmark(windowedLines[centerIndex].index);
          }
        }
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && key === 'l') {
        event.preventDefault();
        setIsLive(!isLive);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLive, setIsLive, fontSize, toggleBookmark, windowedLines, shouldVirtualize, rowHeight, scrollRef]);

  const handleAnalyze = async () => {
    if (!content) return;
    setIsLive(false); // Pause live tailing
    setAnalyzing(true);
    const analysisContent = (debouncedSearch || timeRange)
      ? timeFilteredLines.map(item => item.line).join('\n')
      : content;
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: analysisContent }),
      });
      const data = await res.json();
      
      if (data.error) {
        // Handle API errors (e.g. rate limits)
        console.error("Analysis Error:", data.error);
        const message = String(data.error);
        if (message.toLowerCase().includes('api key') && message.toLowerCase().includes('missing')) {
          alert('No API key set. Open Settings → AI Configuration to add a key.');
        } else if (message.toLowerCase().includes('ai features are disabled')) {
          alert('AI features are disabled. Enable them in Settings → AI Configuration.');
        } else {
          alert(`Analysis failed: ${data.error}`);
        }
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

  const allWindowed = lines.length > MAX_RENDER_LINES && !showAllLines
    ? lines.map((line, index) => ({ line, index })).slice(lines.length - MAX_RENDER_LINES)
    : lines.map((line, index) => ({ line, index }));
  const insightsLines = debouncedSearch ? windowedLines : allWindowed;

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

      <div className="flex-1 flex flex-col bg-white dark:bg-[#09090b] h-screen min-h-0 overflow-hidden transition-colors">

        {/* Header */}

        <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <div className="px-6 py-2">
            <div className="flex flex-wrap items-start gap-4">

              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 min-w-0">

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

              </div>

              <div className="flex items-center gap-3 flex-wrap justify-end min-w-0">

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

                              : "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/20"

                      )}

                  >

                      <span className="flex items-center gap-2">
                          {isLive && (
                              <span className="relative flex h-2 w-2">
                                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                              </span>
                          )}
                          {isLive ? 'Live On' : 'Live Off'}
                      </span>

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

                  <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="relative">
                        <button
                            onClick={() => setShowTimeFilter(prev => !prev)}
                            className={cn(
                                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border flex items-center gap-1",
                                timeRange
                                    ? "border-indigo-300 dark:border-indigo-500/60 text-indigo-600 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-500/10"
                                    : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                            )}
                            title="Filter by time range"
                        >
                            <Clock className="w-3 h-3" />
                            Time
                            {timeRange && (
                              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[9px] leading-none font-bold">
                                {timeRange.start}-{timeRange.end}
                              </span>
                            )}
                        </button>
                        {showTimeFilter && (
                          <div className="absolute top-full right-0 mt-1 z-50 w-64 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <label className="text-[11px] text-zinc-500 dark:text-zinc-400 w-10">Start</label>
                              <input
                                type="time"
                                value={timeStart}
                                onChange={(e) => setTimeStart(e.target.value)}
                                className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-[11px] text-zinc-500 dark:text-zinc-400 w-10">End</label>
                              <input
                                type="time"
                                value={timeEnd}
                                onChange={(e) => setTimeEnd(e.target.value)}
                                className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                              />
                            </div>
                            {detectedTimeRange ? (
                              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                Log range: {detectedTimeRange.earliest} &ndash; {detectedTimeRange.latest}
                              </p>
                            ) : (
                              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">No timestamps detected</p>
                            )}
                            <div className="flex gap-1.5 pt-1">
                              <button
                                onClick={() => {
                                  if (timeStart && timeEnd) {
                                    setTimeRange({ start: timeStart, end: timeEnd });
                                    setShowTimeFilter(false);
                                  }
                                }}
                                disabled={!timeStart || !timeEnd}
                                className="flex-1 px-2 py-1 rounded text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                Apply
                              </button>
                              <button
                                onClick={() => {
                                  setTimeRange(null);
                                  setTimeStart('');
                                  setTimeEnd('');
                                  setShowTimeFilter(false);
                                }}
                                className="flex-1 px-2 py-1 rounded text-[11px] font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <button
                            onClick={() => setShowBookmarks(prev => !prev)}
                            className={cn(
                                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border flex items-center gap-1",
                                showBookmarks
                                    ? "border-indigo-300 dark:border-indigo-500/60 text-indigo-600 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-500/10"
                                    : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                            )}
                            title="Toggle bookmarks (Ctrl/Cmd + B to bookmark a line)"
                        >
                            <Bookmark className="w-3 h-3" />
                            Bookmarks
                            {bookmarks.size > 0 && (
                              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[9px] leading-none font-bold">
                                {bookmarks.size}
                              </span>
                            )}
                        </button>
                        {showBookmarks && bookmarks.size > 0 && (
                          <div className="absolute top-full right-0 mt-1 z-50 w-80 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl">
                            <div className="p-2 space-y-0.5">
                              {Array.from(bookmarks).sort((a, b) => a - b).map(idx => {
                                const lineText = lines[idx] ?? '';
                                const severity = getSeverity(lineText);
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => { jumpToLine(idx); setShowBookmarks(false); }}
                                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 group transition-colors"
                                  >
                                    <span className={cn(
                                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                      severity === 'error' ? "bg-red-500" : severity === 'warn' ? "bg-orange-400" : "bg-zinc-400"
                                    )} />
                                    <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 flex-shrink-0 w-8 text-right">{idx + 1}</span>
                                    <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate font-mono">{lineText.trim().slice(0, 80)}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="border-t border-zinc-200 dark:border-zinc-700 p-1.5">
                              <button
                                onClick={() => { setBookmarks(new Set()); setShowBookmarks(false); }}
                                className="w-full text-center text-[11px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 py-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              >
                                Clear all bookmarks
                              </button>
                            </div>
                          </div>
                        )}
                        {showBookmarks && bookmarks.size === 0 && (
                          <div className="absolute top-full right-0 mt-1 z-50 w-64 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-4 text-center">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">No bookmarks yet.</p>
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">Click the gutter icon or press Ctrl+B</p>
                          </div>
                        )}
                      </div>
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
            <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="relative w-full max-w-[420px]">

                    <input
                        ref={searchInputRef}

                        type="text"

                        aria-label="Filter logs"

                        placeholder={isRegex ? "Filter logs (Regex)..." : "Filter logs..."}

                        value={searchQuery}

                        onChange={(e) => setSearchQuery(e.target.value)}

                        className={cn(
                            "w-full bg-white dark:bg-zinc-900 border rounded-md py-1.5 pl-8 pr-16 text-xs text-zinc-800 dark:text-zinc-200 dark:focus:text-white focus:outline-none focus:ring-1 transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600",
                            regexError
                                ? "border-red-400 dark:border-red-500 focus:ring-red-500/50"
                                : "border-zinc-200 dark:border-zinc-800 focus:ring-indigo-500/50"
                        )}

                    />
                    {regexError && (
                        <div className="absolute left-0 top-full mt-1 text-[10px] text-red-500 dark:text-red-400 truncate max-w-full px-1">
                            {regexError}
                        </div>
                    )}

                    <div className="absolute left-2.5 top-2 text-zinc-400 dark:text-zinc-500">

                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>

                    </div>

                    <div className="absolute right-2 top-1.5 flex items-center gap-1">
                        <button
                            onClick={() => setIsRegex(prev => !prev)}
                            className={cn(
                                "p-0.5 rounded text-[10px] font-mono font-bold transition-colors",
                                isRegex 
                                    ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300" 
                                    : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
                            )}
                            title="Toggle Regex (Ctrl/Cmd + R)"
                        >
                            .*
                        </button>
                        {searchQuery && (

                            <button 

                                onClick={() => setSearchQuery('')}

                                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"

                            >

                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>

                            </button>

                        )}
                    </div>

                </div>
                <div className="ml-auto flex-shrink-0">
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
                </div>
            </div>
          </div>

        </div>

      {timeFilteredLines.length > MAX_RENDER_LINES && !debouncedSearch && !timeRange && (
        <div className="px-6 py-2 text-xs bg-amber-50 text-amber-900 border-b border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/20 flex items-center justify-between">
          <span className="flex flex-wrap items-center gap-2">
            Large log: {shouldWindow ? `showing last ${MAX_RENDER_LINES} of ${timeFilteredLines.length} lines` : `showing all ${timeFilteredLines.length} lines`}
            {wrapLines && (
              <span className="text-amber-700/80 dark:text-amber-200/70">
                Tip: turn off Wrap for smoother scrolling.
              </span>
            )}
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
            if (shouldVirtualize) {
              const targetTop = index * rowHeight - container.clientHeight / 2 + rowHeight / 2;
              container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
              return;
            }
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

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Code View */}
        <div 
            ref={scrollRef}
            onScroll={scheduleViewportUpdate}
            className="flex-1 min-h-0 overflow-auto p-4 font-mono text-sm text-zinc-300 leading-relaxed custom-scrollbar"
        >
            {windowedLines.length > 0 ? (
              shouldVirtualize ? (
                <div style={{ height: windowedLines.length * rowHeight, position: 'relative' }}>
                  {visibleLines.map(({ line, index }, i) => {
                    const absoluteIndex = startIndex + i;
                    return (
                      <div
                        key={index}
                        style={{
                          position: 'absolute',
                          top: absoluteIndex * rowHeight,
                          left: 0,
                          right: 0,
                          height: rowHeight,
                          overflow: 'hidden',
                        }}
                      >
                        <LogLine
                          line={line}
                          index={index}
                          wrapLines={wrapLines}
                          fontSizeClass={fontSizeClass}
                          searchQuery={debouncedSearch}
                          isRegex={isRegex}
                          disablePrettyJson
                          isBookmarked={bookmarks.has(index)}
                          onToggleBookmark={toggleBookmark}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                windowedLines.map(({ line, index }) => (
                  <LogLine
                    key={index}
                    line={line}
                    index={index}
                    wrapLines={wrapLines}
                    fontSizeClass={fontSizeClass}
                    searchQuery={searchQuery}
                    isRegex={isRegex}
                    disablePrettyJson
                    isBookmarked={bookmarks.has(index)}
                    onToggleBookmark={toggleBookmark}
                  />
                ))
              )
            ) : (
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
                    if (shouldVirtualize && scrollRef.current) {
                      const targetTop = position * rowHeight - scrollRef.current.clientHeight / 2 + rowHeight / 2;
                      scrollRef.current.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
                      return;
                    }
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
