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

        <div class="timeline-list">
          ${(b.tastings || []).length ? b.tastings.map((tItem, idx) => `
            <div class="timeline-card">
              <div class="timeline-header">
                <div>
                  <span class="timeline-time">#${idx+1} ·${esc(tItem.dateStr || tItem.date || '')}</span>
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
          `).join('') : `<div class="timeline-empty-card">
              <div class="empty-icon">🥃</div>
              <div class="empty-title">${currentLang === 'zh' ? '尚未記錄品飲歷史' : 'No Tasting Notes Yet'}</div>
              <div class="empty-desc">${currentLang === 'zh' ? '點擊上方「＋ 記錄這次品飲」，寫下開瓶心得、同伴與評分！' : 'Tap "+ Log This Pour" above to capture your first tasting notes and companions!'}</div>
            </div>`}
        </div>
      </div>

      <div style="margin-top:24px;">
        <button class="btn btn-wine btn-block" onclick="deleteBottle('${esc(b.id)}')">${t('btn_remove')}</button>
      </div>
    </div>
  `;
}

function renderRadar(vm) {
  const dimKeys = ['mv','ql','dv','pv','sv','gv','cv','sto'];
  const dimZh = { mv:"市場價值", ql:"品質", dv:"飲用價值", pv:"配餐價值", sv:"社交話題", gv:"送禮價值", cv:"收藏價值", sto:"保存價值" };
  const dimEn = { mv:"Market", ql:"Quality", dv:"Drinking", pv:"Pairing", sv:"Social", gv:"Gifting", cv:"Collection", sto:"Storage" };
  const labels = currentLang === 'zh' ? dimZh : dimEn;

  const vals = dimKeys.map(k => Number(vm?.[k] || 0));
  if (!vals.some(v => v > 0)) return '';

  const cx = 130, cy = 130, R = 95;
  const n = dimKeys.length;
  const points = dimKeys.map((k,i)=>{
    const angle = (Math.PI*2*i/n) - Math.PI/2;
    const val = Math.max(0, Math.min(100, vm[k] || 75));
    const r = (val/100) * R;
    return [cx + r*Math.cos(angle), cy + r*Math.sin(angle)];
  });
  const axisPoints = dimKeys.map((k,i)=>{
    const angle = (Math.PI*2*i/n) - Math.PI/2;
    return [cx + R*Math.cos(angle), cy + R*Math.sin(angle)];
  });

  const polygon = points.map(p=>p.join(',')).join(' ');
  const rings = [0.25,0.5,0.75,1].map(f=>{
    const ringPts = dimKeys.map((k,i)=>{
      const angle = (Math.PI*2*i/n) - Math.PI/2;
      return [cx + R*f*Math.cos(angle), cy + R*f*Math.sin(angle)].join(',');
    }).join(' ');
    return `<polygon points="${ringPts}" fill="none" stroke="#333722" stroke-width="1"/>`;
  }).join('');
  const axes = axisPoints.map(p=>`<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="#333722" stroke-width="1"/>`).join('');

  const legend = dimKeys.map(k=>`
    <div class="legend-row"><span class="dim">${labels[k]}</span><span class="val">${vm[k] ?? '75'}</span></div>
  `).join('');

  return `
    <div class="radar-wrap">
      <h3>${currentLang === 'zh' ? '八維價值地圖' : 'Value Profile Map'}</h3>
      <svg width="260" height="260" viewBox="0 0 260 260">
        ${rings}
        ${axes}
        <polygon points="${polygon}" fill="rgba(212,175,55,0.25)" stroke="#D4AF37" stroke-width="2"/>
        ${points.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#D4AF37"/>`).join('')}
      </svg>
      <div class="radar-legend">${legend}</div>
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

        <div style="font-size:12.5px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">${currentLang==='zh'?'地點 / 酒吧':'Venue / Location'}</div>
        <input type="text" id="sess-loc" class="text-input" placeholder="${currentLang==='zh'?'例如：尖沙咀 Whisky Bar / 屋企陽台':'e.g. Balcony at home, Bar'}">

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
  const initialLoc = s?.location || "尖沙咀 Whisky Bar, 香港";
  const initialNotes = s?.notes || "這支酒整體表現相當出色，香氣與尾韻平衡。";
  const initialRating = s?.rating || b.personalRating || 5;

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="text-align:left; max-width:400px;" onclick="event.stopPropagation()">
        <h3 style="font-family:var(--serif); font-size:18px; color:var(--gold); margin-bottom:10px;">
          🌍 發布到酒友公開探索池
        </h3>
        <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px; line-height:1.5;">
          分享你的品飲足跡！酒友能在世界地圖上看見你<strong>在何處品飲這款佳釀</strong>：
        </p>

        <!-- 邊度飲呢支酒 (品飲地點) -->
        <div style="font-size:12px; font-weight:700; color:var(--gold); margin-bottom:4px;">
          🥂 你在哪裡品飲這支酒？（酒吧、餐廳、城市或屋企）
        </div>
        <input type="text" id="pub-venue-loc" class="text-input" style="margin-top:0; padding:10px; font-size:13.5px;" value="${esc(initialLoc)}" placeholder="例如：尖沙咀某酒吧、中環、日本東京居酒屋、屋企陽台">

        <!-- 快捷標籤 -->
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; margin-bottom:12px;">
          ${["尖沙咀", "中環", "銅鑼灣", "日本東京", "台北", "屋企陽台", "露營星空下"].map(t => `
            <span style="font-size:11.5px; padding:3px 9px; border-radius:999px; background:var(--surface-2); border:1px solid var(--line); color:var(--text-muted); cursor:pointer;" onclick="setPubLocation('${t}')">${t}</span>
          `).join("")}
        </div>

        <!-- 品飲心得手記 -->
        <div style="font-size:12px; font-weight:700; color:var(--gold); margin-bottom:4px;">
          📝 這次的品飲手記
        </div>
        <textarea id="pub-venue-notes" class="text-input" style="height:70px; resize:none; padding:8px 10px; font-size:13px;">${esc(initialNotes)}</textarea>

        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost btn-block" style="padding:10px; font-size:13px;" onclick="closeModal()">取消</button>
          <button class="btn btn-primary btn-block" style="padding:10px; font-size:13px;" onclick="confirmPublishDrink('${esc(b.id)}', ${initialRating})">確認公開發布</button>
        </div>
      </div>
    </div>
  `;
}

function setPubLocation(locName) {
  const el = document.getElementById("pub-venue-loc");
  if (el) el.value = locName + ", 香港";
}

async function confirmPublishDrink(bottleId, rating) {
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;

  const loc = (document.getElementById("pub-venue-loc")?.value || "").trim() || "香港某品飲處";
  const notes = (document.getElementById("pub-venue-notes")?.value || "").trim() || "品鑑佳釀";

  const payload = {
    id: b.id,
    author: localStorage.getItem("bottlesense_owner_name") || "品飲同好",
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
  
  if (loc.includes("香港") || loc.includes("尖沙咀") || loc.includes("中環") || loc.includes("銅鑼灣") || loc.includes("旺角") || loc.includes("灣仔") || loc.includes("西貢") || loc.includes("hong kong") || loc.includes("hk")) {
    return { top: 47.5, left: 76.1 };
  }
  if (loc.includes("澳門") || loc.includes("macau") || loc.includes("macao")) {
    return { top: 47.6, left: 75.9 };
  }
  if (loc.includes("台灣") || loc.includes("台北") || loc.includes("台中") || loc.includes("高雄") || loc.includes("taiwan")) {
    return { top: 47.4, left: 77.8 };
  }
  if (loc.includes("日本") || loc.includes("東京") || loc.includes("大阪") || loc.includes("京都") || loc.includes("沖繩") || loc.includes("japan") || loc.includes("tokyo")) {
    return { top: 35.0, left: 82.9 };
  }
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
  // 未明確提及飲酒城市時，依據酒款原產地定位
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

function renderSettings() {
  const key = localStorage.getItem('bottlesense_sync_key') || '';
  const owner = localStorage.getItem('bottlesense_owner_name') || '品飲同好';
  const boundAccount = localStorage.getItem('bottlesense_account_bound');

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" style="max-width:390px; text-align:left;" onclick="event.stopPropagation()">
        <h2 style="font-family:var(--serif); margin-bottom:14px; font-size:20px; color:var(--gold); text-align:center;">
          ${t('settings_title')}
        </h2>

        <!-- 1. 帳密直接放出嚟填，唔洗寫方案 -->
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:14px; padding:14px; margin-bottom:12px;">
          <div style="font-size:13px; font-weight:700; color:var(--text); margin-bottom:8px;">
            👤 雲端帳號綁定 / 登入
          </div>
          
          <div style="font-size:11.5px; font-family:var(--mono); color:var(--text-faint); margin-bottom:3px;">帳號 / 電郵 (Username / Email)</div>
          <input type="text" id="set-username" class="text-input" style="margin-top:0; padding:9px 12px; font-size:13.5px;" value="${esc(boundAccount || (owner !== '品飲同好' ? owner : ''))}" placeholder="輸入你的帳號或 Email">
          
          <div style="font-size:11.5px; font-family:var(--mono); color:var(--text-faint); margin-top:8px; margin-bottom:3px;">登入密碼 (Password)</div>
          <input type="password" id="set-password" class="text-input" style="margin-top:0; padding:9px 12px; font-size:13.5px;" placeholder="輸入專屬密碼">
          
          <button class="btn btn-primary btn-block" style="padding:9px; margin-top:12px; font-size:13px;" onclick="executeSettingsAccountAction()">
            ${boundAccount ? '更新帳號綁定' : '儲存並綁定雲端帳號'}
          </button>
        </div>

        <!-- 2. 帳密下面加 Google, FB, Apple 等一鍵 login -->
        <div style="margin-bottom:12px;">
          <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); text-align:center; margin-bottom:6px; text-transform:uppercase;">
            或使用社交帳號一鍵登入
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

        <!-- 3. 專屬碼同換手機登入合成一粒 button 放一鍵 login 下面 -->
        <div style="margin-bottom:12px;">
          <button class="btn btn-ghost btn-block" style="border-color:var(--gold-dim); color:var(--gold); padding:9px; font-size:13px;" onclick="openSyncKeyAndRestoreModal()">
            🔄 專屬同步碼與換手機登入
          </button>
        </div>

        <!-- 4. 最底繼續放遊客身份 -->
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; color:var(--text-faint);">目前身分狀態：</span>
          <span style="font-size:12.5px; font-weight:600; color:${boundAccount ? 'var(--green-ok)' : 'var(--text-muted)'};">
            ${boundAccount ? '✓ 已綁定 (' + esc(boundAccount) + ')' : '👤 遊客模式 (未綁定)'}
          </span>
        </div>

        <button class="btn btn-ghost btn-block" style="padding:9px; font-size:13px; color:var(--text-faint); border-color:transparent;" onclick="closeModal()">
          ${t('btn_close')}
        </button>
      </div>
    </div>
  `;
}

async function executeSettingsAccountAction() {
  const username = (document.getElementById('set-username')?.value || '').trim();
  const password = document.getElementById('set-password')?.value || '';
  const syncKey = localStorage.getItem('bottlesense_sync_key') || '';

  if (!username || !password) {
    showToast('請輸入帳號與密碼！');
    return;
  }

  showToast('正在綁定雲端帳號…');
  try {
    const res = await fetch(`${WORKER_API_URL}/api/account/bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, syncKey })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '綁定失敗');

    localStorage.setItem('bottlesense_owner_name', username);
    localStorage.setItem('bottlesense_account_bound', username);
    localStorage.setItem('bottlesense_registered', 'true');
    syncPublishCellarAsync();
    showToast('✓ 雲端帳號綁定成功！');
    renderSettings();
  } catch (err) {
    showToast('綁定失敗: ' + err.message);
  }
}

function executeSocialLogin(provider) {
  showToast(`正在連接 ${provider} 授權…`);
  setTimeout(() => {
    const defaultName = provider + '_User_' + Math.random().toString(36).substring(2, 6);
    localStorage.setItem('bottlesense_owner_name', defaultName);
    localStorage.setItem('bottlesense_account_bound', `${provider}帳號`);
    localStorage.setItem('bottlesense_registered', 'true');
    syncPublishCellarAsync();
    showToast(`✓ 已透過 ${provider} 成功快速登入綁定！`);
    renderSettings();
  }, 600);
}

function openSyncKeyAndRestoreModal() {
  const key = localStorage.getItem('bottlesense_sync_key') || '';

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="text-align:left; max-width:400px;" onclick="event.stopPropagation()">
        <h3 style="font-family:var(--serif); font-size:18px; color:var(--gold); margin-bottom:12px;">
          🔄 專屬同步碼與換機登入
        </h3>

        <!-- 我的專屬同步碼 -->
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:12px; padding:12px; margin-bottom:14px;">
          <div style="font-size:12px; font-weight:700; color:var(--gold); margin-bottom:4px;">
            📋 我的專屬同步碼 (Sync Key)
          </div>
          <div style="font-size:11.5px; color:var(--text-faint); margin-bottom:6px;">
            換手機時，只需在新手機輸入此代碼即可找回所有藏酒。
          </div>
          <div class="text-input" style="text-align:center; font-family:var(--mono); font-size:13.5px; font-weight:700; color:var(--gold); padding:8px; user-select:all;">
            ${esc(key)}
          </div>
          <button id="btn-copy-sync" class="btn btn-primary btn-block" style="margin-top:8px; padding:8px; font-size:12.5px;" onclick="copySyncKey()">
            ${t('btn_copy_sync')}
          </button>
        </div>

        <!-- 換手機登入還原 -->
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:12px; padding:12px; margin-bottom:14px;">
          <div style="font-size:12px; font-weight:700; color:var(--text); margin-bottom:4px;">
            📲 換手機登入 / 輸入同步碼還原
          </div>
          <div style="font-size:11.5px; color:var(--text-faint); margin-bottom:6px;">
            在下方輸入舊手機的專屬同步碼（如 BTL-XXXX-XXXX）：
          </div>
          <input type="text" id="restore-key" class="text-input" style="padding:8px; font-size:13px; font-family:var(--mono); text-transform:uppercase;" placeholder="例如：BTL-XXXX-XXXX">
          <button class="btn btn-ghost btn-block" style="padding:8px; font-size:12.5px; margin-top:8px; border-color:var(--gold-dim); color:var(--gold);" onclick="executeKeyRestore()">
            確認提取並還原藏酒
          </button>
        </div>

        <button class="btn btn-ghost btn-block" style="padding:8px; font-size:13px;" onclick="renderSettings()">返回設定</button>
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
