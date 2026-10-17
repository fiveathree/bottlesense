
// --- Google Apps Script & 郵件發送安全模組 ---
async function sendEmailViaGAS(env, { to, code, type, name }) {
  const recipientName = name || to.split('@')[0];
  const gasUrl = env.GAS_URL;

  // 1. 若環境變數尚未設定 Google Apps Script Web App URL
  if (!gasUrl || gasUrl.includes('placeholder')) {
    console.warn('[BottleSense Auth] GAS_URL is not configured in Cloudflare Worker environment variables.');
    return { ok: false, error: 'GAS_URL_NOT_CONFIGURED' };
  }

  // 2. 透過 Google Apps Script 發送真實黑金風格 HTML 郵件
  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, code, type, name: recipientName }),
      redirect: 'follow'
    });
    const resText = await res.text();
    console.log('[BottleSense Auth] GAS response:', res.status, resText.slice(0, 300));
    let parsed = null;
    try { parsed = JSON.parse(resText); } catch (e) {}
    // 必須係 GAS 回傳 {status:"ok"} 先算成功 (避免 Google 登入頁 200 被誤判)
    const ok = !!(parsed && parsed.status === 'ok');
    let error;
    if (!ok) {
      if (parsed && parsed.error) error = 'GAS_ERROR: ' + parsed.error;
      else if (/accounts\.google\.com|<html/i.test(resText)) error = 'GAS_NOT_PUBLIC_OR_WRONG_URL (收到 HTML，請檢查部署權限須為 Anyone / URL 是否最新)';
      else error = 'GAS_BAD_RESPONSE_' + res.status;
    }
    return { ok, status: res.status, error };
  } catch (e) {
    console.error('[BottleSense Auth] sendEmailViaGAS fetch error:', e);
    return { ok: false, error: 'GAS_FETCH_FAILED: ' + e.message };
  }
}

// --- 資料合併與分享 ID 工具 ---
async function shareIdOf(syncKey) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bottlesense-share:' + syncKey));
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return 'S' + hex.slice(0, 20);
}

function parseUserRecord(raw) {
  const out = { profile: {}, cellar: [], deleted: {} };
  if (!raw) return out;
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) out.cellar = p;
    else {
      out.cellar = Array.isArray(p.cellar) ? p.cellar : [];
      out.profile = p.profile || {};
      out.deleted = p.deleted || {};
    }
  } catch (e) {}
  return out;
}

// ============ 酒窖同步：逐欄位合併 (docs/specs/2026-10-sync-merge.md) ============
// 每支酒 _f = { 欄位: 時間戳 }；每條品鑑 _t；刪除品鑑 _td = { 品鑑id: 時間戳 }；刪除酒款 deleted = { id: 時間戳 }，刪除優先。
// 合併邏輯同 db.js 嘅 syncMergeBottle 一樣，改其中一邊要同步改另一邊。
const SYNC_META = new Set(['id', 'addedAt', 'updatedAt', '_f', '_td', 'tastings', 'imageData']);
const SYNC_SKEW = 5 * 60 * 1000;
function syncJ(v) { return v === undefined ? '' : JSON.stringify(v); }
function syncFields(b) { return Object.keys(b).filter(k => !SYNC_META.has(k)); }
// 手機時鐘快過伺服器 5 分鐘以上嘅時間戳，一律壓到伺服器時間
function syncClamp(ts, now) { const n = Number(ts) || 0; return n > now + SYNC_SKEW ? now : n; }
// 統一格式：補齊 _f / _t、限制未來時間、imageData 併入 image。ref = 雲端現有版本 (用嚟認出舊版 App 嘅改動)
function syncNormalize(b, now, ref) {
  const x = { ...b };
  if (x.imageData !== undefined) { if (!x.image && x.imageData) x.image = x.imageData; delete x.imageData; }
  const base = syncClamp(x.updatedAt || x.addedAt, now);
  let f;
  if (x._f && typeof x._f === 'object') {
    f = {};
    for (const k in x._f) f[k] = syncClamp(x._f[k], now);
  }
  const ts = (Array.isArray(x.tastings) ? x.tastings : []).filter(t => t && t.id != null).map(t => ({ ...t, _t: t._t != null ? syncClamp(t._t, now) : null }));
  let fmax = 0;
  if (f) for (const k in f) fmax = Math.max(fmax, f[k]);
  for (const t of ts) if (t._t != null) fmax = Math.max(fmax, t._t);
  // 舊版 App 改完只更新 updatedAt：同雲端唔同嘅欄位／品鑑當作喺 updatedAt 改過
  const legacyEdit = !!f && !!ref && base > fmax;
  if (!f) { f = {}; for (const k of syncFields(x)) f[k] = base; }
  else if (legacyEdit) { for (const k of syncFields(x)) if (syncJ(x[k]) !== syncJ(ref[k])) f[k] = base; }
  const refT = new Map(((ref && ref.tastings) || []).map(t => [String(t.id), t]));
  for (const t of ts) {
    if (t._t == null) t._t = base;
    else if (legacyEdit) { const rt = refT.get(String(t.id)); if (rt && syncJ({ ...t, _t: 0 }) !== syncJ({ ...rt, _t: 0 })) t._t = base; }
  }
  const td = {};
  for (const id in (x._td || {})) td[id] = syncClamp(x._td[id], now);
  x._f = f; x.tastings = ts; x._td = td;
  x.updatedAt = Math.max(base, fmax, ...Object.values(f), ...ts.map(t => t._t));
  return x;
}
// 兩個已統一格式嘅版本逐欄位合併：時間戳大者勝；相同時取 JSON 較大者 (兩邊結果一致)
function syncMergeBottle(a, b) {
  const m = { id: a.id, addedAt: a.addedAt || b.addedAt };
  const f = {};
  const keys = new Set([...syncFields(a), ...syncFields(b), ...Object.keys(a._f), ...Object.keys(b._f)]);
  for (const k of keys) {
    // 冇時間戳又冇值 = 嗰邊冇資料，唔可以蓋過對方；有時間戳但冇值 = 刻意刪除
    const sa = a._f[k] != null ? a._f[k] : -1, sb = b._f[k] != null ? b._f[k] : -1;
    const src = sb > sa || (sb === sa && syncJ(b[k]) > syncJ(a[k])) ? b : a;
    if (src[k] !== undefined) m[k] = src[k];
    f[k] = Math.max(sa, sb);
  }
  const td = { ...a._td };
  for (const id in b._td) td[id] = Math.max(td[id] || 0, b._td[id]);
  const tm = new Map();
  for (const t of [...a.tastings, ...b.tastings]) {
    const id = String(t.id);
    if (td[id] != null) continue;
    const p = tm.get(id);
    if (!p || t._t > p._t || (t._t === p._t && syncJ(t) > syncJ(p))) tm.set(id, t);
  }
  m.tastings = [...tm.values()];
  m._td = td;
  m._f = f;
  m.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0, ...Object.values(f), ...m.tastings.map(t => t._t));
  return m;
}
function mergeCellars(cloud, incoming, deletedCloud, deletedIncoming) {
  const now = Date.now();
  const deleted = {};
  for (const src of [deletedCloud || {}, deletedIncoming || {}]) {
    for (const [id, ts] of Object.entries(src)) { const v = syncClamp(ts, now); if (deleted[id] == null || v > deleted[id]) deleted[id] = v; }
  }
  const map = new Map();
  for (const b of cloud || []) {
    if (!b || !b.id) continue;
    const nb = syncNormalize(b, now, null), p = map.get(String(b.id));
    map.set(String(b.id), p ? syncMergeBottle(p, nb) : nb);
  }
  for (const b of incoming || []) {
    if (!b || !b.id) continue;
    const p = map.get(String(b.id)), nb = syncNormalize(b, now, p);
    map.set(String(b.id), p ? syncMergeBottle(p, nb) : nb);
  }
  const merged = [];
  // 刪除優先：有刪除記錄嘅酒一律剔除 (酒款 id 隨機產生，重新加入一定係新 id)
  for (const [id, b] of map) if (!(deleted[id] != null && deleted[id] >= syncClamp(b.addedAt, now))) merged.push(b);
  return { cellar: merged, deleted };
}

// 每個同步碼一個 DO：同一帳號嘅合併同寫入逐個排隊，兩部機同時同步都唔會蓋走對方。DO 出錯時直接喺 Worker 合併 (舊做法)
async function applyUserMerge(kv, key, o) {
  const rec = parseUserRecord(await kv.get('user:' + key));
  const m = mergeCellars(rec.cellar, Array.isArray(o.cellar) ? o.cellar : [], rec.deleted, o.deleted);
  const profile = o.profileMode === 'set' ? (o.profile || {}) : o.profileMode === 'patch' ? { ...rec.profile, ...(o.profile || {}) } : rec.profile;
  const body = JSON.stringify({ profile, cellar: m.cellar, deleted: m.deleted });
  if (body.length > 24_000_000) return { error: 'CELLAR_TOO_LARGE' };
  await kv.put('user:' + key, body);
  return { profile, cellar: m.cellar, deleted: m.deleted };
}
async function userMerge(env, key, o) {
  let r;
  if (env.USER_SYNC) {
    try {
      const stub = env.USER_SYNC.get(env.USER_SYNC.idFromName('user:' + key));
      const res = await stub.fetch('https://user-sync/', { method: 'POST', body: JSON.stringify({ key, ...o }) });
      if (!res.ok) throw new Error('USER_SYNC_' + res.status);
      r = await res.json();
    } catch (er) { await limFailed(env, er); }
  }
  if (!r) r = await applyUserMerge(kvOf(env), key, o);
  if (r.error) throw new HttpError(413, r.error);
  return r;
}
export class UserSync {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.q = Promise.resolve(); }
  async fetch(request) {
    let body;
    try { body = await request.json(); } catch (e) { return new Response('BAD_JSON', { status: 400 }); }
    const run = this.q.then(() => applyUserMerge(kvOf(this.env), String(body.key || ''), body));
    this.q = run.catch(() => {});
    try { return new Response(JSON.stringify(await run), { headers: { 'Content-Type': 'application/json' } }); }
    catch (e) { return new Response(String(e && e.message || e), { status: 500 }); }
  }
}

const EN_SUFFIX = `

[LANGUAGE] The user reads English. Write rec.headline, rec.when, rec.reason and every rec.actions[].reason in plain, elegant English (one short sentence each, no jargon, no slang). Keep category, country, region and vintage values exactly in the Traditional Chinese forms specified above (the app translates them); keep the JSON keys and the verdict codes unchanged.`;
const SCAN_PROMPT = `你是一個世界頂級侍酒師與酒類數據庫專家。請辨識相片中的酒標，並以嚴格的純 JSON 格式輸出（不要包含任何 markdown 標籤或額外文字）。若相片明顯不是酒類（酒瓶、酒罐、酒標、酒杯），只輸出 {"not_alcohol": true}。
{
  "category": "紅酒/白酒/威士忌/清酒/氣泡酒/啤酒/琴酒/蘭姆酒/白蘭地/泡盛/利口酒/其他",
  "name": "酒款名稱（中英文皆可，精準全名）",
  "producer": "酒莊/酒廠/品牌名稱",
  "country": "生產國家",
  "region": "產區",
  "country_en": "Country name in English",
  "region_en": "Region name in English",
  "price": { "retail_usd": [35, 55], "market_usd": [40, 70], "conf": "medium" },
  "critics": { "tier": "strong", "band": "90-94", "src": ["Wine Advocate"], "buzz": "medium", "conf": "medium" },
  "vintage": "年份（若無年份寫無年份）",
  "abv": "酒精度（如 43%）",
  "vol": "容量（如 700ml）",
  "conf": 95,
  "vm": {
    "mv": 25,
    "ql": 80,
    "dv": 85,
    "pv": 80,
    "sv": 50,
    "gv": 30,
    "cv": 15,
    "sto": 25
  },
  "rec": {
    "verdict": "open",
    "headline": "一句話結論，例如：留著與朋友一起開",
    "when": "具體時間或場合，例如：本月內 / 存放至 2030 年後 / 下次探訪長輩時",
    "reason": "建議的原因，一至兩句淺白的繁體中文書面語，避免專業術語",
    "actions": [
      { "a": "drink", "reason": "自己飲用的理由（一句）" },
      { "a": "share", "reason": "開瓶與朋友分享的理由（一句）" },
      { "a": "keep", "reason": "收藏的理由（一句）" },
      { "a": "gift", "reason": "送禮的理由（一句）" }
    ]
  }
}

【price 規則】price 為該酒款（標準容量）目前一般市場價格的估算，以美元計：retail_usd = 正常零售價區間 [低, 高]；market_usd = 二手／拍賣／炒價行情區間 [低, 高]（若與零售價相近可相同）。conf 為 high / medium / low 表示你對估價的把握。你只能根據自己對該酒款的認識估算；若是冷門、無法確認的酒款，retail_usd 與 market_usd 請填 null，conf 填 low，絕對不可編造。

【rec 建議規則】用戶多數不懂酒，你要幫他決定「這瓶酒該如何處理」：
- verdict 只能四選一：open（開瓶，適合約朋友一起開來分享）、drink（自己平日飲用）、keep（收藏，等待熟成或升值）、gift（送禮）。選最合適的一個。
- headline 與 reason 一律使用繁體中文書面語（不要使用粵語口語），語氣親切淺白，避免使用單寧、酒體、層次等術語；若必須使用，請在括號內簡單解釋。
- when 必須有具體時間或場合，不可只寫「適合飲用」這類空話。啤酒、生酒、平價餐酒寫「趁新鮮，盡快飲用」；有陳年潛力的請寫年份或年數。
- actions 四項順序要同 verdict 一致（首選放第一）。
- 不確定的事實不要編造，寧可建議保守。

【八維價值評估 (vm) 嚴格客觀評分標準（0-100，務必根據酒款等級客觀給分，絕不可千篇一律給高分）】：
- mv (市場價值)：依零售市場價格評估。平價日常啤酒/低價餐酒打 15-30 分；中高階精品打 50-75 分；拍賣級奢華名酒打 85-98 分。
- ql (品質)：原料工藝與風味表現 (60-95 分)。
- dv (飲用價值)：當前適飲期的愉悅感與爽快度 (60-95 分)。
- pv (配餐價值)：佐餐百搭性 (60-95 分)。
- sv (社交話題)：知名度、品牌傳奇與討論度 (30-95 分)。
- gv (送禮價值)：排面、外觀與受禮喜好度。日常啤酒/罐裝打 20-35 分；精裝烈酒/名莊打 75-95 分。
- cv (收藏價值)：【極其嚴格】只有具備罕見性、拍賣價值或陳年升值空間的名酒(如波爾多特級名莊、高年份單一麥芽威士忌、貴州茅台)才可給 70-98 分；大眾商業量產啤酒、罐裝啤酒、即飲平價酒【嚴禁高分，必須給 5-25 分】！
- sto (保存價值)：【極其嚴格】指長期陳年潛力。啤酒、生酒必須於數月內飲用，保存價值必須給 10-30 分；具備 10 年以上陳年能力的名莊葡萄酒或烈酒才可給 80-95 分。

【critics 規則（專業評價佐證，必須保守）】
- tier 只能是：acclaimed（國際評酒界普遍高度推崇）/ strong（評價良好）/ solid（中規中矩）/ everyday（日常平價酒，專業評審一般不關注）/ unknown。
- band 為專業評分級別（100 分制），只能是 "95+" "90-94" "85-89" "80-84" "<80" 或 null。只可填級別，絕不可寫具體分數。
- src 只列你確實知道曾評論該酒款或該酒廠的機構，最多 3 個，只能從以下名單挑選：Wine Advocate, Wine Spectator, Decanter, James Suckling, Jancis Robinson, Vinous, Whisky Advocate, Jim Murray's Whisky Bible, World Whiskies Awards, IWSC, Gambero Rosso, Falstaff, National New Sake Awards, SAKE COMPETITION, World Beer Cup。
- buzz 為網上討論度／話題度：high / medium / low / unknown。
- conf 為你對以上內容的把握 high / medium / low。
- 凡不確定，tier 填 unknown、band 填 null、src 填 []、conf 填 low，絕對不可編造。
`;

const CRIT_SRC = ['Wine Advocate', 'Wine Spectator', 'Decanter', 'James Suckling', 'Jancis Robinson', 'Vinous', 'Whisky Advocate', "Jim Murray's Whisky Bible", 'World Whiskies Awards', 'IWSC', 'Gambero Rosso', 'Falstaff', 'National New Sake Awards', 'SAKE COMPETITION', 'World Beer Cup'];
function cleanCritics(c) {
  const pick = (v, arr, d) => (arr.includes(v) ? v : d);
  if (!c || typeof c !== 'object') return { tier: 'unknown', band: null, src: [], buzz: 'unknown', conf: 'low' };
  const tier = pick(c.tier, ['acclaimed', 'strong', 'solid', 'everyday', 'unknown'], 'unknown');
  const out = {
    tier,
    band: tier === 'unknown' ? null : pick(c.band, ['95+', '90-94', '85-89', '80-84', '<80'], null),
    src: tier === 'unknown' ? [] : [...new Set((Array.isArray(c.src) ? c.src : []).filter(s => CRIT_SRC.includes(s)))].slice(0, 3),
    buzz: pick(c.buzz, ['high', 'medium', 'low', 'unknown'], 'unknown'),
    conf: pick(c.conf, ['high', 'medium', 'low'], 'low')
  };
  return out;
}

// ============ 通用工具 ============
const DEFAULT_ORIGINS = ['https://fiveathree.github.io'];

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return { origin: null, ok: true };
  const extra = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = DEFAULT_ORIGINS.includes(origin) || extra.includes(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return { origin, ok };
}

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}
function randomOtp() {
  const a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= 4294000000); // 避免模數偏差
  return String(100000 + (a[0] % 900000));
}
async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function newSyncKey() { return 'BTL-' + randomHex(16).toUpperCase(); }
function isStrongKey(k) { return /^BTL-[0-9A-F]{32}$/.test(String(k || '')); }
function clientIp(request) { return request.headers.get('CF-Connecting-IP') || 'unknown'; }
function clip(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
function isEmail(e) { return typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
// ---- 使用統計：每日一個 JSON 計數 (香港時間 UTC+8)，只記數量，不記個人內容 ----
function hkday(off = 0) { return new Date(Date.now() + 8 * 3600e3 - off * 86400e3).toISOString().slice(0, 10); }
async function bumpDay(kv, fields) {
  try {
    const k = 'm:' + hkday();
    const cur = JSON.parse(await kv.get(k) || '{}');
    for (const f in fields) cur[f] = (cur[f] || 0) + fields[f];
    await kv.put(k, JSON.stringify(cur), { expirationTtl: 60 * 60 * 24 * 400 });
  } catch (e) {}
}
function ymd() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
function ym() { return new Date().toISOString().slice(0, 7).replace('-', ''); }
function envInt(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }

class HttpError extends Error {
  constructor(status, code, extra) { super(code); this.status = status; this.code = code; this.extra = extra || {}; }
}

// ============ 計數：Durable Object `Limiter` (原子) ============
// 每個「計數 + 身分」一個 DO (計數鍵去掉尾段日期／時段，例如 rl:otpip:<ip>)，同一個 DO 入面嘅操作逐個排隊執行，並發請求唔會超額。
// DO 出錯 (例如免費方案當日額度用完) 時退回舊 KV 計數：非原子，只係盡力限流，唔會令全站停用。
function kvOf(env) { return env.CELLAR_KV || env.BOTTLE_KV; }
function limName(key) { return String(key).replace(/:\d{6,10}$/, ''); }
let limErrAt = 0;
async function limCall(env, key, body) {
  if (!env.LIMITER) throw new Error('LIMITER_NOT_BOUND');
  const stub = env.LIMITER.get(env.LIMITER.idFromName(limName(key)));
  const res = await stub.fetch('https://limiter/', { method: 'POST', body: JSON.stringify({ key, ...body }) });
  if (!res.ok) throw new Error('LIMITER_' + res.status);
  return res.json();
}
// DO 出錯記錄喺 ailast (後台「AI 最近一次錯誤」可見)，10 分鐘最多寫一次，避免故障期間狂寫 KV
async function limFailed(env, er) {
  if (Date.now() - limErrAt < 600_000) return;
  limErrAt = Date.now();
  try { await kvOf(env).put('ailast', JSON.stringify({ t: Date.now(), status: 0, model: 'limiter', msg: 'limiter: ' + String(er && er.message || er).slice(0, 280) }), { expirationTtl: 60 * 60 * 24 * 14 }); } catch (e) {}
}
// 舊 KV 計數 (只喺 DO 出錯時用)
async function kvUsed(kv, key) { return parseInt(await kv.get(key) || '0', 10); }
async function kvBump(kv, key, ttl) { await kv.put(key, String((await kvUsed(kv, key)) + 1), { expirationTtl: Math.max(60, ttl) }); }
async function kvHit(kv, key, limit, ttl) {
  if ((await kvUsed(kv, key)) >= limit) return false;
  await kvBump(kv, key, ttl);
  return true;
}

// 計一次；已達上限回 false
async function limTake(env, key, limit, ttl) {
  try { return (await limCall(env, key, { op: 'take', limit, ttl })).ok; }
  catch (er) { await limFailed(env, er); return kvHit(kvOf(env), key, limit, ttl); }
}
async function limitOrThrow(env, key, limit, ttl, code) {
  if (!(await limTake(env, key, limit, ttl))) throw new HttpError(429, code || 'RATE_LIMITED');
}
// 退還一次 limTake (同一請求後面嘅檢查失敗、請求被拒時用)
async function limRefund(env, key) {
  try { await limCall(env, key, { op: 'refund' }); } catch (er) { await limFailed(env, er); }
}
// 「成功先扣」：reserve 預留一次 (預留都計入上限，並發唔會超額)；成功 limCommit，失敗 limRelease；預留 5 分鐘未處理自動失效
async function limReserve(env, key, limit, ttl) {
  try { return { key, ttl, ...(await limCall(env, key, { op: 'reserve', limit, ttl })) }; }
  catch (er) {
    await limFailed(env, er);
    const used = await kvUsed(kvOf(env), key);
    return used < limit ? { key, ttl, ok: true, used: used + 1, ticket: 'kv' } : { key, ttl, ok: false, used };
  }
}
async function limCommit(env, r) {
  if (!r || !r.ok) return;
  if (r.ticket === 'kv') { try { await kvBump(kvOf(env), r.key, r.ttl); } catch (e) {} return; }
  try { await limCall(env, r.key, { op: 'commit', ticket: r.ticket, ttl: r.ttl }); } catch (er) { await limFailed(env, er); }
}
async function limRelease(env, r) {
  if (!r || !r.ok || r.ticket === 'kv') return;
  try { await limCall(env, r.key, { op: 'release', ticket: r.ticket }); } catch (er) { await limFailed(env, er); }
}
// 只讀 (額度顯示、後台)
async function limPeek(env, key) {
  try { return (await limCall(env, key, { op: 'peek' })).used; }
  catch (er) { await limFailed(env, er); return kvUsed(kvOf(env), key); }
}
async function limDelete(env, key) {
  try { await limCall(env, key, { op: 'del' }); } catch (er) { await limFailed(env, er); }
}
// OTP：驗證碼同錯誤次數放喺 DO，比對同加錯誤次數一次過完成；DO 出錯時一律當驗證失敗 (安全優先)
async function otpPut(env, email, h, exp) {
  try { await limCall(env, 'otp:' + email, { op: 'otpPut', h, exp }); }
  catch (er) { await limFailed(env, er); throw new HttpError(503, 'SERVICE_BUSY'); }
}
async function otpCheck(env, email, h) {
  try { return (await limCall(env, 'otp:' + email, { op: 'otpCheck', h })).r; }
  catch (er) { await limFailed(env, er); return 'none'; }
}

const LIM_SEED = /^(quota:|rl:verify:)/;
// 每個 DO 實例只處理一個 limName 底下嘅鍵；所有操作經 this.q 排隊，包括等 KV 遷移讀取期間
export class Limiter {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.q = Promise.resolve(); this.alarmOk = false; }
  async fetch(request) {
    let body;
    try { body = await request.json(); } catch (e) { return new Response('BAD_JSON', { status: 400 }); }
    const run = this.q.then(() => this.op(body));
    this.q = run.catch(() => {});
    try { return new Response(JSON.stringify(await run), { headers: { 'Content-Type': 'application/json' } }); }
    catch (e) { return new Response(String(e && e.message || e), { status: 500 }); }
  }
  async alarm() {
    const st = this.ctx.storage;
    let left = 0;
    for (const [k, r] of await st.list()) {
      if (!r || !r.exp) continue;
      if (r.exp < Date.now()) await st.delete(k); else left++;
    }
    if (left) await st.setAlarm(Date.now() + 86400e3);
  }
  async load(key) {
    const r = await this.ctx.storage.get(key);
    if (r && r.exp && r.exp < Date.now()) { await this.ctx.storage.delete(key); return null; }
    return r || null;
  }
  async save(key, r) {
    const st = this.ctx.storage;
    await st.put(key, r);
    if (r.exp && !this.alarmOk) {
      if ((await st.getAlarm()) == null) await st.setAlarm(Date.now() + 86400e3);
      this.alarmOk = true;
    }
  }
  // 第一次用某個計數：由舊 KV 帶入本月／今日已用次數 (遷移)，之後只用 DO
  async seedCount(key) {
    if (!LIM_SEED.test(key)) return 0;
    try { return Math.max(0, parseInt(await kvOf(this.env).get(key) || '0', 10) || 0); } catch (e) { return 0; }
  }
  async counter(key, ttl) {
    let r = await this.load(key);
    if (!r) r = { n: await this.seedCount(key), r: {}, exp: Date.now() + Math.max(60, Number(ttl) || 86400) * 1000 };
    const now = Date.now();
    for (const t in r.r) if (r.r[t] < now) delete r.r[t];
    return r;
  }
  async bonus(key) {
    let r = await this.load(key);
    if (!r) {
      let l = [];
      try { l = JSON.parse(await kvOf(this.env).get(key) || '[]'); } catch (e) {}
      r = { l: Array.isArray(l) ? l : [], r: {} };
    }
    const now = Date.now();
    r.l = r.l.filter(x => x && x.n > 0 && x.exp > now);
    for (const t in r.r) if (r.r[t] < now) delete r.r[t];
    return r;
  }
  async op(b) {
    const key = String(b.key || '');
    const now = Date.now();
    const used = r => r.n + Object.keys(r.r).length;
    switch (b.op) {
      case 'take': {
        const r = await this.counter(key, b.ttl);
        const u = used(r);
        if (u >= b.limit) return { ok: false, used: u };
        r.n++; await this.save(key, r);
        return { ok: true, used: u + 1 };
      }
      case 'refund': {
        const r = await this.load(key);
        if (r && r.n > 0) { r.n--; await this.save(key, r); }
        return { ok: true };
      }
      case 'reserve': {
        const r = await this.counter(key, b.ttl);
        const u = used(r);
        if (u >= b.limit) return { ok: false, used: u };
        const ticket = crypto.randomUUID();
        r.r[ticket] = now + 300_000;
        await this.save(key, r);
        return { ok: true, used: u + 1, ticket };
      }
      case 'commit': {
        if (key.startsWith('bonus:')) {
          const r = await this.bonus(key);
          delete r.r[b.ticket];
          const x = r.l.sort((p, q) => p.exp - q.exp).find(y => y.n > 0);
          if (x) x.n--;
          await this.save(key, r);
          return { ok: true };
        }
        // 預留過期都照扣：AI 已經成功回覆
        const r = await this.counter(key, b.ttl);
        delete r.r[b.ticket]; r.n++;
        await this.save(key, r);
        return { ok: true };
      }
      case 'release': {
        const r = await this.load(key);
        if (r && r.r && r.r[b.ticket]) { delete r.r[b.ticket]; await this.save(key, r); }
        return { ok: true };
      }
      case 'peek': {
        const r = await this.load(key);
        if (!r) return { used: await this.seedCount(key) };
        return { used: r.n + Object.values(r.r).filter(x => x >= now).length };
      }
      case 'del': await this.ctx.storage.delete(key); return { ok: true };
      case 'otpPut':
        await this.save(key, { h: String(b.h), tries: 0, exp: Number(b.exp) });
        return { ok: true };
      case 'otpCheck': {
        let r = await this.load(key);
        if (!r) {
          // 遷移：部署前已發出嘅驗證碼仲喺 KV
          try {
            const kv = kvOf(this.env);
            const raw = await kv.get(key);
            if (raw) { r = JSON.parse(raw); await kv.delete(key); }
          } catch (e) { r = null; }
        }
        if (!r || !r.h || now > r.exp) { await this.ctx.storage.delete(key); return { r: 'none' }; }
        if (r.tries >= 5) { await this.ctx.storage.delete(key); return { r: 'toomany' }; }
        if (!safeEqual(b.h, r.h)) { r.tries++; await this.save(key, r); return { r: 'bad' }; }
        await this.ctx.storage.delete(key);
        return { r: 'ok' };
      }
      case 'bonusList': {
        const r = await this.bonus(key);
        return { list: r.l, pending: Object.keys(r.r).length };
      }
      case 'bonusGrant': {
        const r = await this.bonus(key);
        r.l.push({ n: Number(b.n) || 0, src: String(b.src || ''), exp: now + (Number(b.days) || 90) * 86400000 });
        await this.save(key, r);
        return { ok: true };
      }
      case 'bonusReserve': {
        const r = await this.bonus(key);
        if (r.l.reduce((a, x) => a + x.n, 0) - Object.keys(r.r).length <= 0) return { ok: false };
        const ticket = crypto.randomUUID();
        r.r[ticket] = now + 300_000;
        await this.save(key, r);
        return { ok: true, ticket };
      }
    }
    throw new Error('BAD_OP');
  }
}
// AI 上游錯誤分類：繁忙 / 暫時故障 / 回覆壞咗 可以轉另一個模型再試；403 等其他錯誤唔重試
function aiStatus(er) { return Number(er && er.status) || 0; }
function aiRetryable(er) { const s = aiStatus(er); return !!er && (er.message === 'AI_BAD_JSON' || s === 0 || s === 429 || s === 529 || s >= 500); }
function aiBusy(er) { const s = aiStatus(er); return s === 429 || s === 529; }
function aiHttpError(er) { return aiBusy(er) ? new HttpError(503, 'AI_BUSY') : new HttpError(502, 'AI_UPSTREAM_ERROR'); }

async function readJson(request, maxBytes = 2_000_000) {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'PAYLOAD_TOO_LARGE');
  try { return JSON.parse(text || '{}'); } catch (e) { throw new HttpError(400, 'BAD_JSON'); }
}

// ============ 登入 session ============
async function getSession(request, kv) {
  const h = request.headers.get('Authorization') || '';
  const m = /^Bearer\s+([0-9a-f]{64})$/i.exec(h);
  if (!m) return null;
  const raw = await kv.get('session:' + await sha256hex(m[1]));
  if (!raw) return null;
  let s; try { s = JSON.parse(raw); } catch (e) { return null; }
  const ver = parseInt(await kv.get('sessver:' + s.email) || '0', 10);
  if (ver !== (s.v || 0)) return null;
  return s;
}
async function createSession(kv, email) {
  const token = randomHex(32);
  const v = parseInt(await kv.get('sessver:' + email) || '0', 10);
  await kv.put('session:' + await sha256hex(token), JSON.stringify({ email, v, t: Date.now() }), { expirationTtl: 60 * 60 * 24 * 90 });
  return token;
}
// 帳號綁定的 syncKey 必須由已登入 session 操作；訪客 (未綁定) 以高熵 syncKey 為憑
async function requireKeyAccess(request, kv, syncKey) {
  if (!syncKey || typeof syncKey !== 'string') throw new HttpError(400, 'MISSING_SYNC_KEY');
  const owner = await kv.get('keyowner:' + syncKey);
  if (!owner) {
    if (!isStrongKey(syncKey)) throw new HttpError(400, 'WEAK_SYNC_KEY');
    return { owner: null, session: null };
  }
  const s = await getSession(request, kv);
  if (!s || s.email !== owner) throw new HttpError(401, 'AUTH_REQUIRED');
  return { owner, session: s };
}
async function requireSession(request, kv) {
  const s = await getSession(request, kv);
  if (!s) throw new HttpError(401, 'AUTH_REQUIRED');
  const userKey = await kv.get('account:' + s.email);
  if (!userKey) throw new HttpError(401, 'AUTH_REQUIRED');
  return { session: s, email: s.email, userKey };
}

// 將舊的弱同步碼換成高熵同步碼 (搬資料 + 更新擁有者標記 + 探索池擁有者)
async function rotateKey(env, kv, email, oldKey) {
  const newKey = newSyncKey();
  // 相片擁有者由同步碼計出，換碼後舊相唔會搬：記低舊擁有者，刪帳號時一併清走
  try {
    const po = JSON.parse(await kv.get('photoowners:' + email) || '[]');
    const old = await photoOwnerOf(oldKey);
    if (!po.includes(old)) po.push(old);
    await kv.put('photoowners:' + email, JSON.stringify(po.slice(-50)));
  } catch (e) {}
  const raw = await kv.get('user:' + oldKey);
  if (raw) await kv.put('user:' + newKey, raw);
  await kv.put('account:' + email, newKey);
  await kv.put('keyowner:' + newKey, email);
  await kv.delete('keyowner:' + oldKey);
  await kv.delete('user:' + oldKey);
  await kv.delete('public_cellar:' + oldKey);
  const oldShare = await shareIdOf(oldKey);
  const newShare = await shareIdOf(newKey);
  await kv.delete('public_cellar:' + oldShare);
  // 探索池：改擁有者 (舊分享連結失效，但自己的分享仍可收回)
  const list = await kv.list({ prefix: 'exp:', limit: 500 });
  for (const k of list.keys) {
    if (k.metadata && k.metadata.o === oldShare) {
      const v = await kv.get(k.name);
      if (v) {
        try { const it = JSON.parse(v); it.ownerShareId = newShare; await kv.put(k.name, JSON.stringify(it), { metadata: { ...k.metadata, o: newShare }, expirationTtl: 60 * 60 * 24 * 90 }); } catch (e) {}
      }
    }
  }
  return newKey;
}

// ============ 掃描配額 ============
async function scanTier(request, kv, env) {
  const s = await getSession(request, kv);
  if (s) {
    const pl = await planOf(kv, s.email);
    if (pl.plan === 'pro') return { tier: 'pro', id: 'u:' + s.email, email: s.email, limit: envInt(env.SCAN_PRO_MONTHLY, 1000) };
    return { tier: 'free', id: 'u:' + s.email, email: s.email, limit: envInt(env.SCAN_FREE_MONTHLY, 40) };
  }
  const k = request.headers.get('X-Sync-Key') || '';
  const gid = 'g:' + (await sha256hex(isStrongKey(k) ? k : 'anon:' + clientIp(request))).slice(0, 24);
  // 訪客另加 IP 層上限：同步碼可以隨意新造，單靠同步碼計額度會被無限繞過
  const ipId = 'gi:' + (await sha256hex('anon:' + clientIp(request))).slice(0, 24);
  return { tier: 'guest', id: gid, ipId, email: null, limit: envInt(env.SCAN_GUEST_MONTHLY, 8), ipLimit: envInt(env.SCAN_GUEST_IP_MONTHLY, 24) };
}

// ============ 酒款圖片索引：探索池內其他酒友公開嘅酒瓶相 ============
const IMG_STOP = new Set(['year', 'years', 'old', 'the', 'single', 'malt', 'whisky', 'whiskey', 'wine', 'and', 'de', 'la', 'le', 'des', 'du', 'of', 'nv', 'limited', 'edition', 'reserve', 'cask', 'strength', 'bottle']);
function nameToks(s2) { return [...new Set(String(s2 || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9\u4e00-\u9fff]+/).filter(x => x.length >= (/[\u4e00-\u9fff]/.test(x) ? 2 : 2) && !IMG_STOP.has(x)))].slice(0, 8); }
async function expImgAdd(kv, clean) {
  try {
    if (!clean || !clean.image || !/^https:\/\//.test(clean.image)) return;
    const idn = clean.identification || {};
    const toks = nameToks((idn.name || '') + ' ' + (idn.producer || ''));
    if (toks.length < 2) return;
    const cur = JSON.parse(await kv.get('expimg:index') || '[]').filter(e => e.id !== clean.id);
    cur.unshift({ id: clean.id, k: toks, img: clean.image, t: Date.now() });
    await kv.put('expimg:index', JSON.stringify(cur.slice(0, 250)), { expirationTtl: 60 * 60 * 24 * 120 });
  } catch (e) {}
}
async function expImgRemove(kv, id) {
  try { const raw = await kv.get('expimg:index'); if (!raw) return; await kv.put('expimg:index', JSON.stringify(JSON.parse(raw).filter(e => e.id !== id)), { expirationTtl: 60 * 60 * 24 * 120 }); } catch (e) {}
}
async function expImgIndex(kv) {
  let raw = await kv.get('expimg:index');
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  // 首次：由現有公開項目建立 (最多取 40 項，避免過多子請求)
  const l = await kv.list({ prefix: 'exp:', limit: 300 });
  const keys = l.keys.filter(k => !(k.metadata && k.metadata.h)).sort((a, b) => ((b.metadata && b.metadata.t) || 0) - ((a.metadata && a.metadata.t) || 0)).slice(0, 40);
  const out = [];
  for (const v of await Promise.all(keys.map(k => kv.get(k.name)))) {
    if (!v) continue;
    try { const it = JSON.parse(v); const idn = it.identification || {}; const toks = nameToks((idn.name || '') + ' ' + (idn.producer || '')); if (it.image && /^https:\/\//.test(it.image) && toks.length >= 2) out.push({ id: it.id, k: toks, img: it.image, t: it.publishedAt || 0 }); } catch (e) {}
  }
  try { await kv.put('expimg:index', JSON.stringify(out), { expirationTtl: 60 * 60 * 24 * 120 }); } catch (e) {}
  return out;
}
function expImgMatch(index, want) {
  if (!want.length) return null;
  const nums = want.filter(w => /^\d+$/.test(w));
  let best = null, bestScore = 0;
  for (const e of index) {
    const set = new Set(e.k);
    const hit = want.filter(w => set.has(w)).length;
    const enums = e.k.filter(w => /^\d+$/.test(w));
    if (nums.length && enums.length && !nums.some(n => enums.includes(n))) continue; // 年數/年份不同 = 不同酒款
    const need = Math.max(2, Math.ceil(Math.min(want.length, e.k.length) * 0.66));
    if (hit >= need && hit > bestScore) { best = e; bestScore = hit; }
  }
  return best ? best.img : null;
}

// ============ AI 下一支推薦 ============
const RECO_PROMPT = `你是一位世界級侍酒師。下面是用戶酒窖的摘要（只含酒款屬性，不含任何個人資料）。
請分析他的口味偏好（品類、產地、風格）、價格帶與評分，推薦他「下一支值得試」的 4 支酒。

規則：
1. 只推薦真實存在、市面上買得到的具體酒款（寫出完整名稱與酒莊/品牌），不要虛構。
2. 不可推薦他已擁有或已在願望清單內的酒款。
3. 4 支的組合：2 支「安全牌」(貼近他已喜歡的風格)、1 支「小跳躍」(同風格但換產區或品類，擴闊口味)、1 支「高性價比」(同類裡價錢明顯較低而品質好)。
4. 價格要落在他現有酒款的價格帶附近，除非 tag 係「小跳躍」；price_usd 為零售參考價範圍 [低, 高]（美元整數）。
5. why：一句話說明為何適合他，要引用他酒窖裡的具體線索（例如「你收藏了 3 支蘇格蘭威士忌」）。

只輸出嚴格純 JSON，不要 markdown：
{"summary":"一句話總結他的口味畫像","picks":[{"tag":"安全牌|小跳躍|高性價比","name":"完整酒名","producer":"酒莊/品牌","category":"品類","country":"國家(繁體中文)","region":"產區(繁體中文)","country_en":"English","region_en":"English","vintage":"年份或NV","why":"一句話","price_usd":[低,高]}]}`;
const RECO_EN = `

[LANGUAGE] The user reads English. Write "summary" and every "why" in plain, elegant English (one sentence each). Keep category, country, region in Traditional Chinese as specified, and still fill country_en / region_en.`;
function cleanReco(o) {
  if (!o || !Array.isArray(o.picks)) return null;
  const picks = o.picks.slice(0, 5).map(p => {
    const pr = Array.isArray(p.price_usd) ? p.price_usd.map(Number).filter(x => isFinite(x) && x > 0) : [];
    return {
      tag: clip(String(p.tag || ''), 12), name: clip(String(p.name || ''), 140), producer: clip(String(p.producer || ''), 80),
      category: clip(String(p.category || ''), 30), country: clip(String(p.country || ''), 40), region: clip(String(p.region || ''), 60),
      country_en: clip(String(p.country_en || ''), 40), region_en: clip(String(p.region_en || ''), 60),
      vintage: clip(String(p.vintage || ''), 12), why: clip(String(p.why || ''), 200),
      price_usd: pr.length >= 2 ? [Math.round(pr[0]), Math.round(pr[1])] : null
    };
  }).filter(p => p.name);
  return picks.length ? { summary: clip(String(o.summary || ''), 200), picks } : null;
}

// ============ 探索池 ============
const EXP_TTL = 60 * 60 * 24 * 90;
function sanitizeExploreItem(b, id, ownerShareId, origin) {
  const idn = (b.identification && typeof b.identification === 'object') ? b.identification : {};
  const ident = {};
  for (const k of ['name', 'producer', 'country', 'region', 'country_en', 'region_en', 'vintage', 'category', 'abv', 'vol']) {
    if (idn[k] !== undefined && idn[k] !== null) ident[k] = clip(String(idn[k]), 160);
  }
  let image = '';
  if (typeof b.image === 'string') {
    if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.image) && b.image.length <= 450_000) image = b.image;
    else if (b.image.startsWith(origin + '/api/photo/') && /^https:\/\/[^\s"'<>]{1,300}$/.test(b.image)) image = b.image;
  }
  const rating = Math.min(5, Math.max(1, Math.round(Number(b.personalRating) || 5)));
  return {
    id,
    ownerShareId,
    author: clip(b.author, 40) || '品飲同好',
    identification: ident,
    image,
    personalRating: rating,
    diary: { notes: clip(b.diary && b.diary.notes, 1000) },
    location: clip(b.location, 120),
    tastingLocation: clip(b.tastingLocation, 120),
    publishedAt: Date.now()
  };
}

// ============ 商戶 / 贊助建議 ============
let merchantCache = { t: 0, list: [] };
async function loadMerchants(kv) {
  if (Date.now() - merchantCache.t < 60_000) return merchantCache.list;
  const l = await kv.list({ prefix: 'merchant:', limit: 100 });
  const out = [];
  for (const k of l.keys) {
    const v = await kv.get(k.name);
    if (!v) continue;
    try { const m = JSON.parse(v); if (m && m.active !== false) out.push(m); } catch (e) {}
  }
  merchantCache = { t: Date.now(), list: out };
  return out;
}
function tokens(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9一-鿿぀-ヿ]+/).filter(t => t.length >= 2);
}
function scoreProduct(p, q) {
  let s = 0, exact = false;
  const qt = new Set([...tokens(q.name), ...tokens(q.producer)]);
  const pt = new Set([...tokens(p.n), ...(p.tags || []).flatMap(tokens)]);
  let overlap = 0; qt.forEach(t => { if (pt.has(t)) overlap++; });
  if (overlap >= 2 || (qt.size && overlap === qt.size)) { s += 6; exact = true; }
  else if (overlap === 1) s += 2;
  if (p.cat && q.category && p.cat === q.category) s += 3;
  if (p.country && q.country && String(p.country).toLowerCase() === String(q.country).toLowerCase()) s += 2;
  if (p.region && q.region && (String(q.region).toLowerCase().includes(String(p.region).toLowerCase()) || String(p.region).toLowerCase().includes(String(q.region).toLowerCase()))) s += 3;
  return { s, exact };
}
async function bumpStat(kv, mid, kind) {
  const key = `stat:${mid}:${ym()}:${kind}`;
  const cur = parseInt(await kv.get(key) || '0', 10);
  await kv.put(key, String(cur + 1), { expirationTtl: 60 * 60 * 24 * 400 });
}

// ============ 年齡 / 額度 / 邀請 / 審查 工具 ============
function validBirthday(b) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b || ''))) return false;
  const d = new Date(b + 'T00:00:00Z');
  return !isNaN(d) && d.getUTCFullYear() >= 1900 && d.getTime() <= Date.now();
}
function ageOf(b) {
  const d = new Date(b + 'T00:00:00Z'), n = new Date();
  let a = n.getUTCFullYear() - d.getUTCFullYear();
  const m = n.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && n.getUTCDate() < d.getUTCDate())) a--;
  return a;
}
function minAge(env) { return envInt(env.MIN_AGE, 18); }
async function ipHash(ip) { return (await sha256hex('ip:' + ip)).slice(0, 16); }

async function planOf(kv, email) {
  if ((await kv.get('plan:' + email)) === 'pro') return { plan: 'pro', proUntil: 0 };
  const u = parseInt(await kv.get('proUntil:' + email) || '0', 10);
  if (u > Date.now()) return { plan: 'pro', proUntil: u };
  return { plan: 'free', proUntil: 0 };
}
// 獎勵次數放喺 Limiter DO (bonus:<email>)；第一次讀取時由舊 KV 帶入。DO 出錯時當冇獎勵、派獎回 503
async function loadBonus(env, email) {
  try { return (await limCall(env, 'bonus:' + email, { op: 'bonusList' })).list; }
  catch (er) { await limFailed(env, er); return []; }
}
async function grantBonus(env, email, n, src, days = 90) {
  try { await limCall(env, 'bonus:' + email, { op: 'bonusGrant', n, src, days }); }
  catch (er) { await limFailed(env, er); throw new HttpError(503, 'SERVICE_BUSY'); }
}
async function bonusBalance(env, email) { return (await loadBonus(env, email)).reduce((a, x) => a + x.n, 0); }
// 預留一次獎勵；之後用 limCommit / limRelease
async function bonusReserve(env, email) {
  const key = 'bonus:' + email;
  try { return { key, ...(await limCall(env, key, { op: 'bonusReserve' })) }; }
  catch (er) { await limFailed(env, er); return { key, ok: false }; }
}
async function ensureRefCode(kv, email) {
  let c = await kv.get('refcode:' + email);
  if (c) return c;
  for (let i = 0; i < 5; i++) {
    c = randomHex(4).toUpperCase();
    if (!(await kv.get('refowner:' + c))) break;
  }
  await kv.put('refcode:' + email, c);
  await kv.put('refowner:' + c, email);
  return c;
}
// 被邀請者：驗證電郵 + 完成首次掃描 + 註冊滿 3 日，雙方先派獎
async function evaluateReferral(kv, env, email) {
  const raw = await kv.get('refpending:' + email);
  if (!raw) return null;
  let r; try { r = JSON.parse(raw); } catch (e) { await kv.delete('refpending:' + email); return null; }
  if (Date.now() < r.eligibleAt || !(await kv.get('scanned:' + email))) return null;
  await kv.delete('refpending:' + email);
  const n = envInt(env.REF_REWARD, 10);
  try { await grantBonus(env, email, n, 'referral'); } catch (er) { await kv.put('refpending:' + email, raw, { expirationTtl: 60 * 60 * 24 * 60 }); throw er; }
  const ck = `refcap:${r.owner}:${ym()}`;
  const cnt = parseInt(await kv.get(ck) || '0', 10);
  const ownerIp = await kv.get('lastip:' + r.owner);
  if (cnt < envInt(env.REF_MONTHLY_CAP, 10) && !(ownerIp && ownerIp === r.ip)) {
    await grantBonus(env, r.owner, n, 'referral');
    await kv.put(ck, String(cnt + 1), { expirationTtl: 60 * 60 * 24 * 40 });
    await kv.put('refcount:' + r.owner, String(parseInt(await kv.get('refcount:' + r.owner) || '0', 10) + 1));
  }
  return { n };
}
// 壽星 / 節日活動 / 邀請獎勵：登入後自動入帳，回傳今次新入帳項目
async function grantDue(kv, env, email, profile) {
  const granted = [];
  const now = new Date();
  if (profile && validBirthday(profile.birthday) && profile.birthday.slice(5, 7) === String(now.getUTCMonth() + 1).padStart(2, '0')) {
    const k = `bday:${email}:${now.getUTCFullYear()}`;
    if (!(await kv.get(k))) {
      await kv.put(k, '1', { expirationTtl: 60 * 60 * 24 * 400 });
      const n = envInt(env.BDAY_BONUS, 10);
      try { await grantBonus(env, email, n, 'birthday'); } catch (er) { await kv.delete(k); throw er; }
      granted.push({ src: 'birthday', n });
    }
  }
  const cl = await kv.list({ prefix: 'campaign:', limit: 50 });
  for (const k of cl.keys) {
    const v = await kv.get(k.name);
    if (!v) continue;
    let c; try { c = JSON.parse(v); } catch (e) { continue; }
    if (Date.now() < c.start || Date.now() > c.end) continue;
    const ck = `claimed:${c.id}:${email}`;
    if (await kv.get(ck)) continue;
    await kv.put(ck, '1', { expirationTtl: 60 * 60 * 24 * 400 });
    try { await grantBonus(env, email, c.bonus, 'campaign:' + c.id); } catch (er) { await kv.delete(ck); throw er; }
    granted.push({ src: 'campaign', name: c.name, n: c.bonus });
  }
  const rr = await evaluateReferral(kv, env, email);
  if (rr) granted.push({ src: 'referral', n: rr.n });
  return granted;
}

function toBase64(buf) {
  const u8 = new Uint8Array(buf); let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function sniffMime(u8) {
  if (u8[0] === 0xFF && u8[1] === 0xD8) return 'image/jpeg';
  if (u8[0] === 0x89 && u8[1] === 0x50) return 'image/png';
  if (u8[0] === 0x52 && u8[1] === 0x49 && u8[8] === 0x57) return 'image/webp';
  return null;
}
async function loadImageBytes(env, kv, origin, image) {
  if (image.startsWith('data:')) {
    const b64 = image.split(',')[1] || '';
    const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8.buffer;
  }
  const pre = origin + '/api/photo/';
  if (image.startsWith(pre)) {
    const id = image.slice(pre.length);
    if (!/^[0-9a-f]{12}\/[0-9a-f]{24}$/.test(id)) return null;
    if (env.PHOTOS) { const o = await env.PHOTOS.get('photos/' + id); return o ? await o.arrayBuffer() : null; }
    const r = await kv.getWithMetadata('photo:' + id, 'arrayBuffer');
    return r.value || null;
  }
  return null;
}
async function callClaude(env, model, content, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content }] })
  });
  if (!res.ok) { let body = ''; try { body = (await res.text()).slice(0, 300); } catch (e) {} const er = new Error('AI_UPSTREAM_' + res.status); er.status = res.status; er.body = body; er.model = model; throw er; }
  const data = await res.json();
  // 模型可能先回傳 thinking 區塊：取所有 text 區塊合併，而不是只讀第一個
  const txt = (Array.isArray(data.content) ? data.content : []).filter(c => c && typeof c.text === 'string' && (!c.type || c.type === 'text')).map(c => c.text || '').join('\n');
  if (!txt) { lastEmpty = { stop: data.stop_reason || '', types: (data.content || []).map(c => c && c.type).join(',') }; }
  return txt;
}
let lastEmpty = null;
function extractJson(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(text.substring(a, b + 1)); } catch (e) { return null; }
}
// 公開前自動審查：相片須係酒類相、冇不雅/暴力/違法；文字冇騷擾/廣告垃圾。失敗一律「待覆核」，唔會直接公開
async function moderateExploreItem(env, kv, origin, clean) {
  if (!env.ANTHROPIC_API_KEY) return { v: 'pending' };
  try {
    const content = [];
    if (clean.image) {
      const buf = await loadImageBytes(env, kv, origin, clean.image);
      if (!buf || buf.byteLength > 3_500_000) return { v: 'pending' };
      const mime = sniffMime(new Uint8Array(buf));
      if (!mime) return { v: 'reject' };
      content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: toBase64(buf) } });
    }
    const textBlob = [clean.author, clean.identification.name, clean.identification.producer, clean.diary.notes, clean.location].join(' | ');
    content.push({ type: 'text', text: 'You are a strict content moderator for a public wine/spirits sharing feed. Reply with JSON only: {"alcohol_related": boolean (the photo shows an alcoholic drink, bottle, label or glass; true if there is no photo), "unsafe": boolean (nudity, sexual content, minors in unsafe context, gore/violence, illegal items, hateful or harassing content in photo or text), "spam": boolean (ads, links, contact info, scams in text)}.\nText fields: ' + textBlob.slice(0, 1500) });
    const out = extractJson(await callClaude(env, env.MOD_MODEL || 'claude-haiku-5-5', content, 120));
    if (!out) return { v: 'pending' };
    if (out.unsafe) return { v: 'reject' };
    if (clean.image && out.alcohol_related === false) return { v: 'not_alcohol' };
    if (out.spam) return { v: 'pending' };
    return { v: 'ok' };
  } catch (e) { return { v: 'pending' }; }
}

// ============ 郵件：Resend (RESEND_API_KEY + MAIL_FROM) 優先，否則 Google Apps Script ============
async function sendEmailViaResend(env, { to, code, type, name }) {
  const isReg = type === 'register';
  const html = `<div style="background:#11120D;padding:28px;font-family:-apple-system,Segoe UI,sans-serif;color:#e8e6dc">
  <div style="max-width:420px;margin:auto;border:1px solid #3a3520;border-radius:14px;padding:26px;background:#181912">
    <div style="color:#D4AF37;font-size:20px;letter-spacing:2px;font-weight:700">BOTTLESENSE</div>
    <p style="margin:18px 0 6px">${isReg ? '歡迎加入' : '你好'}，${String(name).replace(/[<>&"]/g, '')}</p>
    <p style="margin:0 0 14px;color:#b8b6a8">你的驗證碼（10 分鐘內有效）：</p>
    <div style="font-size:34px;letter-spacing:8px;color:#D4AF37;font-weight:700;text-align:center;padding:14px;border:1px dashed #D4AF37;border-radius:10px">${code}</div>
    <p style="margin:16px 0 0;color:#8a8a80;font-size:12px">如非本人操作，請忽略此郵件。請勿將驗證碼告訴任何人。</p>
  </div></div>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject: `BottleSense 驗證碼 ${code}`, html })
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: 'RESEND_' + res.status };
  } catch (e) { return { ok: false, error: 'RESEND_FETCH_FAILED' }; }
}
async function sendEmail(env, args) {
  if (env.RESEND_API_KEY && env.MAIL_FROM) return sendEmailViaResend(env, args);
  return sendEmailViaGAS(env, args);
}

// ============ 主程式 ============
export default {
  async fetch(request, env, ctx) {
    const og = allowedOrigin(request, env);
    const corsHeaders = {
      'Access-Control-Allow-Origin': og.origin && og.ok ? og.origin : (og.origin ? 'null' : '*'),
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key',
    };
    const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
    const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...extra } });

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (!og.ok) return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403);

    const url = new URL(request.url);
    const path = url.pathname;
    const kv = env.CELLAR_KV || env.BOTTLE_KV;
    if (!kv) return json({ error: 'KV_NOT_BOUND' }, 500);
    const ip = clientIp(request);

    try {
      // ---------- 認證 ----------
      if (path === '/api/auth/send-otp' && request.method === 'POST') {
        const { email, name, gender, birthday, type } = await readJson(request, 10_000);
        const e = String(email || '').toLowerCase().trim();
        if (!isEmail(e)) throw new HttpError(400, 'INVALID_EMAIL');
        if (type === 'register') {
          if (!validBirthday(birthday)) throw new HttpError(400, 'BIRTHDAY_REQUIRED');
          if (ageOf(birthday) < minAge(env)) throw new HttpError(403, 'UNDER_AGE', { minAge: minAge(env) });
        }
        if (await kv.get('ban:' + e)) throw new HttpError(403, 'BANNED');
        await limitOrThrow(env, `rl:otpip:${ip}:${ymd()}${new Date().getUTCHours()}`, 20, 3600, 'RATE_LIMITED_IP');
        await limitOrThrow(env, `rl:otpem:${e}:${ymd()}${new Date().getUTCHours()}`, 5, 3600, 'RATE_LIMITED_EMAIL');
        if (!(await limTake(env, 'otpcd:' + e, 1, 60))) throw new HttpError(429, 'COOLDOWN');

        const otp = randomOtp();
        await otpPut(env, e, await sha256hex(otp + ':' + e), Date.now() + 600_000);
        if (name || birthday || gender) {
          await kv.put('pending_reg:' + e, JSON.stringify({ name: clip(name, 60), gender: clip(gender, 20), birthday: validBirthday(birthday) ? birthday : '' }), { expirationTtl: 600 });
        }
        const mailRes = await sendEmail(env, { to: e, code: otp, type: clip(type, 20) || 'otp', name: clip(name, 60) || e.split('@')[0] });
        const devMode = env.DEV_MODE === '1';
        if (!mailRes.ok && !devMode) {
          await limDelete(env, 'otp:' + e);
          return json({ error: 'EMAIL_SEND_FAILED: ' + (mailRes.error || 'unknown') }, 502);
        }
        return json({ success: true, emailSent: mailRes.ok, devOtp: (!mailRes.ok && devMode) ? otp : undefined });
      }

      if (path === '/api/auth/check-email' && request.method === 'POST') {
        const { email } = await readJson(request, 5_000);
        await limitOrThrow(env, `rl:chk:${ip}:${ymd()}${new Date().getUTCHours()}`, 30, 3600);
        const e = String(email || '').toLowerCase().trim();
        return json({ exists: isEmail(e) ? !!(await kv.get('account:' + e)) : false });
      }

      if (path === '/api/auth/verify-otp' && request.method === 'POST') {
        const { email, otp, syncKey, localCellar, localDeleted, ref } = await readJson(request, 24_000_000);
        const e = String(email || '').toLowerCase().trim();
        await limitOrThrow(env, `rl:ver:${ip}:${ymd()}${new Date().getUTCHours()}`, 40, 3600, 'RATE_LIMITED_IP');
        const bad = () => json({ error: '驗證碼無效或已過期，請重新發送。' }, 400);
        // 比對同加錯誤次數喺 DO 入面一次過完成，並發猜碼都只會計夠 5 次
        const chk = await otpCheck(env, e, await sha256hex(String(otp || '') + ':' + e));
        if (chk === 'toomany') return json({ error: '嘗試次數過多，請重新發送驗證碼。' }, 429);
        if (chk !== 'ok') return bad();

        let userKey = await kv.get('account:' + e);
        let pendingInfo = {};
        const pendingRaw = await kv.get('pending_reg:' + e);
        if (pendingRaw) { try { pendingInfo = JSON.parse(pendingRaw); } catch (er) {} await kv.delete('pending_reg:' + e); }

        const incoming = Array.isArray(localCellar) ? localCellar : [];
        let profileData;
        let cellar, deleted;
        if (userKey) {
          if (!isStrongKey(userKey)) userKey = await rotateKey(env, kv, e, userKey);
          await kv.put('keyowner:' + userKey, e);
          const m = await userMerge(env, userKey, { cellar: incoming, deleted: localDeleted });
          profileData = m.profile || {};
          cellar = m.cellar; deleted = m.deleted;
        } else {
          let k = isStrongKey(syncKey) ? syncKey : null;
          if (k) { const o = await kv.get('keyowner:' + k); if (o && o !== e) k = null; }
          userKey = k || newSyncKey();
          await kv.put('account:' + e, userKey);
          await kv.put('keyowner:' + userKey, e);
          profileData = {
            email: e,
            name: pendingInfo.name || e.split('@')[0],
            birthday: pendingInfo.birthday || '',
            gender: pendingInfo.gender || 'unspecified'
          };
          const m = await userMerge(env, userKey, { cellar: incoming, deleted: localDeleted, profileMode: 'set', profile: profileData });
          cellar = m.cellar; deleted = m.deleted;
          await bumpDay(kv, { signup: 1 });
          const rc = String(ref || '').toUpperCase();
          if (/^[0-9A-F]{8}$/.test(rc) && !(await kv.get('refclaimed:' + e))) {
            const refOwner = await kv.get('refowner:' + rc);
            if (refOwner && refOwner !== e) {
              await kv.put('refclaimed:' + e, '1');
              await kv.put('refpending:' + e, JSON.stringify({ owner: refOwner, ip: await ipHash(ip), eligibleAt: Date.now() + 3 * 86400000 }), { expirationTtl: 60 * 60 * 24 * 60 });
            }
          }
        }
        await kv.put('lastip:' + e, await ipHash(ip), { expirationTtl: 60 * 60 * 24 * 90 });
        await bumpDay(kv, { login: 1 });
        const token = await createSession(kv, e);
        const grantedNow = await grantDue(kv, env, e, profileData).catch(() => []);
        const pl = await planOf(kv, e);
        return json({
          success: true, email: e,
          name: profileData.name || pendingInfo.name || e.split('@')[0],
          birthday: profileData.birthday || pendingInfo.birthday || '',
          gender: profileData.gender || pendingInfo.gender || 'unspecified',
          syncKey: userKey, token, cellar, deleted,
          plan: pl.plan, proUntil: pl.proUntil, granted: grantedNow,
          birthdayLocked: validBirthday(profileData.birthday)
        });
      }

      if (path === '/api/auth/logout' && request.method === 'POST') {
        const h = request.headers.get('Authorization') || '';
        const m = /^Bearer\s+([0-9a-f]{64})$/i.exec(h);
        if (m) await kv.delete('session:' + await sha256hex(m[1]));
        return json({ success: true });
      }

      // 登出所有裝置 + 更換同步碼 (舊分享連結同時失效)
      if (path === '/api/auth/logout-all' && request.method === 'POST') {
        const { email, userKey } = await requireSession(request, kv);
        const ver = parseInt(await kv.get('sessver:' + email) || '0', 10) + 1;
        await kv.put('sessver:' + email, String(ver));
        const newKey = await rotateKey(env, kv, email, userKey);
        const token = await createSession(kv, email);
        return json({ success: true, syncKey: newKey, token });
      }

      // 讀取目前身分的 AI 辨識額度 (訪客 / 免費 / Pro 皆可；只讀，不計次)
      if (path === '/api/quota' && request.method === 'GET') {
        const tier = await scanTier(request, kv, env);
        try {
          const ak = `act:${hkday()}:${await ipHash(ip)}`;
          if (!(await kv.get(ak))) { await kv.put(ak, '1', { expirationTtl: 172800 }); await bumpDay(kv, { active: 1 }); }
        } catch (e) {}
        const used = await limPeek(env, `quota:${tier.id}:${ym()}`);
        return json({ tier: tier.tier, used, limit: tier.limit, bonus: tier.email ? await bonusBalance(env, tier.email) : 0 });
      }

      if (path === '/api/me' && request.method === 'GET') {
        const { email, userKey } = await requireSession(request, kv);
        const rec = parseUserRecord(await kv.get('user:' + userKey));
        const granted = await grantDue(kv, env, email, rec.profile).catch(() => []);
        await kv.put('lastip:' + email, await ipHash(ip), { expirationTtl: 60 * 60 * 24 * 90 });
        const pl = await planOf(kv, email);
        const limit = pl.plan === 'pro' ? envInt(env.SCAN_PRO_MONTHLY, 1000) : envInt(env.SCAN_FREE_MONTHLY, 40);
        return json({
          email, plan: pl.plan, proUntil: pl.proUntil,
          bonus: await bonusBalance(env, email),
          quota: { used: await limPeek(env, `quota:u:${email}:${ym()}`), limit },
          refCode: await ensureRefCode(kv, email),
          refCount: parseInt(await kv.get('refcount:' + email) || '0', 10),
          birthday: rec.profile.birthday || '', birthdayLocked: validBirthday(rec.profile.birthday),
          minAge: minAge(env), granted
        });
      }

      if (path === '/api/profile/update' && request.method === 'POST') {
        const { name, gender, birthday } = await readJson(request, 10_000);
        const { email, userKey } = await requireSession(request, kv);
        const r = parseUserRecord(await kv.get('user:' + userKey));
        let bd = r.profile.birthday || '';
        // 生日只可設定一次，之後鎖死 (需要更正請聯絡管理員)
        if (!validBirthday(bd) && birthday) {
          if (!validBirthday(birthday)) throw new HttpError(400, 'BIRTHDAY_REQUIRED');
          if (ageOf(birthday) < minAge(env)) throw new HttpError(403, 'UNDER_AGE', { minAge: minAge(env) });
          bd = birthday;
        }
        r.profile = {
          ...r.profile, email,
          name: clip(name, 60) || r.profile.name,
          gender: clip(gender, 20) || r.profile.gender,
          birthday: bd
        };
        await userMerge(env, userKey, { profileMode: 'patch', profile: r.profile });
        return json({ success: true, birthday: bd, birthdayLocked: validBirthday(bd) });
      }

      if (path === '/api/account/delete' && request.method === 'POST') {
        const { email, userKey } = await requireSession(request, kv);
        const share = await shareIdOf(userKey);
        await kv.delete('user:' + userKey);
        await kv.delete('public_cellar:' + share);
        await kv.delete('keyowner:' + userKey);
        await kv.delete('account:' + email);
        await kv.delete('otp:' + email);
        await limDelete(env, 'otp:' + email);
        await limDelete(env, 'bonus:' + email);
        for (const k of ['plan:', 'proUntil:', 'bonus:', 'lastip:', 'scanned:', 'refpending:', 'pubban:', 'modstrike:']) await kv.delete(k + email);
        const rcode = await kv.get('refcode:' + email);
        if (rcode) { await kv.delete('refowner:' + rcode); await kv.delete('refcode:' + email); }
        await kv.put('sessver:' + email, String(parseInt(await kv.get('sessver:' + email) || '0', 10) + 1), { expirationTtl: 60 * 60 * 24 * 100 });
        let owners = [await photoOwnerOf(userKey)];
        try { owners = [...new Set([...owners, ...JSON.parse(await kv.get('photoowners:' + email) || '[]')])]; } catch (e) {}
        await deleteExploreOf(kv, share, owners);
        for (const o of owners) await deletePhotosOf(env, kv, o);
        await kv.delete('photoowners:' + email);
        return json({ success: true });
      }

      // ---------- 酒窖分享 ----------
      if (path === '/api/cellar/publish' && request.method === 'POST') {
        const { syncKey, cellar, ownerName } = await readJson(request, 24_000_000);
        if (!cellar) throw new HttpError(400, 'MISSING_CELLAR');
        await requireKeyAccess(request, kv, syncKey);
        const shareId = await shareIdOf(syncKey);
        let likes = 0, cheers = [];
        const existing = await kv.get('public_cellar:' + shareId);
        if (existing) { try { const p = JSON.parse(existing); likes = p.likes || 0; cheers = p.cheers || []; } catch (e) {} }
        const payload = { shareId, ownerName: clip(ownerName, 40) || '品飲家', updatedAt: Date.now(), likes, cheers, cellar };
        await kv.put('public_cellar:' + shareId, JSON.stringify(payload), { expirationTtl: 31536000 });
        return json({ success: true, shareId });
      }

      if (path === '/api/cellar/get' && request.method === 'GET') {
        const key = url.searchParams.get('key');
        if (!key) throw new HttpError(400, 'MISSING_KEY');
        if (key.startsWith('BTL-')) return json({ error: '此分享連結已過期，請請朋友重新分享一次。' }, 410);
        const data = await kv.get('public_cellar:' + key);
        if (!data) return json({ error: 'Cellar not found' }, 404);
        return new Response(data, { headers: jsonHeaders });
      }

      if (path === '/api/cellar/like' && request.method === 'POST') {
        const { key } = await readJson(request, 2_000);
        const raw = await kv.get('public_cellar:' + key);
        if (!raw) throw new HttpError(404, 'NOT_FOUND');
        const obj = JSON.parse(raw);
        const lk = `like:${key}:${(await sha256hex(ip)).slice(0, 16)}`;
        if (await kv.get(lk)) return json({ success: true, likes: obj.likes || 0, already: true });
        await kv.put(lk, '1', { expirationTtl: 60 * 60 * 24 * 365 });
        obj.likes = (obj.likes || 0) + 1;
        await kv.put('public_cellar:' + key, JSON.stringify(obj), { expirationTtl: 31536000 });
        return json({ success: true, likes: obj.likes });
      }

      // ---------- 同步 ----------
      if (path === '/api/sync' && request.method === 'POST') {
        const { syncKey, cellar, deleted } = await readJson(request, 24_000_000);
        await requireKeyAccess(request, kv, syncKey);
        const m = await userMerge(env, syncKey, { cellar, deleted });
        return json({ success: true, cellar: m.cellar, deleted: m.deleted });
      }

      if (path === '/api/restore' && request.method === 'GET') {
        const syncKey = url.searchParams.get('key');
        await requireKeyAccess(request, kv, syncKey);
        const rec = parseUserRecord(await kv.get('user:' + syncKey));
        const m = mergeCellars(rec.cellar, [], rec.deleted, {});
        return json({ cellar: m.cellar, deleted: m.deleted });
      }

      // ---------- 探索池 (逐筆儲存，無讀寫競爭) ----------
      if (path === '/api/explore/publish' && request.method === 'POST') {
        const body = await readJson(request, 700_000);
        const { syncKey, ...item } = body;
        // 公開發布：必須已登入、年滿 18 歲、未被封禁
        const sess = await requireSession(request, kv);
        if (!syncKey || sess.userKey !== syncKey) throw new HttpError(403, 'KEY_MISMATCH');
        if (await kv.get('ban:' + sess.email) || await kv.get('pubban:' + sess.email)) throw new HttpError(403, 'BANNED');
        const prof = parseUserRecord(await kv.get('user:' + sess.userKey)).profile;
        if (!validBirthday(prof.birthday) || ageOf(prof.birthday) < minAge(env)) throw new HttpError(403, 'AGE_REQUIRED', { minAge: minAge(env) });
        const id = String(item.id || '');
        if (!/^[\w.\-]{1,120}$/.test(id)) throw new HttpError(400, 'BAD_ID');
        await limitOrThrow(env, `rl:exp:${(await sha256hex(syncKey)).slice(0, 16)}:${ymd()}`, 20, 86400, 'RATE_LIMITED');
        await limitOrThrow(env, `rl:expip:${ip}:${ymd()}`, 60, 86400, 'RATE_LIMITED');
        const share = await shareIdOf(syncKey);
        const prev = await kv.getWithMetadata('exp:' + id);
        if (prev.value && prev.metadata && prev.metadata.o && prev.metadata.o !== share) throw new HttpError(409, 'ID_TAKEN');
        const clean = sanitizeExploreItem(item, id, share, url.origin);
        if (!clean.identification.name && !clean.identification.producer) throw new HttpError(400, 'MISSING_NAME');
        const mod = await moderateExploreItem(env, kv, url.origin, clean);
        if (mod.v === 'reject') {
          const sk = 'modstrike:' + sess.email;
          const n = parseInt(await kv.get(sk) || '0', 10) + 1;
          await kv.put(sk, String(n), { expirationTtl: 60 * 60 * 24 * 90 });
          if (n >= 3) await kv.put('pubban:' + sess.email, '1');
          throw new HttpError(422, 'CONTENT_REJECTED');
        }
        if (mod.v === 'not_alcohol') throw new HttpError(422, 'NOT_ALCOHOL_IMAGE');
        const status = mod.v === 'ok' ? 'live' : 'pending';
        await kv.put('exp:' + id, JSON.stringify(clean), { metadata: { t: clean.publishedAt, o: share, ...(status === 'pending' ? { h: 2 } : {}) }, expirationTtl: EXP_TTL });
        if (status === 'live') await expImgAdd(kv, clean);
        await bumpDay(kv, status === 'pending' ? { publish: 1, publish_pending: 1 } : { publish: 1 });
        return json({ success: true, status });
      }

      if (path === '/api/explore/delete' && request.method === 'POST') {
        const { ids, syncKey } = await readJson(request, 20_000);
        await requireKeyAccess(request, kv, syncKey);
        const share = await shareIdOf(syncKey);
        let removed = 0;
        for (const id of (Array.isArray(ids) ? ids : []).slice(0, 50).map(String)) {
          if (!/^[\w.\-]{1,120}$/.test(id)) continue;
          const cur = await kv.getWithMetadata('exp:' + id);
          if (cur.value && cur.metadata && cur.metadata.o === share) { await kv.delete('exp:' + id); removed++; }
        }
        return json({ success: true, removed });
      }

      if (path === '/api/explore/report' && request.method === 'POST') {
        const { id } = await readJson(request, 2_000);
        if (!/^[\w.\-]{1,120}$/.test(String(id || ''))) throw new HttpError(400, 'BAD_ID');
        await limitOrThrow(env, `rl:rep:${ip}:${ymd()}`, 20, 86400);
        const dk = `rep:${id}:${(await sha256hex(ip)).slice(0, 16)}`;
        if (await kv.get(dk)) return json({ success: true, already: true });
        await kv.put(dk, '1', { expirationTtl: 60 * 60 * 24 * 90 });
        const ck = 'repcount:' + id;
        const n = parseInt(await kv.get(ck) || '0', 10) + 1;
        await kv.put(ck, String(n), { expirationTtl: 60 * 60 * 24 * 90 });
        await bumpDay(kv, n === 3 ? { report: 1, report_hidden: 1 } : { report: 1 });
        if (n >= 3) {
          const cur = await kv.getWithMetadata('exp:' + id);
          if (cur.value) await kv.put('exp:' + id, cur.value, { metadata: { ...(cur.metadata || {}), h: 1 }, expirationTtl: EXP_TTL });
        }
        return json({ success: true });
      }

      if (path === '/api/explore' && request.method === 'GET') {
        const l = await kv.list({ prefix: 'exp:', limit: 300 });
        const keys = l.keys.filter(k => !(k.metadata && k.metadata.h))
          .sort((a, b) => ((b.metadata && b.metadata.t) || 0) - ((a.metadata && a.metadata.t) || 0)).slice(0, 30);
        const vals = await Promise.all(keys.map(k => kv.get(k.name)));
        const feed = [];
        for (const v of vals) { if (!v) continue; try { feed.push(JSON.parse(v)); } catch (e) {} }
        return json(feed, 200, { 'Cache-Control': 'public, max-age=15' });
      }

      // ---------- 相片 ----------
      if (path === '/api/photo' && request.method === 'POST') {
        const syncKey = request.headers.get('X-Sync-Key');
        await requireKeyAccess(request, kv, syncKey);
        await limitOrThrow(env, `rl:ph:${(await sha256hex(syncKey)).slice(0, 16)}:${ymd()}`, 300, 86400, 'RATE_LIMITED');
        const buf = await request.arrayBuffer();
        if (buf.byteLength < 200 || buf.byteLength > 900_000) throw new HttpError(413, 'BAD_SIZE');
        const u8 = new Uint8Array(buf);
        const isJpg = u8[0] === 0xFF && u8[1] === 0xD8;
        const isPng = u8[0] === 0x89 && u8[1] === 0x50;
        const isWebp = u8[0] === 0x52 && u8[1] === 0x49 && u8[8] === 0x57;
        if (!isJpg && !isPng && !isWebp) throw new HttpError(415, 'NOT_IMAGE');
        const ct = isJpg ? 'image/jpeg' : isPng ? 'image/png' : 'image/webp';
        const owner = (await sha256hex('photo-owner:' + syncKey)).slice(0, 12);
        const id = owner + '/' + randomHex(12);
        if (env.PHOTOS) await env.PHOTOS.put('photos/' + id, buf, { httpMetadata: { contentType: ct } });
        else await kv.put('photo:' + id, buf, { metadata: { ct } });
        return json({ success: true, url: `${url.origin}/api/photo/${id}` });
      }
      if (path.startsWith('/api/photo/') && request.method === 'GET') {
        const id = path.slice('/api/photo/'.length);
        if (!/^[0-9a-f]{12}\/[0-9a-f]{24}$/.test(id)) return new Response('Not Found', { status: 404, headers: corsHeaders });
        const h = { ...corsHeaders, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' };
        if (env.PHOTOS) {
          const o = await env.PHOTOS.get('photos/' + id);
          if (!o) return new Response('Not Found', { status: 404, headers: corsHeaders });
          return new Response(o.body, { headers: { ...h, 'Content-Type': (o.httpMetadata && o.httpMetadata.contentType) || 'image/jpeg' } });
        }
        const r = await kv.getWithMetadata('photo:' + id, 'arrayBuffer');
        if (!r.value) return new Response('Not Found', { status: 404, headers: corsHeaders });
        return new Response(r.value, { headers: { ...h, 'Content-Type': (r.metadata && r.metadata.ct) || 'image/jpeg' } });
      }

      // ---------- 贊助購買建議 (只用酒款屬性配對，不帶任何用戶身份) ----------
      if (path === '/api/offers' && request.method === 'POST') {
        const q = await readJson(request, 5_000);
        await limitOrThrow(env, `rl:off:${ip}:${ymd()}`, 300, 86400);
        const merchants = await loadMerchants(kv);
        const buy = [], similar = [];
        for (const m of merchants) {
          (m.products || []).forEach((p, i) => {
            const { s, exact } = scoreProduct(p, q);
            const deal = !!(p.was && (!p.until || p.until >= hkday()));
            const item = { m: m.id, i, merchant: m.name, title: p.n, price: p.p || '', s, deal, was: deal ? p.was : '', until: deal ? (p.until || '') : '' };
            if (exact) buy.push(item); else if (s >= 5) similar.push(item);
          });
        }
        const top = a => a.sort((x, y) => (y.s + (y.deal ? 0.5 : 0)) - (x.s + (x.deal ? 0.5 : 0))).slice(0, 2).map(x => ({
          merchant: x.merchant, title: x.title, price: x.price, deal: x.deal, was: x.was, until: x.until,
          go: `${url.origin}/api/offers/click?m=${encodeURIComponent(x.m)}&i=${x.i}`
        }));
        const out = { sponsored: true, buy: top(buy), similar: top(similar) };
        ctx.waitUntil((async () => { for (const x of [...out.buy, ...out.similar]) { const mid = new URL(x.go).searchParams.get('m'); await bumpStat(kv, mid, 'imp'); } })());
        return json(out);
      }
      if (path === '/api/offers/click' && request.method === 'GET') {
        const mid = url.searchParams.get('m') || '', i = parseInt(url.searchParams.get('i') || '-1', 10);
        const raw = await kv.get('merchant:' + mid);
        let dest = null;
        if (raw) { try { const m = JSON.parse(raw); const p = (m.products || [])[i]; dest = (p && p.u) || m.url; } catch (e) {} }
        if (!dest || !/^https:\/\//.test(dest)) return new Response('Not Found', { status: 404, headers: corsHeaders });
        ctx.waitUntil(bumpStat(kv, mid, 'click'));
        return new Response(null, { status: 302, headers: { Location: dest, 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' } });
      }
      // ---------- 社群成交價 (匿名、須 3 人以上才顯示) ----------
      if ((path === '/api/price/report' || path === '/api/price/community') && request.method === 'POST') {
        const b = await readJson(request, 3_000);
        const name = clip(b.name, 120).trim().toLowerCase().replace(/\s+/g, ' ');
        if (!name) throw new HttpError(400, 'MISSING_NAME');
        const vin = /^(19|20)\d{2}$/.test(String(b.vintage || '')) ? String(b.vintage) : 'nv';
        const pk = 'px:' + (await sha256hex(name + '|' + vin)).slice(0, 20);
        if (path === '/api/price/report') {
          const usd = Number(b.usd);
          if (!isFinite(usd) || usd < 1 || usd > 2_000_000) throw new HttpError(400, 'BAD_PRICE');
          await limitOrThrow(env, `rl:px:${ip}:${ymd()}`, 40, 86400);
          const dk = `pxd:${pk}:${(await ipHash(ip)).slice(0, 16)}`;
          if (await kv.get(dk)) return json({ success: true, dup: true });
          await kv.put(dk, '1', { expirationTtl: 60 * 60 * 24 * 90 });
          const cur = JSON.parse(await kv.get(pk) || 'null') || { vals: [] };
          cur.vals.push(Math.round(usd)); cur.vals = cur.vals.slice(-40);
          await kv.put(pk, JSON.stringify(cur), { expirationTtl: 60 * 60 * 24 * 365 });
          await bumpDay(kv, { price_report: 1 });
          return json({ success: true });
        }
        const cur = JSON.parse(await kv.get(pk) || 'null');
        const v = cur ? cur.vals.slice().sort((x, y) => x - y) : [];
        if (v.length < 3) return json({ n: v.length });
        const q = f => v[Math.min(v.length - 1, Math.floor((v.length - 1) * f))];
        return json({ n: v.length, lo: q(0.25), med: q(0.5), hi: q(0.75) });
      }
      // 匿名需求訊號：只記錄「酒款屬性 + 次數」，不記錄是誰
      if (path === '/api/signal' && request.method === 'POST') {
        const b = await readJson(request, 3_000);
        if (!['wishlist', 'scan', 'share_wishlist'].includes(b.type)) throw new HttpError(400, 'BAD_TYPE');
        await limitOrThrow(env, `rl:sig:${ip}:${ymd()}`, 60, 86400);
        const name = clip(b.name, 120).trim();
        if (!name) throw new HttpError(400, 'MISSING_NAME');
        const dk = `demand:${ym()}:${b.type}:${(await sha256hex(name.toLowerCase())).slice(0, 16)}`;
        const cur = JSON.parse(await kv.get(dk) || 'null') || { name, cat: clip(b.category, 30), country: clip(b.country, 40), region: clip(b.region, 60), c: 0 };
        cur.c++;
        await kv.put(dk, JSON.stringify(cur), { expirationTtl: 60 * 60 * 24 * 120 });
        return json({ success: true });
      }

      // ---------- 兌換碼 ----------
      if (path === '/api/redeem' && request.method === 'POST') {
        const { email } = await requireSession(request, kv);
        const { code } = await readJson(request, 1000);
        await limitOrThrow(env, `rl:redip:${ip}:${ymd()}`, 20, 86400, 'RATE_LIMITED_IP');
        await limitOrThrow(env, `rl:redem:${email}:${ymd()}`, 10, 86400, 'RATE_LIMITED');
        const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
        const raw = c ? await kv.get('code:' + c) : null;
        if (!raw) throw new HttpError(404, 'CODE_INVALID');
        const cd = JSON.parse(raw);
        if (cd.expires && Date.now() > cd.expires) throw new HttpError(410, 'CODE_EXPIRED');
        if (await kv.get(`redeemed:${c}:${email}`)) throw new HttpError(409, 'CODE_ALREADY');
        const used = parseInt(await kv.get('codeuses:' + c) || '0', 10);
        if (cd.maxUses && used >= cd.maxUses) throw new HttpError(410, 'CODE_USED_UP');
        if (cd.scans) await grantBonus(env, email, cd.scans, 'code:' + c);
        if (cd.proDays) {
          const cur = parseInt(await kv.get('proUntil:' + email) || '0', 10);
          await kv.put('proUntil:' + email, String(Math.max(Date.now(), cur) + cd.proDays * 86400000));
        }
        await kv.put('codeuses:' + c, String(used + 1));
        await kv.put(`redeemed:${c}:${email}`, '1', { expirationTtl: 60 * 60 * 24 * 800 });
        return json({ success: true, scans: cd.scans || 0, proDays: cd.proDays || 0, voucher: cd.voucher || null });
      }

      // ---------- ops 用量總覽：只回報每日數量，唔含任何個人資料 (需設定 OPS_STATS_TOKEN secret) ----------
      if (path === '/api/ops/daily' && request.method === 'GET') {
        const tok = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
        if (!env.OPS_STATS_TOKEN || !safeEqual(tok, env.OPS_STATS_TOKEN)) throw new HttpError(401, 'OPS_ONLY');
        const days = Math.max(1, Math.min(31, parseInt(url.searchParams.get('days') || '14', 10) || 14));
        const series = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = hkday(i);
          let v = {}; try { v = JSON.parse(await kv.get('m:' + d) || '{}'); } catch (e) {}
          const models = {};
          for (const k in v) if (k.startsWith('mdl:')) models[k.slice(4)] = v[k];
          series.push({ date: d, scan: v.scan || 0, signup: v.signup || 0, models });
        }
        return json({ tz: 'UTC+8', days: series, dailyCap: envInt(env.SCAN_GLOBAL_DAILY, 1500) }, 200, { 'Cache-Control': 'no-store' });
      }

      // ---------- 管理 (需設定 ADMIN_TOKEN secret) ----------
      if (path.startsWith('/api/admin/')) {
        const tok = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
        if (!env.ADMIN_TOKEN || !safeEqual(tok, env.ADMIN_TOKEN)) throw new HttpError(401, 'ADMIN_ONLY');
        if (path === '/api/admin/merchant' && request.method === 'POST') {
          const m = await readJson(request, 200_000);
          if (!/^[a-z0-9_-]{2,40}$/.test(String(m.id || ''))) throw new HttpError(400, 'BAD_MERCHANT_ID');
          if (!/^https:\/\//.test(String(m.url || ''))) throw new HttpError(400, 'MERCHANT_URL_MUST_BE_HTTPS');
          const products = (Array.isArray(m.products) ? m.products : []).slice(0, 500).map(p => ({
            n: clip(p.n, 160), u: /^https:\/\//.test(String(p.u || '')) ? clip(p.u, 500) : '',
            p: clip(p.p, 40), was: clip(p.was, 40), until: /^\d{4}-\d{2}-\d{2}$/.test(String(p.until || '')) ? p.until : '', cat: clip(p.cat, 30), country: clip(p.country, 40), region: clip(p.region, 60),
            tags: (Array.isArray(p.tags) ? p.tags : []).slice(0, 10).map(t => clip(String(t), 40))
          })).filter(p => p.n);
          await kv.put('merchant:' + m.id, JSON.stringify({ id: m.id, name: clip(m.name, 80), url: clip(m.url, 500), active: m.active !== false, products }));
          merchantCache.t = 0;
          return json({ success: true, products: products.length });
        }
        if (path === '/api/admin/merchants' && request.method === 'GET') {
          const l = await kv.list({ prefix: 'merchant:', limit: 100 }); const out = [];
          for (const k of l.keys) { const v = await kv.get(k.name); if (v) { try { out.push(JSON.parse(v)); } catch (e) {} } }
          return json(out);
        }
        if (path === '/api/admin/merchant/delete' && request.method === 'POST') {
          const { id } = await readJson(request, 1000);
          await kv.delete('merchant:' + id); merchantCache.t = 0;
          return json({ success: true });
        }
        if (path === '/api/admin/plan' && request.method === 'POST') {
          const { email, plan } = await readJson(request, 1000);
          const e = String(email || '').toLowerCase().trim();
          if (!isEmail(e)) throw new HttpError(400, 'INVALID_EMAIL');
          if (plan === 'pro') await kv.put('plan:' + e, 'pro'); else await kv.delete('plan:' + e);
          return json({ success: true });
        }
        if (path === '/api/admin/stats' && request.method === 'GET') {
          const month = url.searchParams.get('month') || ym();
          const stats = {}; 
          const sl = await kv.list({ prefix: 'stat:', limit: 1000 });
          for (const k of sl.keys) { const [, mid, mo, kind] = k.name.split(':'); if (mo !== month) continue; (stats[mid] ||= {})[kind] = parseInt(await kv.get(k.name) || '0', 10); }
          const dl = await kv.list({ prefix: `demand:${month}:`, limit: 1000 });
          const demand = [];
          for (const k of dl.keys) { const v = JSON.parse(await kv.get(k.name) || 'null'); if (v) demand.push({ ...v, type: k.name.split(':')[2] }); }
          demand.sort((a, b) => b.c - a.c);
          return json({ month, merchants: stats, demand: demand.slice(0, 100) });
        }
        if (path === '/api/admin/code' && request.method === 'POST') {
          const c = await readJson(request, 5000);
          const code = String(c.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
          if (code.length < 4) throw new HttpError(400, 'BAD_CODE');
          const exp = c.expires ? Date.parse(c.expires) : 0;
          await kv.put('code:' + code, JSON.stringify({
            scans: Math.min(1000, parseInt(c.scans, 10) || 0), proDays: Math.min(366, parseInt(c.proDays, 10) || 0),
            maxUses: parseInt(c.maxUses, 10) || 0, expires: isNaN(exp) ? 0 : exp,
            voucher: c.voucher ? { title: clip(c.voucher.title, 80), text: clip(c.voucher.text, 300), url: /^https:\/\//.test(c.voucher.url || '') ? clip(c.voucher.url, 400) : '' } : null
          }));
          return json({ success: true, code });
        }
        if (path === '/api/admin/campaign' && request.method === 'POST') {
          const c = await readJson(request, 2000);
          if (!/^[a-z0-9_-]{2,40}$/.test(String(c.id || ''))) throw new HttpError(400, 'BAD_ID');
          const st = Date.parse(c.start), en = Date.parse(c.end);
          if (isNaN(st) || isNaN(en) || en <= st) throw new HttpError(400, 'BAD_DATES');
          await kv.put('campaign:' + c.id, JSON.stringify({ id: c.id, name: clip(c.name, 60), start: st, end: en, bonus: Math.min(200, parseInt(c.bonus, 10) || 0) }));
          return json({ success: true });
        }
        if (path === '/api/admin/grant' && request.method === 'POST') {
          const g = await readJson(request, 1000);
          const e = String(g.email || '').toLowerCase().trim();
          if (!isEmail(e)) throw new HttpError(400, 'INVALID_EMAIL');
          if (g.scans) await grantBonus(env, e, Math.min(1000, parseInt(g.scans, 10) || 0), 'admin');
          if (g.proDays) { const cur = parseInt(await kv.get('proUntil:' + e) || '0', 10); await kv.put('proUntil:' + e, String(Math.max(Date.now(), cur) + Math.min(366, parseInt(g.proDays, 10) || 0) * 86400000)); }
          return json({ success: true });
        }
        if (path === '/api/admin/ban' && request.method === 'POST') {
          const b = await readJson(request, 1000);
          const e = String(b.email || '').toLowerCase().trim();
          if (!isEmail(e)) throw new HttpError(400, 'INVALID_EMAIL');
          if (b.off) { await kv.delete('ban:' + e); await kv.delete('pubban:' + e); await kv.delete('modstrike:' + e); }
          else {
            await kv.put('ban:' + e, clip(b.reason, 200) || '1');
            await kv.put('sessver:' + e, String(parseInt(await kv.get('sessver:' + e) || '0', 10) + 1));
            const key = await kv.get('account:' + e);
            if (key) { const sh = await shareIdOf(key); await deleteExploreOf(kv, sh, []); await kv.delete('public_cellar:' + sh); }
          }
          return json({ success: true });
        }
        if (path === '/api/admin/birthday' && request.method === 'POST') {
          const b = await readJson(request, 1000);
          const e = String(b.email || '').toLowerCase().trim();
          const key = await kv.get('account:' + e);
          if (!key || !validBirthday(b.birthday)) throw new HttpError(400, 'BAD_REQUEST');
          const r = parseUserRecord(await kv.get('user:' + key));
          r.profile.birthday = b.birthday;
          await userMerge(env, key, { profileMode: 'patch', profile: { birthday: r.profile.birthday } });
          return json({ success: true });
        }
        if (path === '/api/admin/overview' && request.method === 'GET') {
          const days = Math.max(1, Math.min(30, parseInt(url.searchParams.get('days') || '30', 10)));
          const series = [];
          for (let i = days - 1; i >= 0; i--) { const d = hkday(i); const v = JSON.parse(await kv.get('m:' + d) || '{}'); series.push({ d, ...v }); }
          const count = async (prefix, filter) => { let n = 0, cur; for (let i = 0; i < 10; i++) { const l = await kv.list({ prefix, limit: 1000, cursor: cur }); for (const k of l.keys) if (!filter || filter(k)) n++; if (l.list_complete) break; cur = l.cursor; } return n; };
          const totals = {
            users: await count('account:'),
            banned: await count('ban:'),
            merchants: await count('merchant:'),
            exp_live: await count('exp:', k => !(k.metadata && k.metadata.h)),
            exp_pending: await count('exp:', k => k.metadata && k.metadata.h === 2),
            exp_hidden: await count('exp:', k => k.metadata && k.metadata.h === 1)
          };
          let ailast = null; try { ailast = JSON.parse(await kv.get('ailast') || 'null'); } catch (e) {}
          return json({ tz: 'UTC+8', days, series, totals, ailast });
        }
        if (path === '/api/admin/explore/flagged' && request.method === 'GET') {
          const l = await kv.list({ prefix: 'exp:', limit: 500 });
          const out = [];
          for (const k of l.keys) if (k.metadata && (k.metadata.h === 1 || k.metadata.h === 2)) { const v = await kv.get(k.name); if (v) { const it = JSON.parse(v); it._flag = k.metadata.h === 1 ? 'reported' : 'pending'; it._reports = parseInt(await kv.get('repcount:' + it.id) || '0', 10); out.push(it); } }
          return json(out);
        }
        if (path === '/api/admin/explore/pending' && request.method === 'GET') {
          const l = await kv.list({ prefix: 'exp:', limit: 500 });
          const out = [];
          for (const k of l.keys) if (k.metadata && k.metadata.h === 2) { const v = await kv.get(k.name); if (v) out.push(JSON.parse(v)); }
          return json(out);
        }
        if (path === '/api/admin/explore/approve' && request.method === 'POST') {
          const { id } = await readJson(request, 1000);
          const cur = await kv.getWithMetadata('exp:' + id);
          if (!cur.value) throw new HttpError(404, 'NOT_FOUND');
          const md = { ...(cur.metadata || {}) }; delete md.h;
          await kv.put('exp:' + id, cur.value, { metadata: md, expirationTtl: EXP_TTL });
          await kv.delete('repcount:' + id);
          try { await expImgAdd(kv, JSON.parse(cur.value)); } catch (e) {}
          return json({ success: true });
        }
        if (path === '/api/admin/explore/remove' && request.method === 'POST') {
          const { id } = await readJson(request, 1000);
          await kv.delete('exp:' + id);
          await expImgRemove(kv, id);
          return json({ success: true });
        }
        throw new HttpError(404, 'NOT_FOUND');
      }

      // ---------- 酒款參考圖：Wikimedia Commons 搜尋，嚴格比對名稱，找不到就回傳 null ----------
      if (path === '/api/bottle-image' && request.method === 'POST') {
        const b = await readJson(request, 2_000);
        const name = clip(String(b.name || ''), 120).trim(), producer = clip(String(b.producer || ''), 80).trim();
        if (!name) throw new HttpError(400, 'MISSING_NAME');
        await limitOrThrow(env, `rl:bimg:${ip}:${ymd()}`, 80, 86400);
        const ck = 'bimg:' + (await sha256hex((name + '|' + producer).toLowerCase())).slice(0, 24);
        const hitc = await kv.get(ck);
        if (hitc !== null) return json({ url: hitc === '-' ? null : hitc });
        const toks = s2 => String(s2).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(x => x.length >= 3 && !IMG_STOP.has(x));
        const want = [...new Set(toks(name + ' ' + producer))].slice(0, 5);
        let found = null, src = '';
        try { found = expImgMatch(await expImgIndex(kv), nameToks(name + ' ' + producer)); if (found) src = 'explore'; } catch (e) {}
        if (!found) try {
          const q = encodeURIComponent(`${name} ${producer && !name.toLowerCase().includes(producer.toLowerCase()) ? producer : ''} bottle`.trim());
          const r = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|mime&iiurlwidth=260&format=json&origin=*`, { headers: { 'User-Agent': 'BottleSense/1.0 (https://fiveathree.github.io/bottlesense)' } });
          const j = r.ok ? await r.json() : null;
          const pages = j && j.query && j.query.pages ? Object.values(j.query.pages).sort((x, y) => (x.index || 0) - (y.index || 0)) : [];
          const need = Math.max(1, Math.min(2, want.length));
          for (const pg of pages) {
            const ii = pg.imageinfo && pg.imageinfo[0]; if (!ii || !/^image\/(jpeg|png|webp)$/.test(ii.mime || '')) continue;
            const tt = new Set(toks(pg.title || ''));
            if (want.filter(w => tt.has(w)).length >= need && ii.thumburl && /^https:\/\/upload\.wikimedia\.org\//.test(ii.thumburl)) { found = ii.thumburl; break; }
          }
        } catch (e) {}
        await kv.put(ck, found || '-', { expirationTtl: found ? 60 * 60 * 24 * 30 : 60 * 60 * 6 });
        return json({ url: found, src: found ? (src || 'commons') : '' });
      }

      // ---------- App 內熱度：只讀匿名需求訊號計數，少於 3 不顯示 ----------
      if (path === '/api/heat' && request.method === 'POST') {
        const b = await readJson(request, 2_000);
        const name = clip(String(b.name || ''), 120).trim();
        if (!name) throw new HttpError(400, 'MISSING_NAME');
        await limitOrThrow(env, `rl:heat:${ip}:${ymd()}`, 200, 86400);
        const h = (await sha256hex(name.toLowerCase())).slice(0, 16);
        const d = new Date(); const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
        const months = [ym(), prev.toISOString().slice(0, 7).replace('-', '')];
        let n = 0;
        for (const m of months) for (const ty of ['wishlist', 'scan', 'share_wishlist']) {
          try { const v = JSON.parse(await kv.get(`demand:${m}:${ty}:${h}`) || 'null'); if (v) n += Number(v.c) || 0; } catch (e) {}
        }
        return json({ n: n >= 3 ? n : 0 });
      }

      // ---------- 查證評分：Claude 網頁搜尋，結果按酒款快取 30 日 ----------
      if (path === '/api/verify' && request.method === 'POST') {
        if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, 'AI_NOT_CONFIGURED');
        const b = await readJson(request, 3_000);
        const name = clip(String(b.name || ''), 120).trim(), producer = clip(String(b.producer || ''), 80).trim();
        const vin = (String(b.vintage || '').match(/(19|20)\d{2}/) || [''])[0];
        const cat = clip(String(b.category || ''), 30);
        if (!name) throw new HttpError(400, 'MISSING_NAME');
        const ck = 'crit:' + (await sha256hex((name + '|' + producer + '|' + vin).toLowerCase())).slice(0, 24);
        const hit = await kv.get(ck);
        if (hit) { try { return json({ ...JSON.parse(hit), cached: true }); } catch (e) {} }
        const tier = await scanTier(request, kv, env);
        if (tier.email && await kv.get('ban:' + tier.email)) throw new HttpError(403, 'BANNED');
        const daily = tier.tier === 'pro' ? 20 : tier.tier === 'free' ? 5 : 2;
        // 每日次數「成功先扣」：上游失敗唔會食咗用戶次數；另設嘗試上限 (daily x3) 防止失敗請求無限重試
        const vKey = `rl:verify:${tier.id}:${ymd()}`;
        const vIpKey = tier.ipId ? `rl:verify:${tier.ipId}:${ymd()}` : null;
        // 預留都計入上限，並發請求唔會超額；成功先 commit，任何失敗喺 finally 退還
        const vRes = await Promise.all([limReserve(env, vKey, daily, 86400), vIpKey ? limReserve(env, vIpKey, daily * 3, 86400) : null]);
        let vDone = false;
        try {
        if (vRes.some(r => r && !r.ok)) throw new HttpError(429, 'RATE_LIMITED');
        await limitOrThrow(env, `rl:verifytry:${tier.id}:${ymd()}`, daily * 3, 86400, 'RATE_LIMITED');
        await limitOrThrow(env, `rl:verifyall:${ymd()}`, envInt(env.VERIFY_GLOBAL_DAILY, 300), 86400, 'SERVICE_BUSY');
        const prompt = `Use web search to find what established wine/spirits/sake/beer critics and competitions say about this bottle: "${name}"${producer ? ' by ' + producer : ''}${vin ? ', vintage ' + vin : ''}${cat ? ' (category: ' + cat + ')' : ''}.
Also gauge how much online discussion / buzz it gets. Reply with JSON only, no markdown:
{"tier":"acclaimed|strong|solid|everyday|unknown","band":"95+|90-94|85-89|80-84|<80|null","src":[names chosen only from: ${CRIT_SRC.join(', ')}],"buzz":"high|medium|low|unknown","conf":"high|medium|low","cites":[up to 3 https URLs that you actually used],"zh":"一至兩句繁體中文書面語，用自己的話概括專業評價與討論度，不得引用原文，不得寫具體分數","en":"One or two plain English sentences in your own words, no quotes, no exact scores"}
Rules: never quote reviews and never give exact critic scores (only the band). If you cannot find reliable evidence for this exact bottle, use tier "unknown", band null, src [], conf "low" and say so in zh/en. Never invent.`;
        let data = null;
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: env.SCAN_MODEL_STRONG || 'claude-sonnet-5-5', max_tokens: 1800, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }], messages: [{ role: 'user', content: prompt }] })
          });
          if (!res.ok) { let bd = ''; try { bd = (await res.text()).slice(0, 300); } catch (e) {} const er = new Error('AI_UPSTREAM_' + res.status); er.status = res.status; er.body = bd; throw er; }
          data = await res.json();
        } catch (er) {
          try { await kv.put('ailast', JSON.stringify({ t: Date.now(), status: er.status || 0, model: 'verify', msg: 'verify: ' + String(er.body || er.message || '').slice(0, 280) }), { expirationTtl: 60 * 60 * 24 * 14 }); } catch (e) {}
          throw aiHttpError(er);
        }
        const blocks = Array.isArray(data.content) ? data.content : [];
        // 用 web search 時回覆會按引用切成多段：直接拼接，唔可以加換行 (否則 JSON 字串中間會斷)
        const txt = blocks.filter(c => c && c.type === 'text' && typeof c.text === 'string').map(c => c.text).join('');
        const seen = new Map();
        for (const bl of blocks) if (bl && bl.type === 'web_search_tool_result' && Array.isArray(bl.content)) for (const r of bl.content) if (r && /^https:\/\//.test(r.url || '')) seen.set(r.url, clip(String(r.title || ''), 90));
        const j = extractJson(txt);
        if (!j) { try { await kv.put('ailast', JSON.stringify({ t: Date.now(), status: 200, model: 'verify', msg: 'verify PARSE FAIL: ' + String(txt).slice(-200) }), { expirationTtl: 60 * 60 * 24 * 14 }); } catch (e) {} throw new HttpError(502, 'AI_UPSTREAM_ERROR'); }
        const c = cleanCritics(j);
        const links = (Array.isArray(j.cites) ? j.cites : []).filter(u => seen.has(u)).slice(0, 3).map(u => ({ url: u, title: seen.get(u) }));
        const out = { ...c, links, zh: clip(String(j.zh || ''), 220), en: clip(String(j.en || ''), 300), verified: true, t: Date.now() };
        await kv.put(ck, JSON.stringify(out), { expirationTtl: 60 * 60 * 24 * (c.tier === 'unknown' ? 3 : 30) });
        await Promise.all(vRes.map(r => limCommit(env, r)));
        vDone = true;
        await bumpDay(kv, { verify: 1 });
        return json(out);
        } finally {
          if (!vDone) await Promise.all(vRes.map(r => limRelease(env, r)));
        }
      }

      // ---------- AI 下一支推薦 (只收酒款屬性摘要) ----------
      if (path === '/api/recommend' && request.method === 'POST') {
        if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, 'AI_NOT_CONFIGURED');
        const b = await readJson(request, 60_000);
        const tier = await scanTier(request, kv, env);
        if (tier.email && await kv.get('ban:' + tier.email)) throw new HttpError(403, 'BANNED');
        const daily = tier.tier === 'pro' ? 10 : tier.tier === 'free' ? 4 : 2;
        const list = (Array.isArray(b.bottles) ? b.bottles : []).slice(0, 80).map(x => ({
          n: clip(String(x.n || ''), 100), c: clip(String(x.c || ''), 24), k: clip(String(x.k || ''), 30), r: clip(String(x.r || ''), 40),
          v: clip(String(x.v || ''), 8), s: clip(String(x.s || ''), 12), star: Math.max(0, Math.min(5, Number(x.star) || 0)),
          usd: Number(x.usd) > 0 ? Math.round(Number(x.usd)) : 0, nt: Math.max(0, Math.min(99, Number(x.nt) || 0))
        })).filter(x => x.n);
        if (list.length < 2) throw new HttpError(400, 'NOT_ENOUGH_DATA');
        const wish = (Array.isArray(b.wish) ? b.wish : []).slice(0, 40).map(x => clip(String(x), 100)).filter(Boolean);
        await limitOrThrow(env, `rl:reco:${tier.id}:${ymd()}`, daily, 86400, 'RATE_LIMITED');
        if (tier.ipId) await limitOrThrow(env, `rl:reco:${tier.ipId}:${ymd()}`, daily * 3, 86400, 'RATE_LIMITED');
        await limitOrThrow(env, `rl:recoall:${ymd()}`, envInt(env.RECO_GLOBAL_DAILY, 800), 86400, 'SERVICE_BUSY');
        const body = `${b.lang === 'en' ? RECO_PROMPT + RECO_EN : RECO_PROMPT}\n\n【酒窖摘要】(n=名稱 c=品類 k=國家 r=產區 v=年份 s=狀態 star=個人評分1-5 usd=買入價美元 nt=品飲次數)\n${JSON.stringify(list)}\n【願望清單】${JSON.stringify(wish)}`;
        let out = null;
        try {
          const strong = env.SCAN_MODEL_STRONG || 'claude-sonnet-5-5', fast = env.SCAN_MODEL_FAST || 'claude-haiku-5-5';
          const msg = [{ type: 'text', text: body }];
          let txt;
          try { txt = await callClaude(env, strong, msg, 3000); }
          catch (e1) { if (!aiRetryable(e1) || fast === strong) throw e1; txt = await callClaude(env, fast, msg, 3000); }
          out = cleanReco(extractJson(txt));
        } catch (er) {
          try { await kv.put('ailast', JSON.stringify({ t: Date.now(), status: er.status || 0, model: er.model || '', msg: 'reco: ' + String(er.body || er.message || '').slice(0, 280) }), { expirationTtl: 60 * 60 * 24 * 14 }); } catch (e) {}
          throw aiHttpError(er);
        }
        if (!out) throw new HttpError(502, 'AI_UPSTREAM_ERROR');
        await bumpDay(kv, { reco: 1 });
        return json(out);
      }

      // ---------- AI 酒標辨識 (有配額、限大小) ----------
      if (path === '/' || path === '/api/scan') {
        if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: corsHeaders });
        const { image, mediaType, lang } = await readJson(request, 7_000_000);
        if (typeof image !== 'string' || image.length < 100 || image.length > 6_000_000) throw new HttpError(413, 'BAD_IMAGE_SIZE');
        if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, 'AI_NOT_CONFIGURED');

        const tier = await scanTier(request, kv, env);
        if (tier.email && await kv.get('ban:' + tier.email)) throw new HttpError(403, 'BANNED');
        if (await kv.get('scanblock:' + tier.id) || (tier.ipId && await kv.get('scanblock:' + tier.ipId))) throw new HttpError(429, 'TEMP_BLOCKED');
        const mk = `quota:${tier.id}:${ym()}`;
        const ipk = tier.ipId ? `quota:${tier.ipId}:${ym()}` : null;
        const mttl = 60 * 60 * 24 * 40;
        // 預留月額度 (用戶 + 訪客 IP)：預留都計入上限，並發請求唔會超額；AI 成功先 commit，其他情況 (AI 失敗、唔係酒) 喺 finally 退還
        const [qRes, ipRes] = await Promise.all([limReserve(env, mk, tier.limit, mttl), ipk ? limReserve(env, ipk, tier.ipLimit, mttl) : null]);
        const held = [qRes, ipRes];
        let scanDone = false;
        try {
        if (ipRes && !ipRes.ok) { await bumpDay(kv, { quota_out: 1 }); throw new HttpError(429, 'QUOTA_EXCEEDED', { tier: tier.tier, limit: tier.limit, used: tier.limit }); }
        if (!qRes.ok) {
          const br = tier.email ? await bonusReserve(env, tier.email) : null;
          if (!br || !br.ok) { await bumpDay(kv, { quota_out: 1 }); throw new HttpError(429, 'QUOTA_EXCEEDED', { tier: tier.tier, limit: tier.limit, used: qRes.used }); }
          held.push(br);
        }
        const ipDayKey = `rl:scanip:${ip}:${ymd()}`, allDayKey = `rl:scanall:${ymd()}`;
        const [ipDayOk, allDayOk] = await Promise.all([limTake(env, ipDayKey, envInt(env.SCAN_IP_DAILY, 60), 86400), limTake(env, allDayKey, envInt(env.SCAN_GLOBAL_DAILY, 1500), 86400)]);
        if (!ipDayOk || !allDayOk) {
          await Promise.all([ipDayOk && limRefund(env, ipDayKey), allDayOk && limRefund(env, allDayKey)]);
          throw new HttpError(429, ipDayOk ? 'SERVICE_BUSY' : 'RATE_LIMITED_IP');
        }

        // 以實際檔頭判斷格式，避免手機相片標示與內容不符令 AI 拒收
        let mt = ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg';
        try {
          const hd = atob(image.slice(0, 24).replace(/[^A-Za-z0-9+/]/g, '').slice(0, 16));
          if (hd.charCodeAt(0) === 0xFF && hd.charCodeAt(1) === 0xD8) mt = 'image/jpeg';
          else if (hd.charCodeAt(0) === 0x89 && hd.slice(1, 4) === 'PNG') mt = 'image/png';
          else if (hd.slice(0, 4) === 'RIFF' && hd.slice(8, 12) === 'WEBP') mt = 'image/webp';
        } catch (e) {}
        const content = [
          { type: 'image', source: { type: 'base64', media_type: mt, data: image } },
          { type: 'text', text: lang === 'en' ? SCAN_PROMPT + EN_SUFFIX : SCAN_PROMPT }
        ];
        const strong = env.SCAN_MODEL_STRONG || 'claude-sonnet-5-5';
        const fast = env.SCAN_MODEL_FAST || 'claude-haiku-5-5';
        let out = null, modelUsed = strong;
        try {
          const ask = async (mdl) => { lastEmpty = null; const txt = await callClaude(env, mdl, content, 4000); const j = extractJson(txt); if (!j) { const er = new Error('AI_BAD_JSON'); er.status = 200; er.model = mdl; er.body = 'PARSE FAIL stop=' + (lastEmpty && lastEmpty.stop) + ' types=' + (lastEmpty && lastEmpty.types) + ' tail: ' + String(txt).slice(-200); throw er; } return j; };
          if (env.SCAN_FAST_FIRST === '1') {
            out = await ask(fast).catch(() => null);
            modelUsed = fast;
            const lowConf = !out || (!out.not_alcohol && Number(out.conf || 0) < envInt(env.SCAN_CONF_MIN, 75));
            if (lowConf) out = null;
          }
          if (!out) {
            // 強模型繁忙 (429/529)、5xx、連線失敗或回覆壞咗：轉快速模型再試一次
            try { out = await ask(strong); modelUsed = strong; }
            catch (e1) { if (!aiRetryable(e1) || fast === strong) throw e1; out = await ask(fast); modelUsed = fast; }
          }
        } catch (er) {
          try { await kv.put('ailast', JSON.stringify({ t: Date.now(), status: er.status || 0, model: er.model || '', msg: String(er.body || er.message || '').slice(0, 300) }), { expirationTtl: 60 * 60 * 24 * 14 }); } catch (e) {}
          await bumpDay(kv, { ai_err: 1 });
          throw aiHttpError(er);
        }
        if (!out) throw new HttpError(502, 'AI_UPSTREAM_ERROR');

        if (out.not_alcohol) {
          // 唔係酒類相：唔扣額度，但累計警告，反覆亂影會被暫停 24 小時
          const sk = `strike:${tier.id}:${ymd()}`;
          const n = parseInt(await kv.get(sk) || '0', 10) + 1;
          await kv.put(sk, String(n), { expirationTtl: 86400 });
          if (n >= 5) await kv.put('scanblock:' + tier.id, '1', { expirationTtl: 86400 });
          if (tier.ipId) {
            const ik = `strike:${tier.ipId}:${ymd()}`;
            const ni = parseInt(await kv.get(ik) || '0', 10) + 1;
            await kv.put(ik, String(ni), { expirationTtl: 86400 });
            if (ni >= 10) await kv.put('scanblock:' + tier.ipId, '1', { expirationTtl: 86400 });
          }
          await bumpDay(kv, { not_alcohol: 1 });
          throw new HttpError(422, 'NOT_ALCOHOL');
        }
        await Promise.all(held.map(r => limCommit(env, r)));
        scanDone = true;
        if (tier.email) await kv.put('scanned:' + tier.email, '1', { expirationTtl: 60 * 60 * 24 * 400 });
        await bumpDay(kv, { scan: 1, [tier.tier === 'guest' ? 'scan_guest' : 'scan_user']: 1, ['c:' + String(out.category || '其他').slice(0, 12)]: 1, ['k:' + String(out.country || '未知').slice(0, 12)]: 1, ['mdl:' + modelUsed]: 1 });
        out.critics = cleanCritics(out.critics);
        out._quota = { tier: tier.tier, used: qRes.used, limit: tier.limit, bonus: tier.email ? await bonusBalance(env, tier.email) : 0 };
        out._model = modelUsed;
        return new Response(JSON.stringify(out), { headers: jsonHeaders });
        } finally {
          if (!scanDone) await Promise.all(held.map(r => limRelease(env, r)));
        }
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.code, ...err.extra }, err.status);
      console.error('[BottleSense] error:', err);
      return json({ error: 'INTERNAL_ERROR' }, 500);
    }
  }
};

async function photoOwnerOf(syncKey) { return (await sha256hex('photo-owner:' + syncKey)).slice(0, 12); }

// 刪除某分享身分嘅全部探索池項目 (分頁讀完，唔止頭 500 項)，並由酒瓶相索引移除佢哋同佢嘅相片
async function deleteExploreOf(kv, share, photoOwners) {
  const ids = new Set();
  let cursor;
  do {
    const l = await kv.list({ prefix: 'exp:', limit: 1000, cursor });
    for (const k of l.keys) if (k.metadata && k.metadata.o === share) { await kv.delete(k.name); ids.add(k.name.slice(4)); }
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor);
  try {
    const raw = await kv.get('expimg:index');
    if (raw) {
      const marks = (photoOwners || []).map(o => '/api/photo/' + o + '/');
      const cur = JSON.parse(raw);
      const keep = cur.filter(e => !ids.has(e.id) && !marks.some(m => String(e.img || '').includes(m)));
      if (keep.length !== cur.length) await kv.put('expimg:index', JSON.stringify(keep), { expirationTtl: 60 * 60 * 24 * 120 });
    }
  } catch (e) {}
  return ids.size;
}

async function deletePhotosOf(env, kv, owner) {
  try {
    if (env.PHOTOS) {
      let cursor;
      do {
        const l = await env.PHOTOS.list({ prefix: `photos/${owner}/`, cursor });
        for (const o of l.objects) await env.PHOTOS.delete(o.key);
        cursor = l.truncated ? l.cursor : null;
      } while (cursor);
    }
    let cur;
    do {
      const l = await kv.list({ prefix: `photo:${owner}/`, cursor: cur });
      for (const k of l.keys) await kv.delete(k.name);
      cur = l.list_complete ? null : l.cursor;
    } while (cur);
  } catch (e) {}
}
