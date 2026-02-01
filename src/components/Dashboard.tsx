'use client';

import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { HostList } from './HostList';
import { FileList } from './FileList';
import { LogViewer } from './LogViewer';
import { OnboardingOverlay } from './OnboardingOverlay';

interface FileInfo {
  name: string;
  size: number;
  updated: string;
}

export default function Dashboard() {
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

  useEffect(() => {
    hostWidthRef.current = hostWidth;
  }, [hostWidth]);

  useEffect(() => {
    fileWidthRef.current = fileWidth;
  }, [fileWidth]);

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
        isLive?: boolean;
        showHosts?: boolean;
        showFiles?: boolean;
      };
      if (typeof storedSession.showHosts === 'boolean') setShowHosts(storedSession.showHosts);
      if (typeof storedSession.showFiles === 'boolean') setShowFiles(storedSession.showFiles);
      if (typeof storedSession.selectedHost === 'string' || storedSession.selectedHost === null) {
        setSelectedHost(storedSession.selectedHost ?? null);
      }
      if (typeof storedSession.selectedFile === 'string' || storedSession.selectedFile === null) {
        setSelectedFile(storedSession.selectedFile ?? null);
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
        isLive,
        showHosts,
        showFiles,
      })
    );
  }, [selectedHost, selectedFile, isLive, showHosts, showFiles, hasRestored]);

  const handleSelectHost = (host: string) => {
    setSelectedHost(host);
    setLoadingFiles(true);
    setSelectedFile(null);
    setContent(null);
  };

  // Fetch Files
  useEffect(() => {
    if (!selectedHost) return;
    fetch(`/api/files?host=${selectedHost}`)
      .then(res => res.json())
      .then(data => {
        setFiles(data.files || []);
        setLoadingFiles(false);
        if (selectedFile && !(data.files || []).some((file: FileInfo) => file.name === selectedFile)) {
          setSelectedFile(null);
          setContent(null);
        }
      });
  }, [selectedHost]);

  // Fetch Content
  useEffect(() => {
    if (!selectedHost || !selectedFile) return;
    
    const fetchContent = (showLoading = true) => {
        if (showLoading) setLoadingContent(true);
        // Add timestamp to prevent browser caching
        fetch(`/api/content?host=${selectedHost}&file=${selectedFile}&t=${Date.now()}`, { cache: 'no-store' })
          .then(res => res.json())
          .then(data => {
            setContent(data.content || "");
            if (showLoading) setLoadingContent(false);
          });
    };

    // Initial load
    fetchContent(true);

    let interval: NodeJS.Timeout;
    if (isLive) {
        interval = setInterval(() => fetchContent(false), 2000);
    }

    return () => clearInterval(interval);
  }, [selectedHost, selectedFile, isLive]);

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

      const currentIndex = files.findIndex((file) => file.name === selectedFile);
      let nextIndex = currentIndex;
      if (key === 'j') {
        nextIndex = currentIndex < 0 ? 0 : Math.min(files.length - 1, currentIndex + 1);
      } else {
        nextIndex = currentIndex < 0 ? files.length - 1 : Math.max(0, currentIndex - 1);
      }
      const nextFile = files[nextIndex];
      if (nextFile && nextFile.name !== selectedFile) {
        setSelectedFile(nextFile.name);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [files, selectedFile, selectedHost, showFiles]);

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

  return (
    <div className="flex h-screen w-full min-h-0 bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors">
      {showHosts && (
        <div ref={hostPanelRef} style={{ width: hostWidth }} className="flex-shrink-0">
          <HostList 
            hosts={hosts} 
            selectedHost={selectedHost} 
            onSelectHost={handleSelectHost} 
          />
        </div>
      )}

      {showHosts && (
        <div
          onMouseDown={startResize('hosts')}
          className="w-1.5 bg-zinc-200/60 dark:bg-zinc-800/60 hover:bg-indigo-400/60 cursor-col-resize transition-colors"
        />
      )}
      
      {showFiles && selectedHost && (
        <div ref={filePanelRef} style={{ width: fileWidth }} className="flex-shrink-0">
          <FileList 
            files={files} 
            selectedFile={selectedFile} 
            onSelectFile={setSelectedFile}
            loading={loadingFiles}
          />
        </div>
      )}

      {showFiles && selectedHost && (
        <div
          onMouseDown={startResize('files')}
          className="w-1.5 bg-zinc-200/60 dark:bg-zinc-800/60 hover:bg-emerald-400/60 cursor-col-resize transition-colors"
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
      />

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
