# ZEAL — Full Repository Audit


## 1. File Inventory

| Metric | Count |
|--------|-------|
| TypeScript (.ts) | 248 |
| TypeScript JSX (.tsx) | 183 |
| Total TS/TSX | 431 |
| SQL migrations | 29 |
| API route files | 113 |
| Page components | 72 |
| React components | 82 |
| Custom hooks | 22 |
| Server actions | 17 |

### Critical files

- ✅ `package.json`
- ✅ `apps/web/package.json`
- ✅ `apps/admin/package.json`
- ✅ `apps/web/next.config.js`
- ✅ `apps/admin/next.config.js`
- ✅ `apps/web/tsconfig.json`
- ✅ `apps/admin/tsconfig.json`
- ✅ `apps/web/middleware.ts`
- ✅ `apps/admin/middleware.ts`
- ✅ `packages/database/src/server.ts`
- ✅ `packages/database/src/client.ts`
- ✅ `packages/database/src/ai-chat-handler.ts`
- ✅ `packages/realtime/src/index.ts`
- ✅ `packages/realtime/src/channels.ts`
- ✅ `packages/types/src/index.ts`
- ✅ `packages/ui/src/index.ts`
- ✅ `apps/web/lib/auth/api-guard.ts`
- ✅ `apps/web/lib/ai/index.ts`
- ✅ `apps/web/lib/ai/persona-loader.ts`
- ✅ `apps/admin/lib/ai/index.ts`
- ✅ `apps/admin/lib/ai/persona-loader.ts`
- ✅ `apps/admin/hooks/useChat.ts`
- ✅ `apps/admin/components/chat/ChatRoom.tsx`

## 2. Frontend Audit

| Element | Count |
|---------|-------|
| `<button>` | 291 |
| `onClick={...}` | 215 |
| `<Link>` | 44 |
| `<form>` | 112 |
| `fetch(...)` calls | 81 |
| `useChannel(...)` calls | 64 |

### Frontend fetch() endpoints

Unique fetch targets: **61**

- `/api/admin/ai-consultants`
- `/api/admin/ai-consultants/${id}`
- `/api/admin/audit`
- `/api/admin/bookings`
- `/api/admin/bookings/${id}`
- `/api/admin/broadcast`
- `/api/admin/consultants/${consultantId}/stats`
- `/api/admin/content/reports`
- `/api/admin/impersonate`
- `/api/admin/invites`
- `/api/admin/recordings/${id}/send`
- `/api/admin/stats`
- `/api/admin/users`
- `/api/admin/verification`
- `/api/admin/wallet/topup`
- `/api/admin/wallet/transactions`
- `/api/admin/withdrawals`
- `/api/ai`
- `/api/ai/assist`
- `/api/ai/consultants/${params.id}`
- `/api/auth/accept-invite`
- `/api/auth/signout`
- `/api/auth/verify-invite`
- `/api/bookings`
- `/api/bookings/${booking.id}/cancel`
- `/api/bookings/${booking.id}/rate`
- `/api/bookings/${booking.id}/reschedule`
- `/api/bookings/${id}/cancel`
- `/api/bookings/list`
- `/api/calls/end`
- `/api/calls/start`
- `/api/chat/${conversationId}/messages`
- `/api/chat/${conversationId}/read`
- `/api/chat/ai/${consultantId}`
- `/api/chat/conversations`
- `/api/consultant/${consultantId}`
- `/api/consultant/availability`
- `/api/consultant/bookings`
- `/api/consultant/chat/${conversationId}/read`
- `/api/consultant/chat/conversations`
- `/api/consultant/clients`
- `/api/consultant/earnings`
- `/api/consultant/onboarding`
- `/api/consultant/online`
- `/api/consultant/profile`
- `/api/consultant/pulse`
- `/api/consultant/withdraw`
- `/api/debug/log`
- `/api/error-log`
- `/api/notifications`
- `/api/notifications/${id}/read`
- `/api/payments/create-order`
- `/api/posts/`
- `/api/posts/create`
- `/api/posts/feed`
- `/api/sparks/feed`
- `/api/users/`
- `/api/users/me/profile`
- `/api/wallet/balance`
- `/api/wallet/transactions`
- `/api/zeal/chat`

### Frontend realtime channel subscriptions

Unique channel factories used: **14**

- `channels.adminBookings(`
- `channels.adminVerification(`
- `channels.consultantAiUpdates(`
- `channels.consultantBookings(`
- `channels.consultantIncoming(`
- `channels.consultantsLive(`
- `channels.consultantSparks(`
- `channels.consultantStatus(`
- `channels.roomMessages(`
- `channels.roomTyping(`
- `channels.userInbox(`
- `channels.userNotifications(`
- `channels.userWallet(`
- `channels.userWalletLedger(`

### Buttons without `onClick` or `type="submit"` (potential dead UI)

**112** potential dead buttons:

- `apps/web/app/consultant/bookings/page.tsx:97`
- `apps/web/app/consultant/[id]/page.tsx:266`
- `apps/web/app/consultant/[id]/page.tsx:269`
- `apps/web/app/create/page.tsx:76`
- `apps/web/app/debug/page.tsx:103`
- `apps/web/app/debug/page.tsx:113`
- `apps/web/app/debug/page.tsx:119`
- `apps/web/app/debug/page.tsx:153`
- `apps/web/app/debug/page.tsx:164`
- `apps/web/app/debug/page.tsx:181`
- `apps/web/app/global-error.tsx:34`
- `apps/web/app/global-error.tsx:40`
- `apps/web/app/mfa-challenge/page.tsx:174`
- `apps/web/app/notifications/page.tsx:135`
- `apps/web/app/notifications/page.tsx:146`
- `apps/web/app/notifications/page.tsx:200`
- `apps/web/app/profile/edit/page.tsx:88`
- `apps/web/app/profile/edit/page.tsx:106`
- `apps/web/app/profile/page.tsx:229`
- `apps/web/app/profile/page.tsx:239`
- `apps/web/app/profile/page.tsx:249`
- `apps/web/app/profile/page.tsx:442`
- `apps/web/app/profile/page.tsx:467`
- `apps/web/app/profile/page.tsx:478`
- `apps/web/app/register/page.tsx:202`
- `apps/web/app/register/page.tsx:213`
- `apps/web/app/register/page.tsx:327`
- `apps/web/app/register/page.tsx:409`
- `apps/web/app/services/horoscope/page.tsx:58`
- `apps/web/app/services/kundali/page.tsx:133`

## 3. Backend Audit


### API routes and their methods

| App | Route | Methods | Auth Guard |
|-----|-------|---------|-----------|
| admin | `//api/chat/ai:consultantId` | POST  | ✅ |
| admin | `//api/consultant/availability` | GET PUT  | ✅ |
| admin | `//api/consultant/bookings` | GET  | ✅ |
| admin | `//api/consultant/chat:id/messages` | GET POST  | ✅ |
| admin | `//api/consultant/chat:id/read` | POST  | ✅ |
| admin | `//api/consultant/chat/conversations` | GET  | ✅ |
| admin | `//api/consultant/clients` | GET  | ✅ |
| admin | `//api/consultant/earnings` | GET  | ✅ |
| admin | `//api/consultant/online` | POST  | ✅ |
| admin | `//api/consultant/profile` | PATCH  | ✅ |
| admin | `//api/consultant/pulse` | GET  | ✅ |
| admin | `//api/consultant/withdraw` | POST  | ✅ |
| admin | `//api/error-log` | POST  | ⚠️ |
| admin | `//api/health` | GET  | ⚠️ |
| web | `//api/admin/ai-consultants:id` | PUT DELETE  | ✅ |
| web | `//api/admin/ai-consultants` | GET POST  | ✅ |
| web | `//api/admin/audit` | GET  | ⚠️ |
| web | `//api/admin/bookings:id` | PUT  | ✅ |
| web | `//api/admin/bookings` | GET  | ✅ |
| web | `//api/admin/broadcast` | POST  | ✅ |
| web | `//api/admin/consultants:id/stats` | GET  | ⚠️ |
| web | `//api/admin/consultants` | GET POST  | ✅ |
| web | `//api/admin/content/reports` | GET POST  | ⚠️ |
| web | `//api/admin/impersonate` | POST  | ✅ |
| web | `//api/admin/invites` | POST  | ✅ |
| web | `//api/admin/platform-fee` | GET POST  | ✅ |
| web | `//api/admin/recordings:id/send` | POST  | ⚠️ |
| web | `//api/admin/recordings` | GET  | ✅ |
| web | `//api/admin/settings` | GET PUT  | ✅ |
| web | `//api/admin/stats` | GET  | ✅ |
| web | `//api/admin/stats/timeseries` | GET  | ⚠️ |
| web | `//api/admin/users` | GET POST  | ✅ |
| web | `//api/admin/verification` | GET POST  | ✅ |
| web | `//api/admin/wallet` | GET  | ✅ |
| web | `//api/admin/wallet/topup` | POST  | ⚠️ |
| web | `//api/admin/wallet/transactions` | GET  | ⚠️ |
| web | `//api/admin/withdrawals` | GET POST  | ✅ |
| web | `//api/ai/assist` | POST  | ✅ |
| web | `//api/ai/astrologers` | GET  | ⚠️ |
| web | `//api/ai/consultants:id` | GET  | ⚠️ |
| web | `//api/ai/consultants` | GET  | ⚠️ |
| web | `//api/ai/horoscope` | POST  | ✅ |
| web | `//api/ai/kundali` | POST  | ✅ |
| web | `//api/ai/matchmaking` | POST  | ⚠️ |
| web | `//api/ai/numerology` | POST  | ✅ |
| web | `//api/ai/palmistry` | POST  | ⚠️ |
| web | `//api/ai` | POST  | ✅ |
| web | `//api/ai/tarot` | POST  | ✅ |
| web | `//api/auth/accept-invite` | POST  | ⚠️ |
| web | `//api/auth/signout` | POST  | ✅ |
| web | `//api/auth/sync-user` | POST  | ⚠️ |
| web | `//api/auth/verify-invite` | GET  | ⚠️ |
| web | `//api/billing/instamojo` | POST  | ⚠️ |
| web | `//api/bookings:id/cancel` | POST  | ✅ |
| web | `//api/bookings:id/confirm` | POST  | ✅ |
| web | `//api/bookings:id/rate` | POST  | ✅ |
| web | `//api/bookings:id/reschedule` | POST  | ✅ |
| web | `//api/bookings:id` | GET DELETE  | ✅ |
| web | `//api/bookings/availability` | GET  | ✅ |
| web | `//api/bookings/list` | GET  | ✅ |
| web | `//api/bookings` | POST  | ⚠️ |
| web | `//api/chat:id/messages` | GET POST  | ✅ |
| web | `//api/chat:id/read` | POST  | ✅ |
| web | `//api/chat:id` | GET  | ✅ |
| web | `//api/chat/ai:consultantId` | POST  | ✅ |
| web | `//api/chat/conversations` | GET POST  | ✅ |
| web | `//api/chat/groq` | POST  | ⚠️ |
| web | `//api/consultant/availability` | GET PUT  | ✅ |
| web | `//api/consultant/bookings` | GET  | ✅ |
| web | `//api/consultant/clients` | GET  | ✅ |
| web | `//api/consultant/earnings` | GET  | ✅ |
| web | `//api/consultant/onboarding` | POST  | ⚠️ |
| web | `//api/consultant/online` | POST  | ✅ |
| web | `//api/consultant/profile` | PATCH  | ✅ |
| web | `//api/consultant/pulse` | GET  | ✅ |
| web | `//api/cron/alerting` | GET  | ⚠️ |
| web | `//api/cron/reminders` | GET  | ⚠️ |
| web | `//api/debug/log` | POST  | ✅ |
| web | `//api/error-log` | POST  | ⚠️ |
| web | `//api/explore/consultants` | GET  | ⚠️ |
| web | `//api/explore/search` | GET  | ✅ |
| web | `//api/explore/trending` | GET  | ✅ |
| web | `//api/health` | GET  | ⚠️ |
| web | `//api/notifications:id/read` | POST  | ✅ |
| web | `//api/notifications/read-all` | POST  | ✅ |
| web | `//api/notifications` | GET PUT  | ✅ |
| web | `//api/notifications/unread-count` | GET  | ✅ |
| web | `//api/posts:id/cheer` | POST  | ✅ |
| web | `//api/posts:id/comments` | GET POST  | ✅ |
| web | `//api/posts:id/report` | POST  | ✅ |
| web | `//api/posts:id` | GET  | ✅ |
| web | `//api/posts/create` | POST  | ✅ |
| web | `//api/posts/feed` | GET  | ✅ |
| web | `//api/realtime/publish` | POST  | ✅ |
| web | `//api/realtime/token` | POST  | ✅ |
| web | `//api/socket` | GET  | ⚠️ |
| web | `//api/sparks/claim` | POST  | ✅ |
| web | `//api/sparks/feed` | GET  | ✅ |
| web | `//api/trpc:trpc` | GET POST  | ⚠️ |
| web | `//api/upload` | POST  | ✅ |
| web | `//api/users:id/block` | POST DELETE  | ✅ |
| web | `//api/users:id/follow` | POST DELETE  | ✅ |
| web | `//api/users:id/posts` | GET  | ✅ |
| web | `//api/users:id/profile` | GET POST PUT  | ✅ |
| web | `//api/users/me/delete` | POST  | ✅ |
| web | `//api/users/me/export` | GET  | ✅ |
| web | `//api/users/me/profile` | GET  | ✅ |
| web | `//api/wallet/balance` | GET  | ✅ |
| web | `//api/wallet/topup` | POST  | ⚠️ |
| web | `//api/wallet/transactions` | GET  | ✅ |
| web | `//api/wallet/webhooks/instamojo` | POST  | ⚠️ |
| web | `//api/zeal/categories` | GET  | ⚠️ |
| web | `//api/zeal/chat` | POST  | ✅ |

### Server actions (must start with "use server")

All server actions properly declared.

### RPC calls used in code

Unique RPCs called: **15**

- `admin_timeseries`
- `cancel_booking`
- `check_booking_conflict`
- `check_rate_limit`
- `claim_quest`
- `credit_funds_safe`
- `delete_user_cascade`
- `hold_in_escrow_safe`
- `increment_spark`
- `process_withdrawal`
- `pulse_deduct_inr`
- `request_withdrawal`
- `self_heal_user`
- `toggle_cheer`
- `verify_consultant`

### Database tables referenced in code

Unique tables referenced: **25**

```
AdminAuditLog
AdminInvite
AIConsultant
audit_events
audit_logs
auth_attempts
Booking
CallSession
Cheer
Comment
Consultant
consultant_applications
consultant_posts
Conversation
ConversationParticipant
Message
Notification
Post
profiles
session_messages
session_requests
Transaction
User
UserActivity
Wallet
```

## 4. Database Audit

Tables defined in migrations: **0**

```

```
RPCs defined in migrations: **0**

```

```

### Realtime publications

Tables published to realtime: **0**

```

```

### Realtime broadcast triggers

Broadcast triggers defined: **0**

```

```

## 5. Cross-Reference


### Tables referenced in code but NOT defined in migrations

**25 table(s)** referenced but not found in migrations:

```
AdminAuditLog
AdminInvite
AIConsultant
audit_events
audit_logs
auth_attempts
Booking
CallSession
Cheer
Comment
Consultant
consultant_applications
consultant_posts
Conversation
ConversationParticipant
Message
Notification
Post
profiles
session_messages
session_requests
Transaction
User
UserActivity
Wallet
```

### RPCs called in code but NOT defined in migrations

**15 RPC(s)** called but not defined:

```
admin_timeseries
cancel_booking
check_booking_conflict
check_rate_limit
claim_quest
credit_funds_safe
delete_user_cascade
hold_in_escrow_safe
increment_spark
process_withdrawal
pulse_deduct_inr
request_withdrawal
self_heal_user
toggle_cheer
verify_consultant
```

### Realtime channel cross-check

**Channel factories used by TypeScript:**

```
adminBookings
adminVerification
clear
consultantAiUpdates
consultantBookings
consultantIncoming
consultantsLive
consultantSparks
consultantStatus
delete
entries
get
roomMessages
roomTyping
set
userInbox
userNotifications
userWallet
userWalletLedger
values
```
**Channel prefixes referenced by SQL triggers:**

```

```

## 6. Security Scan

**No secret values are read or printed. Only file names are checked.**

### Service role key in client files (must NOT happen)

None — no `"use client"` file references `SUPABASE_SERVICE_ROLE_KEY`.

### Routes without auth guard

**31 route(s)** without visible auth guard:

| App | Route |
|-----|-------|
| admin | `//api/error-log` |
| admin | `//api/health` |
| web | `//api/admin/audit` |
| web | `//api/admin/consultants:id/stats` |
| web | `//api/admin/content/reports` |
| web | `//api/admin/recordings:id/send` |
| web | `//api/admin/stats/timeseries` |
| web | `//api/admin/wallet/topup` |
| web | `//api/admin/wallet/transactions` |
| web | `//api/ai/astrologers` |
| web | `//api/ai/consultants:id` |
| web | `//api/ai/consultants` |
| web | `//api/ai/matchmaking` |
| web | `//api/ai/palmistry` |
| web | `//api/auth/accept-invite` |
| web | `//api/auth/sync-user` |
| web | `//api/auth/verify-invite` |
| web | `//api/billing/instamojo` |
| web | `//api/bookings` |
| web | `//api/chat/groq` |
| web | `//api/consultant/onboarding` |
| web | `//api/cron/alerting` |
| web | `//api/cron/reminders` |
| web | `//api/error-log` |
| web | `//api/explore/consultants` |
| web | `//api/health` |
| web | `//api/socket` |
| web | `//api/trpc:trpc` |
| web | `//api/wallet/topup` |
| web | `//api/wallet/webhooks/instamojo` |
| web | `//api/zeal/categories` |

### server-only imported in client files

**3 client file(s)** importing server modules:

```
apps/web/components/consultant/StudioClient.tsx
apps/web/components/consultant/WorkspaceSidebar.tsx
apps/admin/components/consultant/WorkspaceSidebar.tsx
```

### Excessive console.log usage

Files with `console.log`: **1 lines**

## 7. Environment Variable Audit

**Only env var NAMES are extracted. No values are read or printed.**
Unique env var references: **32**

| Variable | Used In |
|----------|---------|
| `AGNES_API_KEY` | 2 file(s) |
| `ALLOW_RATE_LIMIT_BYPASS` | 2 file(s) |
| `APINATOR_APP_SECRET` | 1 file(s) |
| `ASTROASK_API_KEY` | 2 file(s) |
| `CRON_SECRET` | 2 file(s) |
| `GROQ_API_KEY` | 6 file(s) |
| `INSTAMOJO_API_KEY` | 3 file(s) |
| `INSTAMOJO_API_URL` | 1 file(s) |
| `INSTAMOJO_AUTH_TOKEN` | 3 file(s) |
| `INSTAMOJO_CLIENT_ID` | 1 file(s) |
| `INSTAMOJO_CLIENT_SECRET` | 1 file(s) |
| `INSTAMOJO_SALT` | 1 file(s) |
| `INSTAMOJO_WEBHOOK_SECRET` | 1 file(s) |
| `NEXT_PUBLIC_ADMIN_URL` | 9 file(s) |
| `NEXT_PUBLIC_APINATOR_APP_KEY` | 1 file(s) |
| `NEXT_PUBLIC_APP_URL` | 11 file(s) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | 1 file(s) |
| `NEXT_PUBLIC_REALTIME_ENABLED` | 1 file(s) |
| `NEXT_PUBLIC_SITE_URL` | 3 file(s) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 26 file(s) |
| `NEXT_PUBLIC_SUPABASE_URL` | 36 file(s) |
| `NODE_ENV` | 14 file(s) |
| `R2_ACCESS_KEY_ID` | 1 file(s) |
| `R2_ACCOUNT_ID` | 1 file(s) |
| `R2_BUCKET_NAME` | 1 file(s) |
| `R2_PUBLIC_URL` | 1 file(s) |
| `R2_SECRET_ACCESS_KEY` | 1 file(s) |
| `RAZORPAY_KEY_SECRET` | 1 file(s) |
| `RESEND_API_KEY` | 2 file(s) |
| `SUPABASE_SERVICE_ROLE_KEY` | 17 file(s) |
| `VERCEL_GIT_COMMIT_SHA` | 2 file(s) |
| `VERCEL_REGION` | 2 file(s) |

### Env var presence in .env files (names only)

- `apps/web/.env.local` — **3** keys defined
- `apps/web/.env` — not present
- `apps/admin/.env.local` — **3** keys defined
- `apps/admin/.env` — not present
- `.env.local` — **5** keys defined
- `.env` — not present

## 8. Type-Check Audit

**Web:** ✅ clean
**Admin:** ✅ clean

## 9. Summary

| Check | Result |
|-------|--------|
| Critical files present | ✅ |
| No dead buttons | ⚠️ 112 found |
| All server actions declared | ✅ |
| All referenced tables exist | ❌ 25 missing |
| All called RPCs exist | ❌ 15 missing |
| No service role in client | ✅ |
| No server imports in client | ⚠️ 3 files |
| Web type-check | ✅ clean |
| Admin type-check | ✅ clean |

**Health score: 55%** (5/9 checks passed)
