// db.js - 永久鎖定 BottleSenseDB，絕不改名
const DB_NAME = 'BottleSenseDB';
const STORE_NAME = 'bottles';
const WORKER_API_URL = "https://bottlesense-api.fiveathree.workers.dev";

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

// 自動掃描救回所有舊版本資料庫
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
        for (const item of items) {
          if (item && item.id && !seenIds.has(item.id)) {
            seenIds.add(item.id);
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

  return allFound.sort((a,b) => (b.addedAt || 0) - (a.addedAt || 0));
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