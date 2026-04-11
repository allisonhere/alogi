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
      <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
        <div>
          <div className="ui-section-label">Insights</div>
          <div className="text-sm text-secondary">{data.totalLines} lines analyzed</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section className="space-y-2">
          <div className="ui-section-label">Top Errors</div>
          {data.topErrors.length === 0 && (
            <div className="text-xs text-muted">No errors detected.</div>
          )}
          {data.topErrors.map(item => (
            <button
              key={item.key}
              onClick={() => onJump(item.index)}
              className="w-full text-left rounded-2xl border border-subtle bg-danger-soft px-3 py-2 hover:bg-[color:color-mix(in_srgb,var(--danger)_18%,transparent)] transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-[var(--danger)]">
                <span>{item.count}x</span>
                <span>Jump</span>
              </div>
              <div className="text-xs text-primary mt-1 line-clamp-2">
                {item.sample || item.key}
              </div>
            </button>
          ))}
        </section>

        <section className="space-y-2">
          <div className="ui-section-label">Top Warnings</div>
          {data.topWarns.length === 0 && (
            <div className="text-xs text-muted">No warnings detected.</div>
          )}
          {data.topWarns.map(item => (
            <button
              key={item.key}
              onClick={() => onJump(item.index)}
              className="w-full text-left rounded-2xl border border-subtle bg-warning-soft px-3 py-2 hover:bg-[color:color-mix(in_srgb,var(--warning)_18%,transparent)] transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-[var(--warning)]">
                <span>{item.count}x</span>
                <span>Jump</span>
              </div>
              <div className="text-xs text-primary mt-1 line-clamp-2">
                {item.sample || item.key}
              </div>
            </button>
          ))}
        </section>

        <section className="space-y-3">
          <div className="ui-section-label">Frequency Trend</div>
          <div className="flex items-end gap-1 h-16">
            {data.buckets.map(bucket => {
              const height = Math.max(6, Math.min(100, bucket.total * 8));
              const color = bucket.errors > 0 ? 'bg-[var(--danger)]/70' : bucket.warns > 0 ? 'bg-[var(--warning)]/70' : 'bg-[var(--border-strong)]';
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
          <div className="ui-section-label">Recent Spikes</div>
          {data.spikes.length === 0 && (
            <div className="text-xs text-muted">No spikes detected.</div>
          )}
          {data.spikes.map((spike, index) => (
            <button
              key={`${spike.range}-${index}`}
              onClick={() => onJump(spike.index)}
              className="w-full text-left rounded-2xl border border-subtle bg-accent-soft px-3 py-2 hover:bg-[color:color-mix(in_srgb,var(--accent)_18%,transparent)] transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-[var(--accent)]">
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
