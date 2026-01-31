import { useMemo } from 'react';

interface VibeCheckBarProps {
  lines: string[];
  onScrollTo: (index: number) => void;
  viewportStart?: number;
  viewportEnd?: number;
}

export function VibeCheckBar({ lines, onScrollTo, viewportStart = 0, viewportEnd = 0 }: VibeCheckBarProps) {
  const segments = useMemo(() => {
    if (lines.length === 0) return [];
    const targetSegments = Math.min(140, Math.max(24, Math.ceil(lines.length / 60)));
    const segmentSize = Math.max(1, Math.ceil(lines.length / targetSegments));
    const output: Array<{
      start: number;
      end: number;
      errors: number;
      warns: number;
    }> = [];
    for (let i = 0; i < targetSegments; i += 1) {
      const start = i * segmentSize;
      const end = Math.min(lines.length, start + segmentSize);
      if (start >= lines.length) break;
      let errors = 0;
      let warns = 0;
      for (let j = start; j < end; j += 1) {
        const lower = lines[j].toLowerCase();
        if (lower.includes('error') || lower.includes('critical') || lower.includes('fatal')) {
          errors += 1;
        } else if (lower.includes('warn')) {
          warns += 1;
        }
      }
      output.push({ start, end, errors, warns });
    }
    return output;
  }, [lines]);

  if (lines.length === 0) return null;

  return (
    <div className="h-3 w-full bg-zinc-950 border-b border-zinc-900 relative cursor-crosshair group"
         title="Vibe Check: Click to jump to events"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/50 pointer-events-none" />

      <div className="absolute inset-0 flex">
        {segments.map((segment, i) => {
          const severity = segment.errors > 0 ? 'error' : segment.warns > 0 ? 'warn' : 'none';
          const intensity = segment.errors > 0
            ? Math.min(0.9, 0.35 + segment.errors / 10)
            : segment.warns > 0
              ? Math.min(0.75, 0.25 + segment.warns / 10)
              : 0;
          const color = severity === 'error' ? 'rgba(239, 68, 68, VAR)' : 'rgba(249, 115, 22, VAR)';
          const style = severity === 'none'
            ? { backgroundColor: 'transparent' }
            : { backgroundColor: color.replace('VAR', intensity.toFixed(2)) };
          const title = `Lines ${segment.start + 1}–${segment.end} · ${segment.errors} errors · ${segment.warns} warns`;

          return (
            <button
              type="button"
              key={`${segment.start}-${i}`}
              title={title}
              onClick={(e) => {
                e.stopPropagation();
                onScrollTo(segment.start);
              }}
              className="flex-1 h-full transition-colors hover:brightness-125"
              style={style}
            />
          );
        })}
      </div>

      <div
        className="absolute top-0 bottom-0 border border-indigo-300/70 bg-indigo-400/10 pointer-events-none"
        style={{
          left: `${Math.max(0, Math.min(1, viewportStart)) * 100}%`,
          width: `${Math.max(2, (Math.min(1, viewportEnd) - Math.max(0, viewportStart)) * 100)}%`,
        }}
      />
    </div>
  );
}
