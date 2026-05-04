import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Bookmark, Clock, Sparkles, Terminal, PanelLeft, FolderOpen, WrapText, Minus, Plus, Type, Copy, Clipboard, Filter, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractTimestamp } from '@/lib/logParser';
import { VibeCheckBar } from './VibeCheckBar';
import { ChatPanel } from './ChatPanel';
import { InsightsPanel } from './InsightsPanel';
import LogLine from '@/components/LogLine';
import { useLogScroller } from '@/hooks/useLogScroller';
import { debug } from '@/lib/debug';
import { normalizeAiError, type AiErrorState } from '@/lib/aiErrors';

const FONT_SIZES = [11, 12, 13, 14, 15, 16];

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
  fileSize?: number;
  selectedHost?: string | null;
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
  fileSize,
  selectedHost,
}: LogViewerProps) {
  const PREF_KEY = 'alogi.logViewerPrefs';
  const MAX_RENDER_LINES = 5000;
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<AiErrorState | null>(null);
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
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    lineIndex: number;
    lineText: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const timeFilterButtonRef = useRef<HTMLButtonElement>(null);
  const [timeFilterPosition, setTimeFilterPosition] = useState<{ top: number; right: number } | null>(null);

  const updateTimeFilterPosition = useCallback(() => {
    const rect = timeFilterButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTimeFilterPosition({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, []);

  // Reset analysis and search when file changes
  useEffect(() => {
    setAnalysis(null);
    setAnalysisError(null);
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

  // Pass fontSize directly for inline styles (dynamic Tailwind classes don't work)

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

  useEffect(() => {
    if (!showTimeFilter) return;

    updateTimeFilterPosition();
    window.addEventListener('resize', updateTimeFilterPosition);
    window.addEventListener('scroll', updateTimeFilterPosition, true);
    return () => {
      window.removeEventListener('resize', updateTimeFilterPosition);
      window.removeEventListener('scroll', updateTimeFilterPosition, true);
    };
  }, [showTimeFilter, updateTimeFilterPosition]);

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
    endIndex
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

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, index: number, line: string) => {
    e.preventDefault();
    const menuWidth = 180;
    const menuHeight = 200;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
    setContextMenu({ x, y, lineIndex: index, lineText: line });
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      // Fallback for Electron/non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }, []);

  const handleCopy = useCallback(() => {
    if (!contextMenu) return;
    copyToClipboard(contextMenu.lineText);
    setContextMenu(null);
  }, [contextMenu, copyToClipboard]);

  const handleCopyWithContext = useCallback(() => {
    if (!contextMenu) return;
    const start = Math.max(0, contextMenu.lineIndex - 5);
    const end = Math.min(lines.length, contextMenu.lineIndex + 6);
    const context = lines.slice(start, end).join('\n');
    copyToClipboard(context);
    setContextMenu(null);
  }, [contextMenu, lines, copyToClipboard]);

  const handleContextBookmark = useCallback(() => {
    if (!contextMenu) return;
    toggleBookmark(contextMenu.lineIndex);
    setContextMenu(null);
  }, [contextMenu, toggleBookmark]);

  const handleFilterToThis = useCallback(() => {
    if (!contextMenu) return;
    // Extract key part (remove timestamp, keep message)
    const filtered = contextMenu.lineText.replace(/^\[?[\d\-T:.Z]+\]?\s*/, '').trim();
    setSearchQuery(filtered.slice(0, 60));
    setContextMenu(null);
  }, [contextMenu]);

  const handleSearchSimilar = useCallback(() => {
    if (!contextMenu) return;
    // Extract key identifiers like error codes, function names
    const match = contextMenu.lineText.match(/error|warn|exception|failed|Error: .+?(?=\s|$)/i);
    setSearchQuery(match ? match[0] : contextMenu.lineText.slice(0, 40));
    setContextMenu(null);
  }, [contextMenu]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

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

  const adjustFontSize = useCallback((delta: number) => {
    const index = FONT_SIZES.indexOf(fontSize);
    const nextIndex = Math.min(FONT_SIZES.length - 1, Math.max(0, index + delta));
    setFontSize(FONT_SIZES[nextIndex]);
  }, [fontSize]);

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
  }, [isLive, setIsLive, adjustFontSize, toggleBookmark, windowedLines, shouldVirtualize, rowHeight, scrollRef]);

  const handleAnalyze = async () => {
    if (!content) return;
    setIsLive(false); // Pause live tailing
    setAnalyzing(true);
    setAnalysisError(null);
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
        debug.error("Analysis Error:", data.error);
        const errState = normalizeAiError(String(data.error));
        setAnalysisError(errState);
        setIsAiPanelOpen(true);
        return;
      }
      
      setAnalysis(data);
      setIsAiPanelOpen(true);
    } catch (err) {
      debug.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setAnalysisError(normalizeAiError(message));
      setIsAiPanelOpen(true);
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

  // Status bar helpers
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getHostType = () => {
    if (!selectedHost) return null;
    if (selectedHost === '(system-journal)') return 'journal';
    if (selectedHost.startsWith('remote:')) return 'ssh';
    return 'local';
  };

  const hostType = getHostType();
  const hasContent = Boolean(content);

    return (

      <main className="flex-1 flex flex-col app-shell h-screen min-h-0 overflow-hidden transition-colors" onContextMenu={(e) => e.preventDefault()}>

        {/* Header */}

        <div className="theme-pane-header z-20 border-b border-subtle app-panel">
          <div className="px-6 py-3 space-y-3">
            <div className="flex items-start gap-4">

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 min-w-0">

                    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-subtle bg-[var(--surface-bg)]">
                      <Terminal className="w-4 h-4 text-accent flex-shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <div className="ui-section-label">Current source</div>
                      <span className="font-mono text-sm text-primary truncate block">{filename ?? 'No file selected'}</span>
                    </div>

                    {isLive && (

                        <span className="flex h-2 w-2 relative ml-2">

                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>

                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>

                        </span>

                    )}

                </div>

              </div>
            </div>
            <div className="-mx-2 px-2 toolbar-scroll">
              <div className="flex min-w-max items-center gap-2 whitespace-nowrap">

                  <div className="flex flex-shrink-0 items-center gap-2" role="group" aria-label="Panel toggles">
                      <button
                          onClick={onToggleHosts}
                          aria-pressed={showHosts}
                          className={cn(
                              "theme-toolbar-button ui-control px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5",
                              showHosts ? "ui-control-active border border-[var(--border-strong)]" : "ui-control-secondary"
                          )}
                          title={showHosts ? 'Hide hosts panel' : 'Show hosts panel'}
                      >
                          <PanelLeft className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Hosts</span>
                      </button>
                      <button
                          onClick={onToggleFiles}
                          aria-pressed={showFiles}
                          className={cn(
                              "theme-toolbar-button ui-control px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5",
                              showFiles ? "ui-control-active border border-[var(--border-strong)]" : "ui-control-secondary"
                          )}
                          title={showFiles ? 'Hide files panel' : 'Show files panel'}
                      >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Files</span>
                      </button>
                  </div>

                  <div className="h-6 w-px bg-[var(--border-subtle)] flex-shrink-0" />

                  <button
                      ref={liveButtonRef}
                      onClick={() => setIsLive(!isLive)}
                      aria-pressed={isLive}
                      className={cn(
                          "theme-toolbar-button ui-control px-3 py-1.5 text-xs font-medium flex items-center gap-2 whitespace-nowrap flex-shrink-0",
                          isLive ? "ui-control-success hover:brightness-110" : "ui-control-secondary"
                      )}
                      title={isLive ? 'Disable live updates' : 'Enable live updates'}
                  >
                      {isLive && (
                          <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                          </span>
                      )}
                      {isLive ? 'Live' : 'Paused'}
                  </button>

                  <div className="h-6 w-px bg-[var(--border-subtle)] flex-shrink-0" />

                  <div className="theme-toolbar-group ui-control-group flex-shrink-0">
                      <div className="relative">
                        <button
                            ref={timeFilterButtonRef}
                            onClick={() => {
                              setShowTimeFilter(prev => {
                                if (prev) {
                                  setTimeFilterPosition(null);
                                  return false;
                                }
                                updateTimeFilterPosition();
                                return true;
                              });
                            }}
                            className={cn(
                                "theme-toolbar-button ui-control-segment px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5",
                                timeRange ? "ui-control-active" : "ui-control-ghost"
                            )}
                            title="Filter by time range"
                        >
                            <Clock className="w-3.5 h-3.5" />
                            {timeRange && (
                              <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-[9px] leading-none font-bold">
                                {timeRange.start}-{timeRange.end}
                              </span>
                            )}
                        </button>
                        {showTimeFilter && timeFilterPosition && typeof document !== 'undefined' && createPortal(
                          <div
                            className="fixed z-[70] w-64 rounded-2xl border border-subtle app-panel-strong p-3 space-y-2"
                            style={{ top: timeFilterPosition.top, right: timeFilterPosition.right }}
                          >
                            <div className="flex items-center gap-2">
                              <label className="text-[11px] text-muted w-10">Start</label>
                              <input
                                type="time"
                                value={timeStart}
                                onChange={(e) => setTimeStart(e.target.value)}
                                className="ui-input flex-1 px-2 py-1 text-xs"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-[11px] text-muted w-10">End</label>
                              <input
                                type="time"
                                value={timeEnd}
                                onChange={(e) => setTimeEnd(e.target.value)}
                                className="ui-input flex-1 px-2 py-1 text-xs"
                              />
                            </div>
                            {detectedTimeRange ? (
                              <p className="text-[10px] text-muted">
                                Log range: {detectedTimeRange.earliest} &ndash; {detectedTimeRange.latest}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted">No timestamps detected</p>
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
                                className="ui-button ui-button-primary flex-1 px-2 py-1 text-[11px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
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
                                className="ui-button ui-button-secondary flex-1 px-2 py-1 text-[11px] font-medium"
                              >
                                Clear
                              </button>
                            </div>
                          </div>,
                          document.body
                        )}
                      </div>
                      <div className="relative">
                        <button
                            onClick={() => setShowBookmarks(prev => !prev)}
                            className={cn(
                                "theme-toolbar-button ui-control-segment px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5",
                                showBookmarks ? "ui-control-active" : "ui-control-ghost"
                            )}
                            title="Toggle bookmarks (Ctrl/Cmd + B to bookmark a line)"
                        >
                            <Bookmark className="w-3.5 h-3.5" />
                            {bookmarks.size > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[9px] leading-none font-bold">
                                {bookmarks.size}
                              </span>
                            )}
                        </button>
                        {showBookmarks && bookmarks.size > 0 && (
                          <div className="absolute top-full right-0 mt-1 z-[70] w-80 max-h-64 overflow-y-auto rounded-2xl border border-subtle app-panel-strong">
                            <div className="p-2 space-y-0.5">
                              {Array.from(bookmarks).sort((a, b) => a - b).map(idx => {
                                const lineText = lines[idx] ?? '';
                                const severity = getSeverity(lineText);
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => { jumpToLine(idx); setShowBookmarks(false); }}
                                    className="w-full text-left px-2 py-1.5 rounded-xl hover:bg-[var(--surface-hover)] flex items-center gap-2 group transition-colors"
                                  >
                                    <span className={cn(
                                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                      severity === 'error' ? "bg-red-500" : severity === 'warn' ? "bg-orange-400" : "bg-zinc-400"
                                    )} />
                                    <span className="text-[11px] font-mono text-muted flex-shrink-0 w-8 text-right">{idx + 1}</span>
                                    <span className="text-xs text-secondary truncate font-mono">{lineText.trim().slice(0, 80)}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="border-t border-subtle p-1.5">
                              <button
                                onClick={() => { setBookmarks(new Set()); setShowBookmarks(false); }}
                                className="w-full text-center text-[11px] text-[var(--danger)] py-1 rounded-xl hover:bg-[var(--danger-soft)] transition-colors"
                              >
                                Clear all bookmarks
                              </button>
                            </div>
                          </div>
                        )}
                        {showBookmarks && bookmarks.size === 0 && (
                          <div className="absolute top-full right-0 mt-1 z-[70] w-64 rounded-2xl border border-subtle app-panel-strong p-4 text-center">
                            <p className="text-xs text-secondary">No bookmarks yet.</p>
                            <p className="text-[10px] text-muted mt-1">Click the gutter icon or press Ctrl+B</p>
                          </div>
                        )}
                      </div>
                      <button
                          onClick={() => setInsightsOpen(prev => !prev)}
                          className={cn(
                              "theme-toolbar-button ui-control-segment px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5",
                              insightsOpen ? "ui-control-active" : "ui-control-ghost"
                          )}
                          title="Toggle insights"
                      >
                          <BarChart3 className="w-3.5 h-3.5" />
                      </button>
                  </div>

                  <div className="h-6 w-px bg-[var(--border-subtle)] flex-shrink-0" />

                  <div className="theme-toolbar-group ui-control-group flex-shrink-0">
                      <button
                          onClick={() => setWrapLines(prev => !prev)}
                          className={cn(
                              "theme-toolbar-button ui-control-segment px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5",
                              wrapLines ? "ui-control-active" : "ui-control-ghost"
                          )}
                          title="Toggle line wrap (W)"
                      >
                          <WrapText className="w-3.5 h-3.5" />
                      </button>
                      <button
                          onClick={() => adjustFontSize(-1)}
                          disabled={fontSize <= FONT_SIZES[0]}
                          className="theme-toolbar-button ui-control-segment ui-control-ghost px-2 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Decrease font size (Ctrl/Cmd -)"
                      >
                          <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                          onClick={() => setFontSize(13)}
                          className="theme-toolbar-button ui-control-segment ui-control-ghost px-2 py-1.5 text-xs font-medium"
                          title="Reset font size (Ctrl/Cmd 0)"
                      >
                          <Type className="w-3.5 h-3.5" />
                      </button>
                      <button
                          onClick={() => adjustFontSize(1)}
                          disabled={fontSize >= FONT_SIZES[FONT_SIZES.length - 1]}
                          className="theme-toolbar-button ui-control-segment ui-control-ghost px-2 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Increase font size (Ctrl/Cmd +)"
                      >
                          <Plus className="w-3.5 h-3.5" />
                      </button>
                  </div>

                  <div className="h-6 w-px bg-[var(--border-subtle)] flex-shrink-0" />

                  <div className="relative min-w-[280px] flex-1 max-w-[420px]">

                    <input
                        ref={searchInputRef}

                        type="text"

                        aria-label="Filter logs"

                        placeholder={isRegex ? "Filter logs (Regex)..." : "Filter logs..."}

                        value={searchQuery}

                        onChange={(e) => setSearchQuery(e.target.value)}

                        className={cn(
                            "w-full ui-input py-1.5 pl-8 pr-16 text-xs min-w-0",
                            regexError
                                ? "border-[var(--danger)] focus:ring-[var(--danger)]/50"
                                : ""
                        )}

                    />
                    {regexError && (
                        <div className="absolute left-0 top-full mt-1 text-[10px] text-[var(--danger)] truncate max-w-full px-1">
                            {regexError}
                        </div>
                    )}

                    <div className="absolute left-2.5 top-2 text-muted">

                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>

                    </div>

                    <div className="absolute right-2 top-1.5 flex items-center gap-1">
                        <button
                            onClick={() => setIsRegex(prev => !prev)}
                            className={cn(
                                "ui-control-icon ui-control-ghost px-1.5 text-[10px] font-mono font-bold",
                                isRegex ? "ui-control-active" : ""
                            )}
                            title="Toggle Regex (Ctrl/Cmd + R)"
                        >
                            .*
                        </button>
                        {searchQuery && (

                            <button 

                                onClick={() => setSearchQuery('')}

                                className="ui-control-icon ui-control-ghost p-1"

                            >

                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>

                            </button>

                        )}
                    </div>

                  </div>
                  <button
                      ref={analyzeButtonRef}
                      onClick={() => {
                          if (analysis) {
                              setIsAiPanelOpen(prev => !prev);
                          } else {
                              handleAnalyze();
                          }
                      }}
                      disabled={analyzing}
                      className={cn(
                          "theme-toolbar-button ui-control flex items-center gap-2 px-3 py-1.5 text-xs font-medium flex-shrink-0",
                          analyzing
                              ? "ui-control-secondary cursor-not-allowed"
                              : "ui-control-primary shadow-lg cursor-pointer hover:brightness-110"
                      )}
                  >
                      <Sparkles className="w-3 h-3" />
                      {analyzing ? 'Analyzing...' : analysis ? (isAiPanelOpen ? 'Hide AI' : 'Show AI') : 'AI Analyze'}
                  </button>
              </div>
            </div>
          </div>

        </div>

      {timeFilteredLines.length > MAX_RENDER_LINES && !debouncedSearch && !timeRange && (
        <div className="relative z-0 px-6 py-2 text-xs bg-warning-soft text-[var(--warning)] border-b border-subtle flex items-center justify-between">
          <span className="flex flex-wrap items-center gap-2">
            Large log: {shouldWindow ? `showing last ${MAX_RENDER_LINES} of ${timeFilteredLines.length} lines` : `showing all ${timeFilteredLines.length} lines`}
            {wrapLines && (
              <span className="text-[var(--text-secondary)]">
                Tip: turn off Wrap for smoother scrolling.
              </span>
            )}
          </span>
          <button
            onClick={() => setShowAllLines(!showAllLines)}
            className="ui-button ui-button-secondary text-xs px-2 py-1"
          >
            {shouldWindow ? 'Show all' : 'Show latest only'}
          </button>
        </div>
      )}

      <div className="relative z-0">
      {hasContent && (
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
      )}
      </div>

      <div className="relative z-0 flex-1 flex min-h-0 overflow-hidden">
        {/* Code View */}
        <div
            ref={scrollRef}
            role="log"
            aria-label="Log output"
            aria-live={isLive ? 'polite' : 'off'}
            onScroll={scheduleViewportUpdate}
            className="flex-1 min-h-0 overflow-auto p-4 font-mono text-sm text-primary leading-relaxed custom-scrollbar"
        >
            {!hasContent ? (
              <div
                className="flex h-full items-center justify-center text-zinc-600"
                role="status"
                aria-live={loading ? 'polite' : 'off'}
              >
                {loading ? 'Loading content...' : 'Select a file to view logs.'}
              </div>
            ) : windowedLines.length > 0 ? (
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
                          fontSize={fontSize}
                          searchQuery={debouncedSearch}
                          isRegex={isRegex}
                          disablePrettyJson
                          isBookmarked={bookmarks.has(index)}
                          onToggleBookmark={toggleBookmark}
                          onContextMenu={handleContextMenu}
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
                    fontSize={fontSize}
                    searchQuery={searchQuery}
                    isRegex={isRegex}
                    disablePrettyJson
                    isBookmarked={bookmarks.has(index)}
                    onToggleBookmark={toggleBookmark}
                    onContextMenu={handleContextMenu}
                  />
                ))
              )
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-secondary space-y-2">
                    <div className="text-sm italic">No matches found for {`"${searchQuery}"`}</div>
                    <button onClick={() => setSearchQuery('')} className="text-xs text-accent hover:underline">Clear search</button>
                </div>
            )}
        </div>

        {insightsOpen && (
            <div className="theme-ai-panel w-80 border-l border-subtle app-panel">
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
        {(analysis || analysisError) && content && isAiPanelOpen && (
            <div className="animate-in slide-in-from-right duration-300 h-full border-l border-subtle">
                <ChatPanel
                  initialSummary={analysis}
                  errorState={analysisError}
                  logContext={content}
                  onCollapse={() => setIsAiPanelOpen(false)}
                  onClose={() => setIsAiPanelOpen(false)}
                  onReanalyze={handleAnalyze}
                  isReanalyzing={analyzing}
                />
            </div>
        )}
      </div>

      {/* Status Bar */}
      {content && (
        <div className="relative z-0 flex-shrink-0 h-7 px-4 flex items-center gap-4 border-t border-subtle app-panel text-[11px] font-mono text-muted">
          <span className="flex items-center gap-1.5">
            <span>Lines:</span>
            <span className="text-secondary">{lines.length.toLocaleString()}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span>Size:</span>
            <span className="text-secondary">{formatFileSize(fileSize ?? content.length)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span>Encoding:</span>
            <span className="text-secondary">UTF-8</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span>Position:</span>
            <span className="text-secondary">
              {isLive ? 'Tail' : `${Math.min(viewportRange.end, windowedLines.length).toLocaleString()} / ${windowedLines.length.toLocaleString()}`}
            </span>
          </span>
          {hostType === 'ssh' && (
            <span className="flex items-center gap-1.5 ml-auto">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-[var(--success)]">SSH Connected</span>
            </span>
          )}
          {hostType === 'journal' && (
            <span className="flex items-center gap-1.5 ml-auto">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
              </span>
              <span className="text-accent">Journal</span>
            </span>
          )}
          {hostType === 'local' && (
            <span className="flex items-center gap-1.5 ml-auto">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-zinc-400"></span>
              </span>
              <span className="text-secondary">Local</span>
            </span>
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          role="menu"
          aria-label="Log line actions"
          className="fixed z-50 min-w-[180px] rounded-2xl border border-subtle app-panel-strong py-1 text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            role="menuitem"
            onClick={handleCopy}
            className="w-full text-left px-3 py-1.5 text-xs text-primary hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </button>
          <button
            role="menuitem"
            onClick={handleCopyWithContext}
            className="w-full text-left px-3 py-1.5 text-xs text-primary hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2"
          >
            <Clipboard className="w-3.5 h-3.5" />
            Copy with context
          </button>
          <div role="separator" className="border-t border-subtle my-1" />
          <button
            role="menuitem"
            onClick={handleContextBookmark}
            className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
          >
            <Bookmark className="w-3.5 h-3.5" />
            {bookmarks.has(contextMenu.lineIndex) ? 'Remove bookmark' : 'Bookmark'}
          </button>
          <div role="separator" className="border-t border-zinc-200 dark:border-zinc-700 my-1" />
          <button
            role="menuitem"
            onClick={handleFilterToThis}
            className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
          >
            <Filter className="w-3.5 h-3.5" />
            Filter to this
          </button>
          <button
            role="menuitem"
            onClick={handleSearchSimilar}
            className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
          >
            <Search className="w-3.5 h-3.5" />
            Search similar
          </button>
        </div>
      )}
    </main>
  );
}
