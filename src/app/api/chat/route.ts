import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '@/lib/config';
import { debug } from '@/lib/debug';
import { retryRateLimited } from '@/lib/aiRetry';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function POST(request: Request) {
  try {
    const { messages, context } = await request.json() as {
      messages?: ChatMessage[];
      context?: string;
    };

    if (!Array.isArray(messages) || typeof context !== 'string') {
      return NextResponse.json({ error: 'Messages and context are required' }, { status: 400 });
    }

    const config = getConfig();
    if (config.ai.enabled === false) {
      return NextResponse.json({ error: 'AI features are disabled in Settings.' }, { status: 400 });
    }
    const provider = config.ai.provider || 'gemini';
    
    const systemPrompt = `You are Alogi, an expert DevOps Investigator. 
Here is the log data you are analyzing (truncated to last ~15k chars):
---
${context.slice(0, 15000)}
---

Answer the user's questions based strictly on these logs. Be technical, precise, and cite timestamps if possible.`;

    // --- GEMINI HANDLER ---
    if (provider === 'gemini') {
        const apiKey = config.ai.apiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Gemini API Key missing");

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: config.ai.model || "gemini-flash-latest" });

        const history = [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Understood. Ready to investigate." }] },
            ...messages.slice(0, -1).map((msg) => ({
                role: msg.role === 'user' ? "user" : "model",
                parts: [{ text: msg.content }]
            }))
        ];

        // Map messages to Gemini format (user/model)
        // Note: Gemini strict history requires alternating roles starting with user.
        // We'll simplisticly assume the user messages are new inputs.
        // For ChatPanel MVP, we just send the last message as prompt? No, we need context.
        // Let's rely on standard chat session.
        
        const chat = model.startChat({ history });
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage?.content) {
            return NextResponse.json({ error: 'Last message missing' }, { status: 400 });
        }

        const result = await retryRateLimited(() => chat.sendMessage(lastMessage.content));
        return NextResponse.json({ role: 'assistant', content: result.response.text() });
    }

    // --- OPENAI HANDLER ---
    if (provider === 'openai') {
        const apiKey = config.ai.openaiApiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OpenAI API Key missing");

        const openai = new OpenAI({ apiKey });
        
        // OpenAI simple chat completion
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                ...messages // spread previous messages { role: 'user'|'assistant', content }
            ],
            model: config.ai.model || "gpt-4o",
        });

        return NextResponse.json({ role: 'assistant', content: completion.choices[0]?.message?.content || 'No response' });
    }

    // --- CLAUDE HANDLER ---
    if (provider === 'claude') {
        const apiKey = config.ai.claudeApiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error("Claude API Key missing");

        const anthropic = new Anthropic({ apiKey });
        const result = await anthropic.messages.create({
            model: config.ai.model || "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        });

        const text = result.content?.[0]?.type === 'text' ? result.content[0].text : 'No response';
        return NextResponse.json({ role: 'assistant', content: text });
    }

    return NextResponse.json({ error: 'Invalid AI Provider' }, { status: 400 });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debug.error("Chat Failed:", message);
    return NextResponse.json({ error: 'Chat failed. Check server logs for details.' }, { status: 500 });
  }
}
