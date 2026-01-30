'use client';

import { useState, useEffect } from 'react';
import { HostList } from './HostList';
import { FileList } from './FileList';
import { LogViewer } from './LogViewer';

export default function Dashboard() {
  const [hosts, setHosts] = useState<string[]>([]);
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Fetch Hosts
  useEffect(() => {
    fetch('/api/hosts')
      .then(res => res.json())
      .then(data => setHosts(data.hosts || []));
  }, []);

  // Fetch Files
  useEffect(() => {
    if (!selectedHost) return;
    setLoadingFiles(true);
    fetch(`/api/files?host=${selectedHost}`)
      .then(res => res.json())
      .then(data => {
        setFiles(data.files || []);
        setLoadingFiles(false);
      });
    setSelectedFile(null);
    setContent(null);
    setIsLive(false); // Reset live mode on host change
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

  return (
    <div className="flex h-screen w-full bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors">
      <HostList 
        hosts={hosts} 
        selectedHost={selectedHost} 
        onSelectHost={setSelectedHost} 
      />
      
      {selectedHost && (
        <FileList 
          files={files} 
          selectedFile={selectedFile} 
          onSelectFile={setSelectedFile}
          loading={loadingFiles}
        />
      )}

      <LogViewer 
        content={content} 
        loading={loadingContent} 
        filename={selectedFile}
        isLive={isLive}
        setIsLive={setIsLive}
      />
    </div>
  );
}
