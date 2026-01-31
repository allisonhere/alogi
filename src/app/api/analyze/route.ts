import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { getConfig } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const config = getConfig();
    if (config.ai.enabled === false) {
      return NextResponse.json({ error: 'AI features are disabled in Settings.' }, { status: 400 });
    }
    const provider = config.ai.provider || 'gemini';
    const systemPrompt = `
      You are an expert DevOps engineer. Analyze the following log data (truncated).
      Provide a JSON response with the following structure:
      {
        "summary": "A concise 1-sentence summary of the log status.",
        "key_findings": ["List of 2-4 concrete events/errors/patterns with evidence if possible (timestamps, services, error codes)."],
        "recommendation": "2-3 actionable steps written as short bullet lines (use '-' bullets), or 'Monitor' if healthy.",
        "severity": "high" | "medium" | "low"
      }

      Return ONLY the JSON. No markdown outside the JSON.
    `;

    // --- GEMINI HANDLER ---
    if (provider === 'gemini') {
        const apiKey = config.ai.apiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Gemini API Key missing");

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: config.ai.model || "gemini-flash-latest" });

        const prompt = `${systemPrompt}\n\nLog Data:\n${content.slice(0, 15000)}`;
        
        let result;
        // Retry logic for Gemini
        try {
            result = await model.generateContent(prompt);
        } catch (e) {
            const err = e as { message?: string; status?: number };
            const message = typeof err.message === 'string' ? err.message : '';
            if (message.includes('429') || err.status === 429) {
                await new Promise(r => setTimeout(r, 4000));
                result = await model.generateContent(prompt);
            } else {
                throw e;
            }
        }
        
        const text = result.response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return NextResponse.json(JSON.parse(jsonStr));
    }

    // --- OPENAI HANDLER ---
    if (provider === 'openai') {
        const apiKey = config.ai.openaiApiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OpenAI API Key missing");

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: content.slice(0, 15000) }
            ],
            model: config.ai.model || "gpt-4o",
            response_format: { type: "json_object" }, // Ensure JSON
        });

        const text = completion.choices[0].message.content || "{}";
        return NextResponse.json(JSON.parse(text));
    }

    return NextResponse.json({ error: 'Invalid AI Provider' }, { status: 400 });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AI Analysis failed:", message);
    return NextResponse.json({ error: 'Analysis failed: ' + message }, { status: 500 });
  }
}
