interface InsightItem {
  key: string;
  count: number;
  index: number;
  sample: string;
}

interface TrendBucket {
  id: string;
  index: number;
  total: number;
  errors: number;
  warns: number;
  range: string;
}

interface Spike {
  index: number;
  count: number;
  range: string;
}

interface InsightsData {
  topErrors: InsightItem[];
  topWarns: InsightItem[];
  buckets: TrendBucket[];
  spikes: Spike[];
  totalLines: number;
}

interface InsightsPanelProps {
  data: InsightsData;
  onJump: (index: number) => void;
}

export function InsightsPanel({ data, onJump }: InsightsPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Insights</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">{data.totalLines} lines analyzed</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Top Errors</div>
          {data.topErrors.length === 0 && (
            <div className="text-xs text-zinc-500">No errors detected.</div>
          )}
          {data.topErrors.map(item => (
            <button
              key={item.key}
              onClick={() => onJump(item.index)}
              className="w-full text-left rounded-lg border border-red-200/60 dark:border-red-500/20 bg-red-50/60 dark:bg-red-500/10 px-3 py-2 hover:border-red-400/80 transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-red-600 dark:text-red-300">
                <span>{item.count}x</span>
                <span>Jump</span>
              </div>
              <div className="text-xs text-zinc-700 dark:text-zinc-200 mt-1 line-clamp-2">
                {item.sample || item.key}
              </div>
            </button>
          ))}
        </section>

        <section className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Top Warnings</div>
          {data.topWarns.length === 0 && (
            <div className="text-xs text-zinc-500">No warnings detected.</div>
          )}
          {data.topWarns.map(item => (
            <button
              key={item.key}
              onClick={() => onJump(item.index)}
              className="w-full text-left rounded-lg border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/10 px-3 py-2 hover:border-amber-400/80 transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-300">
                <span>{item.count}x</span>
                <span>Jump</span>
              </div>
              <div className="text-xs text-zinc-700 dark:text-zinc-200 mt-1 line-clamp-2">
                {item.sample || item.key}
              </div>
            </button>
          ))}
        </section>

        <section className="space-y-3">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Frequency Trend</div>
          <div className="flex items-end gap-1 h-16">
            {data.buckets.map(bucket => {
              const height = Math.max(6, Math.min(100, bucket.total * 8));
              const color = bucket.errors > 0 ? 'bg-red-400/70 dark:bg-red-400/60' : bucket.warns > 0 ? 'bg-amber-400/70 dark:bg-amber-400/60' : 'bg-zinc-200/70 dark:bg-zinc-700/60';
              return (
                <button
                  key={bucket.id}
                  onClick={() => onJump(bucket.index)}
                  title={`Lines ${bucket.range} · ${bucket.errors} errors · ${bucket.warns} warns`}
                  className={`flex-1 rounded-sm ${color} transition-transform hover:-translate-y-0.5`}
                  style={{ height }}
                />
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Recent Spikes</div>
          {data.spikes.length === 0 && (
            <div className="text-xs text-zinc-500">No spikes detected.</div>
          )}
          {data.spikes.map((spike, index) => (
            <button
              key={`${spike.range}-${index}`}
              onClick={() => onJump(spike.index)}
              className="w-full text-left rounded-lg border border-indigo-200/60 dark:border-indigo-500/20 bg-indigo-50/60 dark:bg-indigo-500/10 px-3 py-2 hover:border-indigo-400/80 transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-300">
                <span>{spike.count} events</span>
                <span>Lines {spike.range}</span>
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
