# BottleSense API (Cloudflare Worker)

Deployed automatically by Cloudflare Workers Builds from this repo (root dir `worker`).

## Secrets / variables (Dashboard > Worker > Settings > Variables)
| name | kind | purpose |
|---|---|---|
| `GAS_URL` | secret | Google Apps Script web app that sends the OTP email |
| `ANTHROPIC_API_KEY` | secret | AI label recognition |
| `ADMIN_TOKEN` | secret | long random string; enables `/api/admin/*` (merchants, plans, stats). Unset = admin disabled |
| `ALLOWED_ORIGINS` | var (optional) | extra comma separated allowed web origins (default: https://fiveathree.github.io + localhost) |
| `SCAN_GUEST_MONTHLY` / `SCAN_FREE_MONTHLY` / `SCAN_PRO_MONTHLY` | var (optional) | AI scans per month (defaults 8 / 40 / 1000) |
| `SCAN_IP_DAILY` / `SCAN_GLOBAL_DAILY` | var (optional) | per-IP and whole-service daily caps (defaults 60 / 1500) |
| `DEV_MODE` | var | `1` returns the OTP in the API response when mail fails. NEVER set in production |

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
