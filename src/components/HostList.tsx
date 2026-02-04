import { useState, useCallback } from 'react';
import { ExternalLink, HardDrive, Settings, Moon, Sun, ScrollText, Server, Copy, RefreshCw, Wifi, Pencil, Trash2, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useTheme } from "next-themes";
import { useSyncExternalStore } from 'react';
import { ContextMenu, getMenuPosition, copyToClipboard, type ContextMenuItem } from './ContextMenu';
import { useDialog } from './Dialog';

interface HostListProps {
  hosts: string[];
  selectedHost: string | null;
  onSelectHost: (host: string) => void;
  onRefreshFiles?: () => void;
  onRemoveHost?: (host: string) => void;
}

function getHostIcon(host: string) {
  if (host === '(system-journal)') return ScrollText;
  if (host.startsWith('remote:')) return Server;
  return HardDrive;
}

function getHostDisplayName(host: string) {
  if (host === '(system-journal)') return 'System Journal';
  if (host.startsWith('remote:')) return host.replace('remote:', '');
  return host;
}

export function HostList({ hosts, selectedHost, onSelectHost, onRefreshFiles, onRemoveHost }: HostListProps) {
  const { theme, setTheme } = useTheme();
  const { showDialog, showConfirm } = useDialog();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    host: string;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, host: string) => {
    e.preventDefault();
    const { x, y } = getMenuPosition(e);
    setContextMenu({ x, y, host });
  }, []);

  const getContextMenuItems = useCallback((host: string): ContextMenuItem[] => {
    const isRemote = host.startsWith('remote:');
    const isJournal = host === '(system-journal)';
    const displayName = getHostDisplayName(host);

    const items: ContextMenuItem[] = [
      {
        label: 'Copy hostname',
        icon: <Copy className="w-3.5 h-3.5" />,
        onClick: () => copyToClipboard(displayName),
      },
      {
        label: 'Refresh files',
        icon: <RefreshCw className="w-3.5 h-3.5" />,
        onClick: () => {
          if (selectedHost === host && onRefreshFiles) {
            onRefreshFiles();
          } else {
            onSelectHost(host);
          }
        },
      },
    ];

    if (isRemote) {
      items.push(
        { label: '', separator: true, onClick: () => {} },
        {
          label: 'Test connection',
          icon: <Wifi className="w-3.5 h-3.5" />,
          onClick: async () => {
            try {
              // First fetch the host config from settings
              const settingsRes = await fetch('/api/settings');
              const settings = await settingsRes.json();
              const hostConfig = (settings.hosts || []).find((h: { alias: string }) => h.alias === displayName);
              if (!hostConfig) {
                showDialog({
                  title: 'Host Not Found',
                  message: `Host "${displayName}" not found in settings.`,
                  variant: 'error',
                });
                return;
              }
              const res = await fetch('/api/hosts/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  hostname: hostConfig.hostname,
                  username: hostConfig.username,
                  port: hostConfig.port,
                  keyPath: hostConfig.keyPath,
                  password: hostConfig.password,
                  authMethod: hostConfig.authMethod,
                }),
              });
              const data = await res.json();
              if (data.success) {
                showDialog({
                  title: 'Connection Successful',
                  message: `Successfully connected to ${displayName}.`,
                  variant: 'success',
                });
              } else {
                showDialog({
                  title: 'Connection Failed',
                  message: data.error,
                  variant: 'error',
                });
              }
            } catch {
              showDialog({
                title: 'Connection Error',
                message: 'Failed to test connection. Please try again.',
                variant: 'error',
              });
            }
          },
        },
        { label: '', separator: true, onClick: () => {} },
        {
          label: 'Edit host',
          icon: <Pencil className="w-3.5 h-3.5" />,
          onClick: () => {
            window.location.href = '/settings';
          },
        },
        {
          label: 'Remove host',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          onClick: async () => {
            const confirmed = await showConfirm({
              title: 'Remove Host',
              message: `Are you sure you want to remove "${displayName}" from your hosts?\n\nThis will delete the saved connection settings.`,
              variant: 'warning',
              confirmLabel: 'Remove',
              cancelLabel: 'Cancel',
            });
            if (confirmed) {
              onRemoveHost?.(host);
            }
          },
        },
      );
    }

    if (isJournal) {
      items.push(
        { label: '', separator: true, onClick: () => {} },
        {
          label: 'Copy journalctl command',
          icon: <Terminal className="w-3.5 h-3.5" />,
          onClick: () => copyToClipboard('journalctl -f'),
        },
      );
    }

    return items;
  }, [selectedHost, onSelectHost, onRefreshFiles, onRemoveHost, showDialog, showConfirm]);

  return (
    <div className="w-full border-r border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col h-full min-h-0 transition-colors" onContextMenu={(e) => e.preventDefault()}>
      <div className="px-4 py-3 h-[64px] border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <img
          src="/logo.svg"
          alt="Alogi logo"
          className="w-8 h-8"
        />
        <div className="flex flex-col">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">Alogi</span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-500">Hosts</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {hosts.map((host) => {
          const Icon = getHostIcon(host);
          const displayName = getHostDisplayName(host);
          return (
            <button
              key={host}
              onClick={() => onSelectHost(host)}
              onContextMenu={(e) => handleContextMenu(e, host)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                selectedHost === host
                  ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 border"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              <Icon className="w-4 h-4" />
              {displayName}
            </button>
          );
        })}
        {hosts.length === 0 && (
          <div className="text-zinc-500 text-sm p-4 text-center">
            No hosts found.
          </div>
        )}
      </div>

      {/* Links, Settings & Theme */}
      <div className="px-3 pt-2 flex items-center gap-3 text-[11px] text-zinc-400 dark:text-zinc-600">
        <a href="https://github.com/allisonhere/alogi" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors flex items-center gap-1">
          GitHub <ExternalLink className="w-2.5 h-2.5" />
        </a>
        <a href="https://github.com/allisonhere/alogi/issues" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors flex items-center gap-1">
          Issues <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-900 grid grid-cols-[1fr_auto] gap-1 mt-1">
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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.host)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
