import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

type Provider = 'gemini' | 'openai';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      provider?: Provider;
      apiKey?: string;
      model?: string;
    };

    const provider = body?.provider;
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
    const model = typeof body?.model === 'string' ? body.model.trim() : '';

    if (!provider || (provider !== 'gemini' && provider !== 'openai')) {
      return NextResponse.json({ error: 'Provider is required.' }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required.' }, { status: 400 });
    }

    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey });
      await openai.models.list();
      return NextResponse.json({ ok: true });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-flash-latest' });
    await geminiModel.generateContent('Ping');
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
