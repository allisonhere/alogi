import React, { memo } from 'react';
import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLogLine, type LogToken } from '@/lib/logParser';

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
    severity === 'error' ? "bg-[var(--log-error-bg)]" :
    severity === 'warn' ? "bg-[var(--log-warn-bg)]" :
    "bg-transparent";

  // 1. JSON View
  if (isJson && jsonContent !== undefined) {
    // We need to re-highlight JSON manually since we can't easily tokenize arbitrary JSON tree into our LogToken structure yet
    // For now, we'll just keep the JSON stringify highlight logic or simple text.
    // To match original behavior:
    return (
      <div
        className={cn(
          "flex hover:bg-[var(--log-line-hover)] -mx-4 px-4 py-1 transition-colors",
          severityBg
        )}
        onContextMenu={(e) => onContextMenu?.(e, index, line)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleBookmark?.(index); }}
          className={cn(
            "w-4 flex-shrink-0 flex items-center justify-center mr-0.5 transition-colors",
            isBookmarked ? "text-[var(--accent)]" : "text-transparent hover:text-[var(--log-line-number)]"
          )}
          title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
        >
          <Bookmark className="w-3 h-3" fill={isBookmarked ? "currentColor" : "none"} />
        </button>
        <span className="w-10 text-[var(--log-line-number)] select-none text-right mr-4 flex-shrink-0 text-xs mt-0.5 font-mono">{index + 1}</span>
        <pre
          className="font-mono text-[var(--log-json-text)] bg-[var(--log-json-bg)] p-2 rounded w-full overflow-x-auto border border-[var(--log-json-border)]"
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
        "flex hover:bg-[var(--log-line-hover)] -mx-4 px-4 py-0.5 transition-colors group border-l-2",
        severity === 'error' ? "bg-[var(--log-error-bg)] border-[var(--log-error-border)]" :
        severity === 'warn' ? "bg-[var(--log-warn-bg)] border-[var(--log-warn-border)]" :
        "bg-transparent border-transparent"
      )}
      onContextMenu={(e) => onContextMenu?.(e, index, line)}
    >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleBookmark?.(index); }}
          className={cn(
            "w-4 flex-shrink-0 flex items-center justify-center mr-0.5 transition-colors",
            isBookmarked ? "text-[var(--accent)]" : "text-transparent group-hover:text-[var(--log-line-number)]"
          )}
          title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
        >
          <Bookmark className="w-3 h-3" fill={isBookmarked ? "currentColor" : "none"} />
        </button>
        <span className="w-10 text-[var(--log-line-number)] select-none text-right mr-4 flex-shrink-0 text-xs mt-[3px] font-mono group-hover:text-[var(--log-line-number-hover)]">{index + 1}</span>
        <span
          className={cn(
            "text-[var(--log-line-text)] break-all flex-1 font-mono leading-tight tracking-tight",
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
                style={{ backgroundColor: 'var(--log-match-bg)', color: 'var(--log-match-text)' }}
            >
                {token.text}
            </mark>
        );
    }

    if (token.type === 'timestamp') {
        return <span className="text-[var(--log-timestamp)]">{token.text}</span>;
    }

    if (token.type === 'keyword-info') {
        return <span className="inline-block mx-2 px-2.5 py-1 rounded-md text-[11px] font-black bg-[var(--log-info-chip-bg)] text-[var(--log-info-chip-text)] leading-none select-none tracking-tight uppercase shadow-sm">{token.text}</span>;
    }

    if (token.type === 'keyword-warn') {
        return <span className="inline-block mx-2 px-2.5 py-1 rounded-md text-[11px] font-black bg-[var(--log-warn-chip-bg)] text-[var(--log-warn-chip-text)] leading-none select-none tracking-tight uppercase shadow-sm">{token.text}</span>;
    }

    if (token.type === 'keyword-error') {
        return <span className="inline-block mx-2 px-2.5 py-1 rounded-md text-[11px] font-black bg-[var(--log-error-chip-bg)] text-[var(--log-error-chip-text)] leading-none select-none tracking-tight uppercase shadow-sm">{token.text}</span>;
    }

    if (token.type === 'keyword-http') {
        return <span className="text-[var(--log-http-text)]">{token.text}</span>;
    }

    return <>{token.text}</>;
}

export default LogLine;
