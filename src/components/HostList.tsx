import { Server, HardDrive, Settings, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useTheme } from "next-themes";
import { useSyncExternalStore } from 'react';

interface HostListProps {
  hosts: string[];
  selectedHost: string | null;
  onSelectHost: (host: string) => void;
}

export function HostList({ hosts, selectedHost, onSelectHost }: HostListProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  return (
    <div className="w-64 border-r border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col h-full transition-colors">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
        <Server className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Hosts</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {hosts.map((host) => (
          <button
            key={host}
            onClick={() => onSelectHost(host)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
              selectedHost === host
                ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 border"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-200"
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

      {/* Settings & Theme */}
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-900 grid grid-cols-[1fr_auto] gap-1">
        <Link 
            href="/settings"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-zinc-600 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
        >
            <Settings className="w-4 h-4" />
            Settings
        </Link>
        
        {mounted && (
            <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-md text-zinc-600 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-900 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors"
                title="Toggle Theme"
            >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
        )}
      </div>
    </div>
  );
}

