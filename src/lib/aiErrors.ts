export type AiErrorState = {
  title: string;
  message: string;
  retryable: boolean;
  blocking: boolean;
};

const cleanMessage = (raw: string) =>
  raw
    .replace(/^error:\s*/i, '')
    .replace(/^analysis failed:\s*/i, '')
    .replace(/^chat failed:\s*/i, '')
    .trim();

export const normalizeAiError = (raw: string): AiErrorState => {
  const message = cleanMessage(raw || 'AI request failed.');
  const lower = message.toLowerCase();

  if ((lower.includes('api key') && lower.includes('missing')) || lower.includes('api key is required')) {
    return {
      title: 'API key required',
      message: 'No API key is configured. Go to Settings → AI Configuration to add your API key.',
      retryable: false,
      blocking: true,
    };
  }

  if (lower.includes('ai features are disabled')) {
    return {
      title: 'AI disabled',
      message: 'AI features are disabled. Go to Settings → AI Configuration to enable them.',
      retryable: false,
      blocking: true,
    };
  }

  if (lower.includes('credit balance') || lower.includes('insufficient credits') || lower.includes('insufficient_quota')) {
    return {
      title: 'AI access blocked',
      message: message,
      retryable: false,
      blocking: true,
    };
  }

  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('too many requests')) {
    return {
      title: 'Rate limited',
      message: 'The AI provider is rate limiting requests. Wait a moment, then retry.',
      retryable: true,
      blocking: false,
    };
  }

  if (
    lower.includes('failed to connect') ||
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('timed out') ||
    lower.includes('timeout')
  ) {
    return {
      title: 'Connection error',
      message: 'Could not reach the AI service. Check your connection and retry.',
      retryable: true,
      blocking: false,
    };
  }

  return {
    title: 'AI request failed',
    message: message || 'AI request failed.',
    retryable: true,
    blocking: false,
  };
};
