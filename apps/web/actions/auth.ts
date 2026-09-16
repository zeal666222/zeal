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
