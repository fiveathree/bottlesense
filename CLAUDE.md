# BottleSense - 交接筆記 (給之後接手的新對話)

BottleSense 係一個酒類「電子酒窖」PWA：影酒標 -> AI 辨識 -> 決定「開 / 飲 / 藏 / 送」。
標語：中文「識酒，更識珍酒」、英文 "Know what to do with it"。品牌 5A3。

> 本檔只記規則、架構同進度。**唔好喺度（或任何 commit）寫密碼、密鑰、Token、電郵或個人資料。**

---

## 1. 同用戶溝通 (最重要)

- 用戶用**廣東話**溝通；回覆用廣東話書面口語，簡潔、直接講結果。唔好長篇大論，唔好覆述步驟。
- 用戶好重視**細節同畫面**，通常會貼手機截圖指出問題；每次改 UI 都要自己截圖睇過先講「改好」。
- 用戶經常**一次提多項**，逐項（1. 2. 3.）答，講清楚每項改咗乜。
- 用戶討厭：版面「彈上彈落」、字太細、佈局擠迫、要上下捲動嘅卡（記錄卡要一個畫面放晒）、emoji 圖示、粵語出現喺 App 介面。
- 用戶偏好：黑金配色、線條圖示（line icon）、介面文字用**書面語繁體中文**或英文，**App 內文案唔可以用粵語**。
- 如實講：做過嘅測試同未驗證嘅部分要分開講（例如 iPhone 真機未試）。唔確定嘅成因要標明係推斷。
- 要用戶自己做嘅嘢（Cloudflare 設定、重新整理、真機測試）要明確列出。
- commit message 結尾要加：
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018kHkiDdxWiuvSkMdP6x1ND
  ```
  （新對話如系統提示有新嘅 session 連結，用最新嗰個。）

## 2. 架構

純 vanilla JS，**無 build step、無框架**。

| 檔案 | 作用 |
|---|---|
| `index.html` | 入口、OG/Twitter meta、`color-scheme: dark`、腳本用 `?v=N` 做 cache bust |
| `app.js` (~4800 行) | 全部 UI 邏輯、i18n、各頁面渲染 |
| `db.js` | `WORKER_API_URL`、`apiFetch`、同步、相片上傳 (`shrinkDataUrl`, `uploadPhotoDataUrl`) |
| `icons.js` | MutationObserver：把 emoji 換成 SVG 線條圖示 |
| `style.css` | **必須純 ASCII**（中文字只可以放喺 JS/HTML）。每輪改動喺檔尾追加區塊 |
| `sw.js` | Service Worker，`VERSION = 'bs-vN'` |
| `admin.html` | 後台（見下），`noindex` |
| `privacy.html` | 私隱政策（App 內以彈窗顯示） |
| `worker/worker.js` | Cloudflare Worker API (`bottlesense-api`)，KV 儲存 |
| `worker/wrangler.jsonc` | Worker 設定（KV 綁定、placement） |
| `map_*.webp` | 地區地圖（金線風格） |

**資料**：用戶酒窖存喺本機 IndexedDB，登入後同步到 Worker KV。每支酒 `bottle` 物件：`identification`、`scan`（含 `vm` 八大價值、`rec`、`price`）、`tastings[]`、`status`（`unopened/opened/finished/kept/gifted/wishlist`）、`buy`（買入價）、`personalRating`。

**i18n**：`I18N.zh/en` + `t()`；`applyStaticI18n()` 處理 `data-i18n`；`dz()` 字典式翻譯產地/類別；`placeLabel()`/`PLACE_EN` 翻譯地點；語言切換用 `window._detailId` 保持喺詳情頁。新增任何文案**要同時寫中英**，並用 `audit.mjs` 式檢查英文版有冇漏中文。

**重要 UI 系統**：`askConfirm()` 自訂確認窗（唔好用 `confirm()`）、`timelineHTML()` 品鑑時間軸（由上至下按時間，最舊喺上）、`priceCardHTML()` 價格卡、`renderVerdictCard()` + `scoreReason()` 判決卡、探索頁 `renderFeedView()`、AI 推薦 `openRecommend()`。

**Worker 主要路由**（`worker/worker.js`）
- 用戶：`/api/scan`（AI 辨識，有配額）、`/api/quota`、OTP 登入、同步、`/api/photo`
- 探索池：`/api/explore*`、發布時自動審查（待覆核會 `h=2`，被舉報 3 次隱藏 `h=1`）
- 商業：`/api/offers`（商家贊助配對，支援特價 `was`+`until`）、`/api/signal`（匿名需求）、`/api/price/report|community`（社群成交價，>=3 人先顯示）
- 評分佐證：掃描結果帶 `critics`（只含級別 tier/band、來源名單、話題度，無具體分數）；`/api/verify` 用 Anthropic web_search 查證（每日 訪客 2 / 免費 5 / Pro 20，`VERIFY_GLOBAL_DAILY` 全站上限，結果按酒款快取 `crit:` 30 日）；`/api/heat` 讀匿名需求計數（<3 不顯示）。前端 `criticsCardHTML()` 放喺八維下面。
- AI：`/api/recommend`（下一支推薦）、`/api/bottle-image`（推薦用酒瓶相：先搵探索池索引 `expimg:index`，再 Wikimedia Commons）
- 後台 `/api/admin/*`：以 `Authorization: Bearer <ADMIN_TOKEN>` 保護（overview、stats、merchants、merchant、explore/flagged|pending|approve|remove、ban、plan、code、campaign、grant、birthday）
- KV key 前綴：`user: account: session: quota: exp: repcount: stat: demand: ban: pubban: merchant: bonus: m:<日期>`（每日計數）`act:` `px:` `pxd:` `expimg:index` `bimg:` `crit:` `ailast` `rl:`（限流）
- 統計：`bumpDay()` 寫 `m:<YYYY-MM-DD>`（香港時間），只記數量，不記個人內容。

**成本/限流**：掃描月額度 訪客 8 / 免費 40 / Pro 1000（環境變數可改）；推薦每日 訪客 2 / 免費 4 / Pro 10；全站每日上限防爆。

## 3. 部署方法

- **前端**：GitHub Pages，由 `main` 分支根目錄發佈 (`https://fiveathree.github.io/bottlesense/`)。push 到 `main` 即部署。
- **Worker**：Cloudflare **Workers Builds** 由 repo `worker` 資料夾自動部署（push 到 `main` 即觸發）。`wrangler.jsonc` 有 `keep_vars: true`，Dashboard 設定嘅變數/Secret 唔會被覆蓋；`placement.region = aws:us-east-1`（見第 6 節）。
- **Secrets / 變數**（只寫名，值喺 Cloudflare Dashboard，絕對唔好入 repo）：`ANTHROPIC_API_KEY`、`GAS_URL`（OTP 郵件）、`ADMIN_TOKEN`（後台登入）；可選：`ALLOWED_ORIGINS`、`SCAN_*`、`RECO_GLOBAL_DAILY`、`MIN_AGE`、`MOD_MODEL`、`DEV_MODE`（**正式環境絕對唔可以設**）。詳見 `worker/README.md`。
- **改完前端必做**：`sw.js` 的 `VERSION` +1、`index.html` 內 `app.js?v=` / `style.css?v=` +1（否則用戶會食舊 cache）。
- **WhatsApp 預覽圖 cache**：改 OG 圖要換 `?v=`，並叫用戶用新連結分享。
- 流程：本地改 -> 測試 -> `git add -A && git commit && git push origin HEAD:main`。**用 `&&` 串連，唔好用 `;`**（曾因 `node --check` 失敗仍然 push 咗壞代碼）。

## 4. 改完要行嘅測試

環境冇現成測試套件；用 Playwright + 內存 mock Worker 做整合測試（腳本放 `/tmp`，易失，要時重建）：

1. **語法檢查**：`node --check app.js`、`node --check worker/worker.js`（commit 前必做）。
2. **Mock 環境**：
   - Playwright：`/opt/npm-tools/node_modules/playwright`，Chromium：`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`（`--no-sandbox`），視窗 `390x800`（手機）。
   - 用 Node `http` 起靜態伺服器（例如 port 8099）服務 repo 根目錄。
   - 把 `worker/worker.js` 複製成 `.mjs`，`import` 後用 `page.route('**/bottlesense-api.fiveathree.workers.dev/**')` 轉發；自寫內存 `KV` class（`get/getWithMetadata/put/delete/list`），env：`{CELLAR_KV, DEV_MODE:'1', ADMIN_TOKEN:'<測試用>', ANTHROPIC_API_KEY:'x'}`；轉發時設 `CF-Connecting-IP` 同 `Origin: http://localhost:8099`（並刪走瀏覽器自帶嘅小寫 `origin`，否則會 403）。
   - 要測 AI：stub `globalThis.fetch` 攔截 `api.anthropic.com`，回傳假 JSON。
   - Worker 單獨測：直接 `worker.fetch(new Request(...), env, {waitUntil:p=>p})`。
3. **截圖並用 Read 睇**：每個改過嘅畫面都要睇（中文版 + 英文版）。modal 開住會擋點擊，測下一步前先 `closeModal()`。
4. **必測情境**：首頁、酒窖（篩選只有酒類）、酒款詳情（價格卡、判決卡、時間軸）、記錄品鑑（一個畫面、無捲動）、紀念卡、探索頁、AI 推薦、`admin.html` 登入同各卡。
5. **英文版 CJK 審計**：切英文後掃描畫面文字，確認冇漏譯繁中。
6. **iPhone 真機**行為（鍵盤、日期選擇器）模擬唔到，要明確叫用戶驗證。

## 5. 私隱同安全規則 (必須遵守)

- **只收酒款屬性**：需求訊號、社群價、AI 推薦只送「酒名/品類/產地/年份/價錢」等屬性，**唔送相片、帳號、同步碼、位置**。後台只見數量同匿名統計。
- 匿名功能（購買建議、需求統計、社群成交價）受用戶設定「購買建議及匿名統計」控制；關閉就唔可以發送。
- 社群成交價要 >=3 人先顯示；同一裝置對同一支酒只計一次。
- **年齡**：App 係 18+ 服務（首次進入有年齡確認；Worker 有 `MIN_AGE` / 生日檢查）。唔好移除年齡把關；如改語氣，要保留年齡聲明。
- 探索池公開前自動審查（非酒類相片拒絕、可疑項目入「待覆核」），被舉報 3 次自動隱藏，後台可通過/移除/封鎖。
- 後台只靠 `ADMIN_TOKEN`；`admin.html` 把 token 放 `sessionStorage`，唔可以 hard-code。新增 admin 路由一定要經 Bearer 驗證。
- CORS：只允許 `https://fiveathree.github.io` 同 localhost（`allowedOrigin`）。
- 唔好 log 或儲存個人內容；`ailast` 只記 AI 錯誤狀態同回應頭 300 字。
- 絕對唔可以：commit 任何密鑰、將 `DEV_MODE` 設喺正式環境、用 `confirm()`/`alert()`、寫粵語入 App 文案。

## 6. 已知問題 / 未完成

**需要用戶確認或驗證**
- **AI 辨識偶發失敗**：已見兩種成因並已修（回覆被 `thinking` 區塊令文字為空 -> 改為合併所有 text 區塊並用快速模型重試；Anthropic `403 Request not allowed` -> 疑似 Worker 由唔受支援地區機房出去，已加 `placement` 固定美國東岸）。**仍需真機/朋友確認**：後台頂部紅卡「AI 最近一次錯誤」會顯示真實 HTTP 狀態同內容，先睇呢度再判斷。
- 之前用戶收過舊 Sonnet 3.5 停用電郵：已確認 Cloudflare 無舊模型變數，預設用 `claude-sonnet-5-5` / `claude-haiku-5-5`。
- 日期欄喺 iOS 嘅行為：已移除 JS 追蹤鍵盤高度並改為記錄卡貼頂，**未在 iPhone 真機驗證**；如仍有問題，下一步改用自訂日期選擇器（避開原生 `datetime-local`）。
- AI「下一支推薦」：剛上線，真實推薦質素、價格準確度未驗證；推薦酒款可能已停產。
- 推薦酒瓶相：搵探索池 -> 維基共享資源 -> 金色酒瓶輪廓；真實命中率未知，探索池細時會多數見輪廓。

- **查證評分**：需要 Anthropic Console 啟用 Web Search 工具先用得；未啟用會 502，後台「AI 最近一次錯誤」會顯示 `verify:` 開頭訊息。真實查證質素、來源命中率未驗證。

**未做 / 構想**
- 商家資料加「圖片連結」欄，推薦同商家貨品吻合時用商家相。
- 年齡確認改為「同意條款 + 確認年滿 18 歲」單一掣（已向用戶提議，未獲確認）；亦未有正式使用條款頁（只有私隱政策）。
- 特價功能已就緒（商家 `was` + `until`），但**未有任何商家**；需要用戶搵 1-2 間商家，用後台「商家與特價產品」輸入。
- 發布品飲時提示「公開瓶身相」，以提升推薦圖片命中率。
- 後台統計數據由部署當日開始累積，之前冇資料。
- 「用戶需求」後台列表已放寬至顯示所有信號（原先 >=3 才顯示）。

**維護提醒**
- 改 `style.css` 要保持 ASCII；改文案要中英同步。
- 大改動後更新 `sw.js` VERSION 同 `?v=`。
- `app.js` 好大，改前先用 Grep 搵相關函數，唔好整份重寫。

## 多 AI 協作（2026-10 起）

- 分工：**ChatGPT Go 做設計，Claude（Claude Code）寫 code，Gemini Pro（Google）做驗收**，用戶拍板。
- 交流和規格全部經 `docs/specs/`：一個功能一個 Markdown 檔，用 `docs/specs/_template.md` 開新檔；流程和要貼給 ChatGPT／Gemini 的提示在 `docs/specs/README.md`。
- 開工前先確認規格檔有「2. 驗收標準」且用戶已確認；沒有就先同用戶定好，再開始。
- ChatGPT 和 Gemini 不能直接改 repo：用戶會把他們的回覆貼進來，由 Claude 原文寫入對應章節（第 3、5 節），不改寫他們的判斷。
- 實作完填第 4 節，與設計不同的地方要寫原因；Gemini 退回的項目修好後記在第 6 節。
- 細小修改（改字、修 bug）不用開規格檔，照常做。
