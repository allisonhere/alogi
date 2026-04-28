'use client';

import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { HostList } from './HostList';
import { FileList } from './FileList';
import { LogViewer } from './LogViewer';
import { OnboardingOverlay } from './OnboardingOverlay';
import { useDialog } from './Dialog';
import { debug } from '@/lib/debug';

interface FileInfo {
  name: string;
  size: number;
  updated: string;
  category?: 'journal' | 'files' | 'docker';
}


export default function Dashboard() {
  const { showDialog } = useDialog();
  const HOST_MIN = 200;
  const HOST_MAX = 440;
  const FILE_MIN = 220;
  const FILE_MAX = 520;
  const STORAGE_KEY = 'alogi.panelWidths';
  const SESSION_KEY = 'alogi.session';
  const DEFAULT_HOST_WIDTH = 256;
  const DEFAULT_FILE_WIDTH = 304;

  const clamp = (value: number | undefined, min: number, max: number, fallback: number) => {
    if (typeof value !== 'number') return fallback;
    return Math.min(max, Math.max(min, value));
  };

  const [hosts, setHosts] = useState<string[]>([]);
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [showHosts, setShowHosts] = useState(true);
  const [showFiles, setShowFiles] = useState(true);
  const [hostWidth, setHostWidth] = useState(DEFAULT_HOST_WIDTH);
  const [fileWidth, setFileWidth] = useState(DEFAULT_FILE_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSudoPrompt, setShowSudoPrompt] = useState(false);
  const [sudoError, setSudoError] = useState('');
  const [sudoPassword, setSudoPassword] = useState('');
  const [sudoLoading, setSudoLoading] = useState(false);
  const pendingRetry = useRef<(() => void) | null>(null);
  const hostPanelRef = useRef<HTMLDivElement>(null);
  const filePanelRef = useRef<HTMLDivElement>(null);
  const liveButtonRef = useRef<HTMLButtonElement>(null);
  const analyzeButtonRef = useRef<HTMLButtonElement>(null);
  const dragState = useRef<{
    type: 'hosts' | 'files';
    startX: number;
    startHost: number;
    startFile: number;
  } | null>(null);
  const hostWidthRef = useRef(hostWidth);
  const fileWidthRef = useRef(fileWidth);
  const selectedFileRef = useRef(selectedFile);
  const selectedCategoryRef = useRef(selectedCategory);

  useEffect(() => {
    hostWidthRef.current = hostWidth;
  }, [hostWidth]);

  useEffect(() => {
    fileWidthRef.current = fileWidth;
  }, [fileWidth]);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

  // Fetch Hosts
  useEffect(() => {
    fetch('/api/hosts')
      .then(res => res.json())
      .then(data => setHosts(data.hosts || []));
  }, []);

  useEffect(() => {
    try {
      const storedPanels = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
        hostWidth?: number;
        fileWidth?: number;
      };
      setHostWidth(clamp(storedPanels.hostWidth, HOST_MIN, HOST_MAX, DEFAULT_HOST_WIDTH));
      setFileWidth(clamp(storedPanels.fileWidth, FILE_MIN, FILE_MAX, DEFAULT_FILE_WIDTH));
    } catch {
      // Ignore invalid stored values
    }

    try {
      const storedSession = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as {
        selectedHost?: string | null;
        selectedFile?: string | null;
        selectedCategory?: string | null;
        isLive?: boolean;
        showHosts?: boolean;
        showFiles?: boolean;
      };
      if (typeof storedSession.showHosts === 'boolean') setShowHosts(storedSession.showHosts);
      if (typeof storedSession.showFiles === 'boolean') setShowFiles(storedSession.showFiles);
      if (typeof storedSession.selectedHost === 'string' || storedSession.selectedHost === null) {
        // Handle legacy docker: prefix - convert to remote:
        let host = storedSession.selectedHost ?? null;
        if (host && host.startsWith('docker:')) {
          host = `remote:${host.replace('docker:', '')}`;
        }
        setSelectedHost(host);
      }
      if (typeof storedSession.selectedFile === 'string' || storedSession.selectedFile === null) {
        setSelectedFile(storedSession.selectedFile ?? null);
      }
      if (typeof storedSession.selectedCategory === 'string' || storedSession.selectedCategory === null) {
        setSelectedCategory(storedSession.selectedCategory ?? null);
      }
      if (typeof storedSession.isLive === 'boolean') {
        setIsLive(storedSession.isLive);
      }
    } catch {
      // Ignore invalid stored values
    }
    setHasRestored(true);
  }, []);

  useEffect(() => {
    const loadOnboarding = async () => {
      const forceOnboarding = localStorage.getItem('alogi.forceOnboarding') === 'true';
      if (forceOnboarding) {
        setShowOnboarding(true);
        return;
      }

      const markDismissed = async () => {
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ui: { onboardingDismissed: true } }),
          });
        } catch {
          // ignore
        }
        localStorage.setItem('alogi.onboarded', 'true');
      };

      const hasUsedAppBefore = () => {
        try {
          const raw = localStorage.getItem(SESSION_KEY);
          if (!raw) return false;
          const session = JSON.parse(raw) as {
            selectedHost?: string | null;
            selectedFile?: string | null;
          };
          return Boolean(session?.selectedHost || session?.selectedFile);
        } catch {
          return false;
        }
      };

      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          const hostCount = Array.isArray(data?.hosts) ? data.hosts.length : 0;
          const isExperienced = hostCount >= 2 || hasUsedAppBefore();
          if (data?.ui?.onboardingDismissed || isExperienced) {
            await markDismissed();
            setShowOnboarding(false);
            return;
          }
          setShowOnboarding(true);
          return;
        }
      } catch {
        // ignore and fall back to localStorage
      }
      const dismissed = localStorage.getItem('alogi.onboarded') === 'true';
      if (!dismissed) {
        setShowOnboarding(true);
      }
    };
    loadOnboarding();
  }, []);

  useEffect(() => {
    if (!showOnboarding) return;
    if (!showHosts) setShowHosts(true);
    if (!showFiles) setShowFiles(true);
  }, [showOnboarding, showHosts, showFiles]);

  useEffect(() => {
    if (!hasRestored) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ hostWidth, fileWidth })
    );
  }, [hostWidth, fileWidth, hasRestored]);

  useEffect(() => {
    if (!hasRestored) return;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        selectedHost,
        selectedFile,
        selectedCategory,
        isLive,
        showHosts,
        showFiles,
      })
    );
  }, [selectedHost, selectedFile, selectedCategory, isLive, showHosts, showFiles, hasRestored]);

  const handleSelectHost = (host: string) => {
    setSelectedHost(host);
    setLoadingFiles(true);
    setSelectedFile(null);
    setSelectedCategory(null);
    setContent(null);
  };

  const handleSelectFile = (file: string, category: string | null) => {
    setSelectedFile(file);
    setSelectedCategory(category);
  };

  const promptSudo = (retry: () => void) => {
    pendingRetry.current = retry;
    setSudoError('');
    setSudoPassword('');
    setShowSudoPrompt(true);
  };

  const handleSudoSubmit = async () => {
    setSudoLoading(true);
    setSudoError('');
    try {
      const res = await fetch('/api/sudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: sudoPassword }),
      });
      if (res.ok) {
        setShowSudoPrompt(false);
        setSudoPassword('');
        pendingRetry.current?.();
        pendingRetry.current = null;
      } else {
        setSudoError('Invalid password');
      }
    } catch {
      setSudoError('Failed to validate password');
    } finally {
      setSudoLoading(false);
    }
  };

  // Fetch Files
  useEffect(() => {
    if (!selectedHost) return;
    const controller = new AbortController();
    let active = true;
    const host = selectedHost;

    const fetchFiles = async () => {
      setLoadingFiles(true);
      try {
        const res = await fetch(`/api/files?host=${encodeURIComponent(host)}`, {
          signal: controller.signal,
        });
        const data = await res.json();

        if (!active) return;

        if (res.status === 403 && data.error === 'permission_denied') {
          setLoadingFiles(false);
          promptSudo(() => fetchFiles());
          return;
        }

        if (!res.ok) {
          setFiles([]);
          setContent(data.error ? `Failed to load sources: ${data.error}` : 'Failed to load sources.');
          return;
        }

        const nextFiles = data.files || [];
        setFiles(nextFiles);
        const restoredFile = selectedFileRef.current;
        const restoredCategory = selectedCategoryRef.current;
        if (
          restoredFile &&
          !nextFiles.some((file: FileInfo) =>
            file.name === restoredFile && (file.category ?? null) === restoredCategory
          )
        ) {
          setSelectedFile(null);
          setSelectedCategory(null);
          setContent(null);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        debug.error('Failed to fetch files:', err);
        if (active) {
          setFiles([]);
          setContent('Failed to load sources.');
        }
      } finally {
        if (active) {
          setLoadingFiles(false);
        }
      }
    };

    fetchFiles();

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedHost]);

  // Fetch Content
  useEffect(() => {
    if (!selectedHost || !selectedFile) return;

    const controller = new AbortController();
    const host = selectedHost;
    const file = selectedFile;
    const category = selectedCategory;

    const fetchContent = async (showLoading = true) => {
        if (showLoading) setLoadingContent(true);
        try {
          const params = new URLSearchParams({
            host,
            file,
            t: String(Date.now()),
          });
          if (category) {
            params.set('category', category);
          }

          const res = await fetch(`/api/content?${params.toString()}`, {
            cache: 'no-store',
            signal: controller.signal,
          });
          const data = await res.json();

          if (res.status === 403 && data.error === 'permission_denied') {
            if (showLoading) setLoadingContent(false);
            promptSudo(() => fetchContent(showLoading));
            return;
          }

          if (!res.ok) {
            setContent(data.error ? `Failed to load content: ${data.error}` : 'Failed to load content.');
            return;
          }

          setContent(data.content || "");
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          debug.error('Failed to fetch content:', err);
          setContent('Failed to load content.');
        } finally {
          if (showLoading) setLoadingContent(false);
        }
    };

    // Initial load
    fetchContent(true);

    let interval: NodeJS.Timeout | undefined;
    if (isLive) {
        interval = setInterval(() => fetchContent(false), 2000);
    }

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [selectedHost, selectedFile, selectedCategory, isLive]);

  useEffect(() => {
    if (showHosts && selectedHost && !showFiles) {
      setShowFiles(true);
    }
  }, [showHosts, selectedHost, showFiles]);

  useEffect(() => {
    if (!selectedHost && !showHosts) {
      setShowHosts(true);
    }
    if (selectedHost && !selectedFile && !showFiles) {
      setShowFiles(true);
    }
  }, [selectedHost, selectedFile, showHosts, showFiles]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isTyping = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (isTyping) return;
      if (!showFiles || !selectedHost || files.length === 0) return;

      const key = event.key.toLowerCase();
      if (key !== 'j' && key !== 'k') return;
      event.preventDefault();

      const currentIndex = files.findIndex((file) => file.name === selectedFile && file.category === selectedCategory);
      let nextIndex = currentIndex;
      if (key === 'j') {
        nextIndex = currentIndex < 0 ? 0 : Math.min(files.length - 1, currentIndex + 1);
      } else {
        nextIndex = currentIndex < 0 ? files.length - 1 : Math.max(0, currentIndex - 1);
      }
      const nextFile = files[nextIndex];
      if (nextFile && (nextFile.name !== selectedFile || nextFile.category !== selectedCategory)) {
        handleSelectFile(nextFile.name, nextFile.category || null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [files, selectedFile, selectedCategory, selectedHost, showFiles]);

  useEffect(() => {
    if (!isResizing) return;
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [isResizing]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!dragState.current) return;
      const delta = event.clientX - dragState.current.startX;
      if (dragState.current.type === 'hosts') {
        const nextWidth = Math.min(
          HOST_MAX,
          Math.max(HOST_MIN, dragState.current.startHost + delta)
        );
        setHostWidth(nextWidth);
        return;
      }
      const nextWidth = Math.min(
        FILE_MAX,
        Math.max(FILE_MIN, dragState.current.startFile + delta)
      );
      setFileWidth(nextWidth);
    };

    const handleUp = () => {
      if (dragState.current) {
        dragState.current = null;
        setIsResizing(false);
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const startResize = (type: 'hosts' | 'files') => (event: ReactMouseEvent) => {
    dragState.current = {
      type,
      startX: event.clientX,
      startHost: hostWidthRef.current,
      startFile: fileWidthRef.current,
    };
    setIsResizing(true);
  };

  const handleRefreshFiles = () => {
    if (!selectedHost) return;
    setLoadingFiles(true);
    fetch(`/api/files?host=${encodeURIComponent(selectedHost)}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load sources.');
        }
        return data;
      })
      .then(data => {
        setFiles(data.files || []);
      })
      .catch(err => {
        debug.error('Failed to refresh files:', err);
        setFiles([]);
        setContent(err instanceof Error ? `Failed to load sources: ${err.message}` : 'Failed to load sources.');
      })
      .finally(() => {
        setLoadingFiles(false);
      });
  };

  const handleRemoveHost = async (host: string) => {
    const alias = host.replace('remote:', '');
    try {
      const res = await fetch('/api/settings');
      const settings = await res.json();
      const updatedHosts = (settings.hosts || []).filter((h: { alias: string }) => h.alias !== alias);
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hosts: updatedHosts }),
      });
      setHosts(prev => prev.filter(h => h !== host));
      if (selectedHost === host) {
        setSelectedHost(null);
        setFiles([]);
        setContent(null);
      }
    } catch (err) {
      debug.error('Failed to remove host:', err);
      showDialog({
        title: 'Error',
        message: 'Failed to remove host. Please try again.',
        variant: 'error',
      });
    }
  };

  const handleRefreshContent = () => {
    if (!selectedHost || !selectedFile) return;
    setLoadingContent(true);
    const params = new URLSearchParams({
      host: selectedHost,
      file: selectedFile,
      t: String(Date.now()),
    });
    if (selectedCategory) {
      params.set('category', selectedCategory);
    }
    fetch(`/api/content?${params.toString()}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load content.');
        }
        return data;
      })
      .then(data => {
        setContent(data.content || "");
      })
      .catch(err => {
        debug.error('Failed to refresh content:', err);
        setContent(err instanceof Error ? `Failed to load content: ${err.message}` : 'Failed to load content.');
      })
      .finally(() => {
        setLoadingContent(false);
      });
  };

  return (
    <div className="app-shell flex h-screen w-full min-h-0 overflow-hidden transition-colors" onContextMenu={(e) => e.preventDefault()}>
      {showHosts && (
        <div ref={hostPanelRef} style={{ width: hostWidth }} className="flex-shrink-0">
          <HostList
            hosts={hosts}
            selectedHost={selectedHost}
            onSelectHost={handleSelectHost}
            onRefreshFiles={handleRefreshFiles}
            onRemoveHost={handleRemoveHost}
          />
        </div>
      )}

      {showHosts && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize hosts panel"
          onMouseDown={startResize('hosts')}
          className="w-1.5 bg-[var(--border-subtle)] hover:bg-[var(--accent)]/60 cursor-col-resize transition-colors"
        />
      )}
      
      {showFiles && selectedHost && (
        <div ref={filePanelRef} style={{ width: fileWidth }} className="flex-shrink-0">
          <FileList
            files={files}
            selectedFile={selectedFile}
            selectedCategory={selectedCategory}
            onSelectFile={handleSelectFile}
            loading={loadingFiles}
            selectedHost={selectedHost}
            onRefresh={handleRefreshContent}
          />
        </div>
      )}

      {showFiles && selectedHost && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize files panel"
          onMouseDown={startResize('files')}
          className="w-1.5 bg-[var(--border-subtle)] hover:bg-[var(--accent)]/60 cursor-col-resize transition-colors"
        />
      )}

      <LogViewer
        content={content}
        loading={loadingContent}
        filename={selectedFile}
        isLive={isLive}
        setIsLive={setIsLive}
        showHosts={showHosts}
        showFiles={showFiles}
        onToggleHosts={() => setShowHosts(prev => !prev)}
        onToggleFiles={() => setShowFiles(prev => !prev)}
        liveButtonRef={liveButtonRef}
        analyzeButtonRef={analyzeButtonRef}
        fileSize={files.find(f => f.name === selectedFile && (f.category ?? null) === selectedCategory)?.size}
        selectedHost={selectedHost}
      />

      {showSudoPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sudo-dialog-title"
            className="ui-card p-6 w-full max-w-sm"
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowSudoPrompt(false); pendingRetry.current = null; } }}
          >
            <h2 id="sudo-dialog-title" className="text-lg font-semibold text-primary mb-1">Elevated Access Required</h2>
            <p className="text-sm text-muted mb-4">This file requires sudo. Your password is stored in memory only for this session.</p>
            <input
              type="password"
              value={sudoPassword}
              onChange={e => setSudoPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && sudoPassword) handleSudoSubmit(); }}
              placeholder="Password"
              aria-label="Sudo password"
              autoFocus
              className="ui-input mb-3 px-3 py-2"
            />
            {sudoError && <p className="text-sm text-[var(--danger)] mb-3">{sudoError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowSudoPrompt(false); pendingRetry.current = null; }}
                className="ui-button ui-button-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSudoSubmit}
                disabled={!sudoPassword || sudoLoading}
                className="ui-button ui-button-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {sudoLoading ? 'Authenticating...' : 'Authenticate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOnboarding && (
        <OnboardingOverlay
          steps={[
            {
              id: 'hosts',
              title: 'Choose a host',
              body: 'Pick a local folder, system journal, or remote host.',
              target: hostPanelRef,
              enabled: showHosts,
            },
            {
              id: 'files',
              title: 'Pick a log file',
              body: 'Select a file or service to start reading logs.',
              target: filePanelRef,
              enabled: Boolean(selectedHost && showFiles),
            },
            {
              id: 'live',
              title: 'Go live',
              body: 'Toggle live tailing to stream new lines as they arrive.',
              target: liveButtonRef,
              enabled: Boolean(selectedFile),
            },
            {
              id: 'ai',
              title: 'Analyze with AI',
              body: 'Generate a summary and recommendations for errors.',
              target: analyzeButtonRef,
              enabled: Boolean(selectedFile),
            },
          ]}
          onFinish={async () => {
            try {
              await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ui: { onboardingDismissed: true } }),
              });
            } catch {
              // ignore
            }
            localStorage.removeItem('alogi.forceOnboarding');
            localStorage.setItem('alogi.onboarded', 'true');
            setShowOnboarding(false);
          }}
          onSkip={async () => {
            try {
              await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ui: { onboardingDismissed: true } }),
              });
            } catch {
              // ignore
            }
            localStorage.removeItem('alogi.forceOnboarding');
            localStorage.setItem('alogi.onboarded', 'true');
            setShowOnboarding(false);
          }}
        />
      )}
    </div>
  );
}
