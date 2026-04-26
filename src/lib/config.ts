import fs from 'fs';
import path from 'path';
import os from 'os';
import { debug } from './debug';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'alogi');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const SECRET_PLACEHOLDER = '********';

export interface HostConfig {
  id?: string;
  alias: string;
  hostname: string;
  username: string;
  port?: number;
  keyPath?: string;
  password?: string;
  authMethod?: 'key' | 'password';
  type?: 'ssh' | 'docker';
}

export type UiTheme = 'operator-console' | 'developer-ide' | 'modern-saas';

export interface AlogiConfig {
  general: {
    logPath: string;
    tailLines?: number;
  };
  ai: {
    enabled?: boolean;
    provider: 'gemini' | 'openai' | 'claude';
    apiKey: string;       // Gemini
    openaiApiKey: string; // OpenAI
    claudeApiKey: string; // Claude
    model: string;
  };
  hosts: HostConfig[];
  ui?: {
    onboardingDismissed?: boolean;
    theme?: UiTheme;
  };
}

const DEFAULT_CONFIG: AlogiConfig = {
  general: {
    logPath: process.env.LOG_ROOT_DIR || '/var/log',
  },
  ai: {
    enabled: true,
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    claudeApiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'gemini-flash-latest',
  },
  hosts: [],
  ui: {
    onboardingDismissed: false,
    theme: 'operator-console',
  },
};

export function getConfig(): AlogiConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return DEFAULT_CONFIG;
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (error) {
    debug.warn('Failed to read config, using defaults:', error);
    return DEFAULT_CONFIG;
  }
}

function redactSecret(value: string | undefined): string {
  return value ? SECRET_PLACEHOLDER : '';
}

export function sanitizeConfigForClient(config: AlogiConfig): AlogiConfig {
  return {
    ...config,
    ai: {
      ...config.ai,
      apiKey: redactSecret(config.ai.apiKey),
      openaiApiKey: redactSecret(config.ai.openaiApiKey),
      claudeApiKey: redactSecret(config.ai.claudeApiKey),
    },
    hosts: config.hosts.map((host) => ({
      ...host,
      password: redactSecret(host.password),
    })),
  };
}

function findExistingHost(host: HostConfig, existing: HostConfig[]): HostConfig | undefined {
  if (host.id) {
    const byId = existing.find((candidate) => candidate.id === host.id);
    if (byId) return byId;
  }
  return existing.find((candidate) => candidate.alias === host.alias);
}

export function preserveSecretPlaceholders(
  config: Partial<AlogiConfig>,
  existing: AlogiConfig,
): Partial<AlogiConfig> {
  const next: Partial<AlogiConfig> = { ...config };

  if (config.ai) {
    next.ai = {
      ...config.ai,
      apiKey: config.ai.apiKey === SECRET_PLACEHOLDER ? existing.ai.apiKey : config.ai.apiKey,
      openaiApiKey: config.ai.openaiApiKey === SECRET_PLACEHOLDER ? existing.ai.openaiApiKey : config.ai.openaiApiKey,
      claudeApiKey: config.ai.claudeApiKey === SECRET_PLACEHOLDER ? existing.ai.claudeApiKey : config.ai.claudeApiKey,
    };
  }

  if (config.hosts) {
    next.hosts = config.hosts.map((host) => {
      const existingHost = findExistingHost(host, existing.hosts);
      if (host.password !== SECRET_PLACEHOLDER) return host;
      return {
        ...host,
        password: existingHost?.password ?? '',
      };
    });
  }

  return next;
}

export function saveConfig(config: Partial<AlogiConfig>): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    fs.chmodSync(CONFIG_DIR, 0o700);
    
    // Merge with existing
    const current = getConfig();
    const newConfig: AlogiConfig = {
      ...current,
      ...config,
      general: { ...current.general, ...config.general },
      ai: { ...current.ai, ...config.ai },
      hosts: config.hosts ?? current.hosts,
      ui: { ...current.ui, ...config.ui },
    };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.chmodSync(CONFIG_FILE, 0o600);
  } catch (error) {
    debug.error("Failed to save config", error);
    throw error;
  }
}
