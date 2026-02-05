import React, { memo } from 'react';
import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLogLine, type ParsedLogLine, type LogToken } from '@/lib/logParser';

interface LogLineProps {
  line: string;
  index: number;
  wrapLines: boolean;
  fontSize: number;
  searchQuery: string;
  isRegex?: boolean;
  disablePrettyJson?: boolean;
  isBookmarked?: boolean;
  onToggleBookmark?: (index: number) => void;
  onContextMenu?: (e: React.MouseEvent, index: number, line: string) => void;
}

const LogLine = memo(function LogLine({
  line,
  index,
  wrapLines,
  fontSize,
  searchQuery,
  isRegex = false,
  disablePrettyJson = false,
  isBookmarked = false,
  onToggleBookmark,
  onContextMenu,
}: LogLineProps) {
  // Use the extracted parser
  const parsed = parseLogLine(line, searchQuery, isRegex, disablePrettyJson);
  const { isJson, jsonContent, severity, tokens } = parsed;

  const severityBg = 
    severity === 'error' ? "bg-red-50 dark:bg-red-950/20" :
    severity === 'warn' ? "bg-orange-50 dark:bg-orange-950/10" :
    "bg-transparent";

  // 1. JSON View
  if (isJson && jsonContent !== undefined) {
    // We need to re-highlight JSON manually since we can't easily tokenize arbitrary JSON tree into our LogToken structure yet
    // For now, we'll just keep the JSON stringify highlight logic or simple text.
    // To match original behavior:
    return (
      <div
        className={cn(
          "flex hover:bg-zinc-100 dark:hover:bg-zinc-800/30 -mx-4 px-4 py-1 transition-colors",
          severityBg
        )}
        onContextMenu={(e) => onContextMenu?.(e, index, line)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleBookmark?.(index); }}
          className={cn(
            "w-4 flex-shrink-0 flex items-center justify-center mr-0.5 transition-colors",
            isBookmarked ? "text-indigo-500 dark:text-indigo-400" : "text-transparent hover:text-zinc-400 dark:hover:text-zinc-600"
          )}
          title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
        >
          <Bookmark className="w-3 h-3" fill={isBookmarked ? "currentColor" : "none"} />
        </button>
        <span className="w-10 text-zinc-400 dark:text-zinc-600 select-none text-right mr-4 flex-shrink-0 text-xs mt-0.5 font-mono">{index + 1}</span>
        <pre
          className="font-mono text-emerald-600 dark:text-emerald-400 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded w-full overflow-x-auto border border-zinc-200 dark:border-zinc-800"
          style={{ fontSize }}
        >
          {JSON.stringify(jsonContent, null, 2)}
        </pre>
      </div>
    );
  }

  // 2. Standard View
  return (
    <div
      className={cn(
        "flex hover:bg-zinc-100 dark:hover:bg-zinc-800/40 -mx-4 px-4 py-0.5 transition-colors group border-l-2",
        severity === 'error' ? "bg-red-50 border-red-500/30 dark:bg-red-950/30 dark:border-red-500/50" :
        severity === 'warn' ? "bg-orange-50 border-orange-500/30 dark:bg-orange-950/20 dark:border-orange-500/40" :
        "bg-transparent border-transparent"
      )}
      onContextMenu={(e) => onContextMenu?.(e, index, line)}
    >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleBookmark?.(index); }}
          className={cn(
            "w-4 flex-shrink-0 flex items-center justify-center mr-0.5 transition-colors",
            isBookmarked ? "text-indigo-500 dark:text-indigo-400" : "text-transparent group-hover:text-zinc-400 dark:group-hover:text-zinc-600"
          )}
          title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
        >
          <Bookmark className="w-3 h-3" fill={isBookmarked ? "currentColor" : "none"} />
        </button>
        <span className="w-10 text-zinc-400 dark:text-zinc-700 select-none text-right mr-4 flex-shrink-0 text-xs mt-[3px] font-mono group-hover:text-zinc-500">{index + 1}</span>
        <span
          className={cn(
            "text-zinc-700 dark:text-zinc-300 break-all flex-1 font-mono leading-tight tracking-tight",
            wrapLines ? "whitespace-pre-wrap" : "whitespace-pre"
          )}
          style={{ fontSize }}
        >
            {tokens.map((token, i) => (
                <Token key={i} token={token} />
            ))}
        </span>
    </div>
  );
});

function Token({ token }: { token: LogToken }) {
    if (token.type === 'match') {
        return (
            <mark
                className="rounded px-0.5"
                style={{ backgroundColor: 'oklch(43.2% 0.232 292.759)', color: '#fff' }}
            >
                {token.text}
            </mark>
        );
    }

    if (token.type === 'timestamp') {
        return <span className="text-zinc-400 dark:text-slate-400">{token.text}</span>;
    }

    if (token.type === 'keyword-info') {
        return <span className="inline-block mx-2 px-2.5 py-1 rounded-md text-[11px] font-black bg-[#00f5d4]/10 dark:bg-[#00f5d4]/20 text-emerald-600 dark:text-[#00f5d4] leading-none select-none tracking-tight uppercase shadow-sm shadow-[#00f5d4]/10">{token.text}</span>;
    }

    if (token.type === 'keyword-warn') {
        return <span className="inline-block mx-2 px-2.5 py-1 rounded-md text-[11px] font-black bg-[#ff9f1c]/10 dark:bg-[#ff9f1c]/25 text-orange-600 dark:text-[#ff9f1c] leading-none select-none tracking-tight uppercase shadow-sm shadow-[#ff9f1c]/10">{token.text}</span>;
    }

    if (token.type === 'keyword-error') {
        return <span className="inline-block mx-2 px-2.5 py-1 rounded-md text-[11px] font-black bg-[#ff5d5d]/10 dark:bg-[#ff5d5d]/25 text-red-600 dark:text-[#ff5d5d] leading-none select-none tracking-tight uppercase shadow-sm shadow-[#ff5d5d]/10">{token.text}</span>;
    }

    if (token.type === 'keyword-http') {
        return <span className="text-indigo-600 dark:text-indigo-400">{token.text}</span>;
    }

    return <>{token.text}</>;
}

export default LogLine;
