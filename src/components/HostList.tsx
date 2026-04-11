import { useState, useCallback } from 'react';
import { ExternalLink, HardDrive, Settings, ScrollText, Server, Copy, RefreshCw, Wifi, Pencil, Trash2, Terminal, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
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

function getHostIconColor(host: string) {
  if (host === '(system-journal)') return 'text-blue-500 dark:text-blue-400';
  if (host.startsWith('remote:')) return 'text-emerald-500 dark:text-emerald-400';
  return 'text-amber-500 dark:text-amber-400';
}

function getHostDisplayName(host: string) {
  if (host === '(system-journal)') return 'System Journal';
  if (host.startsWith('remote:')) return host.replace('remote:', '');
  return host;
}

export function HostList({ hosts, selectedHost, onSelectHost, onRefreshFiles, onRemoveHost }: HostListProps) {
  const { showDialog, showConfirm } = useDialog();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const isDesktop = mounted && typeof window !== 'undefined' && typeof window.alogiApp?.quit === 'function';

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
    <nav aria-label="Hosts" className="app-panel w-full border-r flex flex-col h-full min-h-0 transition-colors" onContextMenu={(e) => e.preventDefault()}>
      <div className="theme-pane-header px-4 py-4 border-b border-subtle flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-subtle bg-[var(--accent-soft)]">
          <img
            src="/logo.svg"
            alt="Alogi logo"
            className="w-5 h-5"
          />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-primary leading-tight">Alogi</span>
          <span className="ui-section-label">Hosts</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1" role="listbox" aria-label="Hosts">
        {hosts.map((host) => {
          const Icon = getHostIcon(host);
          const iconColor = getHostIconColor(host);
          const displayName = getHostDisplayName(host);
          return (
            <button
              key={host}
              role="option"
              aria-selected={selectedHost === host}
              onClick={() => onSelectHost(host)}
              onContextMenu={(e) => handleContextMenu(e, host)}
              className={cn(
                "theme-list-row w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2 border border-transparent",
                selectedHost === host
                  ? "theme-list-row-selected bg-[var(--accent-soft)] text-[var(--accent)] border-[color:var(--border-strong)]"
                  : "text-secondary hover:bg-[var(--surface-hover)] hover:text-primary"
              )}
            >
              <Icon className={cn("w-4 h-4", iconColor)} />
              {displayName}
            </button>
          );
        })}
        {hosts.length === 0 && (
          <div className="text-muted text-sm p-4 text-center">
            No hosts found.
          </div>
        )}
      </div>

      {/* Links, Settings & App Controls */}
      <div className="px-3 pt-2 flex items-center gap-3 text-[11px] text-muted">
        <a href="https://github.com/allisonhere/alogi" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1">
          GitHub <ExternalLink className="w-2.5 h-2.5" />
        </a>
        <a href="https://github.com/allisonhere/alogi/issues" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1">
          Issues <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
      <div className="p-2 border-t border-subtle grid grid-cols-[1fr_auto] gap-1 mt-1">
        <Link
            href="/settings"
            className="theme-footer-link ui-control ui-control-ghost text-secondary flex items-center gap-2 px-3 py-2 text-sm"
        >
            <Settings className="w-4 h-4" />
            Settings
        </Link>

        <div className="flex items-center gap-1 justify-end">
          {isDesktop && (
              <button
                  onClick={() => void window.alogiApp?.quit()}
                  className="theme-footer-icon ui-control-icon ui-control-ghost ui-control-danger text-secondary p-2"
                  aria-label="Quit app"
                  title="Quit"
              >
                  <LogOut className="w-4 h-4" />
              </button>
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.host)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </nav>
  );
}
