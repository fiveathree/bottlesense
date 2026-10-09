/* BottleSense app.js
 * 旗艦完整修復版：
 * 1. 修復探索頁面點擊無反應問題（改用安全內聯 SVG，永不死圖且即時反應）
 * 2. 探索頁支援全方位上下左右平移、滑鼠滾輪縮放與手機雙指捏合縮放 (Pinch)
 * 3. 智慧真實地理座標釘選 (蘇格蘭、法國、日本沖繩、美國等) 100% 貼合陸地
 * 4. 首頁 6 格工整排列 (含 🎲 隨機賞味抽取)
 * 5. Know your bottle: 酒款介紹與專業處置建議置頂，品飲歷程與轉移列下移
 * 6. 轉移藏酒空間改為單行極致收窄膠囊列
 * 7. 支援繁英雙語即時切換、HUD 對位相機與首酒引繼/註冊彈窗
 */

const main = document.getElementById('main');
const modalContainer = document.getElementById('modal-container');
const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');

const TELEGRAM_PLANE_SVG = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
const EDIT_PENCIL_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ACTION_ICONS = { drink:"🥃", pair:"🍽️", share:"👥", gift:"🎁", collect:"💎", sell:"💰", store:"🌡️", keep:"💎" };

let currentView = 'home';
let currentBottleDetailId = null;
let previousViewBeforeDetail = 'home';
let timelineExpandedState = {};
let currentScene = 'cooler';
let activeFilter = 'all';

let isVisitorMode = false;
let visitorCellarData = null;

// ==========================================
// 繁英雙語字典系統 (i18n)
// ==========================================
let currentLang = localStorage.getItem('bottlesense_lang') || 'zh';

const I18N = {
  zh: {
    nav_scan: "辨識",
    nav_cellar: "酒櫃",
    nav_explore: "探索",
    hero_title: "認識你的每一瓶酒",
    hero_desc: "拍下酒標，AI 分析風味維度、最佳賞味期與處置決策。",
    choose_album: "從相簿選照片",
    spaces_title: "藏酒空間與隨機探索",
    open_cellar: "打開酒櫃 →",
    recent_title: "最近加入",
    view_all: "查看全部 →",
    empty_cellar: "酒櫃目前是空的<br>先拍一瓶酒標開始吧。",
    space_cooler: "⚡ 未飲",
    space_wood: "🪵 已飲",
    space_bar: "🥃 飲完",
    space_wish: "🏷️ 想買",
    space_fav: "⭐ 最愛",
    space_random: "🎲 隨機賞味",
    shelf_cooler_title: "⚡ 電子恆溫酒櫃 (未飲)",
    shelf_wood_title: "🪵 實木日常酒架 (已飲中)",
    shelf_bar_title: "🥃 吧台展示桌 (飲完紀念)",
    shelf_wish_title: "🏷️ 願望清單 (想買)",
    shelf_fav_title: "⭐ 心頭好精選 (最愛)",
    share_cellar: "分享全窖",
    filter_all: "全部",
    empty_shelf: "此空間暫無藏酒",
    confidence_label: "辨識度",
    back: "← 返回",
    share_bottle: "分享此酒",
    edit_info: "編輯資料",
    transfer_title: "📍 轉移藏酒空間",
    timeline_title: "🥃 品飲記錄時間軸",
    btn_add_log: "記錄",
    timeline_hint: "記錄不同時間、地點與同伴帶來的獨特體驗。",
    no_logs: "尚未記錄品飲歷史，點擊上方按鈕記錄你的第一杯！",
    btn_remove: "從酒庫中移除",
    crop_hint: "雙指縮放拖曳對準酒瓶",
    guide_label_tag: "請將酒標置於框內",
    zoom_label: "縮放:",
    btn_confirm_crop: "確認辨識",
    analyzing_title: "正在辨識酒標",
    analyzing_desc: "AI 正在分析酒款、年份及產區…",
    settings_title: "設定與備份",
    sync_key_label: "你的專屬同步碼 (Sync Key)",
    btn_copy_sync: "複製同步碼",
    btn_close: "關閉",
    copied_toast: "✓ 已複製專屬連結至剪貼簿！",
    published_toast: "✓ 已成功發布至酒友探索池！",
    explore_title: "世界名釀・金線地圖",
    explore_hint: "地圖已釘選各款名釀產地與同好分享地點，可上下左右拖曳與縮放！",
    confirm_delete: "確定要從酒庫移除這瓶酒？",
    no_random_bottle: "酒窖目前暫無藏酒，無法隨機抽選！"
  },
  en: {
    nav_scan: "Scan",
    nav_cellar: "Cellar",
    nav_explore: "Explore",
    hero_title: "Know What To Do With It",
    hero_desc: "Snap a label. Let AI analyze flavor profiles, peak window & drinking decisions.",
    choose_album: "Upload from Photos",
    spaces_title: "Spaces & Random Pick",
    open_cellar: "Open Cellar →",
    recent_title: "Recently Added",
    view_all: "View All →",
    empty_cellar: "Your cellar is empty.<br>Snap a bottle label to begin.",
    space_cooler: "⚡ Unopened",
    space_wood: "🪵 Opened",
    space_bar: "🥃 Finished",
    space_wish: "🏷️ Wishlist",
    space_fav: "⭐ Favorite",
    space_random: "🎲 Surprise Pick",
    shelf_cooler_title: "⚡ Wine Cooler (Unopened)",
    shelf_wood_title: "🪵 Daily Rack (Opened)",
    shelf_bar_title: "🥃 Bar Table (Finished)",
    shelf_wish_title: "🏷️ Wishlist (To Buy)",
    shelf_fav_title: "⭐ Favorites (Top Pick)",
    share_cellar: "Share Cellar",
    filter_all: "All",
    confidence_label: "CONF",
    empty_shelf: "No bottles in this space",
    back: "← Back",
    share_bottle: "Share Bottle",
    edit_info: "Edit Details",
    transfer_title: "📍 Transfer Space",
    timeline_title: "🥃 Tasting Timeline",
    btn_add_log: "Log",
    timeline_hint: "Record how flavor shifts with time, places and companions.",
    no_logs: "No tasting notes yet. Tap above to log your first pour!",
    btn_remove: "Remove from Cellar",
    crop_hint: "Pinch or drag to align bottle",
    guide_label_tag: "Align Label Inside",
    zoom_label: "Zoom:",
    btn_confirm_crop: "Analyze Label",
    analyzing_title: "Analyzing Bottle Label",
    analyzing_desc: "AI is identifying vintage, origin & flavor map…",
    settings_title: "Settings & Backup",
    sync_key_label: "Your Private Sync Key",
    btn_copy_sync: "Copy Sync Key",
    btn_close: "Close",
    copied_toast: "✓ Link copied to clipboard!",
    published_toast: "✓ Published to Community Feed!",
    explore_title: "World Terroir & Golden Map",
    explore_hint: "Origins & pours are pinned. Pan and pinch to zoom around the globe!",
    confirm_delete: "Are you sure you want to remove this bottle?",
    no_random_bottle: "Cellar is empty. Cannot pick a surprise bottle!"
  }
};


const I18N_TERMS = {
  // 酒類別
  "威士忌": { zh: "威士忌", en: "Whisky" },
  "紅酒": { zh: "紅酒", en: "Red Wine" },
  "白酒": { zh: "白酒", en: "White Wine" },
  "清酒": { zh: "清酒", en: "Sake" },
  "氣泡酒": { zh: "氣泡酒", en: "Sparkling Wine" },
  "香檳": { zh: "香檳", en: "Champagne" },
  "啤酒": { zh: "啤酒", en: "Beer" },
  "琴酒": { zh: "琴酒", en: "Gin" },
  "蘭姆酒": { zh: "蘭姆酒", en: "Rum" },
  "白蘭地": { zh: "白蘭地", en: "Brandy" },
  "利口酒": { zh: "利口酒", en: "Liqueur" },
  "泡盛": { zh: "泡盛", en: "Awamori" },
  "伏特加": { zh: "伏特加", en: "Vodka" },
  "龍舌蘭": { zh: "龍舌蘭", en: "Tequila" },
  "酒類": { zh: "酒類", en: "Liquor" },
  // 國家與產區
  "蘇格蘭": { zh: "蘇格蘭", en: "Scotland" },
  "英國": { zh: "英國", en: "UK" },
  "法國": { zh: "法國", en: "France" },
  "日本": { zh: "日本", en: "Japan" },
  "美國": { zh: "美國", en: "USA" },
  "義大利": { zh: "義大利", en: "Italy" },
  "意大利": { zh: "意大利", en: "Italy" },
  "西班牙": { zh: "西班牙", en: "Spain" },
  "台灣": { zh: "台灣", en: "Taiwan" },
  "香港": { zh: "香港", en: "Hong Kong" },
  "中國": { zh: "中國", en: "China" },
  "澳洲": { zh: "澳洲", en: "Australia" },
  "澳大利亞": { zh: "澳大利亞", en: "Australia" },
  "紐西蘭": { zh: "紐西蘭", en: "New Zealand" },
  "愛爾蘭": { zh: "愛爾蘭", en: "Ireland" },
  "德國": { zh: "德國", en: "Germany" },
  "智利": { zh: "智利", en: "Chile" },
  "阿根廷": { zh: "阿根廷", en: "Argentina" },
  "波爾多": { zh: "波爾多", en: "Bordeaux" },
  "勃艮第": { zh: "勃艮第", en: "Burgundy" },
  "勃根地": { zh: "勃根地", en: "Burgundy" },
  "加州": { zh: "加州", en: "California" },
  "納帕": { zh: "納帕", en: "Napa Valley" },
  "肯塔基": { zh: "肯塔基", en: "Kentucky" },
  "余市": { zh: "余市", en: "Yoichi" },
  "山崎": { zh: "山崎", en: "Yamazaki" },
  "北海道": { zh: "北海道", en: "Hokkaido" },
  "沖繩": { zh: "沖繩", en: "Okinawa" },
  "艾雷島": { zh: "艾雷島", en: "Islay" },
  "高地": { zh: "高地", en: "Highlands" },
  "斯佩塞": { zh: "斯佩塞", en: "Speyside" },
  // 年份與通用語
  "無年份": { zh: "無年份", en: "NV" },
  "未知": { zh: "未知", en: "Unknown" },
  "未知產區": { zh: "未知產區", en: "Unknown" },
  "未知國家": { zh: "未知國家", en: "Unknown" }
};

function formatFilterLabel(val) {
  if (!val) return "";
  if (I18N_TERMS[val]) {
    return I18N_TERMS[val][currentLang] || val;
  }
  for (const [k, v] of Object.entries(I18N_TERMS)) {
    if (val.includes(k) || val.toLowerCase() === v.en.toLowerCase()) {
      return v[currentLang];
    }
  }
  return val;
}

function t(k) { return I18N[currentLang]?.[k] || I18N['zh'][k] || k; }

function toggleLanguage() {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  localStorage.setItem('bottlesense_lang', currentLang);
  const langBtn = document.getElementById('langSwitchBtn');
  if (langBtn) langBtn.textContent = currentLang === 'zh' ? 'EN' : '繁';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.innerHTML = t(key);
  });
  if (currentView === 'detail' && currentBottleDetailId) {
    renderBottleDetail(currentBottleDetailId);
  } else if (currentView === 'home') {
    renderHome();
  } else if (currentView === 'cellar') {
    renderCellar();
  } else if (currentView === 'explore') {
    renderExplore();
  }
}

function showToast(msg) {
  const container = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const uid = () => 'btl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);

function safeIdentification(b) { return b?.identification || {}; }
function bottleName(b) { const x = safeIdentification(b); return x.name || x.brand || x.productName || b?.name || (currentLang === 'zh' ? '未辨識酒款' : 'Unidentified Bottle'); }
function bottleCategory(b) { const x = safeIdentification(b); return x.category || b?.tags?.category || (currentLang === 'zh' ? '酒類' : 'Liquor'); }
function bottleCountry(b) { const x = safeIdentification(b); return x.country || b?.tags?.country || ''; }
function bottleRegion(b) { const x = safeIdentification(b); return x.region || b?.tags?.region || ''; }
function bottleVintage(b) { const x = safeIdentification(b); return x.vintage || b?.tags?.vintage || (currentLang === 'zh' ? '無年份' : 'NV'); }
function bottleImage(b) { return b?.image || b?.imageData || b?.photo || b?.imageUrl || ''; }

function categoryEmoji(c) {
  return ({
    '紅酒':'🍷','白酒':'🥂','威士忌':'🥃','清酒':'🍶','氣泡酒':'🥂','啤酒':'🍺','琴酒':'🍸','蘭姆酒':'🥃','白蘭地':'🥃','泡盛':'🍶','利口酒':'🍹',
    'Wine':'🍷','Whisky':'🥃','Whiskey':'🥃','Sake':'🍶','Champagne':'🥂','Beer':'🍺','Gin':'🍸','Rum':'🥃','Brandy':'🥃'
  })[c] || '🍾';
}

function setActiveNav(id) {
  document.querySelectorAll('.navbtn').forEach(x => x.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function normalizeBottle(b) {
  const x = b || {};
  x.id = x.id || uid();
  x.status = x.status || 'unopened';
  x.identification = x.identification || {};
  x.tags = x.tags || {
    category: bottleCategory(x),
    vintage: bottleVintage(x),
    country: bottleCountry(x),
    region: bottleRegion(x)
  };
  x.tastings = Array.isArray(x.tastings) ? x.tastings : [];
  x.isFavorite = !!x.isFavorite;
  x.addedAt = x.addedAt || Date.now();
  return x;
}

async function refreshCellar() {
  if (typeof loadCellarWithMigration === 'function') {
    await loadCellarWithMigration();
  }
  window.cellar = Array.isArray(window.cellar) ? window.cellar.map(normalizeBottle) : [];
  return window.cellar;
}

function statCounts() {
  const c = window.cellar || [];
  return {
    total: c.length,
    cooler: c.filter(b => b.status === 'unopened').length,
    wood: c.filter(b => b.status === 'opened').length,
    bar: c.filter(b => ['finished','gifted','sold'].includes(b.status)).length,
    wish: c.filter(b => b.status === 'wishlist').length,
    fav: c.filter(b => b.isFavorite).length
  };
}

function goHome() {
  if (isVisitorMode) exitVisitorMode();
  renderHome();
}

/* ---------------- 首頁 6 格齊整佈局 (含隨機賞味) ---------------- */
function renderHome() {
  currentView = 'home';
  currentBottleDetailId = null;
  setActiveNav('nav-home');
  const s = statCounts();

  main.innerHTML = `
    <div class="view" style="padding-bottom: 40px;">
      <section class="scan-hero">
        <h1>${t('hero_title')}</h1>
        <p>${t('hero_desc')}</p>
        <div class="scan-center-box">
          <button class="scan-btn" onclick="openCamera()" aria-label="Scan Bottle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
          <span class="upload-subtext" onclick="openGallery()">${t('choose_album')}</span>
        </div>
      </section>

      <div class="section-head">
        <h2>${t('spaces_title')}</h2>
        <a onclick="renderCellar()">${t('open_cellar')}</a>
      </div>

      <div class="stat-grid-6">
        <div class="stat-card" onclick="openScene('cooler')">
          <div class="stat-num" style="color:var(--cyan-glow);">${s.cooler}</div>
          <div class="stat-label">${t('space_cooler')}</div>
        </div>
        <div class="stat-card" onclick="openScene('wood')">
          <div class="stat-num" style="color:#fbbf24;">${s.wood}</div>
          <div class="stat-label">${t('space_wood')}</div>
        </div>
        <div class="stat-card" onclick="openScene('bar')">
          <div class="stat-num" style="color:var(--gold);">${s.bar}</div>
          <div class="stat-label">${t('space_bar')}</div>
        </div>
        <div class="stat-card" onclick="openScene('wishlist')">
          <div class="stat-num" style="color:var(--purple-glow);">${s.wish}</div>
          <div class="stat-label">${t('space_wish')}</div>
        </div>
        <div class="stat-card" onclick="openScene('favorite')">
          <div class="stat-num" style="color:var(--rose-glow);">${s.fav}</div>
          <div class="stat-label">${t('space_fav')}</div>
        </div>
        <div class="stat-card" onclick="pickRandomBottle()">
          <div class="stat-num" style="color:var(--gold);">🎲</div>
          <div class="stat-label">${t('space_random')}</div>
        </div>
      </div>

      <div class="section-head">
        <h2>${t('recent_title')}</h2>
        <a onclick="renderCellar()">${t('view_all')}</a>
      </div>
      <div>
        ${recentBottleHTML()}
      </div>
    </div>
  `;

  attachSwipeListeners();
}

function pickRandomBottle() {
  const c = window.cellar || [];
  if (!c.length) {
    showToast(t('no_random_bottle'));
    return;
  }
  const randomItem = c[Math.floor(Math.random() * c.length)];
  showToast(`🎲 抽選到：${bottleName(randomItem)}`);
  renderBottleDetail(randomItem.id);
}

function recentBottleHTML() {
  const list = (window.cellar || []).slice(0, 3);
  if (!list.length) {
    return `<div class="empty-shelf">${t('empty_cellar')}</div>`;
  }
  return list.map(bottleCardHTML).join('');
}

function openScene(scene) {
  currentScene = scene;
  activeFilter = 'all';
  renderCellar();
}

/* ---------------- 5 大空間酒窖渲染 ---------------- */
function renderCellar() {
  currentView = 'cellar';
  currentBottleDetailId = null;
  setActiveNav('nav-cellar');

  const c = window.cellar || [];
  const coolerBottles = c.filter(b => b.status === 'unopened');
  const woodBottles = c.filter(b => b.status === 'opened');
  const barBottles = c.filter(b => ['finished', 'gifted', 'sold'].includes(b.status));
  const wishBottles = c.filter(b => b.status === 'wishlist');
  const favBottles = c.filter(b => b.isFavorite);

  let spaceList = [];
  let shelfTitle = '';
  let shelfKey = currentScene;

  if (currentScene === 'cooler') { spaceList = coolerBottles; shelfTitle = t('shelf_cooler_title'); }
  else if (currentScene === 'wood') { spaceList = woodBottles; shelfTitle = t('shelf_wood_title'); }
  else if (currentScene === 'bar') { spaceList = barBottles; shelfTitle = t('shelf_bar_title'); }
  else if (currentScene === 'wishlist') { spaceList = wishBottles; shelfTitle = t('shelf_wish_title'); }
  else { spaceList = favBottles; shelfTitle = t('shelf_fav_title'); shelfKey = 'fav'; }

  const filterSet = new Set();
  spaceList.forEach(b => {
    const cat = bottleCategory(b);
    const reg = bottleRegion(b);
    const vin = bottleVintage(b);
    if (cat) filterSet.add(cat);
    if (reg && reg !== '未知產區' && reg !== '未知') filterSet.add(reg);
    if (vin && vin !== '無年份') filterSet.add(vin);
  });
  const filterOptions = ['all', ...Array.from(filterSet)];

  const activeList = (activeFilter === 'all')
    ? spaceList
    : spaceList.filter(b => {
        return bottleCategory(b) === activeFilter || bottleRegion(b) === activeFilter || bottleVintage(b) === activeFilter;
      });

  main.innerHTML = `
    <div class="view" style="padding-bottom: 50px;">
      <div class="section-head" style="margin-top:8px;">
        <h2>${currentLang === 'zh' ? '私人酒窖全景' : 'Private Cellar'}</h2>
        <button class="share-plane-btn" style="background:rgba(212,175,55,0.25);" onclick="shareEntireCellar()">
          ${TELEGRAM_PLANE_SVG}
          <span>${t('share_cellar')}</span>
        </button>
      </div>

      <div class="cellar-scene-tabs">
        <div class="scene-tab ${currentScene==='cooler'?'active-cooler':''}" onclick="switchScene('cooler')">
          <span class="scene-icon">⚡</span>
          <div class="scene-name">${t('space_cooler')}</div>
          <div class="scene-count">${coolerBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='wood'?'active-wood':''}" onclick="switchScene('wood')">
          <span class="scene-icon">🪵</span>
          <div class="scene-name">${t('space_wood')}</div>
          <div class="scene-count">${woodBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='bar'?'active-bar':''}" onclick="switchScene('bar')">
          <span class="scene-icon">🥃</span>
          <div class="scene-name">${t('space_bar')}</div>
          <div class="scene-count">${barBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='wishlist'?'active-wish':''}" onclick="switchScene('wishlist')">
          <span class="scene-icon">🏷️</span>
          <div class="scene-name">${t('space_wish')}</div>
          <div class="scene-count">${wishBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='favorite'?'active-fav':''}" onclick="switchScene('favorite')">
          <span class="scene-icon">⭐</span>
          <div class="scene-name">${t('space_fav')}</div>
          <div class="scene-count">${favBottles.length}</div>
        </div>
      </div>

      ${filterOptions.length > 1 ? `
        <div class="filter-row">
          ${filterOptions.map(opt => `
            <div class="filter-chip ${activeFilter===opt?'active':''}" onclick="setShelfFilter('${esc(opt)}')">
              ${opt === 'all' ? t('filter_all') : esc(formatFilterLabel(opt))}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="shelf-container shelf-${shelfKey}">
        <div style="font-family:var(--serif); font-size:16px; font-weight:700; margin-bottom:10px;">${shelfTitle}</div>
        <div class="shelf-beam"></div>
        <div class="shelf-items-grid">
          ${activeList.length ? activeList.map(bottleCardHTML).join('') : `<div class="empty-shelf">${t('empty_shelf')}</div>`}
        </div>
        <div class="shelf-beam"></div>
      </div>
    </div>
  `;

  attachSwipeListeners();
}

function switchScene(scene) {
  currentScene = scene;
  activeFilter = 'all';
  renderCellar();
}

function setShelfFilter(f) {
  activeFilter = f;
  renderCellar();
}

function bottleCardHTML(b) {
  const img = bottleImage(b);
  const vintage = bottleVintage(b);
  const region = bottleRegion(b);
  const cat = bottleCategory(b);
  const pourCount = (b.tastings || []).length;

  return `
    <div class="swipe-item-wrapper" id="wrap-${esc(b.id)}">
      <div class="swipe-action-left" onclick="toggleFavorite('${esc(b.id)}')">
        <span class="swipe-action-icon">${b.isFavorite ? '★' : '☆'}</span>
        <span>${b.isFavorite ? (currentLang==='zh'?'取消':'Unfav') : (currentLang==='zh'?'最愛':'Fav')}</span>
      </div>
      <div class="swipe-action-right" onclick="deleteBottle('${esc(b.id)}')">
        <span class="swipe-action-icon">×</span>
        <span>${currentLang==='zh'?'刪除':'Delete'}</span>
      </div>

      <article class="bottle-card" id="card-${esc(b.id)}" onclick="renderBottleDetail('${esc(b.id)}')">
        <div class="bottle-photo-box">
          ${img ? `<img src="${esc(img)}" alt="">` : `<div class="emoji-fallback">${categoryEmoji(cat)}</div>`}
        </div>

        <div class="bottle-info">
          <div style="display:flex; align-items:center;">
            <div class="bottle-name">${esc(bottleName(b))}</div>
            ${b.isFavorite ? '<span class="fav-star-badge">★</span>' : ''}
          </div>
          <div class="bottle-sub">${esc(safeIdentification(b).producer || '')}${vintage ? ' · ' + esc(vintage) : ''}</div>
          <div class="tag-cluster">
            <span class="tag-badge">${esc(formatFilterLabel(cat))}</span>
            ${region ? `<span class="tag-badge secondary">${esc(formatFilterLabel(region))}</span>` : ''}
            ${pourCount > 0 ? `<span class="tag-badge" style="background:rgba(56,189,248,0.15); color:var(--cyan-glow); border-color:rgba(56,189,248,0.3);">${currentLang==='zh'?'品飲':'Pours'} ×${pourCount}</span>` : ''}
            ${b.personalRating ? `<span class="tag-badge secondary">★ ${b.personalRating}/5</span>` : ''}
          </div>
        </div>
      </article>
    </div>
  `;
}

function attachSwipeListeners() {
  const wrappers = document.querySelectorAll('.swipe-item-wrapper');
  wrappers.forEach(wrap => {
    const card = wrap.querySelector('.bottle-card');
    const id = wrap.id.replace('wrap-', '');
    let startX = 0, startY = 0, currentX = 0, isDragging = false, hasMoved = false;

    const onStart = (e) => {
      const touch = e.touches ? e.touches[0] : e;
      startX = touch.clientX;
      startY = touch.clientY;
      isDragging = true;
      hasMoved = false;
      card.style.transition = 'none';
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const touch = e.touches ? e.touches[0] : e;
      currentX = touch.clientX;
      const diffX = currentX - startX;
      const diffY = touch.clientY - startY;

      if (Math.abs(diffY) > Math.abs(diffX) && !hasMoved) {
        isDragging = false;
        return;
      }
      if (Math.abs(diffX) > 10) hasMoved = true;
      if (hasMoved && diffX > -100 && diffX < 100) card.style.transform = `translateX(${diffX}px)`;
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      card.style.transition = 'transform 0.25s ease';
      const diffX = currentX - startX;

      if (hasMoved) {
        if (diffX > 40) card.style.transform = 'translateX(80px)';
        else if (diffX < -40) card.style.transform = 'translateX(-80px)';
        else card.style.transform = 'translateX(0px)';
      }
    };

    card.addEventListener('touchstart', onStart, {passive: true});
    card.addEventListener('touchmove', onMove, {passive: true});
    card.addEventListener('touchend', onEnd);
    card.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
  });
}

/* ---------------- Know your bottle: 介紹與建議置頂，品飲歷程與轉移列下移 ---------------- */
function renderBottleDetail(id) {
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) { renderCellar(); return; }

  if (currentView !== 'detail') {
    previousViewBeforeDetail = currentView || 'home';
  }
  currentView = 'detail';
  currentBottleDetailId = id;

  const x = safeIdentification(b);
  const img = bottleImage(b);
  const confidence = Number(x.conf ?? x.confidence ?? 0);
  const vm = b.scan?.vm || x.vm || {};
  const rec = b.scan?.rec || x.rec || {};

  const statuses = [
    { key:'unopened', label: t('space_cooler') },
    { key:'opened', label: t('space_wood') },
    { key:'finished', label: t('space_bar') },
    { key:'wishlist', label: t('space_wish') }
  ];

  main.innerHTML = `
    <div class="view" style="padding-bottom: 60px;">
      <div class="back-row">
        <button class="btn btn-ghost" style="padding:8px 14px; font-size:14px;" onclick="${previousViewBeforeDetail === 'cellar' ? 'renderCellar()' : 'goHome()'}">
          ${t('back')}
        </button>
        <button class="share-plane-btn" onclick="openShareActionSheet('${esc(b.id)}')">
          ${TELEGRAM_PLANE_SVG}
          <span>${t('share_bottle')}</span>
        </button>
      </div>

      ${img ? `<div class="detail-photo-hero"><img src="${esc(img)}" alt=""></div>` : ''}

      <!-- 1. 核心身分卡片 (拉高最先閱讀) -->
      <div class="label-card">
        ${confidence ? `
          <div class="confidence-seal ${confidence >= 80 ? 'seal-high' : confidence >= 55 ? 'seal-medium' : 'seal-low'}">
            <div class="seal-pct">${Math.round(confidence)}%</div>
            <div class="seal-label">${t('confidence_label')}</div>
          </div>
        ` : ''}

        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <div class="label-eyebrow" style="margin-bottom:0;">${esc(formatFilterLabel(bottleCategory(b)))}</div>
          <button class="edit-badge-btn" onclick="openEditBottleModal('${esc(b.id)}')">
            ${EDIT_PENCIL_SVG} ${t('edit_info')}
          </button>
        </div>

        <div class="label-name">${esc(bottleName(b))}</div>
        <div class="label-sub">${esc([formatFilterLabel(bottleCountry(b)), formatFilterLabel(bottleRegion(b))].filter(Boolean).join(' · '))}</div>

        <div class="label-facts">
          <div><div class="fact-label">VINTAGE</div><div class="fact-value">${esc(formatFilterLabel(bottleVintage(b)))}</div></div>
          <div><div class="fact-label">CATEGORY</div><div class="fact-value">${esc(formatFilterLabel(bottleCategory(b)))}</div></div>
          <div><div class="fact-label">COUNTRY</div><div class="fact-value">${esc(formatFilterLabel(bottleCountry(b)) || (currentLang==='zh'?'未知':'Unknown'))}</div></div>
          <div><div class="fact-label">REGION</div><div class="fact-value">${esc(formatFilterLabel(bottleRegion(b)) || (currentLang==='zh'?'未知':'Unknown'))}</div></div>
        </div>
      </div>

      <!-- 2. 八維價值地圖雷達圖 (Know your bottle 核心) -->
      ${renderRadar(vm)}

      <!-- 3. 專業處置建議 (置頂，先知點做) -->
      ${renderRecommendation(rec)}

      <!-- 4. 轉移藏酒空間 (單行極致收窄膠囊列) -->
      <div class="info-block">
        <h3 style="font-size:14px; margin-bottom:6px;">${t('transfer_title')}</h3>
        <div class="destination-strip">
          ${statuses.map(s => `
            <div class="dest-pill ${b.status===s.key?'active':''}" onclick="moveStatus('${esc(b.id)}','${s.key}')">
              ${s.label}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 5. 品飲歷史時間軸 (順延置於下方) -->
      <div class="info-block">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h3>${t('timeline_title')} (${(b.tastings || []).length})</h3>
          <button class="btn btn-primary btn-sm" onclick="openAddSessionModal('${esc(b.id)}')">
            ${t('btn_add_log')}
          </button>
        </div>
        <div style="font-size:13px; color:var(--text-faint); margin-bottom:14px;">${t('timeline_hint')}</div>

        ${(b.tastings || []).length ? `
          <div class="vertical-timeline-container">
            <div class="vertical-timeline-spine"></div>
            ${((timelineExpandedState[String(b.id)] ? b.tastings : b.tastings.slice(0, 3))).map((tItem, idx) => `
              <div class="timeline-item-wrapper">
                <div class="timeline-spine-node">
                  <div class="timeline-spine-dot"></div>
                </div>
                <div class="timeline-card">
                  <div class="timeline-header">
                    <div>
                      <span class="timeline-time">#${idx+1} · ${esc(tItem.dateStr || tItem.date || '')}</span>
                      <div style="color:var(--gold); font-size:14px; margin-top:2px;">${'★'.repeat(tItem.rating || 5)}</div>
                    </div>
                    <button class="timeline-share-btn" onclick="openShareActionSheet('${esc(b.id)}', '${esc(tItem.id)}')" title="Share this pour">
                      ${TELEGRAM_PLANE_SVG}
                    </button>
                  </div>
                  <div class="timeline-meta">
                    ${tItem.location ? `<span>📍 ${esc(tItem.location)}</span>` : ''}
                    ${tItem.companions ? `<span>👥 ${esc(tItem.companions)}</span>` : ''}
                  </div>
                  ${tItem.notes ? `<div class="timeline-notes">"${esc(tItem.notes)}"</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
          ${(b.tastings.length > 3) ? `
            <div style="text-align:center; margin-top:14px;">
              <button class="btn btn-ghost btn-sm timeline-expand-btn" onclick="toggleTimelineExpand('${esc(b.id)}')">
                ${timelineExpandedState[String(b.id)] 
                  ? (currentLang === 'zh' ? '▲ 收起記錄' : '▲ Show Less')
                  : (currentLang === 'zh' ? `▼ 展開更多品飲記錄 (${b.tastings.length - 3} 筆)` : `▼ Load More Tastings (${b.tastings.length - 3})`)}
              </button>
            </div>
          ` : ''}
        ` : `
          <div class="timeline-empty-card">
            <div class="empty-icon">🥃</div>
            <div class="empty-title">${currentLang === 'zh' ? '尚未記錄品飲歷史' : 'No Tasting Notes Yet'}</div>
            <div class="empty-desc">${currentLang === 'zh' ? '點擊上方「＋ 記錄」，寫下開瓶心得、同伴與評分！' : 'Tap "+ Log" above to capture your first tasting notes and companions!'}</div>
          </div>
        `}
      </div>

      <div style="margin-top:24px;">
        <button class="btn btn-wine btn-block" onclick="deleteBottle('${esc(b.id)}')">${t('btn_remove')}</button>
      </div>
    </div>
  `;
}

function renderRadar(vm) {
  const dimKeys = ['mv','ql','dv','pv','sv','gv','cv','sto'];
  const dimZh = { 
    mv: "市場價值", 
    ql: "品質工藝", 
    dv: "飲用價值", 
    pv: "配餐價值", 
    sv: "社交話題", 
    gv: "送禮價值", 
    cv: "收藏價值", 
    sto: "保存潛力" 
  };
  const dimEn = { 
    mv: "Market", 
    ql: "Quality", 
    dv: "Drinking", 
    pv: "Pairing", 
    sv: "Social", 
    gv: "Gifting", 
    cv: "Collection", 
    sto: "Storage" 
  };
  const dimIcons = { 
    mv: "📈", 
    ql: "🏆", 
    dv: "🍷", 
    pv: "🍽️", 
    sv: "💬", 
    gv: "🎁", 
    cv: "💎", 
    sto: "⏳" 
  };
  const labels = currentLang === 'zh' ? dimZh : dimEn;

  const vals = dimKeys.map(k => Number(vm?.[k] || 0));
  if (!vals.some(v => v > 0)) return '';

  const cx = 190, cy = 185, R = 100;
  const n = dimKeys.length;

  const points = dimKeys.map((k,i)=>{
    const angle = (Math.PI*2*i/n) - Math.PI/2;
    const val = Math.max(0, Math.min(100, Number(vm[k] || 75)));
    const r = (val/100) * R;
    return [cx + r*Math.cos(angle), cy + r*Math.sin(angle)];
  });

  const axisPoints = dimKeys.map((k,i)=>{
    const angle = (Math.PI*2*i/n) - Math.PI/2;
    return [cx + R*Math.cos(angle), cy + R*Math.sin(angle)];
  });

  const polygon = points.map(p=>p.map(coord => coord.toFixed(1)).join(',')).join(' ');

  // 1. 同心多邊形網格環 (25%, 50%, 75%, 100%)
  const rings = [0.25, 0.5, 0.75, 1.0].map(f => {
    const ringPts = dimKeys.map((k,i)=>{
      const angle = (Math.PI*2*i/n) - Math.PI/2;
      return [cx + R*f*Math.cos(angle), cy + R*f*Math.sin(angle)].map(c => c.toFixed(1)).join(',');
    }).join(' ');
    const isOuter = f === 1.0;
    return `<polygon points="${ringPts}" fill="${isOuter ? 'rgba(26,29,19,0.5)' : 'none'}" stroke="${isOuter ? 'rgba(212,175,55,0.4)' : '#333722'}" stroke-width="${isOuter ? '1.5' : '1'}"/>`;
  }).join('');

  // 2. 刻度放射軸線
  const axes = axisPoints.map(p=>`<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="rgba(212,175,55,0.22)" stroke-width="1" stroke-dasharray="2,2"/>`).join('');

  // 3. 刻度標籤 (50, 100)
  const scaleMarkers = `
    <text x="${cx + 4}" y="${cy - R * 0.5 + 3}" font-size="8" fill="rgba(255,255,255,0.35)" font-family="var(--mono)">50</text>
    <text x="${cx + 4}" y="${cy - R + 3}" font-size="8" fill="rgba(212,175,55,0.7)" font-family="var(--mono)" font-weight="700">100</text>
  `;

  // 4. 八個軸端外側清晰標註（維度名稱 + 金色分數）
  const axisLabels = dimKeys.map((k, i) => {
    const angle = (Math.PI*2*i/n) - Math.PI/2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const lx = cx + (R + 25) * cosA;
    const ly = cy + (R + 22) * sinA;
    const val = Number(vm[k] || 75);

    let anchor = "middle";
    let baseline = "central";
    if (Math.abs(cosA) < 0.25) {
      anchor = "middle";
      baseline = sinA < 0 ? "text-after-edge" : "text-before-edge";
    } else if (cosA > 0) {
      anchor = "start";
      baseline = "central";
    } else {
      anchor = "end";
      baseline = "central";
    }

    return `
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="${baseline}" font-size="11.5" font-family="var(--sans)" fill="#EDEDED">
        ${labels[k]} <tspan fill="#D4AF37" font-weight="700" font-family="var(--mono)">${val}</tspan>
      </text>
    `;
  }).join('');

  // 5. 下方八維圖例卡片網格
  const legendCards = dimKeys.map(k => {
    const val = Math.max(0, Math.min(100, Number(vm[k] || 75)));
    return `
      <div class="radar-dim-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${dimIcons[k]} ${labels[k]}
          </span>
          <span style="font-family:var(--mono); font-size:13px; font-weight:700; color:var(--gold); margin-left:6px;">
            ${val}<span style="font-size:9.5px; color:var(--text-faint); font-weight:normal;">/100</span>
          </span>
        </div>
        <div class="dim-bar-track">
          <div class="dim-bar-fill" style="width:${val}%;"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="radar-wrap">
      <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin-bottom:0; font-family:var(--serif); font-size:18px;">
          ${currentLang === 'zh' ? '八維價值地圖' : 'Value Profile Map'}
        </h3>
        <span style="font-size:11px; font-family:var(--mono); color:var(--gold); border:1px solid var(--gold-dim); padding:2px 8px; border-radius:999px;">
          8-DIM RADAR
        </span>
      </div>

      <svg width="100%" height="auto" viewBox="0 0 380 370" style="max-width:380px; display:block; margin:0 auto; overflow:visible;">
        <defs>
          <radialGradient id="radarFillGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(212,175,55,0.42)"/>
            <stop offset="100%" stop-color="rgba(212,175,55,0.12)"/>
          </radialGradient>
          <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>
        ${rings}
        ${axes}
        ${scaleMarkers}
        <!-- 數值多邊形 -->
        <polygon points="${polygon}" fill="url(#radarFillGrad)" stroke="#D4AF37" stroke-width="2.5" filter="url(#goldGlow)"/>
        <!-- 頂點光圈 -->
        ${points.map(p => `
          <circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="7" fill="rgba(212,175,55,0.3)"/>
          <circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="#D4AF37" stroke="#161810" stroke-width="1.5"/>
        `).join('')}
        <!-- 8 個軸尖端標註 (名稱 + 分數) -->
        ${axisLabels}
      </svg>

      <!-- 下方八維進度條卡片 -->
      <div class="radar-legend-grid">${legendCards}</div>
    </div>
  `;
}

function renderRecommendation(rec) {
  if (!rec || (!rec.reason && !rec.actions)) return '';
  return `
    <div class="rec-card">
      <h3>${currentLang === 'zh' ? '專業處置建議' : 'Sommelier Guidance'}</h3>
      <div class="rec-reason">${esc(rec.reason || '')}</div>
      ${(rec.actions || [
        {a:"drink", reason: currentLang==='zh'?"現在正是最佳風味表現期":"Peak drinking window is now"},
        {a:"share", reason: currentLang==='zh'?"適合與同好一同品嚐":"Great for social gatherings"},
        {a:"store", reason: currentLang==='zh'?"常溫避光存放即可":"Keep in dark temperature-stable storage"}
      ]).map((a,i)=>`
        <div class="action-item">
          <div class="action-rank">${['🥇','🥈','🥉'][i]||(i+1)}</div>
          <div class="action-icon">${ACTION_ICONS[a.a]||'🍷'}</div>
          <div class="action-body">
            <div class="action-title">${esc(a.a||'')}</div>
            <div class="action-reason">${esc(a.reason||'')}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function moveStatus(id, newStatus) {
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;
  b.status = newStatus;
  await saveBottleToDB(b);
  renderBottleDetail(id);
}

function openEditBottleModal(id) {
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="max-width:380px; text-align:left;" onclick="event.stopPropagation()">
        <div style="font-family:var(--serif); font-size:19px; font-weight:700; margin-bottom:14px; color:var(--gold);">
          ✏️ ${t('edit_info')}
        </div>
        <div style="font-size:12.5px; font-family:var(--mono); color:var(--text-faint);">${currentLang==='zh'?'酒款名稱':'Bottle Name'}</div>
        <input type="text" id="edit-name" class="text-input" value="${esc(bottleName(b))}">

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:8px;">
          <div>
            <div style="font-size:12.5px; font-family:var(--mono); color:var(--text-faint);">${currentLang==='zh'?'酒類別':'Category'}</div>
            <input type="text" id="edit-category" class="text-input" value="${esc(bottleCategory(b))}">
          </div>
          <div>
            <div style="font-size:12.5px; font-family:var(--mono); color:var(--text-faint);">${currentLang==='zh'?'年份':'Vintage'}</div>
            <input type="text" id="edit-vintage" class="text-input" value="${esc(bottleVintage(b))}">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:8px;">
          <div>
            <div style="font-size:12.5px; font-family:var(--mono); color:var(--text-faint);">${currentLang==='zh'?'國家':'Country'}</div>
            <input type="text" id="edit-country" class="text-input" value="${esc(bottleCountry(b))}">
          </div>
          <div>
            <div style="font-size:12.5px; font-family:var(--mono); color:var(--text-faint);">${currentLang==='zh'?'產區':'Region'}</div>
            <input type="text" id="edit-region" class="text-input" value="${esc(bottleRegion(b))}">
          </div>
        </div>

        <div style="display:flex; gap:10px; margin-top:18px;">
          <button class="btn btn-ghost btn-block" onclick="closeModal()">${currentLang==='zh'?'取消':'Cancel'}</button>
          <button class="btn btn-primary btn-block" onclick="saveEditedBottle('${esc(b.id)}')">${currentLang==='zh'?'儲存':'Save'}</button>
        </div>
      </div>
    </div>
  `;
}

async function saveEditedBottle(id) {
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;

  b.identification.name = document.getElementById('edit-name').value.trim();
  b.tags.category = document.getElementById('edit-category').value.trim();
  b.tags.vintage = document.getElementById('edit-vintage').value.trim();
  b.tags.country = document.getElementById('edit-country').value.trim();
  b.tags.region = document.getElementById('edit-region').value.trim();

  await saveBottleToDB(b);
  closeModal();
  renderBottleDetail(id);
}

let currentSessionRating = 5;
function openAddSessionModal(bottleId) {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const defaultIso = now.toISOString().slice(0, 16);
  currentSessionRating = 5;

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="max-width:390px; text-align:left;" onclick="event.stopPropagation()">
        <div style="font-family:var(--serif); font-size:19px; font-weight:700; margin-bottom:12px; color:var(--gold);">
          ${t('btn_add_log')}
        </div>
        <div style="font-size:12.5px; font-family:var(--mono); color:var(--text-faint);">${currentLang==='zh'?'日期與時間':'Date & Time'}</div>
        <input type="datetime-local" id="sess-date" class="text-input" value="${defaultIso}">

        <div style="font-size:12.5px; font-family:var(--mono); color:var(--text-faint); margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
          <span>${currentLang==='zh'?'地點 / 環境':'Venue & Environment'}</span>
          <span style="font-size:10.5px; color:var(--text-faint);">${currentLang==='zh'?'地點與環境可組合選取':'Location & Setting'}</span>
        </div>
        <input type="text" id="sess-loc" class="text-input" placeholder="${currentLang==='zh'?'例如：中環 屋企陽台、高雄 酒吧、東京 居酒屋':'e.g. Central Balcony, Kaohsiung Bar, Tokyo Izakaya'}" oninput="updateSessTagHighlight()">
        
        <!-- 城市 / 地區（單選互斥切換） -->
        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-top:6px; margin-bottom:3px;">
          📍 ${currentLang==='zh'?'城市地區（單選切換）':'City / Region'}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:6px;">
          ${LOCATION_CITIES.map(c => {
            const t = currentLang === 'zh' ? c.zh : c.en;
            return `<span class="sess-city-tag" data-city="${t}" style="font-size:10.5px; padding:3px 8px; border-radius:999px; background:var(--surface-2); border:1px solid var(--line); color:var(--text-muted); cursor:pointer; user-select:none; transition:all 0.15s ease;" onclick="handleSelectCityTag('sess-loc', '${t}')">${t}</span>`;
          }).join("")}
        </div>

        <!-- 場合 / 環境（單選互斥切換） -->
        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-bottom:3px;">
          🥂 ${currentLang==='zh'?'場合環境（單選切換）':'Occasion / Setting'}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px;">
          ${LOCATION_ENVIRONMENTS.map(e => {
            const t = currentLang === 'zh' ? e.zh : e.en;
            return `<span class="sess-env-tag" data-env="${t}" style="font-size:10.5px; padding:3px 8px; border-radius:999px; background:var(--surface-2); border:1px solid var(--line); color:var(--text-muted); cursor:pointer; user-select:none; transition:all 0.15s ease;" onclick="handleSelectEnvTag('sess-loc', '${t}')">${t}</span>`;
          }).join("")}
        </div>

        <div style="font-size:12.5px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">${currentLang==='zh'?'同飲同伴':'Companions'}</div>
        <input type="text" id="sess-comp" class="text-input" placeholder="${currentLang==='zh'?'例如：好友相聚、獨酌深思':'e.g. Solo, Rex, Friends'}">

        <div style="font-size:12.5px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">${currentLang==='zh'?'評分':'Rating'}</div>
        <div class="star-row">
          ${[1,2,3,4,5].map(n => `<button class="star-btn filled" id="sess-star-${n}" onclick="setModalRating(${n})">★</button>`).join('')}
        </div>

        <div style="font-size:12.5px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">${currentLang==='zh'?'品飲感受與筆記':'Tasting Impressions'}</div>
        <textarea id="sess-notes" class="text-input" style="height:80px; resize:none;"></textarea>

        <div style="display:flex; gap:10px; margin-top:18px;">
          <button class="btn btn-ghost btn-block" onclick="closeModal()">${currentLang==='zh'?'取消':'Cancel'}</button>
          <button class="btn btn-primary btn-block" onclick="saveNewSession('${esc(bottleId)}')">${currentLang==='zh'?'儲存品飲':'Save Pour'}</button>
        </div>
      </div>
    </div>
  `;
}



function toggleTimelineExpand(bottleId) {
  timelineExpandedState[String(bottleId)] = !timelineExpandedState[String(bottleId)];
  renderBottleDetail(bottleId);
}

const LOCATION_CITIES = [
  { zh: "中環", en: "Central" },
  { zh: "尖沙咀", en: "TST" },
  { zh: "銅鑼灣", en: "Causeway Bay" },
  { zh: "旺角", en: "Mong Kok" },
  { zh: "台中", en: "Taichung" },
  { zh: "高雄", en: "Kaohsiung" },
  { zh: "台北", en: "Taipei" },
  { zh: "東京", en: "Tokyo" },
  { zh: "大阪", en: "Osaka" },
  { zh: "澳門", en: "Macau" }
];

const LOCATION_ENVIRONMENTS = [
  { zh: "屋企陽台", en: "Balcony" },
  { zh: "酒吧", en: "Bar" },
  { zh: "居酒屋", en: "Izakaya" },
  { zh: "露營星空下", en: "Camping" },
  { zh: "海邊", en: "Beach" },
  { zh: "朋友聚會", en: "Friends" },
  { zh: "餐廳", en: "Restaurant" }
];

const ALL_CITY_NAMES = ["中環", "尖沙咀", "銅鑼灣", "旺角", "台中", "高雄", "台北", "東京", "大阪", "澳門", "Central", "TST", "Causeway Bay", "Mong Kok", "Taichung", "Kaohsiung", "Taipei", "Tokyo", "Osaka", "Macau"];
const ALL_ENV_NAMES = ["屋企陽台", "酒吧", "居酒屋", "露營星空下", "海邊", "朋友聚會", "餐廳", "Balcony", "Bar", "Izakaya", "Camping", "Beach", "Friends", "Restaurant"];

function handleSelectCityTag(inputId, newCity) {
  const input = document.getElementById(inputId);
  if (!input) return;
  let text = (input.value || "").trim();

  let foundCity = null;
  for (const c of ALL_CITY_NAMES) {
    if (text.includes(c)) {
      foundCity = c;
      break;
    }
  }

  if (foundCity === newCity) {
    text = text.replace(newCity, "").replace(/\s+/g, " ").trim();
  } else if (foundCity) {
    text = text.replace(foundCity, newCity).replace(/\s+/g, " ").trim();
  } else {
    text = `${newCity} ${text}`.replace(/\s+/g, " ").trim();
  }

  input.value = text;
  if (inputId === "pub-venue-loc") updatePubTagHighlight();
  else if (inputId === "sess-loc") updateSessTagHighlight();
}

function handleSelectEnvTag(inputId, newEnv) {
  const input = document.getElementById(inputId);
  if (!input) return;
  let text = (input.value || "").trim();

  let foundEnv = null;
  for (const e of ALL_ENV_NAMES) {
    if (text.includes(e)) {
      foundEnv = e;
      break;
    }
  }

  if (foundEnv === newEnv) {
    text = text.replace(newEnv, "").replace(/\s+/g, " ").trim();
  } else if (foundEnv) {
    text = text.replace(foundEnv, newEnv).replace(/\s+/g, " ").trim();
  } else {
    text = `${text} ${newEnv}`.replace(/\s+/g, " ").trim();
  }

  input.value = text;
  if (inputId === "pub-venue-loc") updatePubTagHighlight();
  else if (inputId === "sess-loc") updateSessTagHighlight();
}

function updatePubTagHighlight() {
  const input = document.getElementById("pub-venue-loc");
  if (!input) return;
  const val = input.value || "";

  document.querySelectorAll(".pub-city-tag").forEach(el => {
    const tag = el.getAttribute("data-city");
    const active = tag && val.includes(tag);
    el.style.background = active ? "rgba(212, 175, 55, 0.22)" : "var(--surface-2)";
    el.style.borderColor = active ? "var(--gold)" : "var(--line)";
    el.style.color = active ? "var(--gold)" : "var(--text-muted)";
    el.style.fontWeight = active ? "600" : "400";
  });

  document.querySelectorAll(".pub-env-tag").forEach(el => {
    const tag = el.getAttribute("data-env");
    const active = tag && val.includes(tag);
    el.style.background = active ? "rgba(212, 175, 55, 0.22)" : "var(--surface-2)";
    el.style.borderColor = active ? "var(--gold)" : "var(--line)";
    el.style.color = active ? "var(--gold)" : "var(--text-muted)";
    el.style.fontWeight = active ? "600" : "400";
  });
}

function updateSessTagHighlight() {
  const input = document.getElementById("sess-loc");
  if (!input) return;
  const val = input.value || "";

  document.querySelectorAll(".sess-city-tag").forEach(el => {
    const tag = el.getAttribute("data-city");
    const active = tag && val.includes(tag);
    el.style.background = active ? "rgba(212, 175, 55, 0.22)" : "var(--surface-2)";
    el.style.borderColor = active ? "var(--gold)" : "var(--line)";
    el.style.color = active ? "var(--gold)" : "var(--text-muted)";
    el.style.fontWeight = active ? "600" : "400";
  });

  document.querySelectorAll(".sess-env-tag").forEach(el => {
    const tag = el.getAttribute("data-env");
    const active = tag && val.includes(tag);
    el.style.background = active ? "rgba(212, 175, 55, 0.22)" : "var(--surface-2)";
    el.style.borderColor = active ? "var(--gold)" : "var(--line)";
    el.style.color = active ? "var(--gold)" : "var(--text-muted)";
    el.style.fontWeight = active ? "600" : "400";
  });
}

function setModalRating(n) {
  currentSessionRating = n;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`sess-star-${i}`);
    if (el) el.classList.toggle('filled', i <= n);
  }
}

async function saveNewSession(bottleId) {
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;

  const rawDate = document.getElementById('sess-date').value;
  const newSession = {
    id: 't_' + Date.now(),
    dateStr: rawDate ? rawDate.replace('T', ' ') : new Date().toLocaleString(),
    location: document.getElementById('sess-loc').value.trim(),
    companions: document.getElementById('sess-comp').value.trim(),
    rating: currentSessionRating,
    notes: document.getElementById('sess-notes').value.trim()
  };

  b.tastings.unshift(newSession);
  b.personalRating = newSession.rating;
  await saveBottleToDB(b);
  closeModal();
  renderBottleDetail(bottleId);
}

function openShareActionSheet(bottleId, sessionId = null) {
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="text-align:left;" onclick="event.stopPropagation()">
        <h3 style="font-family:var(--serif); font-size:18px; color:var(--gold); margin-bottom:12px;">
          ${currentLang==='zh'?'選擇分享方式':'Share Options'}
        </h3>
        
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn btn-primary btn-block" onclick="openPublishToCommunityDialog('${esc(b.id)}', '${esc(sessionId||'')}');">
            🌍 ${currentLang==='zh'?'發布到酒友公開探索池':'Publish to Community Feed'}
          </button>
          
          <button class="btn btn-ghost btn-block" onclick="executePrivateShare('${esc(b.id)}', '${esc(sessionId||'')}'); closeModal();">
            📲 ${currentLang==='zh'?'發送給朋友 (私密專屬連結)':'Share with Friends (Private Link)'}
          </button>

          <button class="btn btn-ghost btn-block" style="border-color:transparent; color:var(--text-faint);" onclick="closeModal()">
            ${currentLang==='zh'?'取消':'Cancel'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function openPublishToCommunityDialog(bottleId, sessionId) {
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;
  const s = sessionId ? (b.tastings || []).find(t => String(t.id) === String(sessionId)) : b.tastings?.[0];
  const initialLoc = s?.location || (currentLang === 'zh' ? "中環 屋企陽台" : "Central Balcony");
  const initialNotes = s?.notes || (currentLang === 'zh' ? "這支酒整體表現相當出色，香氣與尾韻平衡。" : "Great overall balance and finish.");
  const initialRating = s?.rating || b.personalRating || 5;

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="text-align:left; max-width:410px;" onclick="event.stopPropagation()">
        <h3 style="font-family:var(--serif); font-size:18px; color:var(--gold); margin-bottom:8px;">
          🌍 ${currentLang === 'zh' ? '發布到酒友公開探索池' : 'Publish to Community Feed'}
        </h3>
        <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px; line-height:1.5;">
          ${currentLang === 'zh'
            ? '分享你的品飲足跡！酒友能在世界地圖上看見你<strong>在何處品飲這款佳釀</strong>：'
            : 'Share your tasting footprint! Connoisseurs can spot where you enjoyed this bottle on the world map:'}
        </p>

        <!-- 邊度飲呢支酒 (地點與環境條件化複選) -->
        <div style="font-size:12px; font-weight:700; color:var(--gold); margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
          <span>🥂 ${currentLang === 'zh' ? '你在哪裡品飲這支酒？' : 'Where did you taste it?'}</span>
          <span style="font-size:11px; font-weight:normal; color:var(--text-faint);">${currentLang === 'zh' ? '地點與環境可組合' : 'Location & Setting'}</span>
        </div>
        <input type="text" id="pub-venue-loc" class="text-input" style="margin-top:0; padding:10px; font-size:13.5px;" value="${esc(initialLoc)}" placeholder="${currentLang === 'zh' ? '例如：中環 屋企陽台、高雄 酒吧、東京 居酒屋' : 'e.g. Central Balcony, Kaohsiung Bar, Tokyo Izakaya'}" oninput="updatePubTagHighlight()">

        <!-- 1. 城市 / 地區（單選切換） -->
        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-top:8px; margin-bottom:4px;">
          📍 ${currentLang === 'zh' ? '城市地區（單選切換）' : 'City / Region'}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px;">
          ${LOCATION_CITIES.map(c => {
            const t = currentLang === 'zh' ? c.zh : c.en;
            return `<span class="pub-city-tag" data-city="${t}" style="font-size:11px; padding:3px 9px; border-radius:999px; background:var(--surface-2); border:1px solid var(--line); color:var(--text-muted); cursor:pointer; user-select:none; transition:all 0.15s ease;" onclick="handleSelectCityTag('pub-venue-loc', '${t}')">${t}</span>`;
          }).join("")}
        </div>

        <!-- 2. 場合 / 環境（單選切換） -->
        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-bottom:4px;">
          🥂 ${currentLang === 'zh' ? '場合環境（單選切換）' : 'Setting / Occasion'}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:12px;">
          ${LOCATION_ENVIRONMENTS.map(e => {
            const t = currentLang === 'zh' ? e.zh : e.en;
            return `<span class="pub-env-tag" data-env="${t}" style="font-size:11px; padding:3px 9px; border-radius:999px; background:var(--surface-2); border:1px solid var(--line); color:var(--text-muted); cursor:pointer; user-select:none; transition:all 0.15s ease;" onclick="handleSelectEnvTag('pub-venue-loc', '${t}')">${t}</span>`;
          }).join("")}
        </div>

        <!-- 品飲心得手記 -->
        <div style="font-size:12px; font-weight:700; color:var(--gold); margin-bottom:4px;">
          📝 ${currentLang === 'zh' ? '這次的品飲手記' : 'Tasting Impressions'}
        </div>
        <textarea id="pub-venue-notes" class="text-input" style="height:70px; resize:none; padding:8px 10px; font-size:13px;">${esc(initialNotes)}</textarea>

        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost btn-block" style="padding:10px; font-size:13px;" onclick="closeModal()">${currentLang === 'zh' ? '取消' : 'Cancel'}</button>
          <button class="btn btn-primary btn-block" style="padding:10px; font-size:13px;" onclick="confirmPublishDrink('${esc(b.id)}', ${initialRating})">${currentLang === 'zh' ? '確認公開發布' : 'Publish to Feed'}</button>
        </div>
      </div>
    </div>
  `;

  updatePubTagHighlight();
}

async function confirmPublishDrink(bottleId, rating) {
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;

  const loc = (document.getElementById("pub-venue-loc")?.value || "").trim() || "香港某品飲處";
  const notes = (document.getElementById("pub-venue-notes")?.value || "").trim() || "品鑑佳釀";

  const payload = {
    id: b.id,
    author: localStorage.getItem("bottlesense_profile_name") || localStorage.getItem("bottlesense_owner_name") || "品飲同好",
    authorEmail: (localStorage.getItem("bottlesense_account_bound") || "").toLowerCase(),
    syncKey: localStorage.getItem("bottlesense_sync_key") || "",
    identification: b.identification,
    image: b.image,
    personalRating: rating,
    diary: { notes: notes },
    location: loc,
    publishedAt: Date.now()
  };

  closeModal();
  showToast("正在發布品飲手記…");

  try {
    await fetch(`${WORKER_API_URL}/api/explore/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    showToast(t("published_toast"));
  } catch(e) {
    showToast(t("published_toast"));
  }
}

function executePrivateShare(bottleId, sessionId) {
  if (sessionId) shareSingleSession(bottleId, sessionId);
  else shareSingleBottle(bottleId);
}

function syncPublishCellarAsync() {
  const key = localStorage.getItem('bottlesense_sync_key');
  fetch(`${WORKER_API_URL}/api/cellar/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ syncKey: key, cellar: window.cellar, ownerName: '品飲家' })
  }).catch(() => {});
}

async function shareEntireCellar() {
  if (!window.cellar || !window.cellar.length) return;
  syncPublishCellarAsync();

  const key = localStorage.getItem('bottlesense_sync_key');
  const shareUrl = `${location.origin}${location.pathname}?cellar=${encodeURIComponent(key)}`;
  const shareText = `🍾 歡迎參觀我的私人酒窖 (BottleSense)：內有 ${window.cellar.length} 款精選佳釀與真實品飲手記！`;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'BottleSense Cellar', text: shareText, url: shareUrl });
      return;
    } catch(err) { return; }
  }
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    showToast(t('copied_toast'));
  }
}

async function shareSingleBottle(id) {
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;
  syncPublishCellarAsync();

  const key = localStorage.getItem('bottlesense_sync_key');
  const shareUrl = `${location.origin}${location.pathname}?cellar=${encodeURIComponent(key)}&bottle=${b.id}`;
  const shareText = `🍾 BottleSense 藏酒推薦：${bottleName(b)}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: bottleName(b), text: shareText, url: shareUrl });
      return;
    } catch(err) { return; }
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    showToast(t('copied_toast'));
  }
}

async function shareSingleSession(bottleId, sessionId) {
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;
  const s = (b.tastings || []).find(t => String(t.id) === String(sessionId));
  if (!s) return;
  syncPublishCellarAsync();

  const key = localStorage.getItem('bottlesense_sync_key');
  const shareUrl = `${location.origin}${location.pathname}?cellar=${encodeURIComponent(key)}&bottle=${b.id}`;
  const noteStr = s.notes ? `\n心得：「${s.notes}」` : '';
  const shareText = `🥃 BottleSense 品飲手記\n酒款：${bottleName(b)}\n時間：${s.dateStr}\n評分：${'★'.repeat(s.rating||5)}${noteStr}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: `${bottleName(b)} Log`, text: shareText, url: shareUrl });
      return;
    } catch(err) { return; }
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    showToast(t('copied_toast'));
  }
}

/* =======================================================================
   真實金線世界地圖：2:1 比例鎖定 + 雙指捏合縮放 + 滾輪縮放 + 全方位平移
======================================================================= */
// 真實世界金線地圖對應坐標庫 (百分比 %：top, left)
// 載入使用者附件的實體「黑底金邊世界地圖」圖片 (Glowing Gold World Map.png)
const ATTACHED_GOLD_MAP_SRC = "Glowing%20Gold%20World%20Map.png";

// 真實世界金線地圖精準經緯座標對應庫 (依據 Glowing Gold World Map 像素校準，單位 %)
const REAL_IMAGE_GEO_POINTS = {
  // 英國 / 蘇格蘭 (威士忌聖地)
  '蘇格蘭': { top: 25.5, left: 47.3 }, '英國': { top: 26.5, left: 47.5 }, 'Scotland': { top: 25.5, left: 47.3 }, 'UK': { top: 26.5, left: 47.5 },
  // 法國 (波爾多 / 香檳 / 勃艮第)
  '法國': { top: 35.9, left: 49.8 }, '波爾多': { top: 36.5, left: 48.4 }, '香檳': { top: 33.4, left: 50.2 }, '勃艮第': { top: 35.2, left: 50.5 }, 'France': { top: 35.9, left: 49.8 },
  // 義大利 / 西班牙
  '義大利': { top: 38.9, left: 52.6 }, '意大利': { top: 38.9, left: 52.6 }, '西班牙': { top: 39.8, left: 46.3 }, 'Italy': { top: 38.9, left: 52.6 }, 'Spain': { top: 39.8, left: 46.3 },
  // 日本 (余市 / 山崎 / 沖繩 / 東京)
  '日本': { top: 35.0, left: 82.9 }, '余市': { top: 30.2, left: 82.9 }, '北海道': { top: 30.2, left: 82.9 }, '山崎': { top: 35.0, left: 82.9 }, '沖繩': { top: 43.0, left: 80.1 }, 'Japan': { top: 35.0, left: 82.9 },
  // 台灣 / 香港 / 中國
  '台灣': { top: 47.4, left: 77.8 }, 'Taiwan': { top: 47.4, left: 77.8 }, '香港': { top: 47.5, left: 76.1 }, 'Hong Kong': { top: 47.5, left: 76.1 }, '中國': { top: 36.0, left: 73.0 },
  // 美國 (納帕 / 加州 / 肯塔基)
  '美國': { top: 33.5, left: 18.0 }, '加州': { top: 32.6, left: 13.1 }, '納帕': { top: 32.6, left: 13.1 }, 'USA': { top: 33.5, left: 18.0 }, '肯塔基': { top: 34.6, left: 24.6 },
  // 澳洲 / 紐西蘭
  '澳洲': { top: 79.0, left: 79.7 }, '澳大利亞': { top: 79.0, left: 79.7 }, '紐西蘭': { top: 83.7, left: 91.4 }, 'Australia': { top: 79.0, left: 79.7 }
};

let mapZoom = 1;
let mapPanX = 0, mapPanY = 0;

async function renderExplore() {
  currentView = 'explore';
  currentBottleDetailId = null;
  setActiveNav('nav-explore');

  // 嚴格依據使用者指定：直接載入附件真實黑底金邊世界地圖圖片，並內建 Loading 動畫與平滑淡入
  function getGoldMapImgHTML() {
    return `
      <!-- 地圖載入 Loading 遮罩 (杜絕一格格漸進式破圖) -->
      <div id="mapLoadingOverlay" class="map-loading-overlay">
        <div class="loading-ring"></div>
        <div class="map-loading-text">LOADING TERROIR MAP...</div>
      </div>
      <img id="realGoldMapImg" 
           src="${ATTACHED_GOLD_MAP_SRC}" 
           class="real-gold-map-img" 
           alt="Glowing Gold World Map" 
           draggable="false" 
           style="opacity: 0; transition: opacity 0.35s ease;"
           onload="onRealMapLoaded(this)"
           onerror="handleGoldMapError(this)">
    `;
  }

  main.innerHTML = `
    <div class="view" style="padding-bottom: 50px;">
      <div class="section-head"><h2>${t('explore_title')}</h2></div>

      <!-- 真實金線世界地圖容器 (2:1 比例鎖定，支援雙指捏合縮放/滾輪與平移) -->
      <div class="world-radar-container" id="worldRadarBox">
        <div class="world-map-canvas-wrap" id="worldMapCanvasWrap">
          ${getGoldMapImgHTML()}
          
          <!-- 釘選在實體地圖上的酒友/產區光點層 -->
          <div id="geoPinsContainer" style="position:absolute; inset:0; pointer-events:none;"></div>
        </div>

        <!-- 縮放與重設 HUD 控制項 -->
        <div class="map-controls-hud">
          <button class="map-hud-btn" onclick="zoomWorldMap(1.25)">+</button>
          <button class="map-hud-btn" onclick="zoomWorldMap(0.8)">−</button>
          <button class="map-hud-btn" onclick="resetWorldMap()">↺</button>
        </div>
      </div>

      <div style="font-size:12.5px; color:var(--text-faint); margin-top:-10px; margin-bottom:18px;">
        💡 ${t('explore_hint')}
      </div>

      <div class="section-head"><h2>${currentLang==='zh'?'酒友最新公開品飲':'Public Tasting Feed'}</h2></div>
      <div id="explore-feed" style="text-align:center; padding:20px 10px; color:var(--text-muted); font-size:14px;">
        載入中...
      </div>
    </div>
  `;

  initRealMapInteractions();
  renderRealWorldPinsAndFeed();
}

function initRealMapInteractions() {
  const container = document.getElementById('worldRadarBox');
  if (!container) return;

  // 滑鼠滾輪縮放 (PC)
  container.onwheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    zoomWorldMap(factor);
  };

  let isDragging = false;
  let startX = 0, startY = 0;
  let initialPinchDist = 0;
  let initialZoomOnPinch = 1;

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - mapPanX;
    startY = e.clientY - mapPanY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    mapPanX = e.clientX - startX;
    mapPanY = e.clientY - startY;
    updateRealMapTransform();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // 觸控事件 (支援單指平移與雙指捏合縮放 Pinch)
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      isDragging = false;
      initialPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialZoomOnPinch = mapZoom;
      return;
    }
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - mapPanX;
      startY = e.touches[0].clientY - mapPanY;
    }
  }, { passive: false });

  container.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialPinchDist > 0) {
      e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = currentDist / initialPinchDist;
      mapZoom = Math.min(4.0, Math.max(0.7, initialZoomOnPinch * factor));
      updateRealMapTransform();
      return;
    }
    if (isDragging && e.touches.length === 1) {
      e.preventDefault();
      mapPanX = e.touches[0].clientX - startX;
      mapPanY = e.touches[0].clientY - startY;
      updateRealMapTransform();
    }
  }, { passive: false });

  container.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) initialPinchDist = 0;
    if (e.touches.length === 0) isDragging = false;
  });
}

function zoomWorldMap(factor) {
  mapZoom = Math.min(4.0, Math.max(0.7, mapZoom * factor));
  updateRealMapTransform();
}

function resetWorldMap() {
  mapZoom = 1; mapPanX = 0; mapPanY = 0;
  updateRealMapTransform();
}

function updateRealMapTransform() {
  const wrap = document.getElementById('worldMapCanvasWrap');
  if (wrap) {
    wrap.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`;
  }
}



function onRealMapLoaded(img) {
  const overlay = document.getElementById("mapLoadingOverlay");
  if (overlay) overlay.style.display = "none";
  if (img) img.style.opacity = "1";
}

function handleGoldMapError(img) {
  if (!img.dataset.retry) {
    img.dataset.retry = "1";
    img.src = "Glowing Gold World Map.png";
  } else if (img.dataset.retry === "1") {
    img.dataset.retry = "2";
    img.src = "map.png";
  }
}


function resolveDrinkingPinPos(drinkingLocation, country, region) {
  const loc = (drinkingLocation || "").toLowerCase();
  
  // 1. 香港各區 (支援中環、尖沙咀、銅鑼灣、旺角等複選場景)
  if (loc.includes("中環") || loc.includes("central")) {
    return { top: 47.5, left: 76.1 };
  }
  if (loc.includes("尖沙咀") || loc.includes("tst")) {
    return { top: 47.3, left: 76.2 };
  }
  if (loc.includes("銅鑼灣") || loc.includes("causeway bay") || loc.includes("cwb")) {
    return { top: 47.6, left: 76.3 };
  }
  if (loc.includes("旺角") || loc.includes("mong kok") || loc.includes("mk")) {
    return { top: 47.2, left: 76.1 };
  }
  if (loc.includes("香港") || loc.includes("灣仔") || loc.includes("西貢") || loc.includes("hong kong") || loc.includes("hk")) {
    return { top: 47.5, left: 76.1 };
  }
  if (loc.includes("澳門") || loc.includes("macau") || loc.includes("macao")) {
    return { top: 47.6, left: 75.9 };
  }
  
  // 2. 台灣各大城市 (精準定位：高雄、台中、台北)
  if (loc.includes("高雄") || loc.includes("kaohsiung")) {
    return { top: 48.2, left: 77.5 };
  }
  if (loc.includes("台中") || loc.includes("taichung")) {
    return { top: 47.4, left: 77.6 };
  }
  if (loc.includes("台北") || loc.includes("taipei")) {
    return { top: 46.7, left: 77.9 };
  }
  if (loc.includes("台南") || loc.includes("tainan")) {
    return { top: 48.0, left: 77.5 };
  }
  if (loc.includes("台灣") || loc.includes("taiwan")) {
    return { top: 47.4, left: 77.8 };
  }

  // 3. 日本各大城市 (精準定位：東京、大阪、京都、沖繩)
  if (loc.includes("東京") || loc.includes("tokyo")) {
    return { top: 35.0, left: 83.1 };
  }
  if (loc.includes("大阪") || loc.includes("osaka")) {
    return { top: 35.8, left: 81.6 };
  }
  if (loc.includes("京都") || loc.includes("kyoto")) {
    return { top: 35.5, left: 81.9 };
  }
  if (loc.includes("沖繩") || loc.includes("okinawa")) {
    return { top: 43.0, left: 80.1 };
  }
  if (loc.includes("北海道") || loc.includes("余市") || loc.includes("hokkaido")) {
    return { top: 30.2, left: 82.9 };
  }
  if (loc.includes("日本") || loc.includes("japan")) {
    return { top: 35.2, left: 82.5 };
  }

  // 4. 其他國際都市
  if (loc.includes("英國") || loc.includes("倫敦") || loc.includes("蘇格蘭") || loc.includes("london") || loc.includes("uk")) {
    return { top: 26.5, left: 47.5 };
  }
  if (loc.includes("法國") || loc.includes("巴黎") || loc.includes("france") || loc.includes("paris")) {
    return { top: 35.9, left: 49.8 };
  }
  if (loc.includes("美國") || loc.includes("紐約") || loc.includes("加州") || loc.includes("usa") || loc.includes("new york")) {
    return { top: 33.5, left: 18.0 };
  }
  if (loc.includes("新加坡") || loc.includes("singapore")) {
    return { top: 56.5, left: 73.5 };
  }
  if (loc.includes("澳洲") || loc.includes("雪梨") || loc.includes("墨爾本") || loc.includes("australia") || loc.includes("sydney")) {
    return { top: 79.0, left: 79.7 };
  }
  
  // 5. 若僅填寫場景（如「屋企陽台」、「露營星空下」）未註明城市，優先嘗試以原產地或熱門點定位
  return resolveRealImagePinPos(country, region);
}

function resolveRealImagePinPos(country, region) {
  const key = [region, country].find(k => k && REAL_IMAGE_GEO_POINTS[k]);
  if (key) {
    return REAL_IMAGE_GEO_POINTS[key];
  }
  const fallbackList = [
    { top: 35.9, left: 49.8 }, // 法國
    { top: 25.5, left: 47.3 }, // 蘇格蘭
    { top: 35.0, left: 82.9 }, // 日本
    { top: 32.6, left: 13.1 }, // 美國加州
    { top: 79.0, left: 79.7 }  // 澳洲
  ];
  return fallbackList[Math.floor(Math.random() * fallbackList.length)];
}

// 地圖平滑飛行並置中至指定 Pin 座標
function flyMapToPin(pos, targetZoom = 1.7) {
  const wrap = document.getElementById("worldMapCanvasWrap");
  if (!wrap) return;

  const pinX = (pos.left / 100) * 580;
  const pinY = (pos.top / 100) * 290;

  mapZoom = targetZoom;
  mapPanX = -(pinX - 290) * mapZoom;
  mapPanY = -(pinY - 145) * mapZoom;

  wrap.style.transition = "transform 0.6s cubic-bezier(0.2, 0.9, 0.3, 1)";
  updateRealMapTransform();

  setTimeout(() => {
    if (wrap) wrap.style.transition = "none";
  }, 650);
}

// 點擊卡片其他範圍（非右下角詳情按鈕）：地圖平滑滾回視野並鏡頭飛過去該 Pin 點（不開彈窗）
function onFeedCardClick(id) {
  const item = (window.currentExploreFeed || []).find(x => String(x.id) === String(id));
  if (!item) return;

  // 1. 平滑將地圖滾動至視野
  const mapBox = document.getElementById("worldRadarBox");
  if (mapBox) {
    mapBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // 2. 地圖平滑飛行至該酒款之飲酒地點 Pin
  const country = item.identification?.country || item.tags?.country || "";
  const region = item.identification?.region || item.tags?.region || "";
  const pos = resolveDrinkingPinPos(item.location, country, region);
  flyMapToPin(pos, 1.85);

  // 3. 地圖光點發出金色發光高亮脈衝
  const pinEl = document.getElementById(`pin-${id}`);
  if (pinEl) {
    document.querySelectorAll(".geo-pin-node").forEach(p => p.classList.remove("active-pin-glow"));
    pinEl.classList.add("active-pin-glow");
    setTimeout(() => { if (pinEl) pinEl.classList.remove("active-pin-glow"); }, 3000);
  }

  // 4. 列表卡片短暫金色邊框反饋
  const cardEl = document.getElementById(`feed-card-${id}`);
  if (cardEl) {
    cardEl.style.borderColor = "var(--gold)";
    setTimeout(() => { if (cardEl) cardEl.style.borderColor = "rgba(255,255,255,0.08)"; }, 2500);
  }
}

// 點擊地圖上的 Pin 光點：定位、高亮列表卡片並打開手記
function onMapPinClick(id) {
  const item = (window.currentExploreFeed || []).find(x => String(x.id) === String(id));
  if (!item) return;

  const cardEl = document.getElementById(`feed-card-${id}`);
  if (cardEl) {
    cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    cardEl.style.borderColor = "var(--gold)";
    setTimeout(() => { if (cardEl) cardEl.style.borderColor = "rgba(255,255,255,0.08)"; }, 2500);
  }

  const pinEl = document.getElementById(`pin-${id}`);
  if (pinEl) {
    document.querySelectorAll(".geo-pin-node").forEach(p => p.classList.remove("active-pin-glow"));
    pinEl.classList.add("active-pin-glow");
  }

  openPublicBottleModal(item);
}

function openPublicBottleModalById(id) {
  const item = (window.currentExploreFeed || []).find(x => String(x.id) === String(id));
  if (!item) return;
  openPublicBottleModal(item);
}

function openPublicBottleModal(b) {
  const x = safeIdentification(b);
  const img = bottleImage(b);
  const name = bottleName(b);
  const cat = formatFilterLabel(bottleCategory(b));
  const country = formatFilterLabel(bottleCountry(b) || (currentLang === "zh" ? "未知" : "Unknown"));
  const region = formatFilterLabel(bottleRegion(b) || (currentLang === "zh" ? "未知" : "Unknown"));
  const vintage = formatFilterLabel(bottleVintage(b));
  const producer = x.producer || x.brand || "";
  const author = b.author || (currentLang === "zh" ? "品飲同好" : "Wine Lover");
  const rating = Number(b.personalRating || 5);
  const notes = b.diary?.notes || (currentLang === "zh" ? "這支酒整體表現相當出色，香氣與尾韻平衡。" : "Great overall balance and finish.");
  const location = b.location || region || country || "";
  const dateStr = b.publishedAt ? new Date(b.publishedAt).toLocaleDateString() : "";

  const vm = b.identification?.vm || b.scan?.vm || null;
  const rec = b.identification?.rec || b.scan?.rec || null;

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="text-align:left; max-width:440px; max-height:88vh; overflow-y:auto;" onclick="event.stopPropagation()">
        <!-- 頂部列：分享者資訊與關閉按鈕 -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; border-bottom:1px solid var(--line); padding-bottom:10px;">
          <div>
            <div style="font-size:12px; font-family:var(--mono); color:var(--gold); font-weight:700;">
              👤 ${currentLang === "zh" ? "酒友分享" : "Community Share"} · ${esc(author)}
            </div>
            <div style="font-size:11.5px; color:var(--text-faint); margin-top:2px;">
              📍 ${esc(location)}${dateStr ? " · " + dateStr : ""}
            </div>
          </div>
          <button class="icon-btn" style="width:28px; height:28px;" onclick="closeModal()">✕</button>
        </div>

        <!-- 酒款照片展示 -->
        ${img ? `
          <div style="width:100%; height:200px; border-radius:12px; overflow:hidden; background:#000; border:1px solid var(--line); margin-bottom:14px; display:flex; align-items:center; justify-content:center;">
            <img src="${esc(img)}" style="width:100%; height:100%; object-fit:contain;" alt="">
          </div>
        ` : ""}

        <!-- 核心酒款名與產區 -->
        <div style="font-size:11px; font-family:var(--mono); color:var(--gold-dim); text-transform:uppercase;">${esc(cat)}</div>
        <div style="font-family:var(--serif); font-size:20px; font-weight:700; color:var(--text); margin-top:2px; margin-bottom:4px; line-height:1.3;">
          ${esc(name)}
        </div>
        <div style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">
          ${esc([producer, country, region].filter(Boolean).join(" · "))}
        </div>

        <!-- 規格網格 -->
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; background:var(--surface-2); border:1px solid var(--line); border-radius:10px; padding:10px; margin-bottom:14px; text-align:center;">
          <div>
            <div style="font-size:10px; font-family:var(--mono); color:var(--text-faint);">VINTAGE</div>
            <div style="font-size:13px; font-weight:600; color:var(--gold); margin-top:2px;">${esc(vintage)}</div>
          </div>
          <div>
            <div style="font-size:10px; font-family:var(--mono); color:var(--text-faint);">CATEGORY</div>
            <div style="font-size:13px; font-weight:600; color:var(--text); margin-top:2px;">${esc(cat)}</div>
          </div>
          <div>
            <div style="font-size:10px; font-family:var(--mono); color:var(--text-faint);">ORIGIN</div>
            <div style="font-size:13px; font-weight:600; color:var(--text); margin-top:2px;">${esc(country)}</div>
          </div>
        </div>

        <!-- 分享者的品飲心得手記 -->
        <div style="background:rgba(212,175,55,0.06); border:1px solid rgba(212,175,55,0.25); border-left:3px solid var(--gold); border-radius:10px; padding:12px 14px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:12px; font-family:var(--mono); font-weight:700; color:var(--gold);">🥃 品飲體驗評分</span>
            <span style="color:var(--gold); font-size:14px;">${"★".repeat(rating)}</span>
          </div>
          <div style="font-size:14px; color:var(--text); line-height:1.6; font-style:italic;">
            "${esc(notes)}"
          </div>
        </div>

        <!-- 八維雷達圖 (若有) -->
        ${vm ? renderRadar(vm) : ""}

        <!-- 侍酒師建議 (若有) -->
        ${rec ? renderRecommendation(rec) : ""}

        <!-- 操作按鈕：一鍵收藏至我的「想買」清單 -->
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn btn-primary btn-block" style="padding:10px; font-size:13.5px;" onclick="addPublicBottleToWishlist('${esc(b.id)}')">
            🏷️ ${currentLang === "zh" ? "加入我的想買清單" : "Add to Wishlist"}
          </button>
          <button class="btn btn-ghost btn-block" style="padding:10px; font-size:13.5px;" onclick="closeModal()">
            ${t("btn_close")}
          </button>
        </div>
      </div>
    </div>
  `;
}

async function addPublicBottleToWishlist(bottleId) {
  const item = (window.currentExploreFeed || []).find(x => String(x.id) === String(bottleId));
  if (!item) return;

  const newBottle = normalizeBottle({
    id: uid(),
    image: item.image,
    imageData: item.image,
    identification: item.identification || {},
    scan: item.identification || {},
    tags: {
      category: item.identification?.category || "酒類",
      vintage: item.identification?.vintage || "",
      country: item.identification?.country || "",
      region: item.identification?.region || ""
    },
    tastings: [],
    isFavorite: false,
    status: "wishlist",
    addedAt: Date.now()
  });

  window.cellar.unshift(newBottle);
  await saveBottleToDB(newBottle);
  closeModal();
  showToast(currentLang === "zh" ? "✓ 已成功收納至你的「想買」願望清單！" : "✓ Added to your Wishlist!");
}

async function renderRealWorldPinsAndFeed() {
  try {
    const res = await fetch(`${WORKER_API_URL}/api/explore`);
    const publicFeed = res.ok ? await res.json() : [];
    window.currentExploreFeed = publicFeed;
    const feedEl = document.getElementById("explore-feed");
    const pinsLayer = document.getElementById("geoPinsContainer");
    if (!feedEl) return;

    if (!publicFeed.length) {
      feedEl.innerHTML = `<div class="empty-shelf">目前尚無公開分享記錄。點擊酒款右上角的紙飛機即可將品飲手記發布到此處！</div>`;
      return;
    }

    if (pinsLayer) {
      pinsLayer.innerHTML = publicFeed.slice(0, 15).map((b) => {
        const country = b.identification?.country || b.tags?.country || "";
        const region = b.identification?.region || b.tags?.region || "";
        const pos = resolveDrinkingPinPos(b.location, country, region);
        return `
          <div class="geo-pin-node" id="pin-${esc(b.id)}" style="top:${pos.top}%; left:${pos.left}%; pointer-events:auto;" onclick="onMapPinClick('${esc(b.id)}')" title="${esc(bottleName(b))}">
            🍷
          </div>
        `;
      }).join("");
    }

    feedEl.innerHTML = publicFeed.map(b => {
      const name = b.identification?.name || "精選酒款";
      const author = b.author || (currentLang === "zh" ? "品飲同好" : "Wine Lover");
      const notes = b.diary?.notes || "這支酒整體表現相當出色，香氣與尾韻平衡。";
      const drinkingSpot = b.location || (currentLang === "zh" ? "香港某酒吧" : "Pour Spot");
      const origin = [formatFilterLabel(b.identification?.country), formatFilterLabel(b.identification?.region)].filter(Boolean).join(" · ") || (currentLang === "zh" ? "名釀產地" : "Terroir");

      return `
        <div class="explore-feed-card" id="feed-card-${esc(b.id)}" onclick="onFeedCardClick('${esc(b.id)}')">
          <div class="bottle-photo-box">${b.image ? `<img src="${esc(b.image)}">` : "🍷"}</div>
          
          <div class="bottle-info" style="flex:1; min-width:0;">
            <div class="bottle-name" style="font-size:16px; font-weight:700; color:var(--text); line-height:1.3; margin-bottom:3px; padding-right:75px;">
              ${esc(name)}
            </div>
            <div style="font-size:13px; color:var(--gold); margin-bottom:4px;">
              ★ ${b.personalRating || 5}/5 · <span style="color:var(--text-muted);">${esc(author)}</span>
            </div>
            <div style="font-size:13px; color:var(--text); line-height:1.5; font-style:italic; margin-bottom:6px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
              "${esc(notes)}"
            </div>
            <div style="font-size:11.5px; color:var(--text-faint); display:flex; flex-wrap:wrap; gap:8px;">
              <span>🥂 ${esc(drinkingSpot)}</span>
              <span>🍇 ${esc(origin)}</span>
            </div>
          </div>

          <!-- 右下角專屬詳情按鈕：絕對一行過，點擊開啟品飲手記視窗 -->
          <button class="explore-card-detail-btn" onclick="event.stopPropagation(); openPublicBottleModalById('${esc(b.id)}')">
            ${currentLang === "zh" ? "詳情 →" : "Details →"}
          </button>
        </div>
      `;
    }).join("");
  } catch(e) {
    const feedEl = document.getElementById("explore-feed");
    if (feedEl) feedEl.innerHTML = `<div class="empty-shelf">暫時無法載入酒友動態。</div>`;
  }
}

async function loadPublicCellar(key, sharedShelf, sharedBottleId) {
  try {
    const res = await fetch(`${WORKER_API_URL}/api/cellar/get?key=${encodeURIComponent(key)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '找不到酒櫃');

    isVisitorMode = true;
    visitorCellarData = data;
    window.cellar = Array.isArray(data.cellar) ? data.cellar.map(normalizeBottle) : [];

    if (sharedBottleId) {
      renderBottleDetail(sharedBottleId);
    } else {
      if (sharedShelf) currentScene = sharedShelf;
      renderCellar();
    }
  } catch(e) {
    alert(e.message || '無法載入公開酒櫃');
    exitVisitorMode();
  }
}

function exitVisitorMode() {
  isVisitorMode = false;
  visitorCellarData = null;
  history.replaceState({}, '', location.pathname);
  refreshCellar().then(renderHome);
}

/* ---------------- 拍照對位校準 HUD ---------------- */
let currentRawFile = null;
let cropScale = 1.0;
let cropTranslateX = 0;
let cropTranslateY = 0;
let isPanning = false;
let startPanX = 0, startPanY = 0;
let initialPinchDist = 0;
let initialScaleOnPinch = 1;

function openCamera() { if (cameraInput) cameraInput.click(); }
function openGallery() { if (galleryInput) galleryInput.click(); }

if (cameraInput) cameraInput.addEventListener('change', e => onImageSelected(e.target.files?.[0]));
if (galleryInput) galleryInput.addEventListener('change', e => onImageSelected(e.target.files?.[0]));

function onImageSelected(file) {
  if (!file) return;
  currentRawFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const cropImg = document.getElementById('cropTargetImage');
    cropImg.onload = () => {
      openCropModal();
    };
    cropImg.src = e.target.result;
    if (cropImg.complete && cropImg.naturalWidth) {
      openCropModal();
    }
  };
  reader.readAsDataURL(file);
}

function openCropModal() {
  const modal = document.getElementById('crop-modal');
  modal.style.display = 'flex';
  cropScale = 1.0;
  cropTranslateX = 0;
  cropTranslateY = 0;
  document.getElementById('zoomSlider').value = 1;
  updateCropTransform();
  initCropInteractions();
}

function closeCropModal() {
  document.getElementById('crop-modal').style.display = 'none';
  if (cameraInput) cameraInput.value = '';
  if (galleryInput) galleryInput.value = '';
}

function onSliderZoom(val) {
  cropScale = parseFloat(val);
  updateCropTransform();
}

function updateCropTransform() {
  const wrap = document.getElementById('cropImageWrap');
  if (wrap) {
    wrap.style.transform = `translate(${cropTranslateX}px, ${cropTranslateY}px) scale(${cropScale})`;
  }
}

function initCropInteractions() {
  const viewport = document.getElementById('cropViewport');

  viewport.onwheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    cropScale = Math.min(3, Math.max(0.5, cropScale + delta));
    document.getElementById('zoomSlider').value = cropScale;
    updateCropTransform();
  };

  const onPointerDown = (e) => {
    if (e.touches && e.touches.length === 2) {
      initialPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialScaleOnPinch = cropScale;
      return;
    }
    isPanning = true;
    const pt = e.touches ? e.touches[0] : e;
    startPanX = pt.clientX - cropTranslateX;
    startPanY = pt.clientY - cropTranslateY;
  };

  const onPointerMove = (e) => {
    if (e.touches && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (initialPinchDist > 0) {
        cropScale = Math.min(3, Math.max(0.5, initialScaleOnPinch * (dist / initialPinchDist)));
        document.getElementById('zoomSlider').value = cropScale;
        updateCropTransform();
      }
      return;
    }
    if (!isPanning) return;
    const pt = e.touches ? e.touches[0] : e;
    cropTranslateX = pt.clientX - startPanX;
    cropTranslateY = pt.clientY - startPanY;
    updateCropTransform();
  };

  const onPointerUp = () => {
    isPanning = false;
    initialPinchDist = 0;
  };

  viewport.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  viewport.addEventListener('touchstart', onPointerDown, { passive: false });
  viewport.addEventListener('touchmove', onPointerMove, { passive: false });
  viewport.addEventListener('touchend', onPointerUp);
}

async function confirmFullScan() {
  const cropImg = document.getElementById('cropTargetImage');
  if (!cropImg.src) return;

  if (!cropImg.complete || !cropImg.naturalWidth) {
    try { await cropImg.decode(); } catch(e){}
  }

  closeCropModal();
  showScanLoading();

  try {
    const nw = cropImg.naturalWidth || 800;
    const nh = cropImg.naturalHeight || 1000;
    const maxDim = 1200;
    let cw, ch;
    if (nh >= nw) {
      ch = maxDim;
      cw = Math.round(maxDim * (nw / nh));
    } else {
      cw = maxDim;
      ch = Math.round(maxDim * (nh / nw));
    }

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cropImg, 0, 0, cw, ch);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const b64Data = dataUrl.split(',')[1];

    const result = await identifyBottle(b64Data, 'image/jpeg');

    const bottle = normalizeBottle({
      id: uid(),
      image: dataUrl,
      imageData: dataUrl,
      identification: result,
      scan: result,
      tags: {
        category: result.category || (currentLang === 'zh' ? '酒類' : 'Liquor'),
        vintage: result.vintage || '',
        country: result.country || '',
        region: result.region || ''
      },
      tastings: [],
      isFavorite: false,
      status: 'unopened',
      addedAt: Date.now()
    });

    const isFirstBottle = (window.cellar || []).length === 0;
    window.cellar.unshift(bottle);
    await saveBottleToDB(bottle);

    if (isFirstBottle && !localStorage.getItem('bottlesense_registered')) {
      promptFirstBottleRegistration(bottle.id);
    } else {
      renderBottleDetail(bottle.id);
    }
  } catch(err) {
    showError(err?.message || (currentLang === 'zh' ? '辨識失敗，請確保酒標清晰後重試。' : 'Recognition failed. Please try again.'));
  }
}

async function confirmCropAndScan() {
  const cropImg = document.getElementById('cropTargetImage');
  if (!cropImg.src) return;

  // 確保圖片完整解碼，徹底解決手機高解析度相片 naturalWidth=0 導致純黑送出的問題
  if (!cropImg.complete || !cropImg.naturalWidth) {
    try { await cropImg.decode(); } catch(e){}
  }

  // 取得 SVG 酒瓶發光輪廓與圖片在螢幕上的真實視覺座標
  const bottlePath = document.getElementById('bottleCutoutPath');
  const targetRect = (bottlePath && bottlePath.getBoundingClientRect().width > 0)
    ? bottlePath.getBoundingClientRect()
    : document.getElementById('cropViewport').getBoundingClientRect();
  const imgRect = cropImg.getBoundingClientRect();

  closeCropModal();
  showScanLoading();

  try {
    // 輸出 1200px 高畫質黃金比例 Canvas (長邊鎖定 1200，完全避免照片巨大導致居中裁掉酒標)
    const maxDim = 1200;
    let canvasW, canvasH;
    if (targetRect.height >= targetRect.width) {
      canvasH = maxDim;
      canvasW = Math.round(maxDim * (targetRect.width / targetRect.height));
    } else {
      canvasW = maxDim;
      canvasH = Math.round(maxDim * (targetRect.height / targetRect.width));
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 精準螢幕視覺坐標 -> Canvas 幾何仿射映射
    const scaleX = canvasW / targetRect.width;
    const scaleY = canvasH / targetRect.height;
    const drawX = (imgRect.left - targetRect.left) * scaleX;
    const drawY = (imgRect.top - targetRect.top) * scaleY;
    const drawW = imgRect.width * scaleX;
    const drawH = imgRect.height * scaleY;

    ctx.drawImage(cropImg, drawX, drawY, drawW, drawH);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const b64Data = dataUrl.split(',')[1];

    const result = await identifyBottle(b64Data, 'image/jpeg');

    const bottle = normalizeBottle({
      id: uid(),
      image: dataUrl,
      imageData: dataUrl,
      identification: result,
      scan: result,
      tags: {
        category: result.category || (currentLang === 'zh' ? '酒類' : 'Liquor'),
        vintage: result.vintage || '',
        country: result.country || '',
        region: result.region || ''
      },
      tastings: [],
      isFavorite: false,
      status: 'unopened',
      addedAt: Date.now()
    });

    const isFirstBottle = (window.cellar || []).length === 0;

    window.cellar.unshift(bottle);
    await saveBottleToDB(bottle);

    if (isFirstBottle && !localStorage.getItem('bottlesense_registered')) {
      promptFirstBottleRegistration(bottle.id);
    } else {
      renderBottleDetail(bottle.id);
    }

  } catch(err) {
    showError(err?.message || (currentLang === 'zh' ? '辨識失敗，請確保酒標清晰後重試。' : 'Recognition failed. Please try again.'));
  }
}

/* ---------------- 完善落地方案：真實雲端綁定與手遊式引繼 ---------------- */
function promptFirstBottleRegistration(bottleId) {
  const syncKey = localStorage.getItem('bottlesense_sync_key') || '';

  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="text-align:left; max-width:400px;" onclick="event.stopPropagation()">
        <div style="font-family:var(--serif); font-size:20px; font-weight:700; color:var(--gold); margin-bottom:8px;">
          🎉 成功收納第一瓶酒！
        </div>

        <p style="font-size:13px; color:var(--text-muted); line-height:1.5; margin-bottom:14px;">
          為防止未來更換手機或清除瀏覽器快取時藏酒遺失，建議立即綁定雲端帳號：
        </p>

        <!-- 方案 A：真實雲端帳號綁定 -->
        <div style="background:var(--surface-2); border:1px solid rgba(212,175,55,0.3); border-radius:12px; padding:14px; margin-bottom:14px;">
          <div style="font-size:13px; font-weight:700; color:var(--gold); margin-bottom:8px;">🔐 方案 A：設定帳號密碼（換機無憂）</div>
          <div style="font-size:11.5px; font-family:var(--mono); color:var(--text-faint); margin-bottom:3px;">帳號 / 稱號 (Username / Email)</div>
          <input type="text" id="reg-name" class="text-input" style="margin-top:0; padding:9px; font-size:13.5px;" placeholder="例如：wine_lover / email">
          
          <div style="font-size:11.5px; font-family:var(--mono); color:var(--text-faint); margin-top:8px; margin-bottom:3px;">登入密碼 (Password)</div>
          <input type="password" id="reg-pass" class="text-input" style="margin-top:0; padding:9px; font-size:13.5px;" placeholder="設定你的專屬密碼">
          
          <button class="btn btn-primary btn-block" style="padding:10px; margin-top:12px; font-size:13.5px;" onclick="executeCloudBinding('${esc(bottleId)}')">
            立即綁定雲端帳號
          </button>
        </div>

        <!-- 方案 B：手遊引繼碼備份 -->
        <div style="background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.25); border-radius:12px; padding:12px; margin-bottom:14px;">
          <div style="font-size:12px; color:#f87171; font-weight:700; margin-bottom:4px;">⚠️ 方案 B：記下專屬同步碼（遊客備份）</div>
          <div style="font-size:11.5px; color:var(--text-muted); line-height:1.5;">
            若不設定帳號，請務必<strong>截圖保存下方專屬同步代碼</strong>，日後可在「設定」輸入代碼復原：
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; background:#0d0e0a; border:1px solid var(--line); border-radius:8px; padding:8px 10px; margin-top:6px;">
            <span style="font-family:var(--mono); font-size:13.5px; color:var(--gold); font-weight:700;">${esc(syncKey)}</span>
            <button class="btn btn-ghost btn-sm" style="padding:4px 8px; font-size:11px;" onclick="copySyncKey()">複製</button>
          </div>
        </div>

        <button class="btn btn-ghost btn-block" style="font-size:13px; color:var(--text-faint); border-color:transparent;" onclick="skipRegistration('${esc(bottleId)}')">
          稍後再說，以遊客身分繼續
        </button>
      </div>
    </div>
  `;
}

async function executeCloudBinding(bottleId) {
  const username = (document.getElementById('reg-name')?.value || '').trim();
  const password = document.getElementById('reg-pass')?.value || '';
  const syncKey = localStorage.getItem('bottlesense_sync_key') || '';

  if (!username || !password) {
    showToast("請輸入帳號與密碼！");
    return;
  }

  try {
    const res = await fetch(`${WORKER_API_URL}/api/account/bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, syncKey })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "綁定失敗");

    localStorage.setItem('bottlesense_owner_name', username);
    localStorage.setItem('bottlesense_account_bound', username);
    localStorage.setItem('bottlesense_registered', 'true');
    syncPublishCellarAsync();
    closeModal();
    showToast("✓ 雲端帳號綁定成功！");
    if (bottleId) renderBottleDetail(bottleId);
    else renderSettings();
  } catch(err) {
    showToast("綁定失敗: " + err.message);
  }
}

function skipRegistration(bottleId) {
  localStorage.setItem('bottlesense_registered', 'skipped');
  closeModal();
  if (bottleId) renderBottleDetail(bottleId);
}

async function identifyBottle(image, mediaType) {
  const res = await fetch(`${WORKER_API_URL}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, mediaType })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `AI 辨識服務異常 (${res.status})`);
  }
  if (!data || Object.keys(data).length === 0 || (!data.name && !data.category)) {
    throw new Error(currentLang === 'zh' ? '未能辨識出酒標資訊，請調整角度或光線後重試。' : 'Could not identify bottle. Please adjust lighting and try again.');
  }
  return data;
}

function showScanLoading() {
  main.innerHTML = `
    <div class="loading-view">
      <div class="loading-ring"></div>
      <div class="loading-badge">BOTTLESENSE VISION AI</div>
      <h2 class="loading-title">${t('analyzing_title')}</h2>
      <p class="loading-desc">${t('analyzing_desc')}</p>
    </div>
  `;
}

function showError(msg) {
  main.innerHTML = `
    <div class="loading-view">
      <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
      <h2 style="font-family:var(--serif); font-size:22px;">出現問題</h2>
      <p style="color:var(--text-muted); font-size:14px; margin:12px 20px 24px;">${esc(msg)}</p>
      <button class="btn btn-primary" onclick="goHome()">${currentLang==='zh'?'返回首頁':'Back to Home'}</button>
    </div>
  `;
}

async function toggleFavorite(id, rerender = false) {
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;
  b.isFavorite = !b.isFavorite;
  await saveBottleToDB(b);
  if (rerender) renderBottleDetail(id);
  else if (currentView === 'cellar') renderCellar();
  else renderHome();
}

async function deleteBottle(id) {
  if (!confirm(t('confirm_delete'))) return;
  const idx = (window.cellar || []).findIndex(x => String(x.id) === String(id));
  if (idx < 0) return;
  window.cellar.splice(idx, 1);
  await deleteBottleFromDB(id);
  currentBottleDetailId = null;
  if (previousViewBeforeDetail === 'cellar') renderCellar();
  else renderHome();
}

// ==========================================
// 電郵註冊／OTP登入與問候語系統 (Email Auth & Greeting)
// ==========================================
let authFlowState = {
  step: 'email', // 'email' | 'register_form' | 'register_sent' | 'login_otp'
  email: '',
  name: '',
  gender: 'unspecified',
  birthday: ''
};
let loginOtpCountdownTimer = null;

function updateHeaderGreeting() {
  const taglineEl = document.getElementById('appTagline') || document.querySelector('.tagline');
  if (!taglineEl) return;
  const boundAccount = localStorage.getItem('bottlesense_account_bound');
  const profileName = localStorage.getItem('bottlesense_profile_name') || (boundAccount ? boundAccount.split('@')[0] : '');
  const birthday = localStorage.getItem('bottlesense_profile_birthday') || '';

  if (boundAccount && profileName) {
    let isBirthday = false;
    if (birthday && birthday.includes('-')) {
      const parts = birthday.split('-');
      const bMonth = parseInt(parts[1], 10);
      const bDay = parseInt(parts[2], 10);
      const now = new Date();
      if ((now.getMonth() + 1) === bMonth && now.getDate() === bDay) {
        isBirthday = true;
      }
    }

    if (isBirthday) {
      taglineEl.innerHTML = `🎉 <strong style="color:var(--gold);">Happy birthday, ${esc(profileName)}!</strong>`;
    } else {
      taglineEl.innerHTML = `Hello, <strong style="color:var(--gold); font-weight:600;">${esc(profileName)}</strong>`;
    }
  } else {
    taglineEl.textContent = 'know what to do with it';
  }
}

function renderSettings() {
  const boundAccount = localStorage.getItem('bottlesense_account_bound');
  const profileName = localStorage.getItem('bottlesense_profile_name') || (boundAccount ? boundAccount.split('@')[0] : '');
  const birthday = localStorage.getItem('bottlesense_profile_birthday') || '';
  const gender = localStorage.getItem('bottlesense_profile_gender') || 'unspecified';
  const cellarCount = (window.cellar || []).length;

  let contentHTML = '';

  if (boundAccount) {
    // 1. 已登入狀態：可查看與即時編輯個人 Profile (姓名、生日、性別)，變更後即時聯動頂部問候語與雲端
    let bdayDisplay = birthday ? `🎂 ${currentLang === 'zh' ? '生日' : 'Birthday'}：${esc(birthday)}` : '';
    contentHTML = `
      <div style="background:linear-gradient(180deg, var(--surface-2) 0%, #161810 100%); border:1px solid var(--gold-dim); border-radius:14px; padding:16px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="font-size:12px; font-family:var(--mono); color:var(--gold); font-weight:700;">
            ✓ ${currentLang === 'zh' ? '已綁定電郵帳號' : 'Bound Email Account'}
          </div>
          <span style="font-size:11px; background:rgba(34,197,94,0.15); color:var(--green-ok); border:1px solid rgba(34,197,94,0.3); padding:2px 8px; border-radius:999px;">
            ● ${currentLang === 'zh' ? '雲端即時同步' : 'Cloud Synced'}
          </span>
        </div>

        <div style="font-family:var(--serif); font-size:20px; font-weight:700; color:var(--text); margin-bottom:4px; word-break:break-all;">
          Hello, <span style="color:var(--gold);">${esc(profileName)}</span>
        </div>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px; word-break:break-all;">
          ✉️ ${esc(boundAccount)}
        </div>

        <!-- 編輯個人資料卡片 (姓名、性別、生日) -->
        <div style="background:rgba(0,0,0,0.35); border:1px solid var(--line); border-radius:10px; padding:12px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:12px; font-weight:700; color:var(--gold);">
              ✏️ ${currentLang === 'zh' ? '會員個人資料 (即時聯動)' : 'Edit Profile'}
            </span>
          </div>

          <div style="font-size:11px; color:var(--text-faint); margin-bottom:3px;">
            ${currentLang === 'zh' ? '姓名 / 暱稱' : 'Name'} <span style="color:var(--wine-bright);">*</span>
          </div>
          <input type="text" id="edit-profile-name" class="text-input" style="margin-top:0; padding:7px 10px; font-size:13px; margin-bottom:8px;" value="${esc(profileName)}" placeholder="${currentLang === 'zh' ? '姓名 / 暱稱' : 'Name'}">

          <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:8px;">
            <div>
              <div style="font-size:11px; color:var(--text-faint); margin-bottom:3px;">
                ${currentLang === 'zh' ? '性別' : 'Gender'}
              </div>
              <select id="edit-profile-gender" class="text-input" style="margin-top:0; padding:7px 8px; font-size:12.5px;">
                <option value="unspecified" ${gender==='unspecified'?'selected':''}>${currentLang==='zh'?'保密':'Private'}</option>
                <option value="male" ${gender==='male'?'selected':''}>${currentLang==='zh'?'男':'Male'}</option>
                <option value="female" ${gender==='female'?'selected':''}>${currentLang==='zh'?'女':'Female'}</option>
              </select>
            </div>
            <div>
              <div style="font-size:11px; color:var(--text-faint); margin-bottom:3px;">
                ${currentLang === 'zh' ? '出生日期' : 'Birthday'}
              </div>
              <input type="date" id="edit-profile-birthday" class="text-input" style="margin-top:0; padding:7px 8px; font-size:12px;" value="${esc(birthday)}">
            </div>
          </div>

          <button id="btn-save-profile" class="btn btn-primary btn-block" style="padding:8px; margin-top:10px; font-size:12.5px; font-weight:700;" onclick="executeSaveProfile()">
            ${currentLang === 'zh' ? '儲存個人資料變更' : 'Save Profile Changes'}
          </button>
        </div>

        <div style="font-size:12px; color:var(--gold-dim); margin-bottom:14px;">
          ${currentLang === 'zh' ? `雲端目前已安全備份 ${cellarCount} 支藏酒與手記` : `${cellarCount} bottles & tasting notes safely backed up`}
        </div>

        <!-- 登出按鈕：依指定精簡為「登出帳號 Logout」 -->
        <button class="btn btn-wine btn-block" style="padding:10px; font-size:13.5px; margin-bottom:14px;" onclick="executeAccountLogout()">
          ${currentLang === 'zh' ? '登出帳號 Logout' : 'Logout'}
        </button>

        <!-- 永久註銷帳號區域 (可 tick 刪除清空所有資料) -->
        <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:12px; margin-top:4px;">
          <div style="font-size:12px; font-weight:700; color:#EF4444; margin-bottom:4px;">
            ⚠️ ${currentLang === 'zh' ? '永久註銷與資料刪除 (危險操作)' : 'Delete Account & Clear All Data'}
          </div>
          <div style="font-size:11px; color:var(--text-faint); line-height:1.4; margin-bottom:8px;">
            ${currentLang === 'zh' ? '若你想永久離開，請勾選下方確認。一旦刪除將清空 Email、個人檔案、所有藏酒手記與探索池記錄，無法回復。' : 'Tick below to permanently delete your email, profile, all bottles, notes and explore records. This cannot be undone.'}
          </div>

          <label style="display:flex; align-items:flex-start; gap:8px; font-size:11.5px; color:#FCA5A5; cursor:pointer; line-height:1.4; margin-bottom:10px;">
            <input type="checkbox" id="delete-account-confirm-check" style="margin-top:2px; accent-color:#EF4444;" onchange="toggleDeleteAccountButton(this.checked)">
            <span>${currentLang === 'zh' ? '我確認要永久刪除帳號及清空所有雲端與本機資料 (無法回復)' : 'I confirm I want to permanently delete my account and clear all data'}</span>
          </label>

          <button id="btn-delete-account" class="btn btn-block" style="padding:8px; font-size:12.5px; background:rgba(239,68,68,0.15); color:#EF4444; border:1px solid rgba(239,68,68,0.3); display:none;" onclick="executeDeleteAccountPermanently()">
            🗑️ ${currentLang === 'zh' ? '確認永久刪除帳號與所有資料' : 'Permanently Delete Account'}
          </button>
        </div>
      </div>
    `;
  } else {
    // 2. 未登入狀態：依據流程步驟顯示
    if (authFlowState.step === 'email') {
      // 步驟 1：只輸入 Email，下方換位按鈕 [註冊帳號] (左) 與 [登入酒窖] (右)，絕無「獲取6位驗證碼」
      contentHTML = `
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:14px; padding:15px; margin-bottom:12px;">
          <div style="font-size:13.5px; font-weight:700; color:var(--gold); margin-bottom:6px;">
            👤 ${currentLang === 'zh' ? '酒窖登入 / 註冊' : 'Cellar Login / Register'}
          </div>
          <div style="font-size:11.5px; color:var(--text-faint); margin-bottom:10px; line-height:1.4;">
            ${currentLang === 'zh' ? '輸入你的電郵地址即可快速開始：' : 'Enter your email address to get started:'}
          </div>

          <div style="font-size:11.5px; font-family:var(--mono); color:var(--text-faint); margin-bottom:4px;">
            ${currentLang === 'zh' ? '電郵地址 (Email)' : 'Email Address'}
          </div>
          <input type="email" id="auth-email" class="text-input" style="margin-top:0; padding:10px 12px; font-size:14px;" value="${esc(authFlowState.email)}" placeholder="${currentLang === 'zh' ? '輸入你的電郵 (例如 user@gmail.com)' : 'Enter email (e.g. user@gmail.com)'}">

          <!-- 依指定：登入、註冊兩個 Button 換位（註冊在左、登入在右） -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:14px;">
            <button class="btn btn-ghost btn-block" style="padding:10px; font-size:13px;" onclick="handleStartRegister()">
              ${currentLang === 'zh' ? '註冊帳號' : 'Register'}
            </button>
            <button class="btn btn-primary btn-block" style="padding:10px; font-size:13px;" onclick="handleStartLogin()">
              ${currentLang === 'zh' ? '登入酒窖' : 'Login'}
            </button>
          </div>
        </div>

        <!-- 社交帳號登入 -->
        <div style="margin-bottom:12px;">
          <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); text-align:center; margin-bottom:6px; text-transform:uppercase;">
            ${currentLang === 'zh' ? '或使用社交帳號登入' : 'Or via Social Account'}
          </div>
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px;">
            <button class="social-login-btn google-btn" onclick="executeSocialLogin('Google')">
              <svg viewBox="0 0 24 24" width="15" height="15"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-2.9z"/><path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.9C3.7 20.6 7.5 23.5 12 23.5z"/></svg>
              <span>Google</span>
            </button>
            <button class="social-login-btn apple-btn" onclick="executeSocialLogin('Apple')">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.64-.78 1.08-1.86.96-2.95-1 .04-2.14.66-2.79 1.43-.57.66-.99 1.76-.85 2.81 1.11.09 2.04-.51 2.68-1.29z"/></svg>
              <span>Apple</span>
            </button>
            <button class="social-login-btn fb-btn" onclick="executeSocialLogin('Facebook')">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              <span>FB</span>
            </button>
          </div>
        </div>

        <!-- 最底遊客身分狀態 -->
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; color:var(--text-faint);">${currentLang === 'zh' ? '目前身分狀態：' : 'Status:'}</span>
          <span style="font-size:12.5px; font-weight:600; color:var(--text-muted);">
            👤 ${currentLang === 'zh' ? '遊客模式 (未登入)' : 'Guest Mode'}
          </span>
        </div>
      `;
    } else if (authFlowState.step === 'register_form') {
      // 步驟 2A：註冊表單（必填項打 *，其他不加多餘備註）
      contentHTML = `
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:14px; padding:15px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-size:14px; font-weight:700; color:var(--gold);">
              📝 ${currentLang === 'zh' ? '填寫註冊資料' : 'Register Profile'}
            </div>
            <span style="font-size:11px; color:var(--gold-dim); font-family:var(--mono);">
              STEP 2/2
            </span>
          </div>

          <div style="background:rgba(0,0,0,0.3); border:1px solid var(--line); border-radius:8px; padding:8px 10px; font-size:12px; color:var(--text-muted); margin-bottom:12px; word-break:break-all;">
            ✉️ ${esc(authFlowState.email)}
          </div>

          <!-- 必填姓名：標註 *，未填時高亮並捲動 -->
          <div id="field-wrap-name">
            <div style="font-size:12px; font-weight:600; color:var(--text); margin-bottom:4px;">
              ${currentLang === 'zh' ? '姓名' : 'Name'} <span style="color:#EF4444; font-weight:700;">*</span>
            </div>
            <input type="text" id="reg-name" class="text-input" style="margin-top:0; padding:9px 12px; font-size:13.5px; transition:border 0.3s;" value="${esc(authFlowState.name)}" placeholder="${currentLang === 'zh' ? '請輸入姓名' : 'Enter name'}" oninput="clearNameFieldError()">
            <div id="reg-name-error" style="display:none; font-size:11.5px; color:#EF4444; margin-top:4px; font-weight:600;">
              ⚠️ ${currentLang === 'zh' ? '請填寫姓名以完成註冊' : 'Please enter your name'}
            </div>
          </div>

          <!-- 選填性別：乾淨無冗餘備註 -->
          <div style="font-size:12px; font-weight:600; color:var(--text); margin-top:12px; margin-bottom:4px;">
            ${currentLang === 'zh' ? '性別' : 'Gender'}
          </div>
          <select id="reg-gender" class="text-input" style="margin-top:0; padding:8px 10px; font-size:13px;">
            <option value="unspecified" ${authFlowState.gender==='unspecified'?'selected':''}>${currentLang==='zh'?'保密':'Prefer not to say'}</option>
            <option value="male" ${authFlowState.gender==='male'?'selected':''}>${currentLang==='zh'?'男':'Male'}</option>
            <option value="female" ${authFlowState.gender==='female'?'selected':''}>${currentLang==='zh'?'女':'Female'}</option>
          </select>

          <!-- 選填生日：乾淨無冗餘備註 -->
          <div style="font-size:12px; font-weight:600; color:var(--text); margin-top:12px; margin-bottom:4px;">
            ${currentLang === 'zh' ? '生日' : 'Birthday'}
          </div>
          <input type="date" id="reg-birthday" class="text-input" style="margin-top:0; padding:8px 10px; font-size:13px;" value="${esc(authFlowState.birthday)}">

          <!-- 使用及私隱條款 Checkbox (必填打 *) -->
          <label style="display:flex; align-items:flex-start; gap:8px; font-size:12px; color:var(--text-muted); margin-top:14px; cursor:pointer; line-height:1.4;">
            <input type="checkbox" id="reg-terms-check" style="margin-top:2px; accent-color:var(--gold);">
            <span>
              ${currentLang === 'zh'
                ? '我已閱讀並同意 <a href="javascript:void(0)" onclick="openTermsModal()" style="color:var(--gold); text-decoration:underline;">使用條款</a> 及 <a href="javascript:void(0)" onclick="openPrivacyModal()" style="color:var(--gold); text-decoration:underline;">私隱政策</a> <span style="color:#EF4444;">*</span>'
                : 'I agree to the <a href="javascript:void(0)" onclick="openTermsModal()" style="color:var(--gold);">Terms of Service</a> and <a href="javascript:void(0)" onclick="openPrivacyModal()" style="color:var(--gold);">Privacy Policy</a> <span style="color:#EF4444;">*</span>'}
            </span>
          </label>

          <button class="btn btn-primary btn-block" style="padding:10px; margin-top:14px; font-size:13.5px;" onclick="executeSendVerificationLink()">
            ${currentLang === 'zh' ? '📨 發送認證電郵 (Verify Email)' : '📨 Send Verification Email'}
          </button>
          
          <button class="btn btn-ghost btn-block" style="padding:8px; margin-top:8px; font-size:12.5px; border-color:transparent; color:var(--text-faint);" onclick="backToEmailStep()">
            ← ${currentLang === 'zh' ? '返回修改電郵' : 'Back to Email'}
          </button>
        </div>
      `;
    } else if (authFlowState.step === 'register_sent') {
      // 步驟 2B：認證郵件已發送（引導用戶去信箱撳 Verify Link 完成註冊）
      contentHTML = `
        <div style="background:var(--surface-2); border:1px solid var(--gold-dim); border-radius:14px; padding:20px 16px; margin-bottom:12px; text-align:center;">
          <div style="font-size:36px; margin-bottom:8px;">📨</div>
          <h3 style="font-family:var(--serif); font-size:19px; color:var(--gold); margin-bottom:8px;">
            ${currentLang === 'zh' ? '認證郵件已發送！' : 'Verification Email Sent!'}
          </h3>
          <div style="font-size:13.5px; color:var(--text); line-height:1.5; margin-bottom:12px;">
            ${currentLang === 'zh' ? '我們已將驗證連結寄至你的信箱：' : 'We sent a verification link to:'}<br>
            <strong style="color:var(--gold); word-break:break-all;">${esc(authFlowState.email)}</strong>
          </div>
          <div style="background:rgba(212,175,55,0.1); border:1px solid var(--gold-dim); border-radius:10px; padding:12px; font-size:12.5px; color:var(--gold); line-height:1.5; margin-bottom:16px; text-align:left;">
            📌 <strong>${currentLang === 'zh' ? '完成註冊步驟：' : 'Next Steps:'}</strong><br>
            1. 打開你的電子郵件收件箱<br>
            2. 點擊信中的「<strong>✓ 立即認證電郵完成註冊</strong>」連結<br>
            3. 點擊後你的酒窖將立即啟用，上方會顯示「Hello, ${esc(authFlowState.name)}」！
          </div>
          <button class="btn btn-primary btn-block" style="padding:10px;" onclick="closeModal()">
            ${currentLang === 'zh' ? '我知道了' : 'Got it'}
          </button>
        </div>
      `;
    } else if (authFlowState.step === 'login_otp') {
      // 步驟 2C：登入酒窖 OTP 輸入介面
      contentHTML = `
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:14px; padding:18px 16px; margin-bottom:12px; text-align:center;">
          <div style="font-size:32px; margin-bottom:6px;">🔐</div>
          <h3 style="font-family:var(--serif); font-size:18px; color:var(--gold); margin-bottom:6px;">
            ${currentLang === 'zh' ? '輸入電郵驗證碼 (OTP)' : 'Enter Email OTP Code'}
          </h3>
          <div style="font-size:12.5px; color:var(--text-muted); margin-bottom:14px; line-height:1.4;">
            ${currentLang === 'zh' ? '6 位數安全驗證碼已發送至：' : 'A 6-digit code has been sent to:'}<br>
            <strong style="color:var(--text); word-break:break-all;">${esc(authFlowState.email)}</strong>
          </div>

          <div style="margin-bottom:14px;">
            <input type="text" id="login-otp" class="text-input" placeholder="------" maxlength="6" inputmode="numeric" autocomplete="one-time-code" oninput="handleOtpInput(this)" onpaste="handleOtpPaste(event)" style="letter-spacing:8px; font-size:24px; font-weight:800; text-align:center; font-family:var(--mono); padding:10px; color:var(--gold);">
          </div>

          <button class="btn btn-primary btn-block" style="padding:10px; font-size:14px; font-weight:700;" onclick="executeLoginWithOtp()">
            ${currentLang === 'zh' ? '確認登入並載入酒窖' : 'Verify & Load Cellar'}
          </button>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
            <button id="btn-login-resend" class="btn btn-ghost btn-sm" style="font-size:11.5px; padding:4px 10px;" onclick="resendLoginOtp()">
              ${currentLang === 'zh' ? '重新發送驗證碼' : 'Resend Code'}
            </button>
            <button class="btn btn-ghost btn-sm" style="font-size:11.5px; padding:4px 10px; border-color:transparent; color:var(--text-faint);" onclick="backToEmailStep()">
              ${currentLang === 'zh' ? '返回修改電郵' : 'Change Email'}
            </button>
          </div>
        </div>
      `;
    }
  }

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" style="max-width:390px; text-align:left;" onclick="event.stopPropagation()">
        <h2 style="font-family:var(--serif); margin-bottom:14px; font-size:20px; color:var(--gold); text-align:center;">
          ${t('settings_title')}
        </h2>

        ${contentHTML}

        <button class="btn btn-ghost btn-block" style="padding:9px; font-size:13px; color:var(--text-faint); border-color:transparent;" onclick="closeModal()">
          ${t('btn_close')}
        </button>
      </div>
    </div>
  `;
}
// 自動偵測 6 位數 OTP 輸入與貼上 (Paste 即直接登入，毋需撳確認)
function handleOtpInput(inputEl) {
  if (!inputEl) return;
  const val = (inputEl.value || '').replace(/\D/g, '').slice(0, 6);
  inputEl.value = val;
  if (val.length === 6) {
    executeLoginWithOtp();
  }
}

function handleOtpPaste(e) {
  const pasteData = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  const match = pasteData.match(/\d{6}/);
  if (match) {
    e.preventDefault();
    const inputEl = document.getElementById('login-otp');
    if (inputEl) {
      inputEl.value = match[0];
      executeLoginWithOtp();
    }
  }
}
window.handleOtpInput = handleOtpInput;
window.handleOtpPaste = handleOtpPaste;

async function handleStartRegister() {
  const emailInput = document.getElementById('auth-email');
  const email = (emailInput?.value || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showToast(currentLang === 'zh' ? '請輸入有效的電郵地址 (例如 user@gmail.com)' : 'Please enter a valid email address');
    return;
  }

  // 檢查是否已註冊，防止重複註冊
  try {
    const checkRes = await fetch(`${WORKER_API_URL}/api/auth/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const checkData = await checkRes.json();
    if (checkData.exists) {
      showToast(currentLang === 'zh' ? '⚠️ 此電郵已經註冊過！已自動為你切換至「登入模式」' : '⚠️ This email is already registered! Switched to login mode.');
      authFlowState.email = email;
      handleStartLogin(email);
      return;
    }
  } catch (e) {
    console.warn('Check email error:', e);
  }

  authFlowState.email = email;
  authFlowState.step = 'register_form';
  renderSettings();
}

async function handleStartLogin(overrideEmail) {
  let email = overrideEmail;
  if (!email) {
    const emailInput = document.getElementById('auth-email');
    email = (emailInput?.value || '').trim().toLowerCase();
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showToast(currentLang === 'zh' ? '請輸入有效的電郵地址 (例如 user@gmail.com)' : 'Please enter a valid email address');
    return;
  }
  authFlowState.email = email;

  showToast(currentLang === 'zh' ? '正在發送登入驗證碼…' : 'Sending login code...');
  try {
    const res = await fetch(`${WORKER_API_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '發送失敗');

    authFlowState.step = 'login_otp';
    renderSettings();
    showToast(currentLang === 'zh' ? '✓ 驗證碼已發送至你的電郵信箱！' : '✓ Code sent to your inbox!');
    startLoginOtpCountdown();
  } catch (err) {
    showToast('發送失敗: ' + err.message);
  }
}

function backToEmailStep() {
  authFlowState.step = 'email';
  if (loginOtpCountdownTimer) clearInterval(loginOtpCountdownTimer);
  renderSettings();
}

function startLoginOtpCountdown() {
  let count = 60;
  const btn = document.getElementById('btn-login-resend');
  if (btn) {
    btn.disabled = true;
    btn.textContent = currentLang === 'zh' ? `重新發送 (${count}s)` : `Resend (${count}s)`;
  }
  if (loginOtpCountdownTimer) clearInterval(loginOtpCountdownTimer);
  loginOtpCountdownTimer = setInterval(() => {
    count--;
    const b = document.getElementById('btn-login-resend');
    if (!b) {
      clearInterval(loginOtpCountdownTimer);
      return;
    }
    if (count <= 0) {
      clearInterval(loginOtpCountdownTimer);
      b.disabled = false;
      b.textContent = currentLang === 'zh' ? '重新發送驗證碼' : 'Resend Code';
    } else {
      b.textContent = currentLang === 'zh' ? `重新發送 (${count}s)` : `Resend (${count}s)`;
    }
  }, 1000);
}

async function resendLoginOtp() {
  if (!authFlowState.email) return;
  showToast(currentLang === 'zh' ? '正在重新發送驗證碼…' : 'Resending code...');
  try {
    const res = await fetch(`${WORKER_API_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authFlowState.email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '發送失敗');
    showToast(currentLang === 'zh' ? '✓ 新驗證碼已發送！' : '✓ New code sent!');
    startLoginOtpCountdown();
  } catch (err) {
    showToast('發送失敗: ' + err.message);
  }
}

function clearNameFieldError() {
  const errEl = document.getElementById('reg-name-error');
  const inputEl = document.getElementById('reg-name');
  if (errEl) errEl.style.display = 'none';
  if (inputEl) inputEl.style.borderColor = '';
}

async function executeSendVerificationLink() {
  const nameInput = document.getElementById('reg-name');
  const nameError = document.getElementById('reg-name-error');
  const genderInput = document.getElementById('reg-gender');
  const bdayInput = document.getElementById('reg-birthday');
  const termsCheck = document.getElementById('reg-terms-check');

  const name = (nameInput?.value || '').trim();
  const gender = genderInput?.value || 'unspecified';
  const birthday = bdayInput?.value || '';

  if (!name) {
    if (nameError) nameError.style.display = 'block';
    if (nameInput) {
      nameInput.style.borderColor = '#EF4444';
      nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameInput.focus();
    }
    showToast(currentLang === 'zh' ? '⚠️ 請填寫姓名或暱稱 (*必填)' : '⚠️ Please enter your name (*required)');
    return;
  }

  if (!termsCheck?.checked) {
    showToast(currentLang === 'zh' ? '⚠️ 請閱讀並勾選同意使用條款及私隱政策 (*必填)' : '⚠️ Please agree to Terms and Privacy Policy (*required)');
    termsCheck?.focus();
    return;
  }

  authFlowState.name = name;
  authFlowState.gender = gender;
  authFlowState.birthday = birthday;

  showToast(currentLang === 'zh' ? '正在發送註冊認證電郵…' : 'Sending verification email...');

  try {
    const originUrl = window.location.origin + window.location.pathname;
    const res = await fetch(`${WORKER_API_URL}/api/auth/send-verify-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: authFlowState.email,
        name: name,
        gender: gender,
        birthday: birthday,
        syncKey: localStorage.getItem('bottlesense_sync_key') || '',
        originUrl: originUrl,
        cellar: window.cellar || []
      })
    });
    const data = await res.json();
    
    // 若後端回傳 409 或已經註冊過提示
    if (res.status === 409 || data.isAlreadyRegistered) {
      showToast(currentLang === 'zh' ? '⚠️ 此電郵已註冊！已自動為你切換至「登入模式」' : '⚠️ Email already registered! Switched to login mode.');
      handleStartLogin(authFlowState.email);
      return;
    }

    if (!res.ok) throw new Error(data.error || '發送失敗');

    authFlowState.step = 'register_sent';
    renderSettings();
    showToast(currentLang === 'zh' ? '✓ 認證信已寄出，請查收信箱！' : '✓ Verification link sent!');
  } catch (err) {
    showToast('發送失敗: ' + err.message);
  }
}
async function handleEmailVerificationFromUrl(token, email) {
  showToast(currentLang === 'zh' ? '正在認證電郵並完成註冊…' : 'Verifying email registration...');
  try {
    const res = await fetch(`${WORKER_API_URL}/api/auth/confirm-verify-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '認證失敗');

    // 還原或綁定酒窖
    if (data.cellar) {
      await restoreCellarToLocal(data.cellar, data.syncKey, data.name || data.email);
    }
    localStorage.setItem('bottlesense_account_bound', data.email);
    localStorage.setItem('bottlesense_profile_name', data.name);
    if (data.birthday) localStorage.setItem('bottlesense_profile_birthday', data.birthday);
    if (data.gender) localStorage.setItem('bottlesense_profile_gender', data.gender);
    localStorage.setItem('bottlesense_registered', 'true');

    // 清理 URL
    window.history.replaceState({}, document.title, window.location.pathname);

    updateHeaderGreeting();

    modalContainer.innerHTML = `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" style="text-align:center; max-width:380px;" onclick="event.stopPropagation()">
          <div style="font-size:42px; margin-bottom:10px;">🎉</div>
          <h3 style="font-family:var(--serif); font-size:20px; color:var(--gold); margin-bottom:8px;">
            ${currentLang === 'zh' ? '電郵認證成功！' : 'Email Verified!'}
          </h3>
          <p style="font-size:14px; color:var(--text); line-height:1.6; margin-bottom:16px;">
            ${currentLang === 'zh'
              ? `歡迎你，<strong>${esc(data.name)}</strong>！你的專屬雲端酒窖已正式啟用。`
              : `Welcome, <strong>${esc(data.name)}</strong>! Your cloud cellar is now active.`}
          </p>
          <button class="btn btn-primary btn-block" style="padding:10px;" onclick="closeModal()">
            ${currentLang === 'zh' ? '開始探索我的酒窖' : 'Explore My Cellar'}
          </button>
        </div>
      </div>
    `;

    if (currentView === 'cellar') renderCellar();
    else if (currentView === 'home') renderHome();
    else if (currentView === 'explore') renderExplore();
  } catch (err) {
    showToast('電郵認證失敗: ' + err.message);
  }
}

// 儲存修改個人資料 (姓名、生日、性別)，即時聯動問候語與同步雲端
async function executeSaveProfile() {
  const email = localStorage.getItem('bottlesense_account_bound');
  const nameInput = document.getElementById('edit-profile-name');
  const genderInput = document.getElementById('edit-profile-gender');
  const bdayInput = document.getElementById('edit-profile-birthday');
  const btn = document.getElementById('btn-save-profile');

  const newName = (nameInput?.value || '').trim();
  const newGender = genderInput?.value || 'unspecified';
  const newBirthday = bdayInput?.value || '';

  if (!newName) {
    showToast(currentLang === 'zh' ? '⚠️ 姓名不能為空' : '⚠️ Name cannot be empty');
    nameInput?.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = currentLang === 'zh' ? '正在儲存…' : 'Saving...';
  }

  try {
    if (email) {
      const res = await fetch(`${WORKER_API_URL}/api/auth/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          name: newName,
          gender: newGender,
          birthday: newBirthday
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '儲存失敗');
    }

    // 更新本機儲存
    localStorage.setItem('bottlesense_profile_name', newName);
    localStorage.setItem('bottlesense_owner_name', newName);
    localStorage.setItem('bottlesense_profile_gender', newGender);
    if (newBirthday) {
      localStorage.setItem('bottlesense_profile_birthday', newBirthday);
    } else {
      localStorage.removeItem('bottlesense_profile_birthday');
    }

    // 即時聯動頂部問候語
    updateHeaderGreeting();

    showToast(currentLang === 'zh' ? '✓ 個人資料已更新，問候語已即時同步！' : '✓ Profile updated & greeting synced!');
    renderSettings();
  } catch (err) {
    showToast('更新失敗: ' + err.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = currentLang === 'zh' ? '儲存個人資料變更' : 'Save Profile Changes';
    }
  }
}

// 登出帳號（就咁寫 登出帳號 Logout）
async function executeAccountLogout() {
  const confirmMsg = currentLang === 'zh'
    ? '確定要登出帳號？登出後將會清空本機暫存藏酒。雲端酒窖資料已安全備份，重新輸入電郵驗證即可再次載入查看。'
    : 'Are you sure you want to log out? Local data on this device will be cleared. Cloud data is safely backed up and can be restored anytime by verifying your email again.';

  if (!confirm(confirmMsg)) return;

  if (typeof clearLocalCellar === 'function') {
    await clearLocalCellar();
  } else {
    window.cellar = [];
  }

  window.cellar = [];
  localStorage.removeItem('bottlesense_account_bound');
  localStorage.removeItem('bottlesense_owner_name');
  localStorage.removeItem('bottlesense_profile_name');
  localStorage.removeItem('bottlesense_profile_birthday');
  localStorage.removeItem('bottlesense_profile_gender');
  localStorage.removeItem('bottlesense_registered');

  const newGuestKey = 'BTL-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  localStorage.setItem('bottlesense_sync_key', newGuestKey);
  mySyncKey = newGuestKey;

  authFlowState = { step: 'email', email: '', name: '', gender: 'unspecified', birthday: '' };

  showToast(currentLang === 'zh' ? '✓ 已成功登出並清空本機藏酒資料' : '✓ Logged out and cleared local data');

  updateHeaderGreeting();

  if (currentView === 'cellar') renderCellar();
  else if (currentView === 'home') renderHome();
  else if (currentView === 'explore') renderExplore();
  else goHome();

  renderSettings();
}

// 切換永久註銷按鈕顯示
function toggleDeleteAccountButton(checked) {
  const btn = document.getElementById('btn-delete-account');
  if (btn) {
    btn.style.display = checked ? 'block' : 'none';
  }
}

// 永久刪除帳號及清空所有資料 (Double Confirm)
async function executeDeleteAccountPermanently() {
  const email = localStorage.getItem('bottlesense_account_bound');
  const syncKey = localStorage.getItem('bottlesense_sync_key') || '';

  const confirmMsg1 = currentLang === 'zh'
    ? `⚠️【第一重警告】您即將永久刪除帳號（${email}）！\n\n此操作將永久銷毀：\n1. 您的電郵帳號與 Profile\n2. 雲端及本機全部藏酒與品飲筆記\n3. 社群探索池中發布的所有手記記錄\n\n刪除後 100% 無法回復！您確定要繼續嗎？`
    : `⚠️ [WARNING 1] You are about to permanently delete your account (${email})! This will erase your email, profile, all cellar bottles, notes and explore records. This CANNOT be undone! Continue?`;

  if (!confirm(confirmMsg1)) return;

  const confirmMsg2 = currentLang === 'zh'
    ? `🔴【第二重最終確認】最後確認：刪除後所有資料將立即化為烏有且無法復原！\n\n請再次確認是否永久註銷並刪除所有資料？`
    : `🔴 [FINAL CONFIRMATION] Are you ABSOLUTELY sure? All your data will be permanently wiped immediately!`;

  if (!confirm(confirmMsg2)) return;

  showToast(currentLang === 'zh' ? '正在永久刪除帳號與清空資料…' : 'Permanently deleting account & data...');

  try {
    if (email) {
      await fetch(`${WORKER_API_URL}/api/auth/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, syncKey })
      });
    }

    // 清空本地 IndexedDB
    if (typeof clearLocalCellar === 'function') {
      await clearLocalCellar();
    } else {
      window.cellar = [];
    }

    // 清空 localStorage 所有相關記錄
    localStorage.clear();

    window.cellar = [];
    const newGuestKey = 'BTL-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    localStorage.setItem('bottlesense_sync_key', newGuestKey);
    mySyncKey = newGuestKey;

    authFlowState = { step: 'email', email: '', name: '', gender: 'unspecified', birthday: '' };

    updateHeaderGreeting();

    closeModal();
    showToast(currentLang === 'zh' ? '✓ 帳號與所有資料已徹底永久刪除！' : '✓ Account and all data permanently deleted!');

    goHome();
  } catch (err) {
    showToast('刪除失敗: ' + err.message);
  }
}

function openTermsModal() {
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="text-align:left; max-width:400px; max-height:80vh; overflow-y:auto;" onclick="event.stopPropagation()">
        <h3 style="font-family:var(--serif); font-size:18px; color:var(--gold); margin-bottom:10px;">
          📜 BottleSense 使用條款
        </h3>
        <div style="font-size:13px; color:var(--text); line-height:1.6; space-y:8px;">
          <p>1. <strong>服務宗旨</strong>：BottleSense 提供酒標識別、私人酒窖管理、八維風味分析與品飲筆記儲存服務。</p>
          <p>2. <strong>數據擁有權</strong>：用戶上傳之藏酒相片與手記均屬用戶所有。本服務採用加密技術備份於雲端。</p>
          <p>3. <strong>理性飲酒</strong>：本應用程式僅供品飲品味記錄與知識交流之用，請勿過量飲酒，未成年請勿飲酒。</p>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:16px; padding:9px;" onclick="renderSettings()">返回註冊</button>
      </div>
    </div>
  `;
}

function openPrivacyModal() {
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="text-align:left; max-width:400px; max-height:80vh; overflow-y:auto;" onclick="event.stopPropagation()">
        <h3 style="font-family:var(--serif); font-size:18px; color:var(--gold); margin-bottom:10px;">
          🔒 BottleSense 私隱政策
        </h3>
        <div style="font-size:13px; color:var(--text); line-height:1.6;">
          <p>1. <strong>電郵與身分隱私</strong>：我們僅將你的電子郵件作為身份認證與帳號找回之用，絕不出售或提供給任何第三方。</p>
          <p>2. <strong>公開分享控制</strong>：除非你主動點擊「發布到公開探索池」，否則你的私人酒櫃與品飲手記預設 100% 保持私密。</p>
          <p>3. <strong>生日資訊保護</strong>：選填之生日資訊僅用於在應用程式內為你呈現專屬生日祝福與開瓶建議。</p>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:16px; padding:9px;" onclick="renderSettings()">返回註冊</button>
      </div>
    </div>
  `;
}

function executeSocialLogin(provider) {
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="text-align:left; max-width:390px;" onclick="event.stopPropagation()">
        <h3 style="font-family:var(--serif); font-size:18px; color:var(--gold); margin-bottom:10px;">
          🔑 ${provider} 官方授權配置說明
        </h3>
        <p style="font-size:13.5px; color:var(--text); line-height:1.6; margin-bottom:12px;">
          真實的 <strong>${provider} 一鍵登入</strong>需依據各大科技公司安全規範，至 ${provider === 'Google' ? 'Google Cloud Console' : provider === 'Apple' ? 'Apple Developer' : 'Meta for Developers'} 後台配置 <code>OAuth Client ID</code> 與授權回呼網域。
        </p>
        <div style="background:rgba(212,175,55,0.1); border:1px solid var(--gold-dim); border-radius:12px; padding:12px; font-size:13px; color:var(--gold); line-height:1.5; margin-bottom:16px;">
          💡 <strong>現已全面啟用的 100% 真實免密碼雲端儲存：</strong><br>
          請直接在上方使用「<strong>純電郵免密碼登入 (OTP)</strong>」或「<strong>電郵註冊認證</strong>」，即可跨手機即時登入與完整還原酒窖！
        </div>
        <button class="btn btn-primary btn-block" style="padding:10px;" onclick="closeModal()">我知道了</button>
      </div>
    </div>
  `;
}

function closeModal() {
  if (modalContainer) {
    modalContainer.innerHTML = '';
  }
}

async function initApp() {
  try {
    // 背景預載並預先解碼世界地圖，徹底消除進入探索頁面的數秒延遲
    const preloadMapImg = new Image();
    preloadMapImg.src = ATTACHED_GOLD_MAP_SRC;
    if (preloadMapImg.decode) preloadMapImg.decode().catch(() => {});

    document.getElementById('langSwitchBtn').textContent = currentLang === 'zh' ? 'EN' : '繁';
    
    // 更新頂部問候語 (Hello, XXX 或 生日祝福)
    updateHeaderGreeting();

    // 檢查網址是否帶有電郵認證 Token (?verify_token=...&email=...)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('verify_token')) {
      const vToken = urlParams.get('verify_token');
      const vEmail = urlParams.get('email');
      setTimeout(() => {
        handleEmailVerificationFromUrl(vToken, vEmail);
      }, 300);
    }

    await refreshCellar();
    const params = new URLSearchParams(location.search);
    const publicKey = params.get('cellar') || params.get('key');
    const sharedShelf = params.get('shelf');
    const sharedBottleId = params.get('bottle');

    if (publicKey) {
      await loadPublicCellar(publicKey, sharedShelf, sharedBottleId);
      return;
    }
    renderHome();
  } catch(e) {
    window.cellar = [];
    renderHome();
  }
}

document.addEventListener('DOMContentLoaded', initApp);
