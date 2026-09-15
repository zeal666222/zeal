"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Send, ArrowLeft, Bot, User, Loader2 } from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function ConsultationRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params?.id as string;
  const isAI = roomId.endsWith("-ai");
  const category = isAI ? roomId.replace("-ai", "").replace(/-/g, " ") : "Consultation";
  
  // Extract Context
  const ctxParam = searchParams.get('ctx');
  const userContext = ctxParam ? JSON.parse(decodeURIComponent(ctxParam)) : null;

  const [messages, setMessages] = useState<any[]>([
    { id: "sys-1", sender_role: "SYSTEM", content: `Secure Encrypted Session. Type: ${category.toUpperCase()}` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialSent, setInitialSent] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  // Auto-send initial context to AI
  useEffect(() => {
    if (isAI && userContext && !initialSent) {
      setInitialSent(true);
      const greetingMsg = `Hello Master. My name is ${userContext.name}. I was born on ${userContext.dob} at ${userContext.time} in ${userContext.location}. My current concern is: ${userContext.concern}. Can you guide me?`;
      
      setMessages(prev => [...prev, { id: "init", sender_role: "USER", content: greetingMsg }]);
      fireGroqAPI(greetingMsg);
    }
  }, [isAI, userContext, initialSent]);

  const fireGroqAPI = async (userMsg: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, category, userContext })
      });
      const data = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender_role: "AI", content: data.reply }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender_role: "SYSTEM", content: "Network error." }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    
    setMessages(prev => [...prev, { id: Date.now().toString(), sender_role: "USER", content: userMsg }]);
    
    if (isAI) {
      fireGroqAPI(userMsg);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
      <header className="flex items-center px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 z-10 shrink-0">
        <Link href="/services" className="mr-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><ArrowLeft size={20}/></Link>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white mr-3 ${isAI ? 'bg-purple-600' : 'bg-emerald-500'}`}>
          {isAI ? <Bot size={20} /> : <User size={20} />}
        </div>
        <h1 className="font-bold text-lg capitalize">{isAI ? `${category} Master AI` : 'Active Consultation'}</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.sender_role === 'USER' ? 'items-end' : 'items-start'}`}>
            {msg.sender_role === 'SYSTEM' ? (
              <div className="w-full text-center text-xs text-slate-500 font-bold uppercase my-2">{msg.content}</div>
            ) : (
              <div className={`max-w-[70%] p-4 rounded-2xl ${msg.sender_role === 'USER' ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-tl-sm'}`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-slate-400 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> AI is analyzing chart...</div>}
      </main>

      <footer className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 shrink-0">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-3">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Send message..." className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-950 rounded-full outline-none focus:ring-2 ring-purple-500" />
          <button type="submit" disabled={loading} className="w-14 h-14 rounded-full bg-purple-600 text-white flex items-center justify-center disabled:opacity-50"><Send size={20}/></button>
        </form>
      </footer>
    </div>
  );
}
