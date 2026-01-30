import { useState, useRef, useEffect } from 'react';
import { Send, User, Sparkles, Bot, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  initialSummary: {
    summary: string;
    key_findings: string[];
    recommendation: string;
    severity: 'low' | 'medium' | 'high';
  };
  logContext: string;
}

export function ChatPanel({ initialSummary, logContext }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when messages change
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            messages: [...messages, userMsg],
            context: logContext 
        }),
      });
      
      const data = await res.json();
      
      if (data.error) {
          setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
          setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Failed to connect to AI." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900/30 border-l border-zinc-200 dark:border-zinc-800 w-96 transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 bg-white dark:bg-zinc-950">
        <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">AI Investigator</h3>
      </div>

      {/* Messages & Summary */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar" ref={scrollRef}>
        
        {/* The "Old Look" Structured Summary */}
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className={cn(
                "p-3 rounded-lg border",
                initialSummary.severity === 'high' ? "bg-red-50 text-red-900 border-red-200 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-200" :
                "bg-white text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
            )}>
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Summary</div>
                <p className="text-sm leading-relaxed">{initialSummary.summary}</p>
            </div>

            <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Key Findings</div>
                <ul className="space-y-2">
                    {(initialSummary.key_findings || []).map((finding, i) => (
                        <li key={i} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300 items-start">
                            <AlertCircle className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0 mt-0.5" />
                            <span>{finding}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Recommendation</div>
                <div className="flex gap-2 text-sm text-indigo-700 bg-indigo-50 border-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/5 p-3 rounded border dark:border-indigo-500/10 items-start">
                    <CheckCircle className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                    <span>{initialSummary.recommendation || "No specific recommendation provided."}</span>
                </div>
            </div>

            <div className="border-b border-zinc-200 dark:border-zinc-800/50 pt-2" />
        </div>

        {/* Chat Thread */}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
            <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                msg.role === 'user' ? "bg-zinc-200 dark:bg-zinc-700" : "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
            )}>
                {msg.role === 'user' ? <User className="w-3 h-3 text-zinc-500 dark:text-zinc-300" /> : <Bot className="w-3 h-3" />}
            </div>
            <div className={cn(
                "rounded-lg p-3 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed shadow-sm",
                msg.role === 'user' ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "bg-white border-zinc-200 text-zinc-800 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300 border"
            )}>
                {msg.content}
            </div>
          </div>
        ))}

        {loading && (
            <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400 animate-pulse" />
                </div>
                <div className="text-xs text-zinc-500 flex items-center">Investigating...</div>
            </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="relative">
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask follow-up questions..."
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md py-2.5 pl-3 pr-10 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            />
            <button 
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="absolute right-2 top-2.5 text-zinc-400 dark:text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 disabled:opacity-50 transition-colors"
            >
                <Send className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
}
