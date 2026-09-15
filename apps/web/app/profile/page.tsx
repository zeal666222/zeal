"use client";

import { useEffect, useState } from "react";
import { getProfileData, updateProfileName, processWalletRecharge } from "@/actions/profile";
import { signOutAction } from "@/actions/auth";
import { 
  User, Wallet, Shield, IndianRupee, ArrowUpRight, ArrowDownRight, 
  Clock, Plus, Loader2, Edit3, CheckCircle2, LogOut, Sparkles
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfileDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"general" | "billing" | "security">("general");

  // Edit Name State
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [updatingName, setUpdatingName] = useState(false);

  // Recharge State
  const [rechargeLoading, setRechargeLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const res = await getProfileData();
    if (!res) {
      router.push("/login");
      return;
    }
    setData(res);
    setNewName(res.profile.full_name);
    setLoading(false);
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingName(true);
    const formData = new FormData();
    formData.append("fullName", newName);
    
    const res = await updateProfileName(formData);
    if (res.success) {
      setIsEditing(false);
      await loadData();
    }
    setUpdatingName(false);
  };

  const handleRecharge = async (amount: number) => {
    setRechargeLoading(true);
    const res = await processWalletRecharge(amount);
    if (res.success) {
      await loadData();
    }
    setRechargeLoading(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" size={32}/></div>;
  }

  const profile = data?.profile;
  const transactions = data?.transactions;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 sm:p-10 relative overflow-hidden">
      {/* Ambient Lighting */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="max-w-5xl mx-auto relative z-10 pt-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-3">
              <Sparkles size={14} /> Personal Command Center
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Account Settings</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1 space-y-2">
            <button 
              onClick={() => setActiveTab("general")}
              className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === "general" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"}`}
            >
              <User size={18} /> General Info
            </button>
            <button 
              onClick={() => setActiveTab("billing")}
              className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === "billing" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"}`}
            >
              <Wallet size={18} /> Billing & Wallet
            </button>
            <button 
              onClick={() => setActiveTab("security")}
              className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === "security" ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"}`}
            >
              <Shield size={18} /> Security
            </button>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            
            {/* TAB: GENERAL */}
            {activeTab === "general" && (
              <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <User className="text-purple-400" size={20}/> Identity & Profile
                </h2>

                <div className="space-y-6">
                  {/* Name Edit Section */}
                  <div className="p-6 bg-slate-950/50 rounded-3xl border border-white/5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Display Name</label>
                    {isEditing ? (
                      <form onSubmit={handleUpdateName} className="flex gap-3">
                        <input 
                          type="text" 
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="flex-1 px-4 py-3 bg-slate-900 border border-purple-500/50 rounded-xl text-sm focus:outline-none focus:border-purple-500"
                          required
                        />
                        <button type="submit" disabled={updatingName} className="px-5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center">
                          {updatingName ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold">{profile?.full_name}</span>
                        <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors">
                          <Edit3 size={18} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Read-only Data */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 bg-slate-950/50 rounded-3xl border border-white/5">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
                      <div className="text-sm font-medium text-slate-300">{data?.email || "Anonymous"}</div>
                    </div>
                    <div className="p-6 bg-slate-950/50 rounded-3xl border border-white/5">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Account Role Tier</label>
                      <div className="inline-block px-3 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-bold uppercase border border-purple-500/30">
                        {profile?.role}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: BILLING */}
            {activeTab === "billing" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Balance Card */}
                <div className="bg-gradient-to-br from-slate-900/90 to-slate-900/50 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">Available Ledger Balance</p>
                      <h2 className="text-5xl font-black font-mono flex items-center text-white">
                        <IndianRupee size={40} className="text-emerald-400 mr-1" />
                        {Number(profile?.wallet_balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </h2>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                      <button onClick={() => handleRecharge(500)} disabled={rechargeLoading} className="flex-1 md:flex-none px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-bold transition-all cursor-pointer">
                        + ₹500
                      </button>
                      <button onClick={() => handleRecharge(1000)} disabled={rechargeLoading} className="flex-1 md:flex-none px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:opacity-90 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer">
                        {rechargeLoading ? <Loader2 className="animate-spin" size={18}/> : <><Plus size={18}/> Add Funds</>}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ledger History */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-xl">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Clock className="text-slate-400" size={18} /> Financial Ledger
                  </h3>

                  <div className="space-y-4">
                    {transactions?.length === 0 ? (
                      <div className="text-center text-slate-500 text-sm py-8">No transactions found.</div>
                    ) : (
                      transactions?.map((tx: any) => (
                        <div key={tx.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.transaction_type === 'credit' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                              {tx.transaction_type === 'credit' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                            </div>
                            <div>
                              <p className="text-sm font-bold">{tx.description}</p>
                              <p className="text-xs text-slate-400">{new Date(tx.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className={`font-mono font-bold ${tx.transaction_type === 'credit' ? 'text-emerald-400' : 'text-slate-300'}`}>
                            {tx.transaction_type === 'credit' ? '+' : '-'} ₹{Number(tx.amount).toFixed(2)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SECURITY */}
            {activeTab === "security" && (
              <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-rose-400">
                  <Shield size={20}/> Security & Access
                </h2>

                <div className="p-6 bg-rose-950/20 rounded-3xl border border-rose-500/10">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Terminate Session</h4>
                      <p className="text-xs text-slate-400">Securely log out of your Zeal account on this device.</p>
                    </div>
                    <form action={signOutAction}>
                      <button type="submit" className="px-6 py-3 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
                        <LogOut size={16} /> Secure Sign Out
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
