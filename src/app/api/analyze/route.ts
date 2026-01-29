import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini (will fail gracefully if key is missing)
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(request: Request) {
  try {
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Fallback to mock if no API key is configured
    if (!genAI) {
      console.warn("No GEMINI_API_KEY found. Using mock analysis.");
      await new Promise(resolve => setTimeout(resolve, 1000));
      return NextResponse.json({
        summary: "Mock Analysis (Configure GEMINI_API_KEY for real AI): Analyzed logs.",
        key_findings: ["API Key missing - using placeholder data.", "System appears normal otherwise."],
        recommendation: "Add GEMINI_API_KEY to your .env.local file.",
        severity: "low"
      });
    }

    // Use gemini-flash-latest for better free-tier availability
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
      You are an expert DevOps engineer. Analyze the following log data (truncated).
      Provide a JSON response with the following structure:
      {
        "summary": "A concise 1-sentence summary of the log status.",
        "key_findings": ["List of 2-4 critical events, errors, or patterns found."],
        "recommendation": "One clear actionable step to resolve issues or 'Monitor' if healthy.",
        "severity": "high" | "medium" | "low"
      }

      Return ONLY the JSON.

      Log Data:
      ${content.slice(0, 15000)} 
    `;

    let result;
    try {
        result = await model.generateContent(prompt);
    } catch (e: any) {
        // Simple retry logic for rate limits (429)
        if (e.message?.includes('429') || e.status === 429) {
             console.warn("Rate limited. Retrying in 4 seconds...");
             await new Promise(r => setTimeout(r, 4000));
             result = await model.generateContent(prompt);
        } else {
             throw e;
        }
    }

    const response = await result.response;
    const text = response.text();
    
    // Clean up markdown code blocks if present (common with LLMs)
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let analysis;
    try {
        analysis = JSON.parse(jsonStr);
    } catch (parseError) {
        console.error("Failed to parse AI JSON:", text);
        return NextResponse.json({ 
            summary: "Analysis generated but format was invalid.",
            key_findings: ["Raw output: " + text.slice(0, 100)],
            recommendation: "Check logs for raw AI output.",
            severity: "medium"
        });
    }

    return NextResponse.json(analysis);

  } catch (error: any) {
    console.error("AI Analysis failed:", error.message);
    
    // Return a structured error to the UI instead of 500 if possible, 
    // or let the UI handle the 500.
    if (error.message?.includes('429')) {
        return NextResponse.json({ 
            error: 'Rate limit exceeded. Please try again in a few moments.' 
        }, { status: 429 });
    }
    
    return NextResponse.json({ error: 'Analysis failed: ' + error.message }, { status: 500 });
  }
}
