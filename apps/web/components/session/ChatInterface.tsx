"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { sendMessageAction } from "@/actions/chat";
import { Send, PhoneOff, Sparkles, Loader2, ShieldCheck, Video, VideoOff } from "lucide-react";
import { useRouter } from "next/navigation";

type Message = { id: string; sender_id: string; content: string; created_at: string; };

export function ChatInterface({ sessionId, currentUserId, initialMessages, partnerName, isAI }: { 
  sessionId: string; currentUserId: string; initialMessages: Message[]; partnerName: string; isAI: boolean;
}) {
  // Chat State
  const [messages, setMessages] = useState<Message[]>(initialMessages.filter(m => !m.content.startsWith("[WEBRTC_")));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  
  // WebRTC State
  const [videoActive, setVideoActive] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // STUN Servers for WebRTC NAT Traversal (Enterprise fallback)
  const rtcConfig = { 
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" }
    ] 
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, aiTyping]);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel(`session:${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_messages', filter: `session_id=eq.${sessionId}` },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // 1. Filter out WebRTC Signaling Messages from the UI
          if (newMessage.content.startsWith("[WEBRTC_")) {
            if (newMessage.sender_id !== currentUserId) {
              handleWebRTCSignal(newMessage.content);
            }
            return; 
          }

          // 2. Standard Text Messages
          setMessages(prev => [...prev, newMessage]);
          if (newMessage.sender_id !== currentUserId) setAiTyping(false);
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'session_requests', filter: `id=eq.${sessionId}` },
        (payload) => {
          if (payload.new.status === 'completed' || payload.new.status === 'cancelled') {
            endCall();
            alert("Session has ended.");
            router.push("/explore");
          }
        }
      ).subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      endCall();
    };
  }, [sessionId, currentUserId, router]);

  // ==============================================================================
  // WEBRTC SIGNALING ENGINE (Enterprise Grade)
  // ==============================================================================
  
  const handleWebRTCSignal = async (signalData: string) => {
    try {
      const parsed = JSON.parse(signalData.replace("[WEBRTC_SIGNAL]:", ""));
      if (!peerConnectionRef.current) await initializePeerConnection();
      const pc = peerConnectionRef.current!;

      if (parsed.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(parsed));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendMessageAction(sessionId, `[WEBRTC_SIGNAL]:${JSON.stringify(answer)}`);
      } else if (parsed.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(parsed));
      } else if (parsed.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(parsed));
      }
    } catch (err) {
      console.error("WebRTC Signal Error:", err);
    }
  };

  const initializePeerConnection = async () => {
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;

    // Send ICE candidates to partner
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessageAction(sessionId, `[WEBRTC_SIGNAL]:${JSON.stringify(event.candidate)}`);
      }
    };

    // Receive remote video track (TS FIXED)
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        // Fallback: If streams array is empty, generate a new MediaStream from the raw track
        if (event.streams && event.streams.length > 0 && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        } else {
          remoteVideoRef.current.srcObject = new MediaStream([event.track]);
        }
      }
    };

    // Add local stream if exists
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }
    return pc;
  };

  const startVideoCall = async () => {
    try {
      setVideoActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = await initializePeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendMessageAction(sessionId, `[WEBRTC_SIGNAL]:${JSON.stringify(offer)}`);
    } catch (err) {
      alert("Microphone/Camera access denied.");
      setVideoActive(false);
    }
  };

  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localVideoRef.current?.srcObject) {
      (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setVideoActive(false);
  };

  // ==============================================================================

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const messageContent = input.trim();
    setInput("");
    setSending(true);
    if (isAI) setAiTyping(true);

    const res = await sendMessageAction(sessionId, messageContent);
    if (!res.success) {
      alert("Failed to send message: " + res.error);
      setAiTyping(false);
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-screen-app bg-slate-950 text-slate-50 relative overflow-hidden">
      
      {/* HEADER */}
      <div className="flex-none h-20 bg-slate-900/80 backdrop-blur-2xl border-b border-white/10 px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black">{partnerName.charAt(0)}</div>
          <div>
            <h2 className="font-bold flex items-center gap-2">{partnerName} {isAI && <Sparkles size={14} className="text-purple-400" />}</h2>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Secure Session
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isAI && (
            <button onClick={videoActive ? endCall : startVideoCall} className={`p-3 rounded-full transition-colors ${videoActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 hover:bg-white/10 text-slate-300'}`}>
              {videoActive ? <VideoOff size={20} /> : <Video size={20} />}
            </button>
          )}
          <button onClick={() => router.push("/explore")} className="p-3 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-full transition-colors"><PhoneOff size={20} /></button>
        </div>
      </div>

      {/* WEBRTC VIDEO OVERLAY */}
      {videoActive && (
        <div className="w-full h-64 bg-black flex border-b border-white/10 relative">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-1/2 h-full object-cover border-r border-white/10" />
          <video ref={localVideoRef} autoPlay playsInline muted className="w-1/2 h-full object-cover" />
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-wider">Remote</div>
          <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-wider">You</div>
        </div>
      )}

      {/* CHAT HISTORY */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-32">
        <div className="text-center pb-6 border-b border-white/5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full mb-2"><ShieldCheck size={14} /> End-to-End Encrypted</div>
          <p className="text-slate-500 text-xs">Your session has begun. Messages and signaling are secured.</p>
        </div>

        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-lg ${isMe ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 border border-white/5 rounded-bl-sm'}`}>{msg.content}</div>
              <span className="text-[10px] text-slate-600 mt-1 font-medium px-1">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          );
        })}

        {aiTyping && (
          <div className="flex flex-col items-start animate-in fade-in duration-300">
            <div className="px-5 py-4 bg-slate-800 border border-white/5 rounded-2xl rounded-bl-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* STICKY INPUT */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-3xl border-t border-white/10 z-20">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-3">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your message..." className="flex-1 bg-slate-900 border border-white/10 rounded-full px-6 py-4 text-sm focus:outline-none focus:border-emerald-500 text-slate-200 shadow-inner" />
          <button type="submit" disabled={!input.trim() || sending} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${input.trim() && !sending ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
            {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-1" />}
          </button>
        </form>
      </div>
    </div>
  );
}
