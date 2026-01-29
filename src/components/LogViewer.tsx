import { useState, useEffect, useRef } from 'react';
import { Sparkles, Terminal, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VibeCheckBar } from './VibeCheckBar';

// Helper to highlight log parts
function LogLine({ line, index }: { line: string; index: number }) {
  const lower = line.toLowerCase();
  const isError = lower.includes('error') || lower.includes('critical') || lower.includes('fatal') || lower.includes('failed') || lower.includes('denied');
  const isWarn = lower.includes('warn') || lower.includes('warning') || lower.includes('block') || lower.includes('conflict') || lower.includes('timeout') || lower.includes('retrying');

  // 1. Try JSON
  if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
      try {
          const obj = JSON.parse(line);
          return (
             <div className={cn(
                "flex hover:bg-zinc-800/30 -mx-4 px-4 py-1 transition-colors",
                isError ? "bg-red-950/20" : "bg-transparent"
             )}>
                <span className="w-10 text-zinc-600 select-none text-right mr-4 flex-shrink-0 text-xs mt-0.5 font-mono">{index + 1}</span>
                <pre className="text-xs font-mono text-emerald-400 bg-zinc-900/50 p-2 rounded w-full overflow-x-auto border border-zinc-800">
                    {JSON.stringify(obj, null, 2)}
                </pre>
             </div>
          );
      } catch (e) {
          // Not valid JSON, fall through
      }
  }

  // 2. Standard Highlighting matching pic.png style
  const parts = line.split(/(\[.*?\]|ERROR|WARN|WARNING|INFO|CRITICAL|FATAL|debug|Failed|failed|GET|POST|PUT|DELETE|Accepted|Started|Stopped)/g);

  return (
    <div className={cn(
        "flex hover:bg-zinc-800/40 -mx-4 px-4 py-0.5 transition-colors group border-l-2",
        isError ? "bg-red-950/30 border-red-500/50" : 
        isWarn ? "bg-orange-950/20 border-orange-500/40" :
        "bg-transparent border-transparent"
    )}>
        <span className="w-10 text-zinc-700 select-none text-right mr-4 flex-shrink-0 text-xs mt-[3px] font-mono group-hover:text-zinc-500">{index + 1}</span>
        <span className="text-zinc-300 break-all whitespace-pre-wrap flex-1 font-mono text-[13px] leading-tight tracking-tight">
            {parts.map((part, i) => {
                // Brackets [Timestamp] or [Component] -> Zinc 500 (Gray)
                if (part.startsWith('[') && part.endsWith(']')) return <span key={i} className="text-zinc-500">{part}</span>;
                
                // Keywords matching vibrant pic.png colors - NOW AS LARGER, BRIGHTER PILLS
                if (part === 'INFO') return <span key={i} className="inline-block mx-2 px-2.5 py-1 rounded-md text-[11px] font-black bg-[#00f5d4]/20 text-[#00f5d4] leading-none select-none tracking-tight uppercase shadow-sm shadow-[#00f5d4]/10">{part}</span>;
                if (part === 'WARN' || part === 'WARNING') return <span key={i} className="inline-block mx-2 px-2.5 py-1 rounded-md text-[11px] font-black bg-[#ff9f1c]/25 text-[#ff9f1c] leading-none select-none tracking-tight uppercase shadow-sm shadow-[#ff9f1c]/10">{part}</span>;
                if (['ERROR', 'CRITICAL', 'FATAL', 'Failed', 'failed'].includes(part)) return <span key={i} className="inline-block mx-2 px-2.5 py-1 rounded-md text-[11px] font-black bg-[#ff5d5d]/25 text-[#ff5d5d] leading-none select-none tracking-tight uppercase shadow-sm shadow-[#ff5d5d]/10">{part}</span>;

                // HTTP Methods & Positive Actions
                if (['GET', 'POST', 'PUT', 'DELETE', 'Accepted', 'Started'].includes(part)) return <span key={i} className="text-indigo-400">{part}</span>;
                
                return part;
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
}

interface AIAnalysis {
  summary: string;
  key_findings: string[];
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}

export function LogViewer({ content, loading, filename, isLive, setIsLive }: LogViewerProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset analysis and search when file changes
  useEffect(() => {
    setAnalysis(null);
    setSearchQuery('');
  }, [filename]);

  // Auto-scroll to bottom in live mode
  useEffect(() => {
    if (isLive && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, isLive]);

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
    } catch (err) {
      console.error(err);
      alert("Failed to connect to analysis service.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading && !content) { // Only show full loading if no content yet
    return <div className="flex-1 flex items-center justify-center text-zinc-500">Loading content...</div>;
  }

  if (!content) {
    return <div className="flex-1 flex items-center justify-center text-zinc-600">Select a file to view logs.</div>;
  }

  const lines = content.split('\n');
  const filteredLines = searchQuery 
    ? lines.map((line, index) => ({ line, index })).filter(item => item.line.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines.map((line, index) => ({ line, index }));

  return (
    <div className="flex-1 flex flex-col bg-[#09090b] h-screen overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950 gap-4">
        <div className="flex items-center gap-2 text-zinc-300 min-w-0 flex-1">
            <Terminal className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <span className="font-mono text-sm truncate">{filename}</span>
            {isLive && (
                <span className="flex h-2 w-2 relative ml-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
            )}
        </div>

        <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
                onClick={() => setIsLive(!isLive)}
                className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                    isLive 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" 
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700"
                )}
            >
                {isLive ? 'Live On' : 'Go Live'}
            </button>
            <div className="relative flex-1">
                <input 
                    type="text" 
                    placeholder="Filter logs..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-1.5 pl-8 pr-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                />
                <div className="absolute left-2.5 top-2 text-zinc-500">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </div>
            
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0",
                            analyzing
                                ? "bg-zinc-800 text-zinc-400 cursor-not-allowed" 
                                : "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white shadow-lg shadow-indigo-500/20 cursor-pointer"
                        )}
                    >
                        <Sparkles className="w-3 h-3" />
                        {analyzing ? 'Analyzing...' : analysis ? 'Re-Analyze' : 'AI Analyze'}
                    </button>        </div>
      </div>

      <VibeCheckBar 
        lines={filteredLines.map(l => l.line)} 
        onScrollTo={(index) => {
            const child = scrollRef.current?.children[index] as HTMLElement;
            if (child) child.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }} 
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Code View */}
        <div 
            ref={scrollRef}
            className="flex-1 overflow-auto p-4 font-mono text-sm text-zinc-300 leading-relaxed custom-scrollbar"
        >
            {filteredLines.length > 0 ? filteredLines.map(({ line, index }) => (
                <LogLine key={index} line={line} index={index} />
            )) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-2">
                    <div className="text-sm italic">No matches found for "{searchQuery}"</div>
                    <button onClick={() => setSearchQuery('')} className="text-xs text-indigo-400 hover:underline">Clear search</button>
                </div>
            )}
        </div>

        {/* AI Panel (Slide in) */}
        {analysis && (
            <div className="w-96 border-l border-zinc-800 bg-zinc-900/30 p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
                <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    AI Insights
                </h3>
                
                <div className={cn(
                    "p-3 rounded-lg mb-4 border",
                    analysis.severity === 'high' ? "bg-red-500/10 border-red-500/20 text-red-200" :
                    "bg-zinc-800 border-zinc-700 text-zinc-300"
                )}>
                    <div className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">Summary</div>
                    {analysis.summary}
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Key Findings</div>
                        <ul className="space-y-2">
                            {(analysis.key_findings || []).map((finding, i) => (
                                <li key={i} className="flex gap-2 text-sm text-zinc-300">
                                    <AlertCircle className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
                                    {finding}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Recommendation</div>
                        <div className="flex gap-2 text-sm text-indigo-300 bg-indigo-500/5 p-3 rounded border border-indigo-500/10">
                            <CheckCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                            {analysis.recommendation}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
