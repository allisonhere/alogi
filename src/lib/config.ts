import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'alogi');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface AlogiConfig {
  general: {
    logPath: string;
  };
  ai: {
    provider: 'gemini' | 'openai';
    apiKey: string;       // Gemini
    openaiApiKey: string; // OpenAI
    model: string;
  };
  hosts: Array<{
    id: string;
    alias: string;
    hostname: string;
    username: string;
    port?: number;
    keyPath?: string;
    password?: string;
    authMethod?: 'key' | 'password';
    type?: 'ssh' | 'docker'; // New field
  }>;
}

const DEFAULT_CONFIG: AlogiConfig = {
  general: {
    logPath: process.env.LOG_ROOT_DIR || '/var/log',
  },
  ai: {
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    model: 'gemini-flash-latest',
  },
  hosts: [],
};

export function getConfig(): AlogiConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return DEFAULT_CONFIG;
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (error) {
    console.warn("Failed to read config, using defaults", error);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: Partial<AlogiConfig>): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    // Merge with existing
    const current = getConfig();
    const newConfig: AlogiConfig = {
      ...current,
      ...config,
      general: { ...current.general, ...config.general },
      ai: { ...current.ai, ...config.ai },
      hosts: config.hosts ?? current.hosts,
    };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
  } catch (error) {
    console.error("Failed to save config", error);
    throw error;
  }
}
