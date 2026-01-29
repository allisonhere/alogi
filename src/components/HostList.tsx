import { Server, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HostListProps {
  hosts: string[];
  selectedHost: string | null;
  onSelectHost: (host: string) => void;
}

export function HostList({ hosts, selectedHost, onSelectHost }: HostListProps) {
  return (
    <div className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col">
      <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
        <Server className="w-5 h-5 text-indigo-400" />
        <h2 className="font-semibold text-zinc-100">Hosts</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {hosts.map((host) => (
          <button
            key={host}
            onClick={() => onSelectHost(host)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
              selectedHost === host
                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            )}
          >
            <HardDrive className="w-4 h-4" />
            {host}
          </button>
        ))}
        {hosts.length === 0 && (
          <div className="text-zinc-500 text-sm p-4 text-center">
            No hosts found.
          </div>
        )}
      </div>
    </div>
  );
}
