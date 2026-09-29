"use server";
// ═══════════════════════════════════════════════════════════════════════════════
// Profile & Post Server Actions
// ═══════════════════════════════════════════════════════════════════════════════
// Returns structured error state. Never throws to the client.
// Used with `useActionState` for progressive enhancement.
// ═══════════════════════════════════════════════════════════════════════════════

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch { /* RSC context */ }
        },
      },
    },
  );
}

// ─── Profile update ──────────────────────────────────────────────────────────
const ProfileSchema = z.object({
  name:     z.string().trim().min(1).max(80).optional(),
  username: z.string().trim().toLowerCase().min(3).max(30)
              .regex(/^[a-z0-9_]+$/, "Only letters, numbers, and underscores").optional(),
  bio:      z.string().max(500).optional(),
  website:  z.string().max(200).optional(),
  location: z.string().max(100).optional(),
  avatar:   z.string().max(500).optional(),
});

export type ProfileActionState =
  | { ok: true; user: Record<string, unknown> }
  | { ok: false; code: string; error: string };

export async function updateProfileAction(
  _prev: ProfileActionState | null,
  formData: FormData,
): Promise<ProfileActionState> {
  const raw = {
    name:     (formData.get("name") as string | null) || undefined,
    username: (formData.get("username") as string | null) || undefined,
    bio:      (formData.get("bio") as string | null) || undefined,
    website:  (formData.get("website") as string | null) || undefined,
    location: (formData.get("location") as string | null) || undefined,
    avatar:   (formData.get("avatar") as string | null) || undefined,
  };

  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "UNAUTHORIZED", error: "Please sign in." };

  const { data, error } = await supabase.rpc("update_profile", {
    p_name:     parsed.data.name ?? null,
    p_username: parsed.data.username ?? null,
    p_bio:      parsed.data.bio ?? null,
    p_website:  parsed.data.website ?? null,
    p_location: parsed.data.location ?? null,
    p_avatar:   parsed.data.avatar ?? null,
  });

  if (error) {
    return { ok: false, code: "INTERNAL", error: "We couldn't save your changes. Please try again." };
  }

  const result = data as { success?: boolean; error?: string; user?: unknown } | null;
  if (!result || result.success === false) {
    const code = result?.error ?? "UNKNOWN";
    const messages: Record<string, string> = {
      USERNAME_TAKEN:         "That username is already taken. Try another.",
      USERNAME_RESERVED:      "That username is reserved. Please choose a different one.",
      INVALID_USERNAME_FORMAT:"Usernames can only contain letters, numbers, and underscores.",
      INVALID_NAME:           "Name must be 1–80 characters.",
      BIO_TOO_LONG:           "Bio must be under 500 characters.",
      WEBSITE_INVALID:        "Please enter a valid website URL.",
      LOCATION_TOO_LONG:      "Location must be under 100 characters.",
      NOT_AUTHENTICATED:      "Your session has expired. Please sign in again.",
    };
    return {
      ok: false,
      code,
      error: messages[code] ?? "We couldn't save your changes. Please try again.",
    };
  }

  revalidatePath("/profile");
  return { ok: true, user: (result.user as Record<string, unknown>) ?? {} };
}

// ─── Create post ─────────────────────────────────────────────────────────────
const PostSchema = z.object({
  content:   z.string().trim().min(1).max(2200),
  mediaUrls: z.array(z.string().max(500)).max(10).optional(),
  locationTag: z.string().max(100).optional(),
});

export type PostActionState =
  | { ok: true; post: Record<string, unknown>; remaining: number }
  | { ok: false; code: string; error: string; limit?: number; current?: number };

export async function createPostAction(
  _prev: PostActionState | null,
  formData: FormData,
): Promise<PostActionState> {
  const raw = {
    content:     String(formData.get("content") ?? "").trim(),
    mediaUrls:   formData.get("mediaUrls")
                   ? JSON.parse(String(formData.get("mediaUrls")))
                   : undefined,
    locationTag: (formData.get("locationTag") as string | null) || undefined,
  };

  const parsed = PostSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error: parsed.error.issues[0]?.message ?? "Invalid post",
    };
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "UNAUTHORIZED", error: "Please sign in." };

  const { data: canData } = await supabase.rpc("can_create_post");
  const can = canData as { canPost?: boolean; limit?: number; current?: number; remaining?: number } | null;

  if (can && can.canPost === false) {
    return {
      ok: false,
      code: "POST_LIMIT_REACHED",
      error: `You've reached your post limit (${can.limit}). Delete a post to create a new one.`,
      limit: can.limit,
      current: can.current,
    };
  }

  const { data, error } = await supabase
    .from("Post")
    .insert({
      authorId: user.id,
      content: parsed.data.content,
      mediaUrls: parsed.data.mediaUrls ?? [],
      locationTag: parsed.data.locationTag ?? null,
      mediaType: (parsed.data.mediaUrls ?? []).length > 1 ? "carousel" : "image",
    })
    .select("id, content, mediaUrls, cheerCount, commentCount, createdAt")
    .single();

  if (error) {
    const msg = error.message.toLowerCase();
    if (error.code === "42501" || msg.includes("policy")) {
      return {
        ok: false,
        code: "POST_LIMIT_REACHED",
        error: "You've reached your post limit. Delete a post to create a new one.",
      };
    }
    return { ok: false, code: "INTERNAL", error: "Could not create post. Please try again." };
  }

  revalidatePath("/profile");
  revalidatePath("/");
  return {
    ok: true,
    post: data as Record<string, unknown>,
    remaining: Math.max(0, (can?.remaining ?? 1) - 1),
  };
}

// ─── Delete post ─────────────────────────────────────────────────────────────
export type DeletePostState =
  | { ok: true }
  | { ok: false; code: string; error: string };

export async function deletePostAction(
  _prev: DeletePostState | null,
  formData: FormData,
): Promise<DeletePostState> {
  const postId = String(formData.get("postId") ?? "").trim();
  if (!postId) return { ok: false, code: "VALIDATION", error: "Missing post id" };

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "UNAUTHORIZED", error: "Please sign in." };

  const { data, error } = await supabase.rpc("delete_post", { p_post_id: postId });
  if (error) return { ok: false, code: "INTERNAL", error: "Could not delete post." };

  const result = data as { success?: boolean; error?: string } | null;
  if (!result || result.success === false) {
    return { ok: false, code: result?.error ?? "UNKNOWN", error: "Could not delete post." };
  }

  revalidatePath("/profile");
  revalidatePath("/");
  return { ok: true };
}

// ─── Legacy exports (preserved) ──────────────────────────────────────────────
export async function getProfileData() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, txRes] = await Promise.all([
    supabase.from("User").select("*").eq("id", user.id).single(),
    supabase
      .from("Transaction")
      .select(`
        id, type, amount, balance, description, "createdAt",
        wallet:Wallet!Transaction_walletId_fkey!inner("userId")
      `)
      .eq("wallet.userId", user.id)
      .order("createdAt", { ascending: false })
      .limit(10),
  ]);

  return {
    email: user.email,
    profile: profileRes.data,
    transactions: txRes.data ?? [],
  };
}

export async function updateProfileName(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName || fullName.length > 80) {
    return { success: false, error: "Name must be 1–80 characters" };
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("User")
    .update({ name: fullName })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/profile");
  return { success: true, message: "Name updated." };
}

export async function processWalletRecharge(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    return { success: false, error: "Amount must be between 1 and 100000" };
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const refId = `topup:${user.id}:${Date.now()}`;
  const { data, error } = await supabase.rpc("credit_funds_safe", {
    p_user_id: user.id,
    p_amount: amount,
    p_description: `Wallet top-up ₹${amount}`,
    p_reference_id: refId,
  });

  if (error) return { success: false, error: error.message };

  const result = data as { success?: boolean; error?: string; balance?: number } | null;
  if (result && result.success === false) {
    return { success: false, error: result.error || "Top-up failed" };
  }

  revalidatePath("/profile");
  revalidatePath("/wallet");
  return { success: true, newBalance: result?.balance };
}
