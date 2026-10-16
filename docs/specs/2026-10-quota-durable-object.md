# 規格：配額與限流計數改用 Durable Object（第二期）

> 一個功能一個檔。設計（ChatGPT Go）、實作（Claude）、驗收（Gemini Pro）都只看這個檔，各自填自己的章節，不改別人的章節。
>
> 這是後端改動，沒有畫面；第 3 節由 Claude 先寫技術方案草稿，ChatGPT Go 可只覆核「3.5 未決定事項」。
>
> 狀態：待驗收
> 建立：2026-10-17　最後更新：2026-10-17

---

## 1. 需求（用戶）

- 目的：現時所有額度和限流都用 KV「先讀、再加一、再寫回」（`worker/worker.js` 的 `hit()`、`limitOrThrow()`、`underLimit()`、`bumpCount()`，以及掃描額度、OTP 錯誤次數的手寫讀寫）。KV 不是原子操作，而且不同機房之間最多可延遲約 60 秒才看到新值，所以同時送出多個請求就可以超出額度（例如訪客額度 8 次，同時送 10 張相可能全部成功）。OTP 錯誤 5 次上限同樣可被並發請求繞過，增加被暴力猜中驗證碼的風險。
- 使用者：所有用戶間接受惠（成本受控、帳號更安全）；用戶本人在後台看到的數字要準確。
- 範圍內：
  1. 掃描月額度：`quota:<身分>:<月>`、訪客每 IP 月額度 `quota:<ipId>:<月>`。
  2. OTP：驗證碼記錄 `otp:<email>`（含錯誤次數 `tries`）、冷卻 `otpcd:<email>`、發送／驗證／檢查的 `rl:otpip` `rl:otpem` `rl:ver` `rl:chk`。
  3. 查證評分每日次數：`rl:verify:*`（成功先扣）、`rl:verifytry:*`、`rl:verifyall:*`。
  4. 其餘所有用 `limitOrThrow()` 的 `rl:*` 限流（推薦、掃描每 IP 每日、全站每日上限、探索、相片、商家、價格、需求、兌換、酒瓶相、熱度、舉報）。
  5. `/api/quota`、後台用戶詳情等讀取額度的地方，改為讀新計數。
- 範圍外（這次不做）：
  - 每日統計 `bumpDay()`（`m:<日期>`）：只是數量統計，少計幾次不影響安全或成本（見 3.5）。
  - 同步 `/api/sync` 的合併邏輯：另一份規格 `2026-10-sync-merge.md`。
  - Cloudflare Rate Limiting／Turnstile 等外加防護。
- 參考：Cloudflare Durable Objects（SQLite 儲存）官方文件。

## 2. 驗收標準（開工前定好，用戶確認後才開始設計）

每一條都要能用「是／否」判斷，並寫明怎樣檢查。測試用 CLAUDE.md 第 4 節的 Worker 單獨測試方式（內存 mock），並發測試用 `Promise.all` 同時送出請求。

- [ ] AC1：掃描額度不會超額。訪客剩 1 次時同時送出 10 個 `/api/scan`（AI 用假回覆），只有 1 個成功，其餘回 `429 QUOTA_EXCEEDED`；之後 `/api/quota` 顯示 `used` 等於上限，不多不少。
- [ ] AC2：掃描「失敗不扣次數」維持不變。AI 回 `AI_BUSY`／`AI_UPSTREAM_ERROR`、或回 `NOT_ALCOHOL` 時，`/api/quota` 的 `used` 不增加；成功時加 1。
- [ ] AC3：訪客每 IP 月上限（`SCAN_GUEST_IP_MONTHLY`）同樣不會被並發繞過：同一 IP 用多個隨機同步碼同時掃描，成功總數不超過上限。
- [ ] AC4：獎勵次數（bonus）在月額度用完後扣除，並發請求下扣除次數等於成功掃描次數，不會多扣或少扣（若 3.5 決定 bonus 不納入，此條改為「行為與現時相同」）。
- [ ] AC5：OTP 錯誤次數不能被並發繞過。對同一電郵同時送出 20 個錯誤驗證碼，最多只有 5 個被實際比對，其餘回「嘗試次數過多」；之後即使送正確驗證碼也要失敗，必須重新發送。
- [ ] AC6：OTP 冷卻 60 秒：同時送出 5 個 `send-otp`，只發出 1 封郵件（mock 郵件函數只被呼叫 1 次）。
- [ ] AC7：查證評分每日次數「成功先扣」且不超額：免費用戶（每日 5 次）同時送出 10 個不同酒款的 `/api/verify`，成功數不超過 5；上游失敗的請求不扣每日次數；嘗試上限（每日次數 x3）同樣不會被並發繞過。
- [ ] AC8：所有原本用 `limitOrThrow()` 的限流，上限數字和錯誤碼（`RATE_LIMITED`、`RATE_LIMITED_IP`、`RATE_LIMITED_EMAIL`、`SERVICE_BUSY`）與現時相同；抽測推薦、探索發布、相片上載三條路由，達上限後回相同錯誤碼。
- [ ] AC9：資料遷移：部署當月已用的掃描次數不會歸零。測試時先在 KV 放 `quota:<身分>:<本月> = 6`，部署新版後 `/api/quota` 顯示 6，再掃描一次變 7。
- [ ] AC10：日／月重置正確：模擬跨日（UTC）後每日限流重新計算；模擬跨月後掃描額度重新計算。
- [ ] AC11：程式碼中不再有對 `quota:`、`rl:`、`otp:`、`otpcd:` 的 KV 讀後寫（用 Grep 檢查 `worker.js`，只容許遷移用的一次性讀取）。
- [ ] AC12：`node --check worker/worker.js` 通過；`wrangler.jsonc` 有 Durable Object 綁定和 migration；Workers Builds 部署成功（由用戶在 Cloudflare 確認，或 Claude 用部署記錄確認）。
- [ ] AC13：正常使用時速度不明顯變慢：mock 環境下單次掃描請求額外增加的計數往返不超過 3 次（以程式碼審閱確認）；正式環境由用戶真機掃描一次確認無異常。
- [ ] AC14：DO 出錯（例如免費方案當日額度用完）時不會令全站停用：mock 令 DO 呼叫拋錯，掃描、查證評分改用舊 KV 計數照常運作（盡力限流）；OTP 驗證則一律拒絕（安全優先），回現有的「驗證碼無效或已過期」錯誤；`ailast` 或後台可見 DO 錯誤記錄。（2026-10-17 因確認免費方案而新增）

## 3. 設計（ChatGPT Go）

> 這一節先由 Claude 起草技術方案（後端無畫面）。ChatGPT Go 如有意見，原文加在本節末尾。

### 3.1 方案選擇

| 方案 | 做法 | 優點 | 缺點 |
|---|---|---|---|
| A. 每個計數一個 Durable Object | `idFromName(計數鍵)` | 隔離最好 | 一次掃描要碰 4–5 個 DO，延遲疊加；物件數量極多 |
| B. 全站一個 Durable Object | 所有計數放同一個 DO | 最簡單，可一次過原子檢查多個計數 | 單線程，所有請求排隊；流量大時成瓶頸 |
| **C. 按「主體」分 Durable Object（建議）** | 用戶／訪客身分一個 DO（`tier.id`）、IP 一個 DO（`ipId`／IP 雜湊）、電郵一個 DO（OTP）、全站上限一個 DO | 同一主體的計數在同一 DO 內原子處理；只有全站上限共用一個 DO，現時每日只約數千次，足夠 | 跨主體（用戶額度 + IP 額度 + 全站）不能一次原子完成，需要「預留／退還」 |
| D. Cloudflare Rate Limiting binding | 官方限流綁定 | 不用自己寫 | 只支援短時間窗口（10 秒／60 秒），不能做月額度；計數並非精確 |

建議方案 C。

### 3.2 計數介面（Durable Object 類別 `Limiter`，SQLite 儲存）

- `take(key, limit, ttlSec)`：未達上限就加 1 並回 `{ ok: true, used }`，否則回 `{ ok: false, used }`。取代 `hit()`／`limitOrThrow()`。
- `reserve(key, limit, ttlSec)` → `{ ok, used, ticket }`：預留 1 次（計入上限），預留 2 分鐘後自動失效。
- `commit(ticket)`：預留轉為正式扣除。
- `release(ticket)`：退還預留（上游失敗、`NOT_ALCOHOL`）。
- `peek(key)`：只讀，供 `/api/quota`、後台使用。
- OTP 專用：`otpPut(email, hash, exp)`、`otpCheck(email, hash)`（在同一 DO 內比對並加錯誤次數，達 5 次即刪除）、`otpCooldown(email, 60)`。
- 過期清理：用 DO alarm 每日刪除過期列。

### 3.3 各路由改法

- **掃描**：依次 `reserve` 用戶月額度（不足時改為預留 bonus）→ `reserve` 訪客 IP 月額度 → `take` 每 IP 每日、全站每日。任何一步失敗就 `release` 已預留的項目並回原錯誤碼。AI 成功後 `commit`；失敗或 `NOT_ALCOHOL` 則 `release`。
- **查證評分**：`reserve` 每日次數（身分 + IP），`take` 嘗試上限與全站上限；成功 `commit`，失敗 `release`。
- **OTP**：發送用 `otpCooldown` + `take`（每 IP／每電郵每小時）；驗證用 `otpCheck`，整個比對在 DO 內完成。
- **其他 `limitOrThrow()`**：保留函數名稱，內部改為呼叫對應主體 DO 的 `take`，路由程式碼盡量不改。
- **「預留」為何會跨 DO**：用戶額度與 IP 額度屬不同主體，不能一次原子完成；用「先預留、失敗退還」確保不會超額，最壞情況是某次失敗的預留要 2 分鐘後才自動釋放（期間該用戶看到的剩餘次數暫時少 1）。

### 3.4 部署設定

- `wrangler.jsonc` 加 `durable_objects.bindings`（`LIMITER` → `Limiter`）和 `migrations`（`new_sqlite_classes: ["Limiter"]`）。
- `worker.js` 匯出 `export class Limiter`。
- 推斷：SQLite 儲存的 Durable Objects 在 Workers 免費方案可用，但每日請求數有上限；需要用戶在 Cloudflare 確認現時方案和用量（見 3.5）。

### 3.5 未決定事項

1. **獎勵次數（bonus）要不要一併改用 DO？** `consumeBonus()` 同樣是讀後寫，並發時可能多用或少扣。建議：一併改（AC4）。
   - **用戶決定（2026-10-17）：一併改。**
2. **每日統計 `bumpDay()` 要不要改？** 建議：這次不改，只是統計數字，偶爾少計不影響成本或安全。
   - **用戶決定（2026-10-17）：這次不改。**
3. **Cloudflare 方案**：需要用戶確認帳戶是免費還是付費方案，以及可接受的 DO 用量。
   - **用戶確認（2026-10-17）：Workers 免費方案。** 根據 Cloudflare 文件（Durable Objects Pricing，2026-09-30 版）：免費方案只可用 SQLite 儲存的 DO（本方案正是）；每日寫入 100,000 列、讀取 500 萬列、總儲存 5 GB；超出後當日該類操作會報錯，00:00 UTC 重置。
   - 估算：每次掃描約 4–6 次計數寫入，其他限流每次 1 次；以現時每日數千次請求計，遠低於每日 100,000 列。
   - 附帶好處（推斷，實作時以 Dashboard 用量確認）：免費方案 KV 每日寫入額度很少，現時每個限流都寫 KV，改用 DO 後可大幅減少 KV 寫入。
   - 因免費方案超額會直接報錯，加 AC14：DO 出錯時的處理。
4. **全站上限 DO 的位置**：Worker 已固定在美國東岸，建議 DO 亦在附近建立（首次存取時自動決定），無需額外設定。

## 4. 實作紀錄（Claude）

- 改動檔案：`worker/worker.js`（新增 `Limiter` 類別和 `limTake`／`limReserve`／`limCommit`／`limRelease`／`limPeek`／`otpPut`／`otpCheck`；掃描、查證評分、OTP、獎勵次數、所有 `limitOrThrow()` 改用 DO）、`worker/wrangler.jsonc`（`LIMITER` 綁定、`v1` migration）、`CLAUDE.md`、`worker/README.md`。
- 與設計不同之處及原因：
  1. DO 分法：設計寫「按主體（身分／IP／電郵）一個 DO」，實作改為「每個計數 + 身分一個 DO」（計數鍵去掉尾段日期，例如 `rl:otpip:<ip>`、`quota:u:<email>`、`rl:scanall`）。原子性相同，但不用逐條鍵拆解身分，程式較簡單；全站上限仍然各自只有一個 DO。
  2. DO 用 `fetch` 介面而不是 RPC（不用 `import "cloudflare:workers"`），方便用 Node 直接測試。每個 DO 內所有操作經內部佇列逐個執行，包括等候舊 KV 遷移讀取期間。
  3. AC8 抽測改為：推薦、相片上載、check-email、同一電郵發送 OTP。探索發布需要已驗證年齡的帳號，限流程式碼與其他路由相同（同一個 `limitOrThrow()`），所以沒有逐條測。
  4. AC11：DO 正常時已沒有 `quota:`／`rl:`／`otp:`／`otpcd:` 的 KV 讀後寫；只保留在 AC14 要求的「DO 出錯後備」路徑（`kvHit`／`kvUsed`／`kvBump`），以及遷移時的一次性讀取和刪帳號時清理舊 KV `otp:`。
  5. AC13：一次訪客掃描共 6 次 DO 呼叫，分 3 輪並行（預留用戶額度 + IP 額度 → 每 IP 每日 + 全站每日 → 正式扣除），即額外 3 個往返；月額用完而用獎勵次數時多 1 輪。
  6. DO 出錯記錄寫入 `ailast`（後台「AI 最近一次錯誤」卡），`model` 為 `limiter`，10 分鐘最多寫一次。
  7. 派獎（生日、活動、邀請、兌換碼、後台贈送）在 DO 出錯時回 503，並撤回「已領取」標記，之後可以再領；`/api/me` 和登入不會因派獎失敗而出錯。
  8. 範圍外仍用 KV 讀後寫（未改）：每日統計 `bumpDay()`、「唔係酒」警告次數 `strike:`、兌換碼使用次數 `codeuses:`、邀請每月上限 `refcap:`。
- 已自測（怎樣測、結果）：Node 單獨測試 Worker（內存 KV 有隨機延遲以模擬並發交錯，內存 DO 模擬儲存；AI 和郵件用 stub）。新版 11/11 通過：

  | AC | 結果 |
  |---|---|
  | AC1 | 訪客剩 1 次，10 個同時掃描：成功 1、`QUOTA_EXCEEDED` 9，之後 used=8 |
  | AC2 | AI 繁忙、唔係酒都不扣（used=0），成功後 used=1 |
  | AC3 | IP 已用 22/24，10 個隨機同步碼同時掃描：成功 2 |
  | AC4 | 月額用完 + 獎勵 3 次，6 個同時掃描：成功 3，剩餘獎勵 0 |
  | AC5 | 20 個同時錯碼：DO 只比對 5 次；之後正確碼都失敗 |
  | AC6 | 5 個同時發送：只發 1 封郵件，其餘 `COOLDOWN` |
  | AC7 | 免費用戶 10 個同時查證：成功 5；上游失敗不扣，之後仍可成功 5 次；30 個失敗請求只打上游 5 次（上限 15） |
  | AC8 | 推薦第 3 次、check-email 第 31 次、相片第 301 次 `RATE_LIMITED`；同一電郵第 6 次發碼 `RATE_LIMITED_EMAIL` |
  | AC9 | KV 舊值 6 → `/api/quota` 6 → 掃描後 7 |
  | AC10 | 每小時限流到下一個時段重置；月額到下個月重置（used=1） |
  | AC14 | DO 全部拋錯：掃描 200（改用 KV 計數）、查證 200、OTP 驗證 400、`ailast` 有 `limiter:` 記錄 |

  同一套測試跑改動前的 Worker：AC1、AC3、AC4、AC5、AC6、AC7 不通過（例如 10 個同時掃描全部成功；20 個錯碼之後正確碼仍然登入成功；同時發 5 個驗證碼寄出 5 封）。
- `node --check worker/worker.js` 通過（AC12 前半）。
- 未能驗證：Cloudflare 正式部署和 migration（AC12 後半）、真實 DO 延遲、DO alarm 每日清理過期記錄、真機掃描（AC13 後半），要部署後由用戶確認。
- 測試網址／截圖：無畫面改動。
- Commit：見第 6 節。

### 資料遷移與回退風險（實作時必須處理）

| 資料 | 風險 | 處理方法 |
|---|---|---|
| 本月掃描已用次數 `quota:*:<月>` | 切換後歸零，用戶當月多出額度 | DO 第一次讀某個本月計數時，從 KV 讀舊值作起點（只讀一次），之後只用 DO（AC9） |
| 每日限流 `rl:*` | 切換當日歸零 | 影響細（最多一日內多出一次額度）；`rl:verify:*` 同樣在第一次讀取時從 KV 帶入 |
| 進行中的 OTP `otp:<email>`（10 分鐘有效） | 部署瞬間收到驗證碼的用戶，新版找不到記錄 | 新版驗證時 DO 沒有記錄就讀一次 KV 舊記錄並搬入 DO，然後刪除 KV 記錄；10 分鐘後此路徑可移除 |
| 獎勵次數 `bonus:<email>` | 若改用 DO，後台「贈送次數」路由也要改，否則贈送寫入 KV 但扣除讀 DO | 同一次部署一併改 `grantBonus`／`loadBonus`；第一次讀取時從 KV 帶入 |
| 回退到舊版 | DO 內的新計數 KV 看不到，月額度會回到切換時的舊值 | 可接受（只會讓用戶多用幾次）；回退前不需要特別處理 |
| 後台／ops 數字 | `/api/admin/*` 讀 `quota:u:<email>` 會讀到舊 KV 值 | 同一次部署改為 `peek` |

## 5. 驗收結果（Gemini Pro）

- 檢查依據（看了什麼：截圖、網址、程式碼）：

| AC | 結果（通過／不通過／未能驗證） | 說明 |
|---|---|---|
| AC1 | | |

- 其他問題（必修／建議／小事）：
- 結論：通過 ／ 退回

## 6. 跟進紀錄

- 2026-10-17：Claude 起草第 1–3 節，等用戶確認第 2 節驗收標準和 3.5 決定。
- 2026-10-17：用戶確認第 2 節驗收標準（照原文），3.5 第 1、2、4 項跟建議；第 3 項（Cloudflare 方案）待用戶查看。
- 2026-10-17：用戶確認免費方案；Claude 補充免費方案限制，並新增 AC14（DO 出錯時的處理），待用戶確認。
- 2026-10-17：用戶確認 AC14，開始實作。完成實作和 Node 自測（11/11），狀態改為「待驗收」；等 Cloudflare 部署結果和用戶真機掃描。
