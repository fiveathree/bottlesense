
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

function stampOf(b) { return Number(b && (b.updatedAt || b.addedAt) || 0); }

// 以 id 合併兩份酒窖：較新 updatedAt 勝出；刪除記錄 (tombstone) 比該酒款更新則剔除
function mergeCellars(cloud, incoming, deletedCloud, deletedIncoming) {
  const deleted = { ...(deletedCloud || {}) };
  for (const [id, ts] of Object.entries(deletedIncoming || {})) {
    if (!deleted[id] || Number(ts) > Number(deleted[id])) deleted[id] = Number(ts);
  }
  const map = new Map();
  for (const b of [...(cloud || []), ...(incoming || [])]) {
    if (!b || !b.id) continue;
    const key = String(b.id);
    const prev = map.get(key);
    if (!prev || stampOf(b) >= stampOf(prev)) map.set(key, b);
  }
  const merged = [];
  for (const [id, b] of map) {
    if (deleted[id] && Number(deleted[id]) >= stampOf(b)) continue;
    merged.push(b);
  }
  return { cellar: merged, deleted };
}

const SCAN_PROMPT = `你是一個世界頂級侍酒師與酒類數據庫專家。請辨識相片中的酒標，並以嚴格的純 JSON 格式輸出（不要包含任何 markdown 標籤或額外文字）：
{
  "category": "紅酒/白酒/威士忌/清酒/氣泡酒/啤酒/琴酒/蘭姆酒/白蘭地/泡盛/利口酒/其他",
  "name": "酒款名稱（中英文皆可，精準全名）",
  "producer": "酒莊/酒廠/品牌名稱",
  "country": "生產國家",
  "region": "產區",
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
    "reason": "適飲期與整體風味簡評",
    "actions": [
      { "a": "drink", "reason": "風味表現說明" },
      { "a": "share", "reason": "聚會分享建議" },
      { "a": "store", "reason": "保存條件" }
    ]
  }
}

【八維價值評估 (vm) 嚴格客觀評分標準（0-100，務必根據酒款等級客觀給分，絕不可千篇一律給高分）】：
- mv (市場價值)：依零售市場價格評估。平價日常啤酒/低價餐酒打 15-30 分；中高階精品打 50-75 分；拍賣級奢華名酒打 85-98 分。
- ql (品質)：原料工藝與風味表現 (60-95 分)。
- dv (飲用價值)：當前適飲期的愉悅感與爽快度 (60-95 分)。
- pv (配餐價值)：佐餐百搭性 (60-95 分)。
- sv (社交話題)：知名度、品牌傳奇與討論度 (30-95 分)。
- gv (送禮價值)：排面、外觀與受禮喜好度。日常啤酒/罐裝打 20-35 分；精裝烈酒/名莊打 75-95 分。
- cv (收藏價值)：【極其嚴格】只有具備罕見性、拍賣價值或陳年升值空間的名酒(如波爾多特級名莊、高年份單一麥芽威士忌、貴州茅台)才可給 70-98 分；大眾商業量產啤酒、罐裝啤酒、即飲平價酒【嚴禁高分，必須給 5-25 分】！
- sto (保存價值)：【極其嚴格】指長期陳年潛力。啤酒、生酒必須於數月內飲用，保存價值必須給 10-30 分；具備 10 年以上陳年能力的名莊葡萄酒或烈酒才可給 80-95 分。`;

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
function ymd() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
function ym() { return new Date().toISOString().slice(0, 7).replace('-', ''); }
function envInt(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }

class HttpError extends Error {
  constructor(status, code, extra) { super(code); this.status = status; this.code = code; this.extra = extra || {}; }
}

// KV 計數式限流 (非原子，足以擋住一般濫用；更強保護請加 Cloudflare Rate Limiting / Turnstile)
async function hit(kv, key, limit, ttl) {
  const cur = parseInt(await kv.get(key) || '0', 10);
  if (cur >= limit) return false;
  await kv.put(key, String(cur + 1), { expirationTtl: Math.max(60, ttl) });
  return true;
}
async function limitOrThrow(kv, key, limit, ttl, code) {
  if (!(await hit(kv, key, limit, ttl))) throw new HttpError(429, code || 'RATE_LIMITED');
}

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
    const plan = await kv.get('plan:' + s.email);
    if (plan === 'pro') return { tier: 'pro', id: 'u:' + s.email, limit: envInt(env.SCAN_PRO_MONTHLY, 1000) };
    return { tier: 'free', id: 'u:' + s.email, limit: envInt(env.SCAN_FREE_MONTHLY, 40) };
  }
  const k = request.headers.get('X-Sync-Key') || '';
  const gid = 'g:' + (await sha256hex(isStrongKey(k) ? k : 'anon:' + clientIp(request))).slice(0, 24);
  return { tier: 'guest', id: gid, limit: envInt(env.SCAN_GUEST_MONTHLY, 8) };
}

// ============ 探索池 ============
const EXP_TTL = 60 * 60 * 24 * 90;
function sanitizeExploreItem(b, id, ownerShareId) {
  const idn = (b.identification && typeof b.identification === 'object') ? b.identification : {};
  const ident = {};
  for (const k of ['name', 'producer', 'country', 'region', 'vintage', 'category', 'abv', 'vol']) {
    if (idn[k] !== undefined && idn[k] !== null) ident[k] = clip(String(idn[k]), 160);
  }
  let image = '';
  if (typeof b.image === 'string') {
    if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.image) && b.image.length <= 450_000) image = b.image;
    else if (/^https:\/\/[^\s"'<>]{1,300}$/.test(b.image)) image = b.image;
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
        await limitOrThrow(kv, `rl:otpip:${ip}:${ymd()}${new Date().getUTCHours()}`, 20, 3600, 'RATE_LIMITED_IP');
        await limitOrThrow(kv, `rl:otpem:${e}:${ymd()}${new Date().getUTCHours()}`, 5, 3600, 'RATE_LIMITED_EMAIL');
        if (await kv.get('otpcd:' + e)) throw new HttpError(429, 'COOLDOWN');
        await kv.put('otpcd:' + e, '1', { expirationTtl: 60 });

        const otp = randomOtp();
        await kv.put('otp:' + e, JSON.stringify({ h: await sha256hex(otp + ':' + e), tries: 0, exp: Date.now() + 600_000 }), { expirationTtl: 600 });
        if (name || birthday || gender) {
          await kv.put('pending_reg:' + e, JSON.stringify({ name: clip(name, 60), gender: clip(gender, 20), birthday: clip(birthday, 12) }), { expirationTtl: 600 });
        }
        const mailRes = await sendEmailViaGAS(env, { to: e, code: otp, type: clip(type, 20) || 'otp', name: clip(name, 60) || e.split('@')[0] });
        const devMode = env.DEV_MODE === '1';
        if (!mailRes.ok && !devMode) {
          await kv.delete('otp:' + e);
          return json({ error: 'EMAIL_SEND_FAILED: ' + (mailRes.error || 'unknown') }, 502);
        }
        return json({ success: true, emailSent: mailRes.ok, devOtp: (!mailRes.ok && devMode) ? otp : undefined });
      }

      if (path === '/api/auth/check-email' && request.method === 'POST') {
        const { email } = await readJson(request, 5_000);
        await limitOrThrow(kv, `rl:chk:${ip}:${ymd()}${new Date().getUTCHours()}`, 30, 3600);
        const e = String(email || '').toLowerCase().trim();
        return json({ exists: isEmail(e) ? !!(await kv.get('account:' + e)) : false });
      }

      if (path === '/api/auth/verify-otp' && request.method === 'POST') {
        const { email, otp, syncKey, localCellar, localDeleted } = await readJson(request, 24_000_000);
        const e = String(email || '').toLowerCase().trim();
        await limitOrThrow(kv, `rl:ver:${ip}:${ymd()}${new Date().getUTCHours()}`, 40, 3600, 'RATE_LIMITED_IP');
        const raw = await kv.get('otp:' + e);
        let rec = null; try { rec = raw ? JSON.parse(raw) : null; } catch (er) {}
        const bad = () => json({ error: '驗證碼無效或已過期，請重新發送。' }, 400);
        if (!rec || Date.now() > rec.exp) return bad();
        if (rec.tries >= 5) { await kv.delete('otp:' + e); return json({ error: '嘗試次數過多，請重新發送驗證碼。' }, 429); }
        const h = await sha256hex(String(otp || '') + ':' + e);
        if (!safeEqual(h, rec.h)) {
          rec.tries++;
          await kv.put('otp:' + e, JSON.stringify(rec), { expirationTtl: Math.max(60, Math.floor((rec.exp - Date.now()) / 1000)) });
          return bad();
        }
        await kv.delete('otp:' + e);

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
          const r = parseUserRecord(await kv.get('user:' + userKey));
          profileData = r.profile || {};
          const m = mergeCellars(r.cellar, incoming, r.deleted, localDeleted);
          cellar = m.cellar; deleted = m.deleted;
          await kv.put('user:' + userKey, JSON.stringify({ profile: profileData, cellar, deleted }));
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
          const existing = parseUserRecord(await kv.get('user:' + userKey));
          const m = mergeCellars(existing.cellar, incoming, existing.deleted, localDeleted);
          cellar = m.cellar; deleted = m.deleted;
          await kv.put('user:' + userKey, JSON.stringify({ profile: profileData, cellar, deleted }));
        }
        const token = await createSession(kv, e);
        return json({
          success: true, email: e,
          name: profileData.name || pendingInfo.name || e.split('@')[0],
          birthday: profileData.birthday || pendingInfo.birthday || '',
          gender: profileData.gender || pendingInfo.gender || 'unspecified',
          syncKey: userKey, token, cellar, deleted,
          plan: (await kv.get('plan:' + e)) || 'free'
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

      if (path === '/api/me' && request.method === 'GET') {
        const { email } = await requireSession(request, kv);
        return json({ email, plan: (await kv.get('plan:' + email)) || 'free' });
      }

      if (path === '/api/profile/update' && request.method === 'POST') {
        const { name, gender, birthday } = await readJson(request, 10_000);
        const { email, userKey } = await requireSession(request, kv);
        const r = parseUserRecord(await kv.get('user:' + userKey));
        r.profile = {
          ...r.profile, email,
          name: clip(name, 60) || r.profile.name,
          gender: clip(gender, 20) || r.profile.gender,
          birthday: clip(birthday, 12) || r.profile.birthday
        };
        await kv.put('user:' + userKey, JSON.stringify(r));
        return json({ success: true });
      }

      if (path === '/api/account/delete' && request.method === 'POST') {
        const { email, userKey } = await requireSession(request, kv);
        const share = await shareIdOf(userKey);
        await kv.delete('user:' + userKey);
        await kv.delete('public_cellar:' + share);
        await kv.delete('keyowner:' + userKey);
        await kv.delete('account:' + email);
        await kv.delete('otp:' + email);
        await kv.delete('plan:' + email);
        await kv.put('sessver:' + email, String(parseInt(await kv.get('sessver:' + email) || '0', 10) + 1), { expirationTtl: 60 * 60 * 24 * 100 });
        const ex = await kv.list({ prefix: 'exp:', limit: 500 });
        for (const k of ex.keys) if (k.metadata && k.metadata.o === share) await kv.delete(k.name);
        await deletePhotosOf(env, kv, userKey);
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
        const rec = parseUserRecord(await kv.get('user:' + syncKey));
        const m = mergeCellars(rec.cellar, Array.isArray(cellar) ? cellar : [], rec.deleted, deleted);
        const body = JSON.stringify({ profile: rec.profile, cellar: m.cellar, deleted: m.deleted });
        if (body.length > 24_000_000) throw new HttpError(413, 'CELLAR_TOO_LARGE');
        await kv.put('user:' + syncKey, body);
        return json({ success: true, cellar: m.cellar, deleted: m.deleted });
      }

      if (path === '/api/restore' && request.method === 'GET') {
        const syncKey = url.searchParams.get('key');
        await requireKeyAccess(request, kv, syncKey);
        const rec = parseUserRecord(await kv.get('user:' + syncKey));
        return json({ cellar: rec.cellar, deleted: rec.deleted });
      }

      // ---------- 探索池 (逐筆儲存，無讀寫競爭) ----------
      if (path === '/api/explore/publish' && request.method === 'POST') {
        const body = await readJson(request, 700_000);
        const { syncKey, ...item } = body;
        await requireKeyAccess(request, kv, syncKey);
        const id = String(item.id || '');
        if (!/^[\w.\-]{1,120}$/.test(id)) throw new HttpError(400, 'BAD_ID');
        await limitOrThrow(kv, `rl:exp:${(await sha256hex(syncKey)).slice(0, 16)}:${ymd()}`, 20, 86400, 'RATE_LIMITED');
        await limitOrThrow(kv, `rl:expip:${ip}:${ymd()}`, 60, 86400, 'RATE_LIMITED');
        const share = await shareIdOf(syncKey);
        const prev = await kv.getWithMetadata('exp:' + id);
        if (prev.value && prev.metadata && prev.metadata.o && prev.metadata.o !== share) throw new HttpError(409, 'ID_TAKEN');
        const clean = sanitizeExploreItem(item, id, share);
        if (!clean.identification.name && !clean.identification.producer) throw new HttpError(400, 'MISSING_NAME');
        await kv.put('exp:' + id, JSON.stringify(clean), { metadata: { t: clean.publishedAt, o: share }, expirationTtl: EXP_TTL });
        return json({ success: true });
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
        await limitOrThrow(kv, `rl:rep:${ip}:${ymd()}`, 20, 86400);
        const dk = `rep:${id}:${(await sha256hex(ip)).slice(0, 16)}`;
        if (await kv.get(dk)) return json({ success: true, already: true });
        await kv.put(dk, '1', { expirationTtl: 60 * 60 * 24 * 90 });
        const ck = 'repcount:' + id;
        const n = parseInt(await kv.get(ck) || '0', 10) + 1;
        await kv.put(ck, String(n), { expirationTtl: 60 * 60 * 24 * 90 });
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
        await limitOrThrow(kv, `rl:ph:${(await sha256hex(syncKey)).slice(0, 16)}:${ymd()}`, 300, 86400, 'RATE_LIMITED');
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
        await limitOrThrow(kv, `rl:off:${ip}:${ymd()}`, 300, 86400);
        const merchants = await loadMerchants(kv);
        const buy = [], similar = [];
        for (const m of merchants) {
          (m.products || []).forEach((p, i) => {
            const { s, exact } = scoreProduct(p, q);
            const item = { m: m.id, i, merchant: m.name, title: p.n, price: p.p || '', s };
            if (exact) buy.push(item); else if (s >= 5) similar.push(item);
          });
        }
        const top = a => a.sort((x, y) => y.s - x.s).slice(0, 2).map(x => ({
          merchant: x.merchant, title: x.title, price: x.price,
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
      // 匿名需求訊號：只記錄「酒款屬性 + 次數」，不記錄是誰
      if (path === '/api/signal' && request.method === 'POST') {
        const b = await readJson(request, 3_000);
        if (!['wishlist', 'scan', 'share_wishlist'].includes(b.type)) throw new HttpError(400, 'BAD_TYPE');
        await limitOrThrow(kv, `rl:sig:${ip}:${ymd()}`, 60, 86400);
        const name = clip(b.name, 120).trim();
        if (!name) throw new HttpError(400, 'MISSING_NAME');
        const dk = `demand:${ym()}:${b.type}:${(await sha256hex(name.toLowerCase())).slice(0, 16)}`;
        const cur = JSON.parse(await kv.get(dk) || 'null') || { name, cat: clip(b.category, 30), country: clip(b.country, 40), region: clip(b.region, 60), c: 0 };
        cur.c++;
        await kv.put(dk, JSON.stringify(cur), { expirationTtl: 60 * 60 * 24 * 120 });
        return json({ success: true });
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
            p: clip(p.p, 40), cat: clip(p.cat, 30), country: clip(p.country, 40), region: clip(p.region, 60),
            tags: (Array.isArray(p.tags) ? p.tags : []).slice(0, 10).map(t => clip(String(t), 40))
          })).filter(p => p.n);
          await kv.put('merchant:' + m.id, JSON.stringify({ id: m.id, name: clip(m.name, 80), url: clip(m.url, 500), active: m.active !== false, products }));
          merchantCache.t = 0;
          return json({ success: true, products: products.length });
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
          for (const k of dl.keys) { const v = JSON.parse(await kv.get(k.name) || 'null'); if (v && v.c >= 3) demand.push({ ...v, type: k.name.split(':')[2] }); }
          demand.sort((a, b) => b.c - a.c);
          return json({ month, merchants: stats, demand: demand.slice(0, 100) });
        }
        if (path === '/api/admin/explore/remove' && request.method === 'POST') {
          const { id } = await readJson(request, 1000);
          await kv.delete('exp:' + id);
          return json({ success: true });
        }
        throw new HttpError(404, 'NOT_FOUND');
      }

      // ---------- AI 酒標辨識 (有配額、限大小) ----------
      if (path === '/' || path === '/api/scan') {
        if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: corsHeaders });
        const { image, mediaType } = await readJson(request, 7_000_000);
        if (typeof image !== 'string' || image.length < 100 || image.length > 6_000_000) throw new HttpError(413, 'BAD_IMAGE_SIZE');
        if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, 'AI_NOT_CONFIGURED');

        const tier = await scanTier(request, kv, env);
        const mk = `quota:${tier.id}:${ym()}`;
        const used = parseInt(await kv.get(mk) || '0', 10);
        if (used >= tier.limit) throw new HttpError(429, 'QUOTA_EXCEEDED', { tier: tier.tier, limit: tier.limit, used });
        await limitOrThrow(kv, `rl:scanip:${ip}:${ymd()}`, envInt(env.SCAN_IP_DAILY, 60), 86400, 'RATE_LIMITED_IP');
        const gk = `rl:scanall:${ymd()}`;
        await limitOrThrow(kv, gk, envInt(env.SCAN_GLOBAL_DAILY, 1500), 86400, 'SERVICE_BUSY');

        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-5-5',
            max_tokens: 2000,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg', data: image } },
                { type: 'text', text: SCAN_PROMPT }
              ]
            }]
          })
        });
        if (!anthropicRes.ok) throw new HttpError(502, 'AI_UPSTREAM_ERROR');
        const anthropicData = await anthropicRes.json();
        let text = anthropicData.content?.[0]?.text || '{}';
        const s = text.indexOf('{'), e = text.lastIndexOf('}');
        if (s !== -1 && e !== -1) text = text.substring(s, e + 1);
        await kv.put(mk, String(used + 1), { expirationTtl: 60 * 60 * 24 * 40 });
        let out;
        try { out = JSON.parse(text); out._quota = { tier: tier.tier, used: used + 1, limit: tier.limit }; text = JSON.stringify(out); } catch (er) {}
        return new Response(text, { headers: jsonHeaders });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.code, ...err.extra }, err.status);
      console.error('[BottleSense] error:', err);
      return json({ error: 'INTERNAL_ERROR' }, 500);
    }
  }
};

async function deletePhotosOf(env, kv, userKey) {
  const owner = (await sha256hex('photo-owner:' + userKey)).slice(0, 12);
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
