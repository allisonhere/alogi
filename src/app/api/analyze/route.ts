import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { getConfig } from '@/lib/config';

// Smart truncation to prioritize errors and recent logs
function smartTruncate(content: string, limit: number = 25000): string {
  if (content.length <= limit) return content;

  const lines = content.split('\n');
  const totalLines = lines.length;
  
  // 1. Identify "Interest Points" (Errors/Exceptions)
  const errorIndices: number[] = [];
  const ERROR_REGEX = /ERROR|CRITICAL|FATAL|EXCEPTION|PANIC|FAIL/i;
  
  lines.forEach((line, idx) => {
    if (ERROR_REGEX.test(line)) {
      errorIndices.push(idx);
    }
  });

  // 2. Create Windows around Interest Points (e.g., -5 lines before, +5 after)
  const context = 5;
  const windows: Array<{start: number, end: number}> = [];
  
  errorIndices.forEach(idx => {
    windows.push({
      start: Math.max(0, idx - context),
      end: Math.min(totalLines - 1, idx + context)
    });
  });

  // 3. Always include Head and Tail
  // Head: Context setup (first 20 lines)
  windows.push({ start: 0, end: Math.min(totalLines - 1, 20) });
  // Tail: Recent activity (last 100 lines)
  windows.push({ start: Math.max(0, totalLines - 100), end: totalLines - 1 });

  // 4. Merge Overlapping Windows & Sort
  windows.sort((a, b) => a.start - b.start);
  
  const mergedWindows: Array<{start: number, end: number}> = [];
  if (windows.length > 0) {
    let current = windows[0];
    for (let i = 1; i < windows.length; i++) {
      if (windows[i].start <= current.end + 1) { // Merge if overlapping or adjacent
        current.end = Math.max(current.end, windows[i].end);
      } else {
        mergedWindows.push(current);
        current = windows[i];
      }
    }
    mergedWindows.push(current);
  }

  // 5. Construct Result
  let result = '';
  let currentLength = 0;
  
  // Iterate backwards to prioritize Errors and recent logs if we still hit limit?
  // Actually, we construct forward, but strict check length.
  // Better strategy: If merged extraction is still too big, we just take the last 'limit' chars of the *extracted* content.
  // Or simpler: Just take the constructed string and slice it if it somehow exceeds (though unlikely to exceed by massive amounts unless errors are spamming).

  const chunks: string[] = [];
  let lastEnd = -1;

  for (const win of mergedWindows) {
    if (win.start > lastEnd + 1) {
      chunks.push(`\n... [${win.start - lastEnd - 1} lines skipped] ...\n`);
    }
    const chunk = lines.slice(win.start, win.end + 1).join('\n');
    chunks.push(chunk);
    lastEnd = win.end;
  }

  result = chunks.join('');

  // Final Safety Net: If the "smart" selection is still huge (e.g. error spam), hard truncate the middle
  if (result.length > limit) {
    const half = Math.floor(limit / 2);
    return result.slice(0, half) + '\n... [Content Truncated] ...\n' + result.slice(-half);
  }

  return result;
}

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
    
    const processedContent = smartTruncate(content);
    
    const systemPrompt = `
      You are an expert DevOps engineer. Analyze the following log data (smartly truncated).
      The data includes the beginning, end, and context around potential errors.
      
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

        const prompt = `${systemPrompt}\n\nLog Data:\n${processedContent}`;
        
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
                { role: "user", content: processedContent }
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