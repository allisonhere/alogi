import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

type Provider = 'gemini' | 'openai' | 'claude' | 'ollama';

const extractHumanMessage = (error: unknown) => {
  if (!error) return 'Validation failed.';

  const direct =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : String(error);

  const anyError = error as { error?: { message?: unknown } } | null;
  if (anyError?.error && typeof anyError.error.message === 'string') {
    return anyError.error.message;
  }

  const trimmed = direct.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as {
        message?: unknown;
        error?: { message?: unknown } | unknown;
      };
      if (typeof parsed?.error === 'object' && parsed?.error && 'message' in parsed.error) {
        const nested = (parsed.error as { message?: unknown }).message;
        if (typeof nested === 'string') return nested;
      }
      if (typeof parsed?.message === 'string') return parsed.message;
      if (typeof parsed?.error === 'string') return parsed.error;
    } catch {
      // fall through to sanitize the raw message
    }
  }

  return trimmed.replace(/^error:\s*/i, '').replace(/^\d{3}\s+/, '');
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      provider?: Provider;
      apiKey?: string;
      model?: string;
      baseUrl?: string;
    };

    const provider = body?.provider;
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
    const model = typeof body?.model === 'string' ? body.model.trim() : '';

    if (!provider || (provider !== 'gemini' && provider !== 'openai' && provider !== 'claude' && provider !== 'ollama')) {
      return NextResponse.json({ error: 'Provider is required.' }, { status: 400 });
    }
    if (provider !== 'ollama' && !apiKey) {
      return NextResponse.json({ error: 'API key is required.' }, { status: 400 });
    }

    if (provider === 'claude') {
      const anthropic = new Anthropic({ apiKey });
      await anthropic.messages.create({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Ping' }],
      });
      return NextResponse.json({ ok: true });
    }

    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey });
      await openai.models.list();
      return NextResponse.json({ ok: true });
    }

    if (provider === 'ollama') {
      const baseURL = (typeof body?.baseUrl === 'string' ? body.baseUrl.trim() : 'http://localhost:11434') + '/v1';
      const openai = new OpenAI({ baseURL, apiKey: 'ollama' });
      await openai.models.list();
      return NextResponse.json({ ok: true });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-flash-latest' });
    await geminiModel.generateContent('Ping');
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = extractHumanMessage(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
