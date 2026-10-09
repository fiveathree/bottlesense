
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

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

      const kv = env.CELLAR_KV || env.BOTTLE_KV;
      const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
      if (!kv) {
        return new Response(JSON.stringify({ error: 'KV_NOT_BOUND: 請於 Worker Settings > Bindings 綁定 KV，變數名 CELLAR_KV 或 BOTTLE_KV' }), { status: 500, headers: jsonHeaders });
      }

      try {

      // --- 純電郵 OTP 免密碼認證端點 (Pure Email Auth) ---

      // 1. 發送 6 位數 OTP 驗證碼 (有效 10 分鐘)
      if (path === "/api/auth/send-otp" && request.method === "POST") {
        const { email, name, gender, birthday, type } = await request.json();
        const normalizedEmail = (email || "").toLowerCase().trim();
        if (!normalizedEmail) {
          return new Response(JSON.stringify({ error: "Email is required" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 生成 6 位數安全驗證碼
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await kv.put(`otp:${normalizedEmail}`, otp, { expirationTtl: 600 });

        // 若帶有註冊預備資料，暫存 10 分鐘
        if (name || birthday || gender) {
          await kv.put(`pending_reg:${normalizedEmail}`, JSON.stringify({ name, gender, birthday }), { expirationTtl: 600 });
        }

        // 透過 Google Apps Script 免費發送 HTML 郵件
        const mailRes = await sendEmailViaGAS(env, {
          to: normalizedEmail,
          code: otp,
          type: type || "otp",
          name: name || normalizedEmail.split('@')[0]
        });

        const isUnconfigured = mailRes.error === 'GAS_URL_NOT_CONFIGURED';
        const devMode = env.DEV_MODE === '1';

        if (!mailRes.ok && !devMode) {
          // 正式環境：唔可以將 OTP 傳返畀前端，否則任何人都可冒登入
          await kv.delete(`otp:${normalizedEmail}`);
          return new Response(JSON.stringify({ error: 'EMAIL_SEND_FAILED: ' + (mailRes.error || 'unknown') }), { status: 502, headers: jsonHeaders });
        }

        return new Response(JSON.stringify({
          success: true,
          emailSent: mailRes.ok,
          warning: isUnconfigured ? 'GAS_URL_NOT_CONFIGURED' : (mailRes.ok ? undefined : 'EMAIL_SEND_FAILED'),
          detail: mailRes.ok ? undefined : mailRes.error,
          devOtp: (!mailRes.ok && devMode) ? otp : undefined
        }), { headers: jsonHeaders });
      }

      // 2. 檢查電郵是否已存在
      if (path === "/api/auth/check-email" && request.method === "POST") {
        const { email } = await request.json();
        const normalizedEmail = (email || "").toLowerCase().trim();
        const userKey = await kv.get(`account:${normalizedEmail}`);
        return new Response(JSON.stringify({ exists: !!userKey }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 3. 驗證 OTP 並提取／綁定雲端酒窖
      if (path === "/api/auth/verify-otp" && request.method === "POST") {
        const { email, otp, syncKey, localCellar, localDeleted } = await request.json();
        const normalizedEmail = (email || "").toLowerCase().trim();

        const storedOtp = await kv.get(`otp:${normalizedEmail}`);
        if (!storedOtp || storedOtp !== otp) {
          return new Response(JSON.stringify({ error: "驗證碼無效或已過期，請重新發送。" }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 驗證成功後立即銷毀一次性 OTP，杜絕重放攻擊
        await kv.delete(`otp:${normalizedEmail}`);

        // 查詢用戶帳號
        let userKey = await kv.get(`account:${normalizedEmail}`);
        let profileData = null;
        let cellar = [];

        // 檢查是否有 pending 註冊資料
        const pendingRaw = await kv.get(`pending_reg:${normalizedEmail}`);
        let pendingInfo = {};
        if (pendingRaw) {
          try { pendingInfo = JSON.parse(pendingRaw); } catch(e){}
          await kv.delete(`pending_reg:${normalizedEmail}`);
        }

        const incoming = Array.isArray(localCellar) ? localCellar : [];
        if (userKey) {
          // 既有用戶：雲端酒窖 + 本機(訪客期間)資料 合併
          const rec = parseUserRecord(await kv.get(`user:${userKey}`));
          profileData = rec.profile || {};
          const m = mergeCellars(rec.cellar, incoming, rec.deleted, localDeleted);
          cellar = m.cellar;
          await kv.put(`user:${userKey}`, JSON.stringify({ profile: profileData, cellar, deleted: m.deleted }));
        } else {
          // 新用戶：自動建立內部 UUID 並綁定，並帶入註冊前本機(訪客)資料
          userKey = syncKey || "BTL-" + Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
          await kv.put(`account:${normalizedEmail}`, userKey);
          profileData = {
            email: normalizedEmail,
            name: pendingInfo.name || normalizedEmail.split('@')[0],
            birthday: pendingInfo.birthday || "",
            gender: pendingInfo.gender || "unspecified"
          };
          const m = mergeCellars([], incoming, {}, localDeleted);
          cellar = m.cellar;
          await kv.put(`user:${userKey}`, JSON.stringify({ profile: profileData, cellar, deleted: m.deleted }));
        }

        return new Response(JSON.stringify({
          success: true,
          email: normalizedEmail,
          name: profileData?.name || pendingInfo.name || normalizedEmail.split('@')[0],
          birthday: profileData?.birthday || pendingInfo.birthday || "",
          gender: profileData?.gender || pendingInfo.gender || "unspecified",
          syncKey: userKey,
          cellar: cellar,
          deleted: (parseUserRecord(await kv.get(`user:${userKey}`))).deleted
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 4. 更新用戶個人資料
      if (path === "/api/profile/update" && request.method === "POST") {
        const { email, name, gender, birthday, syncKey } = await request.json();
        const normalizedEmail = (email || "").toLowerCase().trim();
        const userKey = await kv.get(`account:${normalizedEmail}`) || syncKey;
        if (userKey) {
          let currentData = { profile: {}, cellar: [], deleted: {} };
          const raw = await kv.get(`user:${userKey}`);
          if (raw) {
            try {
              const p = JSON.parse(raw);
              if (Array.isArray(p)) currentData.cellar = p;
              else { currentData.cellar = p.cellar || []; currentData.profile = p.profile || {}; currentData.deleted = p.deleted || {}; }
            } catch(e) {}
          }
          currentData.profile = {
            ...currentData.profile,
            email: normalizedEmail,
            name: name || currentData.profile.name,
            gender: gender || currentData.profile.gender,
            birthday: birthday || currentData.profile.birthday
          };
          await kv.put(`user:${userKey}`, JSON.stringify(currentData));
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 5. 永久註銷帳號
      if (path === "/api/account/delete" && request.method === "POST") {
        const { email, syncKey } = await request.json();
        const normalizedEmail = (email || "").toLowerCase().trim();
        const userKey = await kv.get(`account:${normalizedEmail}`) || syncKey;
        if (userKey) {
          await kv.delete(`user:${userKey}`);
          await kv.delete(`public_cellar:${userKey}`);
          await kv.delete(`public_cellar:${await shareIdOf(userKey)}`);
        }
        await kv.delete(`account:${normalizedEmail}`);
        await kv.delete(`otp:${normalizedEmail}`);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }


      } catch (authErr) {
        console.error('[BottleSense Auth] error:', authErr);
        return new Response(JSON.stringify({ error: authErr.message }), { status: 500, headers: jsonHeaders });
      }

    try {
      // 1. 發布完整公開酒窖：公開連結只用「分享 ID」(由同步碼單向雜湊)，絕不暴露同步碼
      if (path === '/api/cellar/publish' && request.method === 'POST') {
        const { syncKey, cellar, ownerName } = await request.json();
        if (!syncKey || !cellar) {
          return new Response(JSON.stringify({ error: "Missing syncKey or cellar data" }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const shareId = await shareIdOf(syncKey);

        const existingData = await kv.get(`public_cellar:${shareId}`);
        let likes = 0;
        let cheers = [];
        if (existingData) {
          try {
            const parsed = JSON.parse(existingData);
            likes = parsed.likes || 0;
            cheers = parsed.cheers || [];
          } catch(e){}
        }

        const payload = {
          shareId,
          ownerName: ownerName || '品飲家',
          updatedAt: Date.now(),
          likes,
          cheers,
          cellar
        };

        await kv.put(`public_cellar:${shareId}`, JSON.stringify(payload), { expirationTtl: 31536000 });
        return new Response(JSON.stringify({ success: true, shareId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 2. 訪客打開連結獲取好友的完整酒窖 (唯讀)
      if (path === '/api/cellar/get' && request.method === 'GET') {
        const key = url.searchParams.get('key');
        if (!key) {
          return new Response(JSON.stringify({ error: "Missing key" }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        // 舊版連結直接用同步碼 (BTL-xxxx)：不再提供，避免外洩私人同步碼
        if (key.startsWith('BTL-')) {
          return new Response(JSON.stringify({ error: "此分享連結已過期，請請朋友重新分享一次。" }), {
            status: 410,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const data = await kv.get(`public_cellar:${key}`);
        if (!data) {
          return new Response(JSON.stringify({ error: "Cellar not found" }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(data, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 3. 陌生人 / 好友免登入點讚 (Like / Cheers)
      if (path === '/api/cellar/like' && request.method === 'POST') {
        const { key } = await request.json();
        const raw = await kv.get(`public_cellar:${key}`);
        if (!raw) {
          return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
        }
        const obj = JSON.parse(raw);
        obj.likes = (obj.likes || 0) + 1;
        await kv.put(`public_cellar:${key}`, JSON.stringify(obj), { expirationTtl: 31536000 });
        return new Response(JSON.stringify({ success: true, likes: obj.likes }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 4. 同步：雙向合併 (多裝置)，回傳合併後結果給客戶端
      if (path === '/api/sync' && request.method === 'POST') {
        const { syncKey, cellar, deleted } = await request.json();
        if (!syncKey) return new Response(JSON.stringify({ error: "Missing syncKey" }), { status: 400, headers: jsonHeaders });
        const rec = parseUserRecord(await kv.get(`user:${syncKey}`));
        const m = mergeCellars(rec.cellar, Array.isArray(cellar) ? cellar : [], rec.deleted, deleted);
        await kv.put(`user:${syncKey}`, JSON.stringify({ profile: rec.profile, cellar: m.cellar, deleted: m.deleted }));
        return new Response(JSON.stringify({ success: true, cellar: m.cellar, deleted: m.deleted }), { headers: jsonHeaders });
      }

      if (path === '/api/restore' && request.method === 'GET') {
        const syncKey = url.searchParams.get('key');
        const rec = parseUserRecord(syncKey ? await kv.get(`user:${syncKey}`) : null);
        return new Response(JSON.stringify({ cellar: rec.cellar, deleted: rec.deleted }), { headers: jsonHeaders });
      }

      // 5. 探索池：發布與獲取社群品飲
      if (path === '/api/explore/publish' && request.method === 'POST') {
        const item = await request.json();
        let feed = [];
        try {
          const raw = await kv.get('community_explore_feed');
          if (raw) feed = JSON.parse(raw);
        } catch(e){}

        // 保留最新 30 筆社群分享
        feed.unshift(item);
        feed = feed.slice(0, 30);

        await kv.put('community_explore_feed', JSON.stringify(feed), { expirationTtl: 31536000 });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (path === '/api/explore' && request.method === 'GET') {
        const raw = await kv.get('community_explore_feed');
        return new Response(raw || '[]', { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 6. AI 酒標辨識 (強化 Prompt 與純 JSON 容錯解析)
      if (path === '/' || path === '/api/scan') {
        if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: corsHeaders });
        const { image, mediaType } = await request.json();

        const prompt = `你是一個世界頂級侍酒師與酒類數據庫專家。請辨識相片中的酒標，並以嚴格的純 JSON 格式輸出（不要包含任何 markdown 標籤或額外文字）：
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

        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-5-5',
            max_tokens: 2000,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
                { type: 'text', text: prompt }
              ]
            }]
          })
        });

        const anthropicData = await anthropicRes.json();
        let text = anthropicData.content?.[0]?.text || '{}';

        const s = text.indexOf('{'), e = text.lastIndexOf('}');
        if (s !== -1 && e !== -1) {
          text = text.substring(s, e + 1);
        }

        return new Response(text, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
};