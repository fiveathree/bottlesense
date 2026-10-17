# BottleSense API (Cloudflare Worker)

Deployed automatically by Cloudflare Workers Builds from this repo (root dir `worker`).

## Secrets / variables (Dashboard > Worker > Settings > Variables)
| name | kind | purpose |
|---|---|---|
| `GAS_URL` | secret | Google Apps Script web app that sends the OTP email |
| `ANTHROPIC_API_KEY` | secret | AI label recognition |
| `ADMIN_TOKEN` | secret | long random string; enables `/api/admin/*` (merchants, plans, stats). Unset = admin disabled |
| `OPS_STATS_TOKEN` | secret | long random string; lets the ops dashboard read daily scan counts from `/api/ops/daily`. Unset = endpoint disabled |
| `ALLOWED_ORIGINS` | var (optional) | extra comma separated allowed web origins (default: https://fiveathree.github.io + localhost) |
| `SCAN_GUEST_MONTHLY` / `SCAN_FREE_MONTHLY` / `SCAN_PRO_MONTHLY` | var (optional) | AI scans per month (defaults 8 / 40 / 1000) |
| `SCAN_IP_DAILY` / `SCAN_GLOBAL_DAILY` | var (optional) | per-IP and whole-service daily caps (defaults 60 / 1500) |
| `SCAN_GUEST_IP_MONTHLY` | var (optional) | guest scans per IP per month, on top of the per-sync-key guest limit (default 24) |
| `PAIR_GUEST_DAILY` / `PAIR_FREE_DAILY` / `PAIR_PRO_DAILY` / `PAIR_GLOBAL_DAILY` | var (optional) | `/api/pairing` daily limits (defaults 3 / 10 / 30 / 1500); charged on success only |
| `DEV_MODE` | var | `1` returns the OTP in the API response when mail fails. NEVER set in production |

## Counters (Durable Object)
Quotas, rate limits, OTP codes/attempts and bonus credits live in the `Limiter` Durable Object (SQLite backend, binding `LIMITER`, migration tag `v1` in wrangler.jsonc).
`UserSync` (binding `USER_SYNC`, migration `v2`) serialises cellar merges per sync key. Both are created automatically on deploy; nothing to set in the dashboard. If the Durable Object fails (e.g. free-plan daily limit reached), counters fall back to KV and OTP login is refused until it recovers; the error shows in the admin "AI last error" card as `limiter: ...`.

## Photos
Photos are stored in R2 when an `PHOTOS` R2 binding exists, otherwise in KV (`photo:` keys).
To use R2: enable R2 in the dashboard, create a bucket, add to wrangler.jsonc:
`"r2_buckets": [{ "binding": "PHOTOS", "bucket_name": "bottlesense-photos" }]`

## Merchants (sponsored suggestions)
```
curl -X POST https://bottlesense-api.fiveathree.workers.dev/api/admin/merchant \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"id":"myshop","name":"My Wine Shop","url":"https://myshop.example",
       "products":[{"n":"Dassai 23","u":"https://myshop.example/dassai23","p":"HK$1,200",
                    "cat":"清酒","country":"日本","region":"山口","tags":["junmai","daiginjo"]}]}'
```
- Monthly stats (impressions, clicks, anonymous demand >= 3): `GET /api/admin/stats?month=202610`
- Give a user Pro: `POST /api/admin/plan {"email":"x@y.com","plan":"pro"}`
- Remove an explore item: `POST /api/admin/explore/remove {"id":"..."}`

## Wave 2: age, moderation, credits, referrals
Extra variables (all optional): `MIN_AGE` (18), `BDAY_BONUS` (10), `REF_REWARD` (10), `REF_MONTHLY_CAP` (10),
`MOD_MODEL` (claude-haiku-5-5), `SCAN_MODEL_FAST` / `SCAN_MODEL_STRONG`, `SCAN_FAST_FIRST` (`1` = try Haiku first, fall back to Sonnet when `conf` < `SCAN_CONF_MIN` (75); default off - compare accuracy before enabling),
`RESEND_API_KEY` + `MAIL_FROM` (use Resend instead of Google Apps Script for OTP mail).

Admin API (Bearer ADMIN_TOKEN):
```
POST /api/admin/code      {"code":"VIP2026","scans":10,"proDays":30,"maxUses":100,"expires":"2026-12-31","voucher":{"title":"9折","text":"結帳輸入 VIP","url":"https://shop.example"}}
POST /api/admin/campaign  {"id":"cny","name":"新年","start":"2027-02-01","end":"2027-02-15","bonus":5}
POST /api/admin/grant     {"email":"x@y.com","scans":10,"proDays":7}
POST /api/admin/ban       {"email":"x@y.com","reason":"..."}      (add "off":true to unban)
POST /api/admin/birthday  {"email":"x@y.com","birthday":"1990-01-31"}   (birthday is locked for users)
GET  /api/admin/explore/pending      POST /api/admin/explore/approve {"id":"..."}
```
