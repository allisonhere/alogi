import { FileText, Clock, Layers, ScrollText, Folder, Container, ChevronDown, ChevronRight, Copy, RefreshCw, Info, ExternalLink, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';
import { ContextMenu, getMenuPosition, copyToClipboard, type ContextMenuItem } from './ContextMenu';
import { useDialog } from './Dialog';

interface FileInfo {
  name: string;
  size: number;
  updated: string;
  category?: 'journal' | 'files' | 'docker';
}

interface FileListProps {
  files: FileInfo[];
  selectedFile: string | null;
  selectedCategory: string | null;
  onSelectFile: (file: string, category: string | null) => void;
  loading: boolean;
  selectedHost?: string | null;
  onRefresh?: () => void;
}

type CategoryKey = 'journal' | 'files' | 'docker';

const categoryConfig: Record<CategoryKey, { icon: typeof ScrollText; label: string; color: string }> = {
  journal: { icon: ScrollText, label: 'Journal Services', color: 'text-blue-500 dark:text-blue-400' },
  files: { icon: Folder, label: '/var/log Files', color: 'text-amber-500 dark:text-amber-400' },
  docker: { icon: Container, label: 'Docker Containers', color: 'text-purple-500 dark:text-purple-400' },
};

export function FileList({ files, selectedFile, selectedCategory, onSelectFile, loading, selectedHost, onRefresh }: FileListProps) {
  const { showDialog } = useDialog();
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileInfo;
    category: string | null;
  } | null>(null);
  const [showFileInfo, setShowFileInfo] = useState<FileInfo | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatUpdated = (updated: string) => {
    const parsed = new Date(updated);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString();
    }
    return updated || "—";
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileInfo, category: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getMenuPosition(e);
    setContextMenu({ x, y, file, category });
  }, []);

  const getContextMenuItems = useCallback((file: FileInfo, category: string | null): ContextMenuItem[] => {
    const isRemote = selectedHost?.startsWith('remote:');
    const isJournal = selectedHost === '(system-journal)';
    const isLocal = !isRemote && !isJournal;

    const items: ContextMenuItem[] = [
      {
        label: 'Copy filename',
        icon: <Copy className="w-3.5 h-3.5" />,
        onClick: () => copyToClipboard(file.name),
      },
      {
        label: 'Copy full path',
        icon: <Copy className="w-3.5 h-3.5" />,
        onClick: () => {
          const path = isJournal ? file.name : isRemote ? `/var/log/${file.name}` : `${selectedHost}/${file.name}`;
          copyToClipboard(path);
        },
      },
      { label: '', separator: true, onClick: () => {} },
      {
        label: 'Refresh',
        icon: <RefreshCw className="w-3.5 h-3.5" />,
        onClick: () => onRefresh?.(),
      },
      {
        label: 'Show info',
        icon: <Info className="w-3.5 h-3.5" />,
        onClick: () => setShowFileInfo(file),
      },
    ];

    if (isLocal) {
      items.push(
        { label: '', separator: true, onClick: () => {} },
        {
          label: 'Open in file manager',
          icon: <ExternalLink className="w-3.5 h-3.5" />,
          onClick: () => {
            // This would need Electron IPC to work properly
            const path = `${selectedHost}/${file.name}`;
            copyToClipboard(path);
            showDialog({
              title: 'Path Copied',
              message: `The file path has been copied to your clipboard:\n\n${path}`,
              variant: 'info',
            });
          },
        },
      );
    }

    if (isRemote) {
      items.push(
        { label: '', separator: true, onClick: () => {} },
        {
          label: 'Copy SCP command',
          icon: <Download className="w-3.5 h-3.5" />,
          onClick: () => {
            const hostAlias = selectedHost?.replace('remote:', '') || '';
            const remotePath = category === 'docker' ? file.name : `/var/log/${file.name}`;
            copyToClipboard(`scp ${hostAlias}:${remotePath} .`);
          },
        },
      );
    }

    return items;
  }, [selectedHost, onRefresh, showDialog]);

  // Check if files have categories (remote host) or not (local/journal)
  const hasCategories = files.some(f => f.category);

  // Group files by category
  const groupedFiles: Record<string, FileInfo[]> = {};
  if (hasCategories) {
    for (const file of files) {
      const cat = file.category || 'files';
      if (!groupedFiles[cat]) groupedFiles[cat] = [];
      groupedFiles[cat].push(file);
    }
  }

  const renderFileButton = (file: FileInfo, category: string | null) => {
    const isSelected = selectedFile === file.name && selectedCategory === category;
    const isSpecial = file.name === 'ALL_CONTAINERS' || file.name === 'ALL_SYSTEM_LOGS';

    return (
      <button
        key={`${category}-${file.name}`}
        role="option"
        aria-selected={isSelected}
        onClick={() => onSelectFile(file.name, category)}
        onContextMenu={(e) => handleContextMenu(e, file, category)}
        className={cn(
          "theme-list-row w-full text-left px-3 py-3 text-sm transition-colors group border border-transparent",
          isSelected
            ? "theme-list-row-selected bg-[var(--accent-soft)] text-[var(--accent)] border-[color:var(--border-strong)]"
            : "text-secondary hover:bg-[var(--surface-hover)] hover:text-primary"
        )}
      >
        <div className="flex items-center gap-2 font-medium">
          {isSpecial
            ? <Layers className="w-4 h-4" />
            : <FileText className="w-4 h-4" />}
          {file.name}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted mt-1 pl-6 group-hover:text-secondary">
          <Clock className="w-3 h-3" />
          {formatUpdated(file.updated)}
        </div>
      </button>
    );
  };

  const renderCategorySection = (categoryKey: CategoryKey) => {
    const categoryFiles = groupedFiles[categoryKey];
    if (!categoryFiles || categoryFiles.length === 0) return null;

    const config = categoryConfig[categoryKey];
    const Icon = config.icon;
    const isCollapsed = collapsedCategories.has(categoryKey);

    return (
      <div key={categoryKey} className="mb-2">
        <button
          onClick={() => toggleCategory(categoryKey)}
          aria-expanded={!isCollapsed}
          className="theme-list-row w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-secondary hover:bg-[var(--surface-hover)] transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <Icon className={cn("w-4 h-4", config.color)} />
          <span>{config.label}</span>
          <span className="ml-auto text-xs text-muted">
            {categoryFiles.length}
          </span>
        </button>
        {!isCollapsed && (
          <div className="ml-2 space-y-1 mt-1">
            {categoryFiles.map(file => renderFileButton(file, categoryKey))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-panel w-full border-r flex flex-col h-full min-h-0 transition-colors" onContextMenu={(e) => e.preventDefault()}>
      <div className="theme-pane-header px-4 py-4 border-b border-subtle flex items-center gap-2">
        <FileText className="w-4 h-4 text-[var(--accent)]" />
        <div>
          <div className="ui-section-label">Sources</div>
          <h2 className="font-semibold text-primary leading-tight">Logs & Services</h2>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1" role="listbox" aria-label="Log files">
        {loading ? (
          <div className="text-muted text-sm p-4 text-center" role="status">Loading...</div>
        ) : hasCategories ? (
          // Render categorized sections for remote hosts
          <>
            {renderCategorySection('journal')}
            {renderCategorySection('files')}
            {renderCategorySection('docker')}
          </>
        ) : (
          // Render flat list for local hosts and system journal
          files.map((file) => renderFileButton(file, null))
        )}
        {!loading && files.length === 0 && (
          <div className="text-muted text-sm p-4 text-center">
            No files found.
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.file, contextMenu.category)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showFileInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowFileInfo(null)} role="presentation">
          <div
            role="dialog"
            aria-label="File information"
            className="ui-card p-4 min-w-[280px]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowFileInfo(null); }}
          >
            <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              File Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Name:</span>
                <span className="text-primary font-mono">{showFileInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Size:</span>
                <span className="text-primary font-mono">{formatFileSize(showFileInfo.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Modified:</span>
                <span className="text-primary font-mono">{formatUpdated(showFileInfo.updated)}</span>
              </div>
              {showFileInfo.category && (
                <div className="flex justify-between">
                  <span className="text-muted">Category:</span>
                  <span className="text-primary font-mono">{showFileInfo.category}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowFileInfo(null)}
              className="ui-button ui-button-secondary mt-4 w-full px-3 py-1.5 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
