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

async function saveBottleToDB(bottle) {
  if (isReadOnlyMode()) return;
  try {
    bottle.updatedAt = Date.now();
    const m = getDeletedMap();
    if (m[bottle.id]) { delete m[bottle.id]; setDeletedMap(m); }
    const db = await openDB(DB_NAME);
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(bottle);
    await waitTx(tx);
    scheduleSync();
    if (typeof bottle.image === 'string' && bottle.image.startsWith('data:')) schedulePhotoMigration();
  } catch(e) {
    console.error('DB save error', e);
  }
}

async function deleteBottleFromDB(id) {
  if (isReadOnlyMode()) return;
  try {
    const m = getDeletedMap();
    m[id] = Date.now();
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
    const local = await readAllLocal();
    const deleted = getDeletedMap();
    setSyncStatus('syncing');
    const res = await apiFetch('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ syncKey: currentKey, cellar: local, deleted })
    });
    if (!res.ok) { setSyncStatus(res.status === 401 ? 'auth' : 'error'); throw new Error('sync http ' + res.status); }
    const data = await res.json();
    if (Array.isArray(data.cellar)) {
      const localMap = new Map(local.map(b => [String(b.id), b]));
      const toPut = [];
      for (const b of data.cellar) {
        const l = localMap.get(String(b.id));
        if (!l || Number(b.updatedAt || b.addedAt || 0) > Number(l.updatedAt || l.addedAt || 0)) toPut.push(b);
      }
      const cloudIds = new Set(data.cellar.map(b => String(b.id)));
      const toDel = local.filter(b => !cloudIds.has(String(b.id)) && data.deleted && data.deleted[b.id]).map(b => b.id);
      if (toPut.length) { await putBottlesLocalRaw(toPut); changed = true; }
      if (toDel.length) { await deleteBottlesLocalRaw(toDel); changed = true; }
      if (data.deleted) setDeletedMap({ ...getDeletedMap(), ...data.deleted });
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
