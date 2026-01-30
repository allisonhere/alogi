import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { getConfig } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const { messages, context } = await request.json();

    if (!messages || !context) {
      return NextResponse.json({ error: 'Messages and context are required' }, { status: 400 });
    }

    const config = getConfig();
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
            { role: "model", parts: [{ text: "Understood. Ready to investigate." }] }
        ];

        // Map messages to Gemini format (user/model)
        // Note: Gemini strict history requires alternating roles starting with user.
        // We'll simplisticly assume the user messages are new inputs.
        // For ChatPanel MVP, we just send the last message as prompt? No, we need context.
        // Let's rely on standard chat session.
        
        const chat = model.startChat({ history });
        const lastMessage = messages[messages.length - 1];

        // Retry Logic
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            try {
                const result = await chat.sendMessage(lastMessage.content);
                return NextResponse.json({ role: 'assistant', content: result.response.text() });
            } catch (e: any) {
                attempts++;
                if (e.message?.includes('429') || e.status === 429) {
                    await new Promise(r => setTimeout(r, attempts * 5000));
                    continue;
                }
                throw e;
            }
        }
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

        return NextResponse.json({ role: 'assistant', content: completion.choices[0].message.content });
    }

    return NextResponse.json({ error: 'Invalid AI Provider' }, { status: 400 });

  } catch (error: any) {
    console.error("Chat Failed:", error);
    return NextResponse.json({ error: 'Chat failed: ' + error.message }, { status: 500 });
  }
}
