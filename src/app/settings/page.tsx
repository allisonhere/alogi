'use client';

import { useState, useEffect } from 'react';
import { Save, ArrowLeft, Server, Cpu, Key } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      alert("Settings saved!");
    } catch (e) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-zinc-500 p-8">Loading settings...</div>;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center py-10">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
           <div className="flex items-center gap-4">
             <Link href="/" className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
             </Link>
             <h1 className="text-xl font-bold">Settings</h1>
           </div>
           <button 
             onClick={handleSave}
             disabled={saving}
             className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
           >
             <Save className="w-4 h-4" />
             {saving ? "Saving..." : "Save Changes"}
           </button>
        </div>

        <div className="p-6 space-y-8">
            
            {/* General Section */}
            <div>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Server className="w-4 h-4" /> General
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">Local Log Directory</label>
                        <input 
                            type="text" 
                            value={config.general.logPath}
                            onChange={(e) => setConfig({...config, general: {...config.general, logPath: e.target.value}})}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                        <p className="text-xs text-zinc-500 mt-1">Path to the logs folder on this machine (e.g. /var/log).</p>
                    </div>
                </div>
            </div>

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex flex-col items-center py-10 transition-colors">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
           <div className="flex items-center gap-4">
             <Link href="/" className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                <ArrowLeft className="w-5 h-5" />
             </Link>
             <h1 className="text-xl font-bold">Settings</h1>
           </div>
           <button 
             onClick={handleSave}
             disabled={saving}
             className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
           >
             <Save className="w-4 h-4" />
             {saving ? "Saving..." : "Save Changes"}
           </button>
        </div>

        <div className="p-6 space-y-8">
            
            {/* General Section */}
            <div>
                <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Server className="w-4 h-4" /> General
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Local Log Directory</label>
                        <input 
                            type="text" 
                            value={config.general.logPath}
                            onChange={(e) => setConfig({...config, general: {...config.general, logPath: e.target.value}})}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                        <p className="text-xs text-zinc-500 mt-1">Path to the logs folder on this machine (e.g. /var/log).</p>
                    </div>
                </div>
            </div>

            {/* AI Section */}
            <div>
                <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Cpu className="w-4 h-4" /> AI Configuration
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Provider</label>
                        <select 
                            value={config.ai.provider || 'gemini'}
                            onChange={(e) => {
                                const provider = e.target.value;
                                setConfig({
                                    ...config, 
                                    ai: {
                                        ...config.ai, 
                                        provider, 
                                        model: provider === 'openai' ? 'gpt-4o' : 'gemini-flash-latest'
                                    }
                                });
                            }}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                        >
                            <option value="gemini">Google Gemini</option>
                            <option value="openai">OpenAI</option>
                        </select>
                    </div>

                    {config.ai.provider === 'openai' ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">OpenAI API Key</label>
                                <div className="relative">
                                    <input 
                                        type="password" 
                                        value={config.ai.openaiApiKey || ''}
                                        onChange={(e) => setConfig({...config, ai: {...config.ai, openaiApiKey: e.target.value}})}
                                        placeholder="sk-..."
                                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 pl-9 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                    <Key className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Model</label>
                                <select 
                                    value={config.ai.model}
                                    onChange={(e) => setConfig({...config, ai: {...config.ai, model: e.target.value}})}
                                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="gpt-4o">GPT-4o (Smartest)</option>
                                    <option value="gpt-4o-mini">GPT-4o Mini (Fastest)</option>
                                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                </select>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Gemini API Key</label>
                                <div className="relative">
                                    <input 
                                        type="password" 
                                        value={config.ai.apiKey}
                                        onChange={(e) => setConfig({...config, ai: {...config.ai, apiKey: e.target.value}})}
                                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 pl-9 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                    <Key className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Model</label>
                                <select 
                                    value={config.ai.model}
                                    onChange={(e) => setConfig({...config, ai: {...config.ai, model: e.target.value}})}
                                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="gemini-flash-latest">Gemini Flash (Recommended)</option>
                                    <option value="gemini-pro">Gemini Pro</option>
                                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Remote Hosts Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                        <Server className="w-4 h-4" /> Remote Hosts (SSH)
                    </h2>
                    <button
                        onClick={() => setConfig({
                            ...config, 
                            hosts: [...config.hosts, { id: Math.random().toString(36).substring(2, 9), alias: 'New Server', hostname: '', username: 'root', keyPath: '~/.ssh/id_rsa' }] 
                        })}
                        className="text-xs bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 px-2 py-1 rounded text-zinc-700 dark:text-zinc-300 transition-colors border border-zinc-300 dark:border-zinc-700"
                    >
                        + Add Host
                    </button>
                </div>
                
                <div className="space-y-4">
                    {config.hosts.length === 0 && (
                        <div className="text-zinc-500 text-sm italic text-center p-4 border border-dashed border-zinc-300 dark:border-zinc-800 rounded">
                            No remote hosts configured.
                        </div>
                    )}
                    {config.hosts.map((host: any, index: number) => (
                        <div key={host.id} className="bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-md p-4 relative group">
                            <button 
                                onClick={() => {
                                    const newHosts = [...config.hosts];
                                    newHosts.splice(index, 1);
                                    setConfig({...config, hosts: newHosts});
                                }}
                                className="absolute top-2 right-2 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                Remove
                            </button>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">Alias</label>
                                    <input 
                                        type="text" 
                                        value={host.alias}
                                        onChange={(e) => {
                                            const newHosts = [...config.hosts];
                                            newHosts[index].alias = e.target.value;
                                            setConfig({...config, hosts: newHosts});
                                        }}
                                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-sm text-zinc-900 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">Hostname / IP</label>
                                    <input 
                                        type="text" 
                                        value={host.hostname}
                                        placeholder="192.168.1.1"
                                        onChange={(e) => {
                                            const newHosts = [...config.hosts];
                                            newHosts[index].hostname = e.target.value;
                                            setConfig({...config, hosts: newHosts});
                                        }}
                                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-sm text-zinc-900 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">Username</label>
                                    <input 
                                        type="text" 
                                        value={host.username}
                                        onChange={(e) => {
                                            const newHosts = [...config.hosts];
                                            newHosts[index].username = e.target.value;
                                            setConfig({...config, hosts: newHosts});
                                        }}
                                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-sm text-zinc-900 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1">Private Key Path</label>
                                    <input 
                                        type="text" 
                                        value={host.keyPath}
                                        onChange={(e) => {
                                            const newHosts = [...config.hosts];
                                            newHosts[index].keyPath = e.target.value;
                                            setConfig({...config, hosts: newHosts});
                                        }}
                                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-sm text-zinc-900 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}
