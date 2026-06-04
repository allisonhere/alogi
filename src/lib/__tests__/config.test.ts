import { describe, expect, it } from 'vitest';
import {
  SECRET_PLACEHOLDER,
  preserveSecretPlaceholders,
  sanitizeConfigForClient,
  type AlogiConfig,
} from '../config';

const existingConfig: AlogiConfig = {
  general: { logPath: '/var/log', tailLines: 100 },
  ai: {
    enabled: true,
    provider: 'openai',
    apiKey: 'gemini-secret',
    openaiApiKey: 'openai-secret',
    claudeApiKey: 'claude-secret',
    ollamaBaseUrl: 'http://localhost:11434',
    deepseekApiKey: 'deepseek-secret',
    openrouterApiKey: 'openrouter-secret',
    model: 'gpt-4o',
  },
  hosts: [
    {
      id: 'host-1',
      alias: 'prod',
      hostname: 'prod.example.com',
      username: 'deploy',
      port: 22,
      authMethod: 'password',
      password: 'ssh-secret',
    },
  ],
  ui: { onboardingDismissed: true, theme: 'operator-console' },
};

describe('config client sanitization', () => {
  it('redacts API keys and SSH passwords before returning settings to clients', () => {
    const sanitized = sanitizeConfigForClient(existingConfig);

    expect(sanitized.ai.apiKey).toBe(SECRET_PLACEHOLDER);
    expect(sanitized.ai.openaiApiKey).toBe(SECRET_PLACEHOLDER);
    expect(sanitized.ai.claudeApiKey).toBe(SECRET_PLACEHOLDER);
    expect(sanitized.ai.deepseekApiKey).toBe(SECRET_PLACEHOLDER);
    expect(sanitized.ai.openrouterApiKey).toBe(SECRET_PLACEHOLDER);
    expect(sanitized.hosts[0].password).toBe(SECRET_PLACEHOLDER);
  });

  it('preserves existing secrets when sanitized placeholders are posted back unchanged', () => {
    const posted = sanitizeConfigForClient(existingConfig);
    const merged = preserveSecretPlaceholders(posted, existingConfig);

    expect(merged.ai?.apiKey).toBe('gemini-secret');
    expect(merged.ai?.openaiApiKey).toBe('openai-secret');
    expect(merged.ai?.claudeApiKey).toBe('claude-secret');
    expect(merged.ai?.deepseekApiKey).toBe('deepseek-secret');
    expect(merged.ai?.openrouterApiKey).toBe('openrouter-secret');
    expect(merged.hosts?.[0].password).toBe('ssh-secret');
  });
});
