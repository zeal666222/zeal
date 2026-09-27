"use client";
export const dynamic = "force-dynamic";

import {useState} from "react";
import { useRouter } from "next/navigation";
import { Home } from "lucide-react";

export default function ConsultantSettingsPage() {
  const router = useRouter();
  const [name, setName] = useState("Acharya Rajesh");
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.push("/consultant/dashboard")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-purple-400 mb-8">
          <Home size={16} /> Back to Dashboard
        </button>

        <div className="bg-surface backdrop-blur-xl border border-border rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
          <h1 className="text-3xl font-bold mb-2">Consultant Settings</h1>
          <p className="text-muted-foreground font-light mb-8">Update your public practice profile.</p>

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Display Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 bg-background border border-border rounded-2xl outline-none text-foreground" />
            </div>
            <button type="submit" className="px-8 py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold">
              {saved ? "Saved Changes!" : "Save Profile"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
