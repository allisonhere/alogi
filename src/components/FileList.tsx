import { FileText, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileInfo {
  name: string;
  size: number;
  updated: string;
}

interface FileListProps {
  files: FileInfo[];
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  loading: boolean;
}

export function FileList({ files, selectedFile, onSelectFile, loading }: FileListProps) {
  const formatUpdated = (updated: string) => {
    const parsed = new Date(updated);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString();
    }
    return updated || "—";
  };

  return (
    <div className="w-72 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col transition-colors">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
        <FileText className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Files</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
           <div className="text-zinc-500 text-sm p-4 text-center">Loading...</div>
        ) : files.map((file) => (
          <button
            key={file.name}
            onClick={() => onSelectFile(file.name)}
            className={cn(
              "w-full text-left px-3 py-3 rounded-md text-sm transition-colors group",
              selectedFile === file.name
                ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 border"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            <div className="flex items-center gap-2 font-medium">
              <FileText className="w-4 h-4" />
              {file.name}
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-600 mt-1 pl-6 group-hover:text-zinc-600 dark:group-hover:text-zinc-500">
               <Clock className="w-3 h-3" />
               {formatUpdated(file.updated)}
            </div>
          </button>
        ))}
        {!loading && files.length === 0 && (
          <div className="text-zinc-500 text-sm p-4 text-center">
            No files found.
          </div>
        )}
      </div>
    </div>
  );
}
