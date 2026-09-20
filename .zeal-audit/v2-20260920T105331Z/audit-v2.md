
## 1. Inventory

| Metric | Count |
|--------|-------|
| TS/TSX files | 434 |
| SQL migrations | 30 |
| API routes | 113 |
| Pages | 72 |

## 2. SQL Truth

| Kind | Count |
|------|-------|
| Tables defined | 22 |
| RPCs defined | 55 |
| Broadcast triggers | 9 |

### Tables defined

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

### RPCs defined

```
admin_timeseries
admin_treasury
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
check_rate_limit
claim_quest
cleanup_admin_logs
credit_funds_safe
custom_access_token_hook
delete_user_cascade
end_call_session
generate_consultant_subdomain
get_or_create_conversation
handle_new_user
hold_in_escrow_safe
increment_comment_count
increment_spark
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
pulse_deduct_inr
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

## 4. Cross-Check

**Missing tables:** 7

#### `audit_events`
  - `apps/web/app/api/admin/verification/route.ts:66`

#### `audit_logs`
  - `apps/web/actions/admin.ts:36`

#### `consultant_applications`
  - `apps/web/actions/admin.ts:34`
  - `apps/web/actions/admin.ts:35`
  - `apps/web/actions/admin.ts:64`

#### `consultant_posts`
  - `apps/web/actions/ai.ts:80`
  - `apps/web/actions/discovery.ts:33`
  - `apps/web/actions/discovery.ts:55`
  - `apps/web/actions/public.ts:44`

#### `profiles`
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
  - `apps/web/actions/chat.ts:28`
  - `apps/web/actions/chat.ts:64`
  - `apps/web/actions/inbox.ts:71`

#### `session_requests`
  - `apps/web/actions/chat.ts:36`
  - `apps/web/actions/discovery.ts:78`
  - `apps/web/actions/inbox.ts:49`
  - `apps/web/actions/signaling.ts:33`
  - `apps/web/actions/signaling.ts:50`

**Missing RPCs:** none ✅

## 5. Auth Guard Map

**Unguarded (excluding known-public):** 22

- `apps/web/app/api/admin/audit/route.ts`
- `apps/web/app/api/admin/consultants/[id]/stats/route.ts`
- `apps/web/app/api/admin/content/reports/route.ts`
- `apps/web/app/api/admin/recordings/[id]/send/route.ts`
- `apps/web/app/api/admin/stats/timeseries/route.ts`
- `apps/web/app/api/admin/wallet/topup/route.ts`
- `apps/web/app/api/admin/wallet/transactions/route.ts`
- `apps/web/app/api/ai/astrologers/route.ts`
- `apps/web/app/api/ai/consultants/[id]/route.ts`
- `apps/web/app/api/ai/consultants/route.ts`
- `apps/web/app/api/ai/matchmaking/route.ts`
- `apps/web/app/api/ai/palmistry/route.ts`
- `apps/web/app/api/auth/accept-invite/route.ts`
- `apps/web/app/api/auth/sync-user/route.ts`
- `apps/web/app/api/auth/verify-invite/route.ts`
- `apps/web/app/api/consultant/onboarding/route.ts`
- `apps/web/app/api/cron/alerting/route.ts`
- `apps/web/app/api/cron/reminders/route.ts`
- `apps/web/app/api/explore/consultants/route.ts`
- `apps/web/app/api/socket/route.ts`
- `apps/web/app/api/trpc/[trpc]/route.ts`
- `apps/web/app/api/wallet/webhooks/instamojo/route.ts`

## 6. Client-Server Leaks

**Count:** 0


## 7. Dead Buttons

**Count:** 1

- `packages/ui/src/Button.tsx:39`

## 8. Environment Variables (names only)

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

## Summary

| Metric | Value |
|--------|-------|
| Tables defined | 22 |
| RPCs defined | 55 |
| Triggers defined | 9 |
| Tables used | 25 |
| RPCs called | 15 |
| Missing tables | 7 |
| Missing RPCs | 0 |
| Unguarded routes | 22 |
| Client leaks | 0 |
| Dead buttons | 1 |
| Env vars | 32 |
| Web type-check | ✅ |
| Admin type-check | ✅ |

**Health: 70%** (7/10)
