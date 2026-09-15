"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, User, Wallet, Shield, Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";

export function ClientNav({ role }: { role: string }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Define dynamic routes based on enterprise roles
  const navLinks = [
    { name: "Explore", href: "/explore", icon: Compass, show: true },
    { name: "My Vault", href: "/profile", icon: Wallet, show: true },
    { 
      name: "Consultant Studio", 
      href: "/consultant/dashboard", 
      icon: Sparkles, 
      show: role === "consultant" 
    },
    { 
      name: "God-View Admin", 
      href: "/admin/dashboard", 
      icon: Shield, 
      show: ["admin", "superadmin", "super_admin"].includes(role) 
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo */}
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Compass size={18} className="text-white" />
              </div>
              <span className="text-lg font-black tracking-widest text-white uppercase hidden sm:block">
                Zeal
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.filter(link => link.show).map((link) => {
                const isActive = pathname.startsWith(link.href);
                const Icon = link.icon;
                return (
                  <Link 
                    key={link.name} 
                    href={link.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                      isActive 
                        ? "bg-white/10 text-white" 
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    } ${link.name === "God-View Admin" ? "text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" : ""}`}
                  >
                    <Icon size={16} />
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            {/* Profile Avatar & Mobile Toggle */}
            <div className="flex items-center gap-4">
              <Link href="/profile" className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-slate-800 border border-white/10 hover:border-purple-500 transition-colors">
                <User size={16} className="text-slate-300" />
              </Link>
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-slate-400 hover:text-white"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu (Glassmorphism Dropdown) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-950/95 backdrop-blur-3xl pt-20 px-4">
          <div className="flex flex-col gap-2">
            {navLinks.filter(link => link.show).map((link) => {
              const isActive = pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link 
                  key={link.name} 
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 p-4 rounded-2xl text-base font-bold transition-all ${
                    isActive ? "bg-white/10 text-white" : "text-slate-400"
                  } ${link.name === "God-View Admin" ? "text-rose-400" : ""}`}
                >
                  <Icon size={20} />
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
