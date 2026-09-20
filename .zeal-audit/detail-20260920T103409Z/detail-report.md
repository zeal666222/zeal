# ZEAL — Detailed Audit (file:line for every finding)


## A. SQL Schema Truth

| Kind | Count |
|------|-------|
| Tables defined | 22 |
| RPCs defined | 50 |
| Broadcast triggers | 9 |
| Published realtime tables | 6 |

### Tables defined in migrations

```
AdminAuditLog
AdminInvite
AdminLoginAttempt
AIConsultant
Booking
CallSession
ChatMessage
Cheer
Comment
Consultant
Conversation
ConversationParticipant
DebugLog
Message
Notification
Post
public
Transaction
User
UserActivity
UserPreferences
Wallet
```

### RPCs defined in migrations

```
admin_timeseries
auth_is_admin
auth_is_consultant
auth_user_role
broadcast_ai_consultant_changes
broadcast_booking_changes
broadcast_consultant_changes
broadcast_consultant_directory_changes
broadcast_ledger_entry
broadcast_message_change
broadcast_message_changes
broadcast_message_to_inboxes
broadcast_new_message
broadcast_notification_changes
broadcast_wallet_change
broadcast_wallet_changes
cancel_booking
check_booking_conflict
claim_quest
cleanup_admin_logs
credit_funds_safe
custom_access_token_hook
end_call_session
generate_consultant_subdomain
get_or_create_conversation
handle_new_user
hold_in_escrow_safe
increment_comment_count
ledger_credit
ledger_debit
ledger_transfer
process_escrow_hold
process_escrow_release
process_per_minute_deduction
process_wallet_deduction
process_wallet_deduction_safe
process_wallet_topup
process_withdrawal
request_withdrawal
self_heal_user
sync_consultant_spark_score
sync_spark_aggregate
toggle_cheer
top_spark_consultants
touch_updated_at
trigger_activity_sparks
trigger_cheer_sparks
trigger_comment_sparks
update_conversation_last_message
verify_consultant
```

### Broadcast triggers defined

```
trg_broadcast_ai_consultant
trg_broadcast_booking
trg_broadcast_consultant
trg_broadcast_consultant_directory
trg_broadcast_ledger_entry
trg_broadcast_message
trg_broadcast_message_to_inboxes
trg_broadcast_notification
trg_broadcast_wallet
```

## C. Missing Tables and RPCs

### Missing Tables: 8

#### `audit_events`

Referenced in:

  - `apps/web/app/api/admin/users/route.ts:84`
  - `apps/web/app/api/admin/verification/route.ts:66`

#### `audit_logs`

Referenced in:

  - `apps/web/actions/admin.ts:36`

#### `auth_attempts`

Referenced in:

  - `apps/web/actions/auth.ts:57`

#### `consultant_applications`

Referenced in:

  - `apps/web/actions/admin.ts:34`
  - `apps/web/actions/admin.ts:35`
  - `apps/web/actions/admin.ts:64`

#### `consultant_posts`

Referenced in:

  - `apps/web/actions/ai.ts:80`
  - `apps/web/actions/discovery.ts:33`
  - `apps/web/actions/discovery.ts:55`
  - `apps/web/actions/public.ts:44`

#### `profiles`

Referenced in:

  - `apps/admin/app/page.tsx:18`
  - `apps/web/actions/admin.ts:28`
  - `apps/web/actions/admin.ts:33`
  - `apps/web/actions/admin.ts:72`
  - `apps/web/actions/ai.ts:33`
  - `apps/web/actions/ai.ts:65`
  - `apps/web/actions/discovery.ts:27`
  - `apps/web/actions/discovery.ts:49`
  - `apps/web/actions/public.ts:33`
  - `apps/web/actions/signaling.ts:21`
  - `apps/web/actions/studio.ts:24`
  - `apps/web/actions/studio.ts:41`
  - `apps/web/app/dashboard/page.tsx:14`
  - `apps/web/app/layout.tsx:34`

#### `session_messages`

Referenced in:

  - `apps/web/actions/chat.ts:28`
  - `apps/web/actions/chat.ts:64`
  - `apps/web/actions/inbox.ts:71`

#### `session_requests`

Referenced in:

  - `apps/web/actions/chat.ts:36`
  - `apps/web/actions/discovery.ts:78`
  - `apps/web/actions/inbox.ts:49`
  - `apps/web/actions/signaling.ts:33`
  - `apps/web/actions/signaling.ts:50`

### Missing RPCs: 4

#### `check_rate_limit`

Called from:

  - `apps/admin/lib/rate-limit/index.ts:38`
  - `apps/web/lib/rate-limit/index.ts:46`

#### `delete_user_cascade`

Called from:

  - `apps/web/app/api/users/me/delete/route.ts:20`

#### `increment_spark`

Called from:

  - `apps/web/actions/pulse.ts:30`

#### `pulse_deduct_inr`

Called from:

  - `apps/web/actions/pulse.ts:12`


## D. Unguarded Routes (excluding known-public)

**14 route(s)** without visible auth guard:

- `apps/web/app/api/admin/audit/route.ts`
- `apps/web/app/api/ai/matchmaking/route.ts`
- `apps/web/app/api/ai/palmistry/route.ts`
- `apps/web/app/api/auth/accept-invite/route.ts`
- `apps/web/app/api/auth/sync-user/route.ts`
- `apps/web/app/api/auth/verify-invite/route.ts`
- `apps/web/app/api/bookings/route.ts`
- `apps/web/app/api/chat/groq/route.ts`
- `apps/web/app/api/consultant/onboarding/route.ts`
- `apps/web/app/api/cron/alerting/route.ts`
- `apps/web/app/api/socket/route.ts`
- `apps/web/app/api/trpc/[trpc]/route.ts`
- `apps/web/app/api/wallet/topup/route.ts`
- `apps/web/app/api/wallet/webhooks/instamojo/route.ts`

## E. Client → Server Leaks

**3** client file(s) importing server modules:

- `apps/web/components/consultant/StudioClient.tsx:6`
- `apps/web/components/consultant/WorkspaceSidebar.tsx:7`
- `apps/admin/components/consultant/WorkspaceSidebar.tsx:8`

## F. Dead Buttons (verified)

**7** buttons needing review:

- `apps/web/app/consultant/[id]/page.tsx:266`
- `apps/web/app/consultant/[id]/page.tsx:269`
- `apps/web/components/profile/ActionButtons.tsx:26`
- `apps/web/components/profile/ActionButtons.tsx:30`
- `apps/admin/app/(dashboard)/users/page.tsx:233`
- `apps/admin/components/notifications/NotificationBell.tsx:72`
- `packages/ui/src/Button.tsx:39`

## G. Channels used by TS vs SQL


### TS channel factories

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

### SQL broadcast topics (prefix before string interpolation)

```

```

## H. Env Vars Referenced

```
AGNES_API_KEY
ALLOW_RATE_LIMIT_BYPASS
APINATOR_APP_SECRET
ASTROASK_API_KEY
CRON_SECRET
GROQ_API_KEY
INSTAMOJO_API_KEY
INSTAMOJO_API_URL
INSTAMOJO_AUTH_TOKEN
INSTAMOJO_CLIENT_ID
INSTAMOJO_CLIENT_SECRET
INSTAMOJO_SALT
INSTAMOJO_WEBHOOK_SECRET
NEXT_PUBLIC_ADMIN_URL
NEXT_PUBLIC_APINATOR_APP_KEY
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_RAZORPAY_KEY_ID
NEXT_PUBLIC_REALTIME_ENABLED
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL
NODE_ENV
R2_ACCESS_KEY_ID
R2_ACCOUNT_ID
R2_BUCKET_NAME
R2_PUBLIC_URL
R2_SECRET_ACCESS_KEY
RAZORPAY_KEY_SECRET
RESEND_API_KEY
SUPABASE_SERVICE_ROLE_KEY
VERCEL_GIT_COMMIT_SHA
VERCEL_REGION
```
