# Zeal — Architecture

## Two Portals

zeal-web-red.vercel.app (seekers):
- Public: / /explore /services/* /consultant/[id] /ai-astrologers
- Auth: /login /register /auth/callback
- Authed: /chat /bookings /wallet /profile /sparks

zeal-admin-rose.vercel.app (consultants + admins):
- Auth: /login /auth/handoff
- Consultant: /consultant/{dashboard,chat,bookings,clients,earnings,availability,settings}
- Admin: /(dashboard)/{dashboard,analytics,users,consultants,verification,bookings,withdrawals,broadcast,content}

## Why Two Domains
- Security isolation (admin CSP stricter)
- Independent scaling
- Session separation (magic-link handoff, one-time-use)

## Auth Flow
| User | Action | Result |
|---|---|---|
| Seeker | Signup on web | Session on web → /explore |
| Seeker | Login on web | Session on web → /explore |
| Consultant | Signup on web | Handoff → session on admin → /consultant/dashboard |
| Consultant | Login on admin | Session on admin → /consultant/dashboard |
| Admin | Login on admin | Session on admin → /admin/dashboard |
| Seeker | Visit admin | Bounced to /login?error=not_authorized |

## Canonical Tables
User, Wallet, Transaction, Consultant, AIConsultant, Booking, CallSession, Post, Comment, Cheer, Conversation, ConversationParticipant, Message, Notification, AdminAuditLog

## Money Flow (escrow-safe)
Seeker top-up → credit_funds_safe → balance up + Transaction(TOPUP)
Seeker books  → hold_in_escrow_safe → balance down, escrow up + Transaction(PAYMENT)
Session ends  → end_call_session → escrow released, consultant credited, fee kept
Cancel        → cancel_booking → escrow refunded

All atomic via Postgres RPCs with FOR UPDATE locks.

## Realtime
- One Supabase client per tab
- One WebSocket channel per topic
- Broadcast, not postgres_changes (6ms vs 50-200ms)
- Reconnect with exponential backoff, 10 attempts
- Dedupe via LRU of seen event IDs

## Packages
apps/web — seeker portal (Next.js 16)
apps/admin — consultant + admin console (Next.js 16)
packages/database — Supabase clients + auth core
packages/realtime — singleton + hooks + channels
packages/types — Database types + Zod + tRPC
packages/ui — shared primitives
packages/utils — currency/date/format
supabase/migrations — SQL 000 → 026