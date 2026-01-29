import { useMemo } from 'react';

interface VibeCheckBarProps {
  lines: string[];
  onScrollTo: (index: number) => void;
}

export function VibeCheckBar({ lines, onScrollTo }: VibeCheckBarProps) {
  // Memoize the "hotspots" to avoid recalculating on every render
  const hotspots = useMemo(() => {
    const spots: { index: number; type: 'error' | 'warn' }[] = [];
    lines.forEach((line, i) => {
        const lower = line.toLowerCase();
        if (lower.includes('error') || lower.includes('critical') || lower.includes('fatal')) {
            spots.push({ index: i, type: 'error' });
        } else if (lower.includes('warn')) {
            spots.push({ index: i, type: 'warn' });
        }
    });
    return spots;
  }, [lines]);

  if (lines.length === 0) return null;

  return (
    <div className="h-3 w-full bg-zinc-950 border-b border-zinc-900 relative cursor-crosshair group"
         title="Vibe Check: Click to jump to events"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/50 pointer-events-none" />
      
      {hotspots.map((spot, i) => (
        <div
            key={i}
            onClick={(e) => {
                e.stopPropagation();
                onScrollTo(spot.index);
            }}
            className={`absolute top-0 bottom-0 w-[2px] cursor-pointer hover:w-[4px] hover:z-10 transition-all
                ${spot.type === 'error' ? 'bg-red-500' : 'bg-amber-400'}
            `}
            style={{
                left: `${(spot.index / lines.length) * 100}%`
            }}
        />
      ))}
    </div>
  );
}
