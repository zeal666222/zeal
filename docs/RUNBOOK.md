# Zeal — Operations Runbook

## Deploy
Both apps on Vercel:
- Web (seekers): zeal-web-red.vercel.app → apps/web
- Admin (consultants+admins): zeal-admin-rose.vercel.app → apps/admin

Push to `main` auto-deploys both.

## Health
curl -s https://zeal-web-red.vercel.app/api/health | jq
curl -s https://zeal-admin-rose.vercel.app/api/health | jq

Status: ok / degraded / down (503).

## Migrations
supabase db push

## Rollback
- Code: revert commit → Vercel redeploys previous.
- Migration: forward-only, write a new one.
- Emergency: Vercel → Deployments → Promote to Production.

## Realtime Channels
| Channel | Producer | Consumers |
|---|---|---|
| room:{id}:messages | Message INSERT | Both chat UIs |
| user:{id}:inbox | Message INSERT | Inbox |
| user:{id}:wallet | Wallet UPDATE | Wallet page |
| user:{id}:wallet:ledger | Transaction INSERT | Ledger |
| user:{id}:notifications | Notification INSERT | Bell+page |
| consultant:{id}:sparks | Consultant UPDATE | Sparks |
| consultant:ai:updates | AIConsultant CRUD | AI list |
| consultants:live | Consultant CRUD | Directory |
| admin:bookings | Booking CRUD | Admin |
| admin:verification | Consultant status | Queue |
| booking:{id}:status | Booking UPDATE | Booking card |

Verify: SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_broadcast_%';

## Common Failures

**Missing SUPABASE_SERVICE_ROLE_KEY** — add to both Vercel projects.

**Rate limit in production** — by design. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.

**Handoff failed** — token expires in 5 min. Check NEXT_PUBLIC_ADMIN_URL matches deployed admin domain. Enable Supabase Auth Hook custom_access_token_hook.

**Chat not realtime** — check admin topbar badge says Live. Confirm NEXT_PUBLIC_REALTIME_ENABLED=true in both projects.

## On-Call
1. Curl both /api/health endpoints.
2. Vercel Functions tab error rates.
3. Supabase Logs → Database slow queries.
4. Upstash @zeal/* keys.
5. If stuck channel, redeploy both apps.