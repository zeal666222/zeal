#!/usr/bin/env bash
# ==============================================================================
# PROJECT ZEAL — MISSING AUTH ACTION FIX & DEPLOYMENT
# ==============================================================================
set -euo pipefail

INFO="\033[1;34m[INFO]\033[0m"
SUCCESS="\033[1;32m[SUCCESS]\033[0m"
ERR_MSG="\033[1;31m[ERROR]\033[0m"

echo -e "${INFO} 1. Restoring signOutAction to Auth Controller (apps/web/actions/auth.ts)..."
cat << 'EOF' > apps/web/actions/auth.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = formData.get("redirectTo") as string || "/explore";
  
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) return { success: false, error: error.message };
  redirect(redirectTo);
}

export async function registerAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password,
    options: { data: { full_name: fullName, role: 'user' } }
  });
  
  if (error) return { success: false, error: error.message };
  
  // Create profile securely
  if (data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      role: 'user'
    });
  }
  
  redirect("/explore");
}

export async function signOutAction() {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
EOF

echo -e "${INFO} 2. Running Strict TypeScript Sweep..."
if npx tsc --noEmit --project apps/web/tsconfig.json; then
    echo -e "${SUCCESS} Build Verified. No missing exports detected!"
else
    echo -e "${ERR_MSG} TS Error."
    exit 1
fi

echo -e "${INFO} 3. Running Production Build & Syncing to GitHub..."
if npm run build; then
    echo -e "${SUCCESS} Build Complete!"
    git add -A
    git commit -m "fix(zeal): restore missing signOutAction to auth controller to satisfy profile dependencies" || true
    git push -u origin main
    echo -e "${SUCCESS} ====================================================================="
    echo -e "${SUCCESS} PLATFORM FULLY COMPILED AND DEPLOYED!"
    echo -e "${SUCCESS} ====================================================================="
else
    echo -e "${ERR_MSG} Build failed."
    exit 1
fi