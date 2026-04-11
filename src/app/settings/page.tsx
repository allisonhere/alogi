'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, ArrowLeft, Server, Cpu, Key, Trash2, Copy, X, ChevronDown, Settings, Github, ExternalLink, Heart, Info } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { AlogiConfig, HostConfig, UiTheme } from '@/lib/config';
import { ToastContainer, useToast } from '@/components/Toast';
import { useDialog } from '@/components/Dialog';
import { useUiTheme } from '@/components/theme-provider';
import packageJson from '../../../package.json';

type MissingKey = { id?: string; alias?: string; keyPath?: string };
type MissingPassword = { id?: string; alias?: string };
type SaveErrorResponse = { error?: string; missingKeys?: MissingKey[]; missingPasswords?: MissingPassword[] };
type UpdateCommand = { label: string; command: string };
type UpdateCheckResponse = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  publishedAt: string | null;
  releaseUrl: string | null;
  archPackageUrl: string | null;
  notes: string | null;
  environment: {
    hasPacman: boolean;
    hasParu: boolean;
    hasYay: boolean;
    isAlogiInstalled: boolean;
  };
  commands: {
    primary: UpdateCommand | null;
    alternatives: UpdateCommand[];
  };
  error?: string;
};

interface HostValidationErrors {
  hostname?: string;
  username?: string;
  keyPath?: string;
  password?: string;
}

function validateHost(host: HostConfig): HostValidationErrors {
  const errors: HostValidationErrors = {};

  if (!host.hostname?.trim()) {
    errors.hostname = 'Hostname is required';
  }

  if (!host.username?.trim()) {
    errors.username = 'Username is required';
  }

  const authMethod = host.authMethod ?? 'key';
  if (authMethod === 'key' && !host.keyPath?.trim()) {
    errors.keyPath = 'Key path is required';
  }

  if (authMethod === 'password' && !host.password?.trim()) {
    errors.password = 'Password is required';
  }

  return errors;
}

function hasValidationErrors(errors: HostValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export default function SettingsPage() {
  const { uiTheme, setUiTheme } = useUiTheme();
  const [config, setConfig] = useState<AlogiConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<AlogiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingOnboarding, setResettingOnboarding] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<{ state: 'idle' | 'testing' | 'success' | 'error'; message?: string }>({ state: 'idle' });
  const [hostTestStatus, setHostTestStatus] = useState<Record<string, { state: 'idle' | 'testing' | 'success' | 'error'; message?: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [missingKeyById, setMissingKeyById] = useState<Record<string, string>>({});
  const [missingPasswordById, setMissingPasswordById] = useState<Record<string, true>>({});
  const [showPasswordById, setShowPasswordById] = useState<Record<string, boolean>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, Set<string>>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set());
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');

  const { toasts, showToast, dismissToast } = useToast();
  const { showConfirm } = useDialog();

  // Compute dirty state
  const isDirty = useMemo(() => {
    if (!config || !savedConfig) return false;
    return JSON.stringify(config) !== JSON.stringify(savedConfig);
  }, [config, savedConfig]);

  // Compute validation errors for all hosts
  const hostValidationErrors = useMemo(() => {
    if (!config) return {};
    const errors: Record<string, HostValidationErrors> = {};
    config.hosts.forEach((host) => {
      if (host.id) {
        errors[host.id] = validateHost(host);
      }
    });
    return errors;
  }, [config]);

  // Check if any host has validation errors
  const hasAnyValidationErrors = useMemo(() => {
    return Object.values(hostValidationErrors).some(hasValidationErrors);
  }, [hostValidationErrors]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setError(null);
        const res = await fetch('/api/settings');
        if (!res.ok) {
          throw new Error(`Failed to load settings (${res.status})`);
        }
        const data = await res.json();
        data.ui = { onboardingDismissed: false, theme: 'operator-console', ...data.ui };
        setConfig(data);
        setSavedConfig(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load settings';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const checkForUpdates = useCallback(async (silent = false) => {
    setUpdateStatus('checking');

    try {
      const res = await fetch('/api/updates', { cache: 'no-store' });
      const data = await res.json() as UpdateCheckResponse;

      if (!res.ok) {
        throw new Error(data.error || `Failed to check updates (${res.status})`);
      }

      setUpdateInfo(data);
      setUpdateStatus('ready');

      if (!silent) {
        showToast(
          'info',
          data.updateAvailable
            ? `Update available: v${data.latestVersion}`
            : `Alogi is up to date${data.currentVersion ? ` (v${data.currentVersion})` : ''}`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check updates';
      setUpdateStatus('error');
      setUpdateInfo(null);
      if (!silent) {
        showToast('error', message);
      }
    }
  }, [showToast]);

  useEffect(() => {
    void checkForUpdates(true);
  }, [checkForUpdates]);

  const markFieldTouched = useCallback((hostId: string, field: string) => {
    setTouchedFields(prev => {
      const hostFields = prev[hostId] ?? new Set();
      if (hostFields.has(field)) return prev;
      const newSet = new Set(hostFields);
      newSet.add(field);
      return { ...prev, [hostId]: newSet };
    });
  }, []);

  const isFieldTouched = useCallback((hostId: string, field: string) => {
    return touchedFields[hostId]?.has(field) ?? false;
  }, [touchedFields]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        let message = `Failed to save settings (${res.status})`;
        try {
          const data = await res.json() as SaveErrorResponse;
          if (data?.missingKeys?.length) {
            const list = data.missingKeys
              .map((item) => `${item.alias}: ${item.keyPath}`)
              .join('\n');
            message = `Missing SSH key file(s):\n${list}`;
            const nextMissing: Record<string, string> = {};
            data.missingKeys.forEach((item) => {
              if (item?.id) {
                nextMissing[item.id] = item.keyPath ?? '';
                return;
              }
              if (item?.alias) {
                const match = config?.hosts?.find((h) => h.alias === item.alias);
                if (match?.id) {
                  nextMissing[match.id] = item.keyPath ?? '';
                }
              }
            });
            setMissingKeyById(nextMissing);
          }
          if (data?.missingPasswords?.length) {
            const list = data.missingPasswords
              .map((item) => `${item.alias}`)
              .join('\n');
            message = message.includes('Missing SSH key file')
              ? `${message}\n\nMissing SSH password(s):\n${list}`
              : `Missing SSH password(s):\n${list}`;
            const nextMissingPasswords: Record<string, true> = {};
            data.missingPasswords.forEach((item) => {
              if (item?.id) {
                nextMissingPasswords[item.id] = true;
                return;
              }
              if (item?.alias) {
                const match = config?.hosts?.find((h) => h.alias === item.alias);
                if (match?.id) {
                  nextMissingPasswords[match.id] = true;
                }
              }
            });
            setMissingPasswordById(nextMissingPasswords);
          } else if (data?.error) {
            message = data.error;
          }
        } catch {
          // ignore parse errors
        }
        showToast('error', message);
        return;
      }
      setMissingKeyById({});
      setMissingPasswordById({});
      setSavedConfig(config);
      setTouchedFields({});
      showToast('success', 'Settings saved!');
    } catch {
      showToast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetOnboarding = async () => {
    setResettingOnboarding(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui: { onboardingDismissed: false } }),
      });
      if (!res.ok) {
        throw new Error(`Failed to reset onboarding (${res.status})`);
      }
      localStorage.removeItem('alogi.onboarded');
      localStorage.setItem('alogi.forceOnboarding', 'true');
      showToast('success', 'Onboarding reset. Reload the app to see it again.');
    } catch {
      showToast('error', 'Failed to reset onboarding');
    } finally {
      setResettingOnboarding(false);
    }
  };

  const handleTestKey = async () => {
    if (!config) return;
    const provider = config.ai.provider || 'gemini';
    const apiKey = provider === 'openai' ? (config.ai.openaiApiKey || '') : provider === 'claude' ? (config.ai.claudeApiKey || '') : (config.ai.apiKey || '');
    if (!apiKey.trim()) {
      setAiTestStatus({ state: 'error', message: 'Paste an API key first.' });
      return;
    }
    setAiTestStatus({ state: 'testing' });
    try {
      const res = await fetch('/api/ai/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, model: config.ai.model }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setAiTestStatus({ state: 'error', message: data?.error || 'Validation failed.' });
        return;
      }
      setAiTestStatus({ state: 'success', message: 'Key verified.' });
    } catch {
      setAiTestStatus({ state: 'error', message: 'Validation failed.' });
    }
  };

  const handleTestConnection = async (hostIndex: number) => {
    if (!config) return;
    const host = config.hosts[hostIndex];
    if (!host.id) return;

    setHostTestStatus(prev => ({ ...prev, [host.id!]: { state: 'testing', message: undefined } }));

    try {
      const res = await fetch('/api/hosts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(host),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setHostTestStatus(prev => ({ ...prev, [host.id!]: { state: 'error', message: data.error || 'Connection failed' } }));
        showToast('error', `Connection failed: ${data.error || 'Unknown error'}`);
      } else {
        setHostTestStatus(prev => ({ ...prev, [host.id!]: { state: 'success', message: 'Connected!' } }));
        showToast('success', `Connected to ${host.alias}!`);
      }
    } catch {
      setHostTestStatus(prev => ({ ...prev, [host.id!]: { state: 'error', message: 'Network error' } }));
      showToast('error', 'Network error during connection test');
    }
  };

  const handleDuplicateHost = (index: number) => {
    if (!config) return;
    const original = config.hosts[index];
    const newId = Math.random().toString(36).substring(2, 9);
    const newHost: HostConfig = {
      ...original,
      id: newId,
      alias: `Copy of ${original.alias}`,
    };
    const newHosts = [...config.hosts];
    newHosts.splice(index + 1, 0, newHost);
    setConfig({ ...config, hosts: newHosts });
    setExpandedHosts(prev => new Set(prev).add(newId));
    showToast('info', `Duplicated "${original.alias}"`);
  };

  const handleRemoveHost = async (index: number) => {
    if (!config) return;
    const host = config.hosts[index];
    const ok = await showConfirm({
      title: 'Remove host?',
      message: `Are you sure you want to remove "${host.alias}"?`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    if (host.id) {
      if (missingKeyById[host.id]) {
        const next = { ...missingKeyById };
        delete next[host.id];
        setMissingKeyById(next);
      }
      if (missingPasswordById[host.id]) {
        const next = { ...missingPasswordById };
        delete next[host.id];
        setMissingPasswordById(next);
      }
      if (showPasswordById[host.id]) {
        const next = { ...showPasswordById };
        delete next[host.id];
        setShowPasswordById(next);
      }
      if (touchedFields[host.id]) {
        const next = { ...touchedFields };
        delete next[host.id];
        setTouchedFields(next);
      }
      if (expandedHosts.has(host.id)) {
        const next = new Set(expandedHosts);
        next.delete(host.id);
        setExpandedHosts(next);
      }
    }
    const newHosts = [...config.hosts];
    newHosts.splice(index, 1);
    setConfig({ ...config, hosts: newHosts });
  };

  const toggleHostExpanded = (hostId: string) => {
    setExpandedHosts(prev => {
      const next = new Set(prev);
      if (next.has(hostId)) {
        next.delete(hostId);
      } else {
        next.add(hostId);
      }
      return next;
    });
  };

  const getCurrentApiKey = useCallback(() => {
    if (!config) return '';
    const provider = config.ai.provider || 'gemini';
    switch (provider) {
      case 'openai': return config.ai.openaiApiKey || '';
      case 'claude': return config.ai.claudeApiKey || '';
      default: return config.ai.apiKey || '';
    }
  }, [config]);

  const setCurrentApiKey = useCallback((value: string) => {
    if (!config) return;
    const provider = config.ai.provider || 'gemini';
    switch (provider) {
      case 'openai':
        setConfig({ ...config, ai: { ...config.ai, openaiApiKey: value } });
        break;
      case 'claude':
        setConfig({ ...config, ai: { ...config.ai, claudeApiKey: value } });
        break;
      default:
        setConfig({ ...config, ai: { ...config.ai, apiKey: value } });
    }
  }, [config]);

  const getApiKeyPlaceholder = useCallback(() => {
    if (!config) return '';
    const provider = config.ai.provider || 'gemini';
    switch (provider) {
      case 'openai': return 'sk-...';
      case 'claude': return 'sk-ant-...';
      default: return 'AIza...';
    }
  }, [config]);

  const getApiKeyLabel = useCallback(() => {
    if (!config) return 'API Key';
    const provider = config.ai.provider || 'gemini';
    switch (provider) {
      case 'openai': return 'OpenAI API Key';
      case 'claude': return 'Claude API Key';
      default: return 'Gemini API Key';
    }
  }, [config]);

  useEffect(() => {
    setAiTestStatus({ state: 'idle' });
  }, [config?.ai?.provider, config?.ai?.apiKey, config?.ai?.openaiApiKey, config?.ai?.claudeApiKey, config?.ai?.model]);

  // Reset host test status when host config changes significantly
  useEffect(() => {
    setHostTestStatus({});
  }, [config?.hosts.length]);

  const copyCommand = useCallback(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      showToast('success', 'Command copied');
    } catch {
      showToast('error', 'Failed to copy command');
    }
  }, [showToast]);

  const formatPublishedAt = useCallback((value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading settings...</div>;
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex flex-col items-center py-10 transition-colors">
        <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xl">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold">Settings</h1>
            </div>
          </div>
          <div className="p-6">
            <div className="text-sm text-red-600 dark:text-red-400 mb-4">Failed to load settings: {error}</div>
            <button
              onClick={() => window.location.reload()}
              className="text-xs bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 px-3 py-2 rounded text-zinc-700 dark:text-zinc-300 transition-colors border border-zinc-300 dark:border-zinc-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!config) return <div className="text-zinc-500 p-8">Loading settings...</div>;

  const provider = config.ai.provider || 'gemini';
  const themeCards: Array<{ value: UiTheme; title: string; body: string }> = [
    { value: 'operator-console', title: 'Operator Console', body: 'Dark, restrained, high signal-to-noise.' },
    { value: 'developer-ide', title: 'Developer IDE', body: 'Denser framing with stronger pane separation.' },
    { value: 'modern-saas', title: 'Modern SaaS', body: 'Lighter, softer surfaces with cleaner spacing.' },
  ];
  const currentVersion = updateInfo?.currentVersion ?? packageJson.version;
  const publishedAt = formatPublishedAt(updateInfo?.publishedAt ?? null);
  const updatesSummary = updateStatus === 'checking'
    ? 'Checking...'
    : updateStatus === 'error'
      ? 'Check failed'
      : updateInfo?.updateAvailable
        ? 'Update available'
        : 'Up to date';

  return (
    <div className="settings-page app-shell min-h-screen flex flex-col items-center py-10 transition-colors px-4">
      <div className="ui-card w-full max-w-4xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-subtle flex items-center justify-between bg-[var(--surface-bg)]">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-[var(--surface-hover)] rounded-full transition-colors text-secondary hover:text-primary">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="ui-section-label">Workspace</div>
              <h1 className="text-xl font-bold text-primary">Settings</h1>
            </div>
            {isDirty && (
              <span className="ui-badge bg-warning-soft text-[var(--warning)]">
                Unsaved changes
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || hasAnyValidationErrors}
            title={hasAnyValidationErrors ? 'Fix validation errors before saving' : undefined}
            className="ui-button ui-button-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div className="p-6 space-y-8">
          <div>
            <h2 className="ui-section-label mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Appearance
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {themeCards.map((themeOption) => {
                const active = (config.ui?.theme ?? uiTheme) === themeOption.value;
                return (
                  <button
                    key={themeOption.value}
                    type="button"
                    onClick={() => {
                      setUiTheme(themeOption.value);
                      setConfig({ ...config, ui: { ...config.ui, theme: themeOption.value } });
                    }}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      active
                        ? 'border-[color:var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-subtle bg-[var(--surface-bg)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-primary">{themeOption.title}</div>
                      {active && <span className="ui-badge bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent">Active</span>}
                    </div>
                    <p className="mt-2 text-sm text-secondary">{themeOption.body}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Section */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4" /> AI Configuration
            </h2>
            <div className="space-y-4">
              <div className="rounded-lg border border-indigo-200/70 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 p-4 text-sm text-zinc-700 dark:text-zinc-300">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">New to API keys?</div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
                  An API key lets Alogi talk to your AI provider. Keys are stored locally on your machine.
                  No key? You can still use logs without AI and add one later.
                </p>
                <ol className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 list-decimal list-inside">
                  <li>Pick a provider below.</li>
                  <li>Create a key in the provider dashboard.</li>
                  <li>Paste it here and click Test key.</li>
                </ol>
                <div className="flex flex-wrap gap-2 mt-3">
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-500/10 transition-colors"
                  >
                    Get OpenAI API key
                  </a>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-500/10 transition-colors"
                  >
                    Get Gemini API key
                  </a>
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-500/10 transition-colors"
                  >
                    Get Claude API key
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Enable AI features</p>
                  <p className="text-xs text-zinc-500">Turn off to disable AI analyze and chat.</p>
                </div>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={config.ai.enabled !== false}
                    onChange={(e) => setConfig({ ...config, ai: { ...config.ai, enabled: e.target.checked } })}
                  />
                  <span className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${config.ai.enabled !== false ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                    <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${config.ai.enabled !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => {
                    const newProvider = e.target.value as 'gemini' | 'openai' | 'claude';
                    const model = newProvider === 'openai' ? 'gpt-4o' : newProvider === 'claude' ? 'claude-sonnet-4-20250514' : 'gemini-flash-latest';
                    setConfig({
                      ...config,
                      ai: {
                        ...config.ai,
                        provider: newProvider,
                        model,
                      }
                    });
                  }}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Anthropic Claude</option>
                </select>
              </div>

              {/* Unified API Key Input */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{getApiKeyLabel()}</label>
                <div className="relative">
                  <input
                    type="password"
                    value={getCurrentApiKey()}
                    onChange={(e) => setCurrentApiKey(e.target.value)}
                    placeholder={getApiKeyPlaceholder()}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 pl-9 pr-9 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <Key className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  {getCurrentApiKey() && (
                    <button
                      type="button"
                      onClick={() => setCurrentApiKey('')}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                      title="Clear API key"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={aiTestStatus.state === 'testing' || config.ai.enabled === false}
                    className="text-xs px-3 py-1.5 rounded-md border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-50 transition-colors"
                  >
                    {aiTestStatus.state === 'testing' ? 'Testing...' : 'Test key'}
                  </button>
                  {aiTestStatus.state !== 'idle' && (
                    <span className={`text-xs ${aiTestStatus.state === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {aiTestStatus.message}
                    </span>
                  )}
                </div>
              </div>

              {/* Model Selection with optgroups */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Model</label>
                <select
                  value={config.ai.model}
                  onChange={(e) => setConfig({...config, ai: {...config.ai, model: e.target.value}})}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  {provider === 'gemini' && (
                    <>
                      <optgroup label="Recommended">
                        <option value="gemini-flash-latest">Gemini Flash (Fast & Capable)</option>
                      </optgroup>
                      <optgroup label="Premium">
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gemini-pro">Gemini Pro</option>
                      </optgroup>
                    </>
                  )}
                  {provider === 'openai' && (
                    <>
                      <optgroup label="Recommended">
                        <option value="gpt-4o">GPT-4o (Smartest)</option>
                        <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                      </optgroup>
                      <optgroup label="Legacy">
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </optgroup>
                    </>
                  )}
                  {provider === 'claude' && (
                    <>
                      <optgroup label="Recommended">
                        <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                      </optgroup>
                      <optgroup label="Premium">
                        <option value="claude-opus-4-20250514">Claude Opus 4</option>
                      </optgroup>
                      <optgroup label="Fast">
                        <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                      </optgroup>
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Onboarding Section */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Key className="w-4 h-4" /> Onboarding
            </h2>
            <div className="space-y-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Replay the guided overlay the next time you open the app.
              </p>
              <button
                onClick={handleResetOnboarding}
                disabled={resettingOnboarding}
                className="inline-flex items-center gap-2 rounded-md border border-indigo-200 dark:border-indigo-500/40 px-3 py-2 text-sm text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
              >
                <Key className="w-4 h-4" />
                {resettingOnboarding ? 'Resetting...' : 'Restart onboarding'}
              </button>
            </div>
          </div>

          {/* Remote Hosts Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4" /> Remote Hosts (SSH)
              </h2>
              <button
                onClick={() => {
                  const newId = Math.random().toString(36).substring(2, 9);
                  setConfig({
                    ...config,
                    hosts: [...config.hosts, { id: newId, alias: 'New Server', hostname: '', username: 'root', port: 22, keyPath: '~/.ssh/id_rsa', password: '', authMethod: 'key' }]
                  });
                  setExpandedHosts(prev => new Set(prev).add(newId));
                }}
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
              {config.hosts.map((host, index) => {
                const hostId = host.id || '';
                const errors = hostValidationErrors[hostId] || {};
                const hasErrors = hasValidationErrors(errors);
                const authMethod = host.authMethod ?? 'key';
                const isExpanded = expandedHosts.has(hostId);
                const testStatus = hostId ? hostTestStatus[hostId] : undefined;

                return (
                  <div
                    key={hostId}
                    className={`bg-zinc-50/50 dark:bg-zinc-900/50 border rounded-md overflow-hidden ${hasErrors ? 'border-red-300 dark:border-red-500/50' : 'border-zinc-200 dark:border-zinc-800'}`}
                  >
                    {/* Collapsed header - always visible */}
                    <button
                      type="button"
                      onClick={() => toggleHostExpanded(hostId)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{host.alias || 'Unnamed'}</span>
                          <span className="text-xs text-zinc-500 truncate">
                            {host.hostname ? `${host.hostname}:${host.port ?? 22}` : 'Not configured'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasErrors && (
                          <span className="w-2 h-2 rounded-full bg-red-500" title="Has validation errors" />
                        )}
                        {testStatus?.state === 'success' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Connected" />
                        )}
                        {testStatus?.state === 'error' && (
                          <span className="w-2 h-2 rounded-full bg-red-500" title={testStatus.message} />
                        )}
                        {testStatus?.state === 'testing' && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Testing..." />
                        )}
                      </div>
                    </button>

                    {/* Expanded form */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-zinc-200 dark:border-zinc-800">
                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-2 py-2 mb-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDuplicateHost(index); }}
                            className="text-zinc-400 hover:text-indigo-500 transition-colors flex items-center gap-1 text-xs"
                            title="Duplicate host"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRemoveHost(index); }}
                            className="text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1 text-xs"
                            title="Remove host"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>

                        {/* Connection section */}
                        <div className="space-y-4">
                          {/* Row 1: Alias */}
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

                          {/* Row 2: Hostname + Port */}
                          <div className="grid grid-cols-[1fr_80px] gap-3">
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
                                onBlur={() => markFieldTouched(hostId, 'hostname')}
                                className={`w-full bg-white dark:bg-zinc-950 border rounded px-2 py-1 text-sm text-zinc-900 dark:text-zinc-200 focus:ring-1 outline-none ${
                                  errors.hostname && isFieldTouched(hostId, 'hostname')
                                    ? 'border-red-400 dark:border-red-500 focus:ring-red-500'
                                    : 'border-zinc-300 dark:border-zinc-800 focus:ring-indigo-500'
                                }`}
                              />
                              {errors.hostname && isFieldTouched(hostId, 'hostname') && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.hostname}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs text-zinc-500 mb-1">Port</label>
                              <input
                                type="number"
                                value={host.port ?? 22}
                                min={1}
                                max={65535}
                                onChange={(e) => {
                                  const newHosts = [...config.hosts];
                                  newHosts[index].port = parseInt(e.target.value) || 22;
                                  setConfig({...config, hosts: newHosts});
                                }}
                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-sm text-zinc-900 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                              />
                            </div>
                          </div>

                          {/* Row 3: Username */}
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
                              onBlur={() => markFieldTouched(hostId, 'username')}
                              className={`w-full bg-white dark:bg-zinc-950 border rounded px-2 py-1 text-sm text-zinc-900 dark:text-zinc-200 focus:ring-1 outline-none ${
                                errors.username && isFieldTouched(hostId, 'username')
                                  ? 'border-red-400 dark:border-red-500 focus:ring-red-500'
                                  : 'border-zinc-300 dark:border-zinc-800 focus:ring-indigo-500'
                              }`}
                            />
                            {errors.username && isFieldTouched(hostId, 'username') && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.username}</p>
                            )}
                          </div>

                          {/* Auth section divider */}
                          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <label className="block text-xs text-zinc-500">Authentication</label>
                              <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-800 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newHosts = [...config.hosts];
                                    newHosts[index].authMethod = 'key';
                                    setConfig({...config, hosts: newHosts});
                                    if (hostId && missingPasswordById[hostId]) {
                                      const next = { ...missingPasswordById };
                                      delete next[hostId];
                                      setMissingPasswordById(next);
                                    }
                                  }}
                                  className={`px-3 py-1 text-xs transition-colors ${authMethod === 'key' ? "bg-indigo-600 text-white" : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}
                                >
                                  SSH Key
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newHosts = [...config.hosts];
                                    newHosts[index].authMethod = 'password';
                                    setConfig({...config, hosts: newHosts});
                                    if (hostId && missingKeyById[hostId]) {
                                      const next = { ...missingKeyById };
                                      delete next[hostId];
                                      setMissingKeyById(next);
                                    }
                                  }}
                                  className={`px-3 py-1 text-xs transition-colors ${authMethod === 'password' ? "bg-indigo-600 text-white" : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}
                                >
                                  Password
                                </button>
                              </div>
                            </div>

                            {/* Auth credential field */}
                            {authMethod === 'key' ? (
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Private Key Path</label>
                                <input
                                  type="text"
                                  value={host.keyPath}
                                  onChange={(e) => {
                                    const newHosts = [...config.hosts];
                                    newHosts[index].keyPath = e.target.value;
                                    setConfig({...config, hosts: newHosts});
                                    if (hostId && missingKeyById[hostId]) {
                                      const next = { ...missingKeyById };
                                      delete next[hostId];
                                      setMissingKeyById(next);
                                    }
                                  }}
                                  onBlur={() => markFieldTouched(hostId, 'keyPath')}
                                  className={`w-full bg-white dark:bg-zinc-950 border rounded px-2 py-1 text-sm text-zinc-900 dark:text-zinc-200 focus:ring-1 outline-none ${
                                    (hostId && missingKeyById[hostId]) || (errors.keyPath && isFieldTouched(hostId, 'keyPath'))
                                      ? "border-red-400 dark:border-red-500 focus:ring-red-500"
                                      : "border-zinc-300 dark:border-zinc-800 focus:ring-indigo-500"
                                  }`}
                                />
                                {hostId && missingKeyById[hostId] && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    Private key not found at {missingKeyById[hostId]}
                                  </p>
                                )}
                                {errors.keyPath && isFieldTouched(hostId, 'keyPath') && !missingKeyById[hostId] && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.keyPath}</p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Password</label>
                                <div className="relative">
                                  <input
                                    type={hostId && showPasswordById[hostId] ? "text" : "password"}
                                    value={host.password || ''}
                                    onChange={(e) => {
                                      const newHosts = [...config.hosts];
                                      newHosts[index].password = e.target.value;
                                      setConfig({...config, hosts: newHosts});
                                      if (hostId && missingPasswordById[hostId]) {
                                        const next = { ...missingPasswordById };
                                        delete next[hostId];
                                        setMissingPasswordById(next);
                                      }
                                    }}
                                    onBlur={() => markFieldTouched(hostId, 'password')}
                                    className={`w-full bg-white dark:bg-zinc-950 border rounded px-2 py-1 pr-12 text-sm text-zinc-900 dark:text-zinc-200 focus:ring-1 outline-none ${
                                      (hostId && missingPasswordById[hostId]) || (errors.password && isFieldTouched(hostId, 'password'))
                                        ? "border-red-400 dark:border-red-500 focus:ring-red-500"
                                        : "border-zinc-300 dark:border-zinc-800 focus:ring-indigo-500"
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!hostId) return;
                                      setShowPasswordById(prev => ({ ...prev, [hostId]: !prev[hostId] }));
                                    }}
                                    className="absolute right-2 top-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                  >
                                    {hostId && showPasswordById[hostId] ? "Hide" : "Show"}
                                  </button>
                                </div>
                                {hostId && missingPasswordById[hostId] && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    Password is required for this host.
                                  </p>
                                )}
                                {errors.password && isFieldTouched(hostId, 'password') && !missingPasswordById[hostId] && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.password}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Test Connection Button */}
                        <div className="flex items-center justify-end gap-3 mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                          {testStatus?.state !== 'idle' && testStatus && (
                            <span className={`text-xs ${testStatus.state === 'success' ? 'text-emerald-600 dark:text-emerald-400' : testStatus.state === 'error' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>
                              {testStatus.message || (testStatus.state === 'testing' ? 'Connecting...' : '')}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleTestConnection(index)}
                            disabled={testStatus?.state === 'testing'}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${testStatus?.state === 'success' ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" : testStatus?.state === 'error' ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                          >
                            {testStatus?.state === 'testing' ? 'Testing...' : 'Test Connection'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Advanced Section (Collapsible) */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="w-full flex items-center justify-between text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4" /> Advanced
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>

            {advancedOpen && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Local Log Directory</label>
                  <input
                    type="text"
                    value={config.general.logPath}
                    onChange={(e) => setConfig({...config, general: {...config.general, logPath: e.target.value}})}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Path to the logs folder on this machine. Default: /var/log</p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <button
              type="button"
              onClick={() => setUpdatesOpen(!updatesOpen)}
              className="w-full flex items-center justify-between gap-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4" /> Updates
              </span>
              <span className="flex items-center gap-3">
                <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full normal-case ${
                  updateStatus === 'error'
                    ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                    : updateInfo?.updateAvailable
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}>
                  {updatesSummary}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${updatesOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {updatesOpen && (
              <div className={`mt-4 rounded-xl border p-4 space-y-4 ${
                updateInfo?.updateAvailable
                  ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-500/5'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40'
              }`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {updateStatus === 'checking'
                        ? 'Checking for the latest release...'
                        : updateStatus === 'error'
                          ? 'Update check failed'
                          : updateInfo?.updateAvailable
                            ? `Update available: v${updateInfo.latestVersion}`
                            : 'You are up to date'}
                    </div>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      Current version: <span className="font-mono text-zinc-900 dark:text-zinc-100">v{currentVersion}</span>
                      {updateInfo?.latestVersion && (
                        <>
                          {' '}• Latest: <span className="font-mono text-zinc-900 dark:text-zinc-100">v{updateInfo.latestVersion}</span>
                        </>
                      )}
                      {publishedAt && (
                        <>
                          {' '}• Released {publishedAt}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {updateInfo?.releaseUrl && (
                      <a
                        href={updateInfo.releaseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline"
                      >
                        View release
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void checkForUpdates()}
                      disabled={updateStatus === 'checking'}
                      className="inline-flex items-center gap-2 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      {updateStatus === 'checking' ? 'Checking...' : 'Check for updates'}
                    </button>
                  </div>
                </div>

                {updateStatus === 'error' && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Could not reach GitHub Releases right now. Try again in a moment.
                  </p>
                )}

                {updateInfo?.notes && (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                      Release notes
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                      {updateInfo.notes}
                    </p>
                  </div>
                )}

                {updateInfo?.commands.primary && (
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                        Recommended command
                      </div>
                      <div className="flex items-start gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/60 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                            {updateInfo.commands.primary.label}
                          </div>
                          <code className="block break-all text-xs text-zinc-900 dark:text-zinc-100">
                            {updateInfo.commands.primary.command}
                          </code>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copyCommand(updateInfo.commands.primary!.command)}
                          className="inline-flex items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-700 p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Copy command"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {updateInfo.commands.alternatives.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Alternate commands
                        </div>
                        {updateInfo.commands.alternatives.map((option) => (
                          <div
                            key={`${option.label}-${option.command}`}
                            className="flex items-start gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                                {option.label}
                              </div>
                              <code className="block break-all text-xs text-zinc-900 dark:text-zinc-100">
                                {option.command}
                              </code>
                            </div>
                            <button
                              type="button"
                              onClick={() => void copyCommand(option.command)}
                              className="inline-flex items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-700 p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Copy command"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {updateInfo && !updateInfo.commands.primary && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    No Arch install command could be detected on this system. Use the release link above to download the latest build.
                  </p>
                )}

                {updateInfo && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Command suggestions are based on detected tools on this machine and may not match the exact way Alogi was originally installed.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* About Section */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info className="w-4 h-4" /> About
            </h2>

            <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-pink-500/10">
              {/* Decorative gradient orbs */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />

              <div className="relative p-6">
                <div className="flex items-start gap-5">
                  {/* Logo */}
                  <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/25">
                    <div className="w-full h-full rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                      <Image src="/logo.svg" alt="Alogi" width={40} height={40} />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Alogi</h3>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                        v{currentVersion}
                      </span>
                      {updateInfo?.updateAvailable && (
                        <button
                          type="button"
                          onClick={() => setUpdatesOpen(true)}
                          className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 hover:brightness-95 transition-colors"
                        >
                          Update available
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                      AI-powered log viewer for developers and DevOps engineers. Analyze local files, remote servers, systemd journals, and Docker containers.
                    </p>

                    {/* Links */}
                    <div className="flex flex-wrap gap-2">
                      <a
                        href="https://github.com/allisonhere/alogi"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <Github className="w-3.5 h-3.5" />
                        GitHub
                      </a>
                      <a
                        href="https://allisonhere.github.io/alogi/"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Website
                      </a>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-zinc-200/50 dark:border-zinc-700/50 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-500">
                  <a href="https://github.com/allisonhere/alogi/blob/main/LICENSE" target="_blank" rel="noreferrer" className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">MIT License</a>
                  <span className="flex items-center gap-1">
                    Made with <Heart className="w-3 h-3 text-pink-500 fill-pink-500" /> by <a href="http://alliehere.com/blog/" target="_blank" rel="noreferrer" className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">Allie</a>
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
