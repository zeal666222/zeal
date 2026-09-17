"use client";

import Link from "next/link";
import { Sparkles, Cpu, ShieldCheck, Zap } from "lucide-react";

export default function ZealPage() {
  return (
    <div className="min-h-screen bg-white py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-6">
          <Sparkles size={14} /> Architecture & Mission
        </div>
        <h1 className="text-5xl font-black text-gray-900 tracking-tight mb-6">
          The Zeal Intelligence Engine
        </h1>
        <p className="text-xl text-gray-600 leading-relaxed mb-16">
          Bridging millenary metaphysical traditions with Groq-accelerated neural networks and rigorous astronomical algorithms.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50/50">
            <Cpu className="text-indigo-600 mb-4" size={28} />
            <h4 className="font-bold text-gray-900 text-lg mb-2">Sub-second Latency</h4>
            <p className="text-sm text-gray-500 font-medium">Groq LPU architecture powers real-time streaming astrology readings in under 400ms.</p>
          </div>

          <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50/50">
            <Zap className="text-amber-600 mb-4" size={28} />
            <h4 className="font-bold text-gray-900 text-lg mb-2">Double Precision</h4>
            <p className="text-sm text-gray-500 font-medium">Accurate mathematical natal chart generation ensuring reliable house and degree mapping.</p>
          </div>

          <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50/50">
            <ShieldCheck className="text-emerald-600 mb-4" size={28} />
            <h4 className="font-bold text-gray-900 text-lg mb-2">Verified Humans</h4>
            <p className="text-sm text-gray-500 font-medium">Certified consultant network with encrypted sessions and private client ledgers.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
