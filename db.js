// db.js - 永久鎖定 BottleSenseDB，管理本地儲存與跨庫遷移
const DB_NAME = 'BottleSenseDB';
const STORE_NAME = 'bottles';
const WORKER_API_URL = "https://bottlesense-api.fiveathree.workers.dev";

window.cellar = [];

let mySyncKey = localStorage.getItem('bottlesense_sync_key') || '';
if (!mySyncKey) {
  mySyncKey = 'BTL-' + Math.random().toString(36).substring(2,6).toUpperCase() + '-' + Math.random().toString(36).substring(2,6).toUpperCase();
  localStorage.setItem('bottlesense_sync_key', mySyncKey);
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
    const res = await fetch(`${WORKER_API_URL}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncKey: currentKey, cellar: local, deleted })
    });
    if (!res.ok) throw new Error('sync http ' + res.status);
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
  } catch(e) {
    console.warn('cloud sync failed', e);
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
