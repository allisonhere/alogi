import { FileText, Clock, Layers, ScrollText, Folder, Container, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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
}

type CategoryKey = 'journal' | 'files' | 'docker';

const categoryConfig: Record<CategoryKey, { icon: typeof ScrollText; label: string; color: string }> = {
  journal: { icon: ScrollText, label: 'Journal Services', color: 'text-blue-500 dark:text-blue-400' },
  files: { icon: Folder, label: '/var/log Files', color: 'text-amber-500 dark:text-amber-400' },
  docker: { icon: Container, label: 'Docker Containers', color: 'text-purple-500 dark:text-purple-400' },
};

export function FileList({ files, selectedFile, selectedCategory, onSelectFile, loading }: FileListProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

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
        onClick={() => onSelectFile(file.name, category)}
        className={cn(
          "w-full text-left px-3 py-3 rounded-md text-sm transition-colors group",
          isSelected
            ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 border"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200"
        )}
      >
        <div className="flex items-center gap-2 font-medium">
          {isSpecial
            ? <Layers className="w-4 h-4" />
            : <FileText className="w-4 h-4" />}
          {file.name}
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-600 mt-1 pl-6 group-hover:text-zinc-600 dark:group-hover:text-zinc-500">
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
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-md transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <Icon className={cn("w-4 h-4", config.color)} />
          <span>{config.label}</span>
          <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-600">
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
    <div className="w-full border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col h-full min-h-0 transition-colors">
      <div className="px-4 py-3 h-[64px] border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
        <FileText className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Files</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="text-zinc-500 text-sm p-4 text-center">Loading...</div>
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
          <div className="text-zinc-500 text-sm p-4 text-center">
            No files found.
          </div>
        )}
      </div>
    </div>
  );
}
