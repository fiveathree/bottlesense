// db.js - 永久鎖定 BottleSenseDB，絕不改名
const DB_NAME = 'BottleSenseDB';
const STORE_NAME = 'bottles';
const WORKER_API_URL = "https://bottlesense-api.fiveathree.workers.dev";

// 全域保證存在
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

// 自動掃描救回所有舊版本資料庫，並標準化資料結構防報錯
async function loadCellarWithMigration() {
  const oldDbNames = ['BottleSenseDB', 'BottleSenseDB_V7', 'BottleSenseDB_V6', 'BottleSenseDB_V5', 'BottleSenseDB_V4', 'BottleSenseDB_V3'];
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
          if (rawItem && rawItem.id && !seenIds.has(rawItem.id)) {
            seenIds.add(rawItem.id);
            // 防呆補齊必備物件，防止讀取 undefined 搞到畫面空白
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

  window.cellar = allFound.sort((a,b) => (b.addedAt || 0) - (a.addedAt || 0));
  return window.cellar;
}

async function saveBottleToDB(bottle) {
  try {
    const db = await openDB(DB_NAME);
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(bottle);
    syncToCloudKV();
  } catch(e) { console.error('DB save error', e); }
}

async function deleteBottleFromDB(id) {
  try {
    const db = await openDB(DB_NAME);
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    syncToCloudKV();
  } catch(e) { console.error('DB delete error', e); }
}

async function syncToCloudKV() {
  if (!mySyncKey || !window.cellar) return;
  try {
    await fetch(`${WORKER_API_URL}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncKey: mySyncKey, cellar: window.cellar })
    });
  } catch(e) {}
}
