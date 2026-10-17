// db.js - 永久鎖定 BottleSenseDB，管理本地儲存與跨庫遷移
const DB_NAME = 'BottleSenseDB';
const STORE_NAME = 'bottles';
const WORKER_API_URL = "https://bottlesense-api.fiveathree.workers.dev";

window.cellar = [];

// 高熵同步碼 (128-bit, crypto 隨機)。舊版 8 位短碼太易猜，一律升級。
function genStrongKey() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return 'BTL-' + Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function isStrongSyncKey(k) { return /^BTL-[0-9A-F]{32}$/.test(String(k || '')); }
let mySyncKey = localStorage.getItem('bottlesense_sync_key') || '';
// 訪客 (未綁定帳號) 的弱同步碼直接換成新的；已綁定帳號會在重新登入時由伺服器換發
if (!mySyncKey || (!isStrongSyncKey(mySyncKey) && !localStorage.getItem('bottlesense_account_bound'))) {
  mySyncKey = genStrongKey();
  localStorage.setItem('bottlesense_sync_key', mySyncKey);
}

/* ---------------- 登入 session 與 API 呼叫 ---------------- */
function getSessionToken() { try { return localStorage.getItem('bottlesense_session') || ''; } catch (e) { return ''; } }
function setSessionToken(t) { try { if (t) localStorage.setItem('bottlesense_session', t); else localStorage.removeItem('bottlesense_session'); } catch (e) {} }

function setSyncStatus(state) {
  window._syncState = state;
  const el = document.getElementById('syncDot');
  if (!el) return;
  el.dataset.state = state;
  const en = (localStorage.getItem('bottlesense_lang') || 'zh') === 'en';
  const labels = en ? { ok: 'Synced', syncing: 'Syncing...', offline: 'Offline (will sync later)', error: 'Sync failed', auth: 'Please sign in again' } : { ok: '已同步', syncing: '同步中…', offline: '離線 (稍後自動同步)', error: '同步失敗', auth: '需要重新登入' };
  el.title = labels[state] || '';
  el.setAttribute('aria-label', labels[state] || '');
}

// 統一 API 入口：自動附上登入 token 與同步碼；401 時通知 UI 重新登入
async function apiFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const tok = getSessionToken();
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  const key = localStorage.getItem('bottlesense_sync_key');
  if (key && !headers['X-Sync-Key']) headers['X-Sync-Key'] = key;
  if (opts.body && typeof opts.body === 'string' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(WORKER_API_URL + path, { ...opts, headers });
  if (res.status === 401 || res.status === 400) {
    let code = '';
    try { code = (await res.clone().json()).error || ''; } catch (e) {}
    if ((res.status === 401 && code === 'AUTH_REQUIRED') || code === 'WEAK_SYNC_KEY') {
      if (typeof handleAuthExpired === 'function') handleAuthExpired();
    }
  }
  return res;
}

function openDB(name = DB_NAME) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadCellarWithMigration() {
  // 舊版資料庫只遷移一次；之後只讀主庫，否則已刪除的酒款會被舊庫「復活」
  const migrated = localStorage.getItem('bottlesense_migrated_v2') === '1';
  const oldDbNames = migrated ? ['BottleSenseDB'] : ['BottleSenseDB', 'BottleSenseDB_V7', 'BottleSenseDB_V6', 'BottleSenseDB_V5', 'BottleSenseDB_V4', 'BottleSenseDB_V3'];
  const tomb = getDeletedMap();
  let allFound = [];
  const seenIds = new Set();

  for (const name of oldDbNames) {
    try {
      const db = await openDB(name);
      if (db.objectStoreNames.contains(STORE_NAME)) {
        const items = await new Promise((res) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).getAll();
          req.onsuccess = () => res(req.result || []);
          req.onerror = () => res([]);
        });
        for (const rawItem of items) {
          if (rawItem && rawItem.id && !seenIds.has(rawItem.id) && !(tomb[rawItem.id] && Number(tomb[rawItem.id]) >= Number(rawItem.updatedAt || rawItem.addedAt || 0))) {
            seenIds.add(rawItem.id);
            // imageData 係 image 嘅重複副本：只有 imageData 嘅舊酒款先搬去 image，之後刪除
            if (rawItem.imageData !== undefined) {
              if (!rawItem.image && rawItem.imageData) rawItem.image = rawItem.imageData;
              delete rawItem.imageData;
            }
            const item = {
              ...rawItem,
              status: rawItem.status || 'unopened',
              identification: rawItem.identification || {},
              tags: rawItem.tags || {
                category: rawItem.identification?.category || '酒類',
                vintage: rawItem.identification?.vintage || '',
                country: rawItem.identification?.country || '',
                region: rawItem.identification?.region || ''
              },
              tastings: rawItem.tastings || [],
              isFavorite: !!rawItem.isFavorite
            };
            allFound.push(item);
          }
        }
      }
    } catch(e) {}
  }

  try {
    const mainDb = await openDB(DB_NAME);
    const tx = mainDb.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const b of allFound) store.put(b);
  } catch(e) {}

  try { localStorage.setItem('bottlesense_migrated_v2', '1'); } catch(e) {}
  window.cellar = allFound.sort((a,b) => (b.addedAt || 0) - (a.addedAt || 0));
  return window.cellar;
}

// 訪客(查看他人分享)模式一律唯讀：不寫入本機、不同步雲端
function isReadOnlyMode() {
  try { return typeof isVisitorMode !== 'undefined' && !!isVisitorMode; } catch(e) { return false; }
}

function getDeletedMap() {
  try { return JSON.parse(localStorage.getItem('bottlesense_deleted') || '{}') || {}; } catch(e) { return {}; }
}
function setDeletedMap(m) {
  try { localStorage.setItem('bottlesense_deleted', JSON.stringify(m || {})); } catch(e) {}
}

function waitTx(tx) {
  return new Promise((res) => {
    tx.oncomplete = () => res(true);
    tx.onerror = () => res(false);
    tx.onabort = () => res(false);
  });
}

async function readAllLocal() {
  try {
    const db = await openDB(DB_NAME);
    return await new Promise((res) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
  } catch(e) { return []; }
}

/* ---------------- 逐欄位同步 (docs/specs/2026-10-sync-merge.md) ----------------
   每支酒 _f = { 欄位: 時間戳 }；每條品鑑 _t；刪除品鑑 _td；刪除酒款寫 bottlesense_deleted，刪除優先。
   時間戳用混合邏輯時鐘：本機時間同見過嘅最大時間戳取較大者再加一，同一部機永遠遞增。
   欄位分類同 worker.js 嘅 SYNC_META 一樣，改其中一邊要同步改另一邊。 */
const SYNC_META = new Set(['id', 'addedAt', 'updatedAt', '_f', '_td', 'tastings', 'imageData']);
function syncJ(v) { return v === undefined ? '' : JSON.stringify(v); }
function syncFields(b) { return Object.keys(b || {}).filter(k => !SYNC_META.has(k)); }
function hlcNow() {
  let last = 0;
  try { last = Number(localStorage.getItem('bottlesense_hlc')) || 0; } catch(e) {}
  const t = Math.max(Date.now(), last + 1);
  try { localStorage.setItem('bottlesense_hlc', String(t)); } catch(e) {}
  return t;
}
// 收到雲端資料：記低見過嘅最大時間戳 (雲端已限制唔會超過伺服器時間 5 分鐘)
function hlcSeen(list) {
  let last = 0;
  try { last = Number(localStorage.getItem('bottlesense_hlc')) || 0; } catch(e) {}
  let mx = last;
  for (const b of (list || [])) if (b && Number(b.updatedAt) > mx) mx = Number(b.updatedAt);
  if (mx > last) { try { localStorage.setItem('bottlesense_hlc', String(mx)); } catch(e) {} }
}
function stripTs(t) { const { _t, ...x } = t || {}; return x; }
// 儲存前比較本機舊版：只為真正改咗嘅欄位／品鑑蓋時間戳，刪除咗嘅品鑑記入 _td
function stampBottle(b, old, ts) {
  const base = Number((old && (old.updatedAt || old.addedAt)) || 0);
  const f = { ...((old && old._f) || b._f || {}) };
  if (old && !old._f) for (const k of syncFields(old)) f[k] = base;
  const ref = old || {};
  let changed = !old;
  for (const k of new Set([...syncFields(b), ...syncFields(ref)])) {
    if (!old || syncJ(b[k]) !== syncJ(ref[k])) { f[k] = ts; changed = true; }
  }
  const oldT = new Map(((old && old.tastings) || []).map(t => [String(t.id), t]));
  const td = { ...((old && old._td) || b._td || {}) };
  const seen = new Set();
  b.tastings = (Array.isArray(b.tastings) ? b.tastings : []).map(t => {
    const o = oldT.get(String(t.id));
    seen.add(String(t.id));
    if (o && syncJ(stripTs(t)) === syncJ(stripTs(o))) return { ...t, _t: o._t != null ? o._t : base };
    changed = true;
    return { ...t, _t: ts };
  });
  for (const id of oldT.keys()) if (!seen.has(id)) { td[id] = ts; changed = true; }
  delete b.imageData;
  b._f = f; b._td = td;
  b.updatedAt = Math.max(changed ? ts : base, ...Object.values(f), ...b.tastings.map(t => t._t || 0));
}
// 雲端合併結果寫回本機：以雲端為準，只保留送出之後 (時間戳 > snap) 本機再改過嘅欄位／品鑑
function applyServerBottle(s, l, snap) {
  const m = { ...s, _f: { ...(s._f || {}) }, _td: { ...(s._td || {}) } };
  let dirty = false;
  const lf = l._f || {};
  for (const k in lf) if (lf[k] > snap) { if (l[k] === undefined) delete m[k]; else m[k] = l[k]; m._f[k] = lf[k]; dirty = true; }
  for (const id in (l._td || {})) if (l._td[id] > snap) { m._td[id] = l._td[id]; dirty = true; }
  const tm = new Map((s.tastings || []).map(t => [String(t.id), t]));
  for (const t of (l.tastings || [])) if (Number(t._t) > snap) { tm.set(String(t.id), t); dirty = true; }
  m.tastings = [...tm.values()].filter(t => m._td[String(t.id)] == null);
  if (dirty) m.updatedAt = Math.max(Number(s.updatedAt) || 0, Number(l.updatedAt) || 0);
  return { m, dirty };
}

async function readLocalBottle(db, id) {
  return new Promise((res) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    req.onsuccess = () => res(req.result || null);
    req.onerror = () => res(null);
  });
}

async function saveBottleToDB(bottle) {
  if (isReadOnlyMode()) return false;
  try {
    // 刪除優先：已刪除 (包括其他裝置刪除並已同步) 嘅酒唔再寫入
    if (getDeletedMap()[bottle.id] != null) {
      if (typeof onBottleGone === 'function') onBottleGone(bottle.id);
      return false;
    }
    const db = await openDB(DB_NAME);
    stampBottle(bottle, await readLocalBottle(db, bottle.id), hlcNow());
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(bottle);
    await waitTx(tx);
    scheduleSync();
    if (typeof bottle.image === 'string' && bottle.image.startsWith('data:')) schedulePhotoMigration();
    return true;
  } catch(e) {
    console.error('DB save error', e);
  }
}

async function deleteBottleFromDB(id) {
  if (isReadOnlyMode()) return;
  try {
    const m = getDeletedMap();
    m[id] = hlcNow();
    setDeletedMap(m);
    const db = await openDB(DB_NAME);
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    await waitTx(tx);
    scheduleSync();
  } catch(e) {
    console.error('DB delete error', e);
  }
}

// 直接寫入本機(不觸發雲端同步)，供登入還原/合併使用
async function putBottlesLocalRaw(list) {
  const db = await openDB(DB_NAME);
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const st = tx.objectStore(STORE_NAME);
  for (const b of (list || [])) if (b && b.id) st.put(b);
  await waitTx(tx);
}
async function deleteBottlesLocalRaw(ids) {
  const db = await openDB(DB_NAME);
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const st = tx.objectStore(STORE_NAME);
  for (const id of (ids || [])) st.delete(id);
  await waitTx(tx);
}

let _syncTimer = null;
let _syncing = false;
let _syncAgain = false;

function scheduleSync() {
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => { syncToCloudKV(); }, 800);
}

// 雙向同步：以 IndexedDB(主庫)為準送出，取回雲端合併結果寫回本機
async function syncToCloudKV() {
  if (isReadOnlyMode()) return false;
  const currentKey = localStorage.getItem("bottlesense_sync_key") || mySyncKey;
  if (!currentKey) return false;
  if (_syncing) { _syncAgain = true; return false; }
  _syncing = true;
  let changed = false;
  try {
    // snap 之後本機再改嘅欄位時間戳一定大過佢，寫回雲端結果時要保留
    const snap = hlcNow();
    // imageData 係 image 嘅重複副本，唔再送出
    const local = (await readAllLocal()).map(({ imageData, ...b }) => (b.image || !imageData ? b : { ...b, image: imageData }));
    const deleted = getDeletedMap();
    setSyncStatus('syncing');
    const res = await apiFetch('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ syncKey: currentKey, cellar: local, deleted })
    });
    if (!res.ok) { setSyncStatus(res.status === 401 ? 'auth' : 'error'); throw new Error('sync http ' + res.status); }
    const data = await res.json();
    if (Array.isArray(data.cellar)) {
      hlcSeen(data.cellar);
      if (data.deleted) setDeletedMap({ ...getDeletedMap(), ...data.deleted });
      const tomb = getDeletedMap();
      const cur = await readAllLocal();
      const localMap = new Map(cur.map(b => [String(b.id), b]));
      const toPut = [];
      let again = false;
      for (const s of data.cellar) {
        if (tomb[s.id] != null) continue;
        const l = localMap.get(String(s.id));
        if (!l) { toPut.push(s); continue; }
        const { m, dirty } = applyServerBottle(s, l, snap);
        if (dirty) again = true;
        if (syncJ(m) !== syncJ(l)) toPut.push(m);
      }
      const cloudIds = new Set(data.cellar.map(b => String(b.id)));
      const toDel = cur.filter(b => !cloudIds.has(String(b.id)) && tomb[b.id] != null).map(b => b.id);
      if (toPut.length) { await putBottlesLocalRaw(toPut); changed = true; }
      if (toDel.length) { await deleteBottlesLocalRaw(toDel); changed = true; }
      if (again) _syncAgain = true;
    }
    setSyncStatus('ok');
  } catch(e) {
    console.warn('cloud sync failed', e);
    if (!navigator.onLine) setSyncStatus('offline'); else if (window._syncState === 'syncing') setSyncStatus('error');
  } finally {
    _syncing = false;
    if (_syncAgain) { _syncAgain = false; scheduleSync(); }
  }
  if (changed) {
    await loadCellarWithMigration();
    if (typeof onCloudCellarChanged === 'function') onCloudCellarChanged();
  }
  return changed;
}


/* ---------------- 相片上傳：base64 → 雲端網址 (突破 KV 單值上限，並可離線快取) ---------------- */
let _photoTimer = null;
let _photoRunning = false;
let _photoUnavailable = false;

function schedulePhotoMigration() {
  if (_photoUnavailable) return;
  clearTimeout(_photoTimer);
  _photoTimer = setTimeout(() => { migratePhotosToCloud(); }, 2000);
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = (/data:([^;]+)/.exec(head) || [])[1] || 'image/jpeg';
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

async function shrinkDataUrl(dataUrl, maxDim, q) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  let w = img.width, h = img.height;
  const sc = Math.min(1, maxDim / Math.max(w, h));
  w = Math.round(w * sc); h = Math.round(h * sc);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', q);
}

// 上傳單張相片，成功回傳網址，失敗回傳 null (保留 base64，之後重試)
async function uploadPhotoDataUrl(dataUrl) {
  try {
    let blob = dataUrlToBlob(dataUrl);
    if (blob.size > 850000) blob = dataUrlToBlob(await shrinkDataUrl(dataUrl, 1280, 0.8));
    if (blob.size > 850000) blob = dataUrlToBlob(await shrinkDataUrl(dataUrl, 900, 0.7));
    const res = await apiFetch('/api/photo', { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
    if (res.status === 501 || res.status === 404) { _photoUnavailable = true; return null; }
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.url ? data.url : null;
  } catch (e) { return null; }
}

async function uploadPhotoIfNeeded(bottle) {
  if (!bottle || typeof bottle.image !== 'string' || !bottle.image.startsWith('data:')) return false;
  const url = await uploadPhotoDataUrl(bottle.image);
  if (!url) return false;
  bottle.image = url;
  return true;
}

async function migratePhotosToCloud() {
  if (_photoRunning || _photoUnavailable || isReadOnlyMode() || !navigator.onLine) return;
  _photoRunning = true;
  try {
    const all = await readAllLocal();
    let n = 0;
    for (const b of all) {
      if (n >= 30) { schedulePhotoMigration(); break; }
      if (typeof b.image === 'string' && b.image.startsWith('data:')) {
        const url = await uploadPhotoDataUrl(b.image);
        if (!url) { if (_photoUnavailable) break; continue; }
        b.image = url;
        const live = (window.cellar || []).find(x => String(x.id) === String(b.id));
        if (live) live.image = url;
        await saveBottleToDB(live || b);
        n++;
      }
    }
  } catch (e) { console.warn('photo migration failed', e); }
  _photoRunning = false;
}
