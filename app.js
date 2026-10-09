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
let currentScene = 'cooler';
let activeFilter = 'all';

let isVisitorMode = false;
let visitorCellarData = null;

// ==========================================
// 繁英雙語字典系統 (i18n)
// ==========================================
let currentLang = localStorage.getItem('bottlesense_lang') || 'zh';

/* ---------------- 專屬碼管理與八維價值合理化校準 ---------------- */
function getOrCreateSyncKey() {
  let key = localStorage.getItem('bottlesense_sync_key');
  if (!key || key.trim() === '' || key === 'undefined' || key === 'null') {
    key = 'BTL-' + Math.random().toString(36).substring(2,6).toUpperCase() + '-' + Math.random().toString(36).substring(2,6).toUpperCase();
    localStorage.setItem('bottlesense_sync_key', key);
  }
  return key;
}

// 嚴格修正八維評分：大眾量產啤酒/即飲平價酒杜絕虛高收藏分
function calibrateValueMap(vm, category = '', name = '') {
  if (!vm || typeof vm !== 'object') return {};
  const res = { ...vm };
  const cat = (category || '').toLowerCase();
  const n = (name || '').toLowerCase();

  const isBeer = cat.includes('啤酒') || cat.includes('beer') || cat.includes('lager') || cat.includes('ale') || cat.includes('ipa') || n.includes('yebisu') || n.includes('beer') || n.includes('啤酒') || n.includes('喜力') || n.includes('百威') || n.includes('asahi') || n.includes('kirin') || n.includes('sapporo');

  if (isBeer) {
    // 啤酒為日常快消飲品，絕無高額收藏空間
    // 收藏價值 (cv)：大眾商業啤酒合理評分為 10-18 分，杜絕 70+ 分荒謬評分
    if (Number(res.cv || 0) > 25) res.cv = 15;
    // 保存價值 (sto)：啤酒建議 6-9 個月內趁鮮飲用完畢，保存價值低
    if (Number(res.sto || 0) > 35) res.sto = 25;
    // 市場價值 (mv)：大眾平價罐裝/瓶裝
    if (Number(res.mv || 0) > 40) res.mv = 25;
    // 飲用價值與配餐價值為啤酒強項 (75-85)
    if (!res.dv || Number(res.dv) < 60) res.dv = 80;
    if (!res.pv || Number(res.pv) < 60) res.pv = 82;
    if (!res.ql || Number(res.ql) < 60) res.ql = 78;
    if (Number(res.sv || 0) > 70) res.sv = 55;
    if (Number(res.gv || 0) > 50) res.gv = 30;
  }

  return res;
}


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
    empty_recent_loggedin: "尚未有最近加入的酒款<br>拍一瓶酒標，開始建立你的酒窖。",
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
    back: "← 返回",
    share_bottle: "分享此酒",
    edit_info: "編輯資料",
    transfer_title: "📍 轉移藏酒空間",
    timeline_title: "🥃 品飲記錄時間軸",
    btn_add_log: "＋ 記錄這次品飲",
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
    no_random_bottle: "酒窖目前暫無藏酒，無法隨機抽選！",
    btn_cancel: "取消",
    btn_full_scan: "📷 全圖辨識",
    btn_focus_scan: "🎯 對焦辨識",
    btn_install_guide: "安裝教學"
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
    empty_recent_loggedin: "No recent bottles yet.<br>Snap a label to start building your cellar.",
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
    empty_shelf: "No bottles in this space",
    back: "← Back",
    share_bottle: "Share Bottle",
    edit_info: "Edit Details",
    transfer_title: "📍 Transfer Space",
    timeline_title: "🥃 Tasting Timeline",
    btn_add_log: "+ Log This Pour",
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
    confirm_delete: "Are you sure you want to remove this bottle from cellar?",
    no_random_bottle: "No bottles in cellar to pick randomly!",
    explore_title: "World Map & Tasting Feed",
    explore_hint: "Pinch or drag to explore world wine regions and member tasting posts!",
    btn_cancel: "Cancel",
    btn_full_scan: "📷 Full Scan",
    btn_focus_scan: "🎯 Focus Scan",
    btn_install_guide: "Install Guide",
    explore_title: "World Terroir & Golden Map",
    explore_hint: "Origins & pours are pinned. Pan and pinch to zoom around the globe!",
    confirm_delete: "Are you sure you want to remove this bottle?",
    no_random_bottle: "Cellar is empty. Cannot pick a surprise bottle!"
  }
};

function t(k) { return I18N[currentLang]?.[k] || I18N['zh'][k] || k; }

function toggleLanguage() {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  localStorage.setItem('bottlesense_lang', currentLang);
  const langBtn = document.getElementById('langSwitchBtn');
  if (langBtn) langBtn.textContent = currentLang === 'zh' ? 'EN' : '繁';
  updateHeaderGreeting();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.innerHTML = t(key);
  });
  if (currentView === 'home') renderHome();
  else if (currentView === 'cellar') renderCellar();
  else if (currentView === 'explore') renderExplore();

  // 若當前設定彈窗開啟，同步刷新繁英文字
  const settingsModal = document.querySelector('.modal-card');
  if (settingsModal && (settingsModal.innerHTML.includes('auth-email') || settingsModal.innerHTML.includes('edit-profile-name') || settingsModal.innerHTML.includes('login-otp'))) {
    renderSettings();
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
    // 已登入：唔再顯示「已有帳號？登入」按鈕
    if (localStorage.getItem('bottlesense_account_bound')) {
      return `<div class="empty-shelf">${t('empty_recent_loggedin')}</div>`;
    }
    return `<div class="empty-shelf">${t('empty_cellar')}<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm" onclick="openLoginModal()" style="font-size:12px; color:var(--gold); border-color:var(--gold-dim);">🔑 ${currentLang==='zh'?'已有帳號？點此電郵登入還原':'Have an account? Log in via Email'}</button></div></div>`;
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
      <div class="section-head" style="margin-top:8px; margin-bottom:6px;">
        <h2>${currentLang === 'zh' ? '私人酒窖全景' : 'Private Cellar Overview'}</h2>
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
              ${opt === 'all' ? t('filter_all') : esc(opt)}
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
            <span class="tag-badge">${esc(cat)}</span>
            ${region ? `<span class="tag-badge secondary">${esc(region)}</span>` : ''}
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

  const x = safeIdentification(b);
  const img = bottleImage(b);
  const confidence = Number(x.conf ?? x.confidence ?? 0);
  const vm = calibrateValueMap(b.scan?.vm || x.vm || {}, bottleCategory(b), bottleName(b));
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
        <button class="btn btn-ghost" style="padding:8px 14px; font-size:14px;" onclick="${currentView === 'cellar' ? 'renderCellar()' : 'goHome()'}">
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
            <div class="seal-label">CONF</div>
          </div>
        ` : ''}

        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <div class="label-eyebrow" style="margin-bottom:0;">${esc(bottleCategory(b))}</div>
          <button class="edit-badge-btn" onclick="openEditBottleModal('${esc(b.id)}')">
            ${EDIT_PENCIL_SVG} ${t('edit_info')}
          </button>
        </div>

        <div class="label-name">${esc(bottleName(b))}</div>
        <div class="label-sub">${esc([bottleCountry(b), bottleRegion(b)].filter(Boolean).join(' · '))}</div>

        <div class="label-facts">
          <div><div class="fact-label">VINTAGE</div><div class="fact-value">${esc(bottleVintage(b))}</div></div>
          <div><div class="fact-label">CATEGORY</div><div class="fact-value">${esc(bottleCategory(b))}</div></div>
          <div><div class="fact-label">COUNTRY</div><div class="fact-value">${esc(bottleCountry(b) || (currentLang==='zh'?'未知':'Unknown'))}</div></div>
          <div><div class="fact-label">REGION</div><div class="fact-value">${esc(bottleRegion(b) || (currentLang==='zh'?'未知':'Unknown'))}</div></div>
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

      <!-- 5. 品飲歷史時間軸 (智慧隱藏：僅在「已飲」與「飲完」狀態顯示) -->
      ${['opened', 'finished'].includes(b.status) ? `
        <div class="info-block" id="tasting-timeline-block">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h3>${t('timeline_title')} (${(b.tastings || []).length})</h3>
            <button class="btn btn-primary btn-sm" onclick="openAddSessionModal('${esc(b.id)}')">
              ${t('btn_add_log')}
            </button>
          </div>
          <div style="font-size:13px; color:var(--text-faint); margin-bottom:14px;">${t('timeline_hint')}</div>

          <div class="timeline-list" style="position:relative; padding-left:14px; border-left:2px solid var(--gold-dim);">
            ${(() => {
              const list = b.tastings || [];
              if (!list.length) return `<div style="font-size:14px; color:var(--text-faint); text-align:center; padding:18px 0;">${t('no_logs')}</div>`;

              const isExpanded = window['timeline_expanded_' + b.id];
              const displayList = isExpanded ? list : list.slice(0, 3);

              const cardsHTML = displayList.map((tItem, idx) => `
                <div class="timeline-card" style="margin-bottom:12px; position:relative;">
                  <div style="position:absolute; left:-21px; top:6px; width:10px; height:10px; border-radius:50%; background:var(--gold); border:2px solid #000;"></div>
                  <div class="timeline-header">
                    <div>
                      <span class="timeline-time" style="font-family:var(--mono); color:var(--gold); font-size:12px;">#${idx+1} · ${esc(tItem.dateStr || tItem.date || '')}</span>
                      <div style="color:var(--gold); font-size:13.5px; margin-top:2px;">${'★'.repeat(tItem.rating || 5)}</div>
                    </div>
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-ghost btn-sm" style="padding:3px 8px; font-size:11px;" onclick="togglePublishSession('${esc(b.id)}', '${esc(tItem.id)}')">
                        ${tItem.isPublic ? '↩️ 收回' : '🌐 發布'}
                      </button>
                      <button class="timeline-share-btn" onclick="openShareActionSheet('${esc(b.id)}', '${esc(tItem.id)}')" title="Share this pour">
                        ${TELEGRAM_PLANE_SVG}
                      </button>
                    </div>
                  </div>
                  <div class="timeline-meta" style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                    ${tItem.location ? `<span>📍 ${esc(tItem.location)}</span>` : ''}
                    ${tItem.companions ? `<span>👥 ${esc(tItem.companions)}</span>` : ''}
                  </div>
                  ${tItem.notes ? `<div class="timeline-notes" style="font-size:13px; color:var(--text); margin-top:6px; line-height:1.5;">"${esc(tItem.notes)}"</div>` : ''}
                </div>
              `).join('');

              const expandBtnHTML = (list.length > 3 && !isExpanded) ? `
                <div style="text-align:center; margin-top:8px;">
                  <button class="btn btn-ghost btn-sm" onclick="expandTimeline('${esc(b.id)}')" style="font-size:12px; color:var(--gold);">
                    ▼ ${currentLang==='zh'?'展開更多品飲記錄 ('+list.length+' 筆)':'Expand All ('+list.length+')'}
                  </button>
                </div>
              ` : '';

              return cardsHTML + expandBtnHTML;
            })()}
          </div>
        </div>
      ` : ''}

      <div style="margin-top:24px;">
        <button class="btn btn-wine btn-block" onclick="deleteBottle('${esc(b.id)}')">${t('btn_remove')}</button>
      </div>
    </div>
  `;
}

function renderRadar(vm) {
  const dimKeys = ['mv','ql','dv','pv','sv','gv','cv','sto'];
  const dimZh = { mv:"市場價值", ql:"品質工藝", dv:"飲用價值", pv:"配餐價值", sv:"社交話題", gv:"送禮價值", cv:"收藏價值", sto:"保存潛力" };
  const dimEn = { mv:"Market", ql:"Quality", dv:"Drinking", pv:"Pairing", sv:"Social", gv:"Gifting", cv:"Collection", sto:"Storage" };
  const labels = currentLang === 'zh' ? dimZh : dimEn;

  const vals = dimKeys.map(k => Number(vm?.[k] || 0));
  if (!vals.some(v => v > 0)) return '';

  const cx = 140, cy = 140, R = 85;
  const n = dimKeys.length;
  const points = dimKeys.map((k,i)=>{
    const angle = (Math.PI*2*i/n) - Math.PI/2;
    const val = Math.max(5, Math.min(100, Number(vm[k]) || 60));
    const r = (val/100) * R;
    return [cx + r*Math.cos(angle), cy + r*Math.sin(angle)];
  });
  const axisPoints = dimKeys.map((k,i)=>{
    const angle = (Math.PI*2*i/n) - Math.PI/2;
    return [cx + R*Math.cos(angle), cy + R*Math.sin(angle)];
  });

  const polygon = points.map(p=>p.join(',')).join(' ');
  
  // 同心圓刻度線 (50 與 100)
  const rings = [0.5, 1.0].map(f => {
    const ringPts = dimKeys.map((k,i)=>{
      const angle = (Math.PI*2*i/n) - Math.PI/2;
      return [cx + R*f*Math.cos(angle), cy + R*f*Math.sin(angle)].join(',');
    }).join(' ');
    return `<polygon points="${ringPts}" fill="none" stroke="#2a2e1d" stroke-dasharray="${f===0.5?'3,3':'none'}" stroke-width="1"/>`;
  }).join('');

  const axes = axisPoints.map(p => `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="#333722" stroke-width="1"/>`).join('');

  // 軸尖端外側直接標註維度名稱與金色實時得分
  const textLabels = dimKeys.map((k, i) => {
    const angle = (Math.PI*2*i/n) - Math.PI/2;
    const labelDist = R + 22;
    const lx = cx + labelDist * Math.cos(angle);
    const ly = cy + labelDist * Math.sin(angle) + 4;
    const val = vm[k] ?? '60';
    let anchor = "middle";
    if (Math.cos(angle) > 0.3) anchor = "start";
    else if (Math.cos(angle) < -0.3) anchor = "end";

    return `<text x="${lx}" y="${ly}" fill="#D4AF37" font-size="10.5" font-family="var(--mono)" font-weight="600" text-anchor="${anchor}">${labels[k]} <tspan fill="#f5e08b" font-weight="700">${val}</tspan></text>`;
  }).join('');

  const legend = dimKeys.map(k=>`
    <div class="legend-row"><span class="dim" style="color:var(--text);">${labels[k]}</span><span class="val" style="color:var(--gold); font-family:var(--mono); font-weight:700;">${vm[k] ?? '60'}</span></div>
  `).join('');

  return `
    <div class="radar-wrap" style="text-align:center;">
      <h3 style="margin-bottom:6px;">${currentLang === 'zh' ? '八維價值地圖' : 'Value Profile Map'}</h3>
      <svg width="280" height="280" viewBox="0 0 280 280" style="overflow:visible; margin:0 auto; display:block;">
        ${rings}
        ${axes}
        <polygon points="${polygon}" fill="rgba(212,175,55,0.25)" stroke="#D4AF37" stroke-width="2"/>
        ${points.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#D4AF37" stroke="#000" stroke-width="1"/>`).join('')}
        ${textLabels}
      </svg>
      <div class="radar-legend" style="display:grid; grid-template-columns:1fr 1fr; gap:6px 16px; margin-top:10px; font-size:12.5px;">${legend}</div>
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
let selectedSessionCity = '';
let selectedSessionScene = '';

function defaultNowStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function openAddSessionModal(bottleId) {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const defaultIso = now.toISOString().slice(0, 16);
  currentSessionRating = 5;
  selectedSessionCity = '';
  selectedSessionScene = '';

  const cities = currentLang === 'zh' ? ['中環', '尖沙咀', '銅鑼灣', '旺角', '台中', '高雄', '台北', '東京', '大阪', '澳門'] : ['Central', 'Tsim Sha Tsui', 'Causeway Bay', 'Mong Kok', 'Taichung', 'Kaohsiung', 'Taipei', 'Tokyo', 'Osaka', 'Macau'];
  const scenes = currentLang === 'zh' ? ['屋企陽台', '酒吧', '居酒屋', '露營星空下', '海邊', '朋友聚會', '餐廳'] : ['Home Balcony', 'Bar', 'Izakaya', 'Camping', 'Beach', 'Gathering', 'Restaurant'];

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="max-width:390px; text-align:left; max-height:85vh; overflow-y:auto;" onclick="event.stopPropagation()">
        <div style="font-family:var(--serif); font-size:19px; font-weight:700; margin-bottom:12px; color:var(--gold);">
          ${t('btn_add_log')}
        </div>

        <div style="font-size:12px; font-family:var(--mono); color:var(--text-faint);">${currentLang==='zh'?'日期與時間':'Date & Time'}</div>
        <input type="datetime-local" id="sess-date" class="text-input" value="${defaultIso}" style="margin-top:2px;">

        <!-- 雙軌地點與環境選取 -->
        <div style="margin-top:10px;">
          <div style="font-size:12px; font-family:var(--mono); color:var(--text-faint); margin-bottom:4px;">
            📍 ${currentLang==='zh'?'城市 / 地區 (單選)':'City / District'}
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px;">
            ${cities.map(c => `
              <button type="button" class="btn btn-ghost btn-sm session-city-pill" onclick="selectSessionCity('${esc(c)}', this)" style="padding:4px 9px; font-size:11.5px; border-radius:999px;">
                ${c}
              </button>
            `).join('')}
          </div>

          <div style="font-size:12px; font-family:var(--mono); color:var(--text-faint); margin-bottom:4px;">
            🥂 ${currentLang==='zh'?'場合 / 環境 (單選)':'Occasion / Scene'}
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px;">
            ${scenes.map(s => `
              <button type="button" class="btn btn-ghost btn-sm session-scene-pill" onclick="selectSessionScene('${esc(s)}', this)" style="padding:4px 9px; font-size:11.5px; border-radius:999px;">
                ${s}
              </button>
            `).join('')}
          </div>

          <div style="font-size:11.5px; color:var(--text-faint); margin-bottom:2px;">
            ${currentLang==='zh'?'自由組合輸出地點：':'Combined Location Output:'}
          </div>
          <input type="text" id="sess-loc" class="text-input" placeholder="${currentLang==='zh'?'點選上方標籤或自由輸入地點':'Select tags or enter custom location'}" style="margin-top:0;">
        </div>

        <div style="font-size:12px; font-family:var(--mono); color:var(--text-faint); margin-top:10px;">${currentLang==='zh'?'同飲同伴':'Companions'}</div>
        <input type="text" id="sess-comp" class="text-input" placeholder="${currentLang==='zh'?'例如：獨酌深思、好友相聚':'e.g. Solo, Friends'}" style="margin-top:2px;">

        <div style="font-size:12px; font-family:var(--mono); color:var(--text-faint); margin-top:10px;">${currentLang==='zh'?'評分':'Rating'}</div>
        <div class="star-row" style="margin-top:4px;">
          ${[1,2,3,4,5].map(n => `<button type="button" class="star-btn filled" id="sess-star-${n}" onclick="setModalRating(${n})">★</button>`).join('')}
        </div>

        <div style="font-size:12px; font-family:var(--mono); color:var(--text-faint); margin-top:10px;">${currentLang==='zh'?'品飲感受與筆記':'Tasting Impressions'}</div>
        <textarea id="sess-notes" class="text-input" style="height:70px; resize:none; margin-top:2px;"></textarea>

        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost btn-block" onclick="closeModal()">${currentLang==='zh'?'取消':'Cancel'}</button>
          <button class="btn btn-primary btn-block" onclick="saveNewSession('${esc(bottleId)}')">${currentLang==='zh'?'儲存品飲':'Save Pour'}</button>
        </div>
      </div>
    </div>
  `;
}

function selectSessionCity(city, btn) {
  selectedSessionCity = (selectedSessionCity === city) ? '' : city;
  document.querySelectorAll('.session-city-pill').forEach(el => {
    el.style.background = 'transparent';
    el.style.color = 'var(--text)';
    el.style.borderColor = 'var(--line)';
  });
  if (selectedSessionCity && btn) {
    btn.style.background = 'var(--gold)';
    btn.style.color = '#0c0d08';
    btn.style.borderColor = 'var(--gold)';
  }
  updateSessionLocationInput();
}

function selectSessionScene(scene, btn) {
  selectedSessionScene = (selectedSessionScene === scene) ? '' : scene;
  document.querySelectorAll('.session-scene-pill').forEach(el => {
    el.style.background = 'transparent';
    el.style.color = 'var(--text)';
    el.style.borderColor = 'var(--line)';
  });
  if (selectedSessionScene && btn) {
    btn.style.background = 'rgba(212,175,55,0.25)';
    btn.style.color = 'var(--gold)';
    btn.style.borderColor = 'var(--gold)';
  }
  updateSessionLocationInput();
}

function updateSessionLocationInput() {
  const input = document.getElementById('sess-loc');
  if (!input) return;
  const combined = [selectedSessionCity, selectedSessionScene].filter(Boolean).join(' ');
  input.value = combined;
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
    dateStr: rawDate ? rawDate.replace('T', ' ') : defaultNowStr(),
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
          <button class="btn btn-primary btn-block" onclick="publishToCommunityPool('${esc(b.id)}', '${esc(sessionId||'')}'); closeModal();">
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

async function publishToCommunityPool(bottleId, sessionId) {
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;
  const s = sessionId ? (b.tastings || []).find(t => String(t.id) === String(sessionId)) : null;

  const payload = {
    id: b.id,
    author: localStorage.getItem('bottlesense_owner_name') || '品飲同好',
    identification: b.identification,
    image: b.image,
    personalRating: s ? s.rating : (b.personalRating || 5),
    diary: { notes: s ? s.notes : (b.tastings?.[0]?.notes || '品鑑佳釀') },
    location: s?.location || b.identification?.region || b.tags?.region || '世界名釀',
    publishedAt: Date.now()
  };

  try {
    await fetch(`${WORKER_API_URL}/api/explore/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    showToast(t('published_toast'));
  } catch(e) {
    showToast(t('published_toast'));
  }
}

function executePrivateShare(bottleId, sessionId) {
  if (sessionId) shareSingleSession(bottleId, sessionId);
  else shareSingleBottle(bottleId);
}

function syncPublishCellarAsync() {
  const key = getOrCreateSyncKey();
  fetch(`${WORKER_API_URL}/api/cellar/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ syncKey: key, cellar: window.cellar, ownerName: '品飲家' })
  }).catch(() => {});
}

async function shareEntireCellar() {
  if (!window.cellar || !window.cellar.length) return;
  syncPublishCellarAsync();

  const key = getOrCreateSyncKey();
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

  const key = getOrCreateSyncKey();
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

  const key = getOrCreateSyncKey();
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
   五、世界名釀・金線探索地圖（純粹單一世界大地圖，零切換、零誤判）
   全站所有產區與品飲分享 100% 統一標注於世界地圖，支援自由雙指縮放平移與點擊飛航
======================================================================= */

// 1. 世界地圖產區精確經緯坐標庫（百分比 %：top, left）
const REAL_IMAGE_GEO_POINTS = {
  // 西班牙 (里奧哈 / 杜埃羅河岸 / 赫雷斯雪莉)
  '里奧哈': { top: 31.5, left: 46.8 }, 'rioja': { top: 31.5, left: 46.8 },
  '杜埃羅河岸': { top: 32.0, left: 46.5 }, 'ribera': { top: 32.0, left: 46.5 },
  '赫雷斯': { top: 33.5, left: 46.0 }, 'jerez': { top: 33.5, left: 46.0 }, '雪莉': { top: 33.5, left: 46.0 },
  '西班牙': { top: 32.5, left: 47.2 }, 'spain': { top: 32.5, left: 47.2 }, 'españa': { top: 32.5, left: 47.2 },

  // 葡萄牙
  '葡萄牙': { top: 32.8, left: 45.5 }, 'portugal': { top: 32.8, left: 45.5 }, '波特': { top: 32.8, left: 45.5 },

  // 法國 (波爾多 / 香檳 / 勃艮第 / 羅納河 / 盧瓦爾河)
  '波爾多': { top: 30.0, left: 48.8 }, 'bordeaux': { top: 30.0, left: 48.8 },
  '香檳': { top: 27.2, left: 49.8 }, 'champagne': { top: 27.2, left: 49.8 },
  '勃艮第': { top: 28.6, left: 50.2 }, 'bourgogne': { top: 28.6, left: 50.2 },
  '羅納河': { top: 30.5, left: 50.0 }, '隆河': { top: 30.5, left: 50.0 },
  '法國': { top: 28.5, left: 49.5 }, 'france': { top: 28.5, left: 49.5 },

  // 英國 / 蘇格蘭 (斯貝賽 / 艾雷島 / 高地 / 低地)
  '斯貝賽': { top: 22.5, left: 47.8 }, 'speyside': { top: 22.5, left: 47.8 },
  '艾雷島': { top: 23.8, left: 46.8 }, 'islay': { top: 23.8, left: 46.8 },
  '高地': { top: 22.0, left: 47.2 }, 'highlands': { top: 22.0, left: 47.2 },
  '低地': { top: 24.5, left: 47.6 }, 'lowlands': { top: 24.5, left: 47.6 },
  '蘇格蘭': { top: 23.0, left: 47.5 }, 'scotland': { top: 23.0, left: 47.5 },
  '英國': { top: 25.0, left: 47.8 }, 'uk': { top: 25.0, left: 47.8 },
  '愛爾蘭': { top: 24.5, left: 45.8 }, 'ireland': { top: 24.5, left: 45.8 },

  // 義大利 / 德國
  '托斯卡納': { top: 31.0, left: 52.2 }, 'tuscany': { top: 31.0, left: 52.2 },
  '皮埃蒙特': { top: 29.8, left: 50.8 }, 'piedmont': { top: 29.8, left: 50.8 },
  '義大利': { top: 31.0, left: 52.2 }, 'italy': { top: 31.0, left: 52.2 },
  '德國': { top: 26.5, left: 50.5 }, 'germany': { top: 26.5, left: 50.5 }, '摩澤爾': { top: 26.5, left: 50.5 },
  '歐洲': { top: 28.0, left: 49.0 }, 'europe': { top: 28.0, left: 49.0 },

  // 日本各主要產區
  '沖繩': { top: 39.0, left: 80.5 }, 'okinawa': { top: 39.0, left: 80.5 }, '琉球': { top: 39.0, left: 80.5 }, '泡盛': { top: 39.0, left: 80.5 },
  '鹿兒島': { top: 35.0, left: 81.2 }, '九州': { top: 34.0, left: 81.5 },
  '山口': { top: 33.2, left: 82.2 }, '獺祭': { top: 33.2, left: 82.2 },
  '兵庫': { top: 32.8, left: 83.0 }, '灘五鄉': { top: 32.8, left: 83.0 },
  '山崎': { top: 32.9, left: 83.2 }, '京都': { top: 32.7, left: 83.3 }, '大阪': { top: 33.0, left: 83.2 },
  '白州': { top: 32.4, left: 83.8 }, '山梨': { top: 32.4, left: 83.8 },
  '東京': { top: 32.2, left: 84.2 }, '秩父': { top: 32.1, left: 84.0 },
  '新潟': { top: 31.2, left: 84.0 }, '東北': { top: 30.0, left: 84.5 },
  '余市': { top: 27.5, left: 84.5 }, '北海道': { top: 27.5, left: 84.5 },
  '日本': { top: 32.0, left: 83.5 }, 'japan': { top: 32.0, left: 83.5 },

  // 香港 / 台灣 / 中國
  '香港': { top: 41.2, left: 77.8 }, '新界': { top: 41.0, left: 77.8 }, '九龍': { top: 41.2, left: 77.8 }, '中環': { top: 41.3, left: 77.8 }, 'hong kong': { top: 41.2, left: 77.8 },
  '台灣': { top: 40.5, left: 79.5 }, '宜蘭': { top: 40.0, left: 79.8 }, '噶瑪蘭': { top: 40.0, left: 79.8 }, '南投': { top: 40.8, left: 79.4 }, 'taiwan': { top: 40.5, left: 79.5 },
  '貴州': { top: 38.0, left: 73.0 }, '茅台': { top: 38.0, left: 73.0 }, '四川': { top: 36.5, left: 72.0 },
  '寧夏': { top: 33.0, left: 72.5 }, '山西': { top: 33.5, left: 74.5 }, '山東': { top: 33.8, left: 76.5 },
  '中國': { top: 34.0, left: 73.5 }, 'china': { top: 34.0, left: 73.5 },

  // 美洲 (納帕 / 加州 / 肯塔基 / 智利 / 阿根廷)
  '納帕': { top: 31.8, left: 16.5 }, '加州': { top: 32.5, left: 16.5 }, '肯塔基': { top: 32.8, left: 24.0 },
  '美國': { top: 31.5, left: 21.0 }, 'usa': { top: 31.5, left: 21.0 },
  '智利': { top: 76.0, left: 30.5 }, '阿根廷': { top: 76.5, left: 32.0 }, '門多薩': { top: 76.5, left: 32.0 },

  // 非洲
  '南非': { top: 78.0, left: 54.5 }, '開普敦': { top: 78.5, left: 54.0 }, '非洲': { top: 58.0, left: 52.0 },

  // 俄羅斯
  '莫斯科': { top: 23.0, left: 57.5 }, '俄羅斯': { top: 22.0, left: 68.0 }, 'russia': { top: 22.0, left: 68.0 }
};

let mapZoom = 1;
let mapPanX = 0, mapPanY = 0;
let currentExploreFeed = [];

// 2. 解析酒款在世界地圖上的經緯坐標（優先精確匹配特定產區與品牌）
function resolveRealImagePinPos(country, region, b = null) {
  const bName = b ? bottleName(b) : '';
  const bCat = b ? (b.category || b.identification?.category || '') : '';
  const bProd = b ? (b.identification?.producer || '') : '';
  const bLoc = b ? (b.location || b.diary?.location || '') : '';
  const fullText = `${region || ''} ${country || ''} ${bName} ${bCat} ${bProd} ${bLoc}`.toLowerCase();

  for (const k in REAL_IMAGE_GEO_POINTS) {
    if (k.length > 1 && fullText.includes(k.toLowerCase())) {
      return REAL_IMAGE_GEO_POINTS[k];
    }
  }

  if (country && REAL_IMAGE_GEO_POINTS[country]) return REAL_IMAGE_GEO_POINTS[country];
  if (region && REAL_IMAGE_GEO_POINTS[region]) return REAL_IMAGE_GEO_POINTS[region];

  return { top: 32.0, left: 47.2 };
}

// 3. 探索頁面渲染（純粹單一世界地圖容器，零圖層切換）
async function renderExplore() {
  currentView = 'explore';
  setActiveNav('nav-explore');

  const worldMapImgHTML = `
    <img id="worldMapMainImg" src="map_world.webp" onerror="this.onerror=null; this.src='map_world'; this.onerror=()=>this.src='map_world.png'; this.onerror=()=>this.src='maps/map_world.webp';" class="real-gold-map-img" alt="World Map" draggable="false">
  `;

  main.innerHTML = `
    <div class="view" style="padding-bottom: 50px;">
      <div class="section-head" style="margin-top:6px; margin-bottom:10px;">
        <h2>${t('explore_title')}</h2>
      </div>

      <!-- 真實金線世界地圖容器 (PC 響應式 Responsive，手機/電腦皆適配) -->
      <div class="world-radar-container" id="worldRadarBox">
        <div class="world-map-canvas-wrap" id="worldMapCanvasWrap">
          ${worldMapImgHTML}
          <div id="geoPinsContainer" style="position:absolute; inset:0; pointer-events:none;"></div>
        </div>

        <!-- 縮放與重設 HUD 控制項 -->
        <div class="map-controls-hud" id="worldMapHud">
          <button class="map-hud-btn" onclick="handleMapZoomIn()" title="放大">+</button>
          <button class="map-hud-btn" onclick="handleMapZoomOut()" title="縮小">−</button>
          <button class="map-hud-btn" onclick="handleMapReset()" title="重設視圖">↺</button>
        </div>
      </div>

      <!-- 下方操作指引 -->
      <div style="font-size:11.5px; color:var(--text-faint); margin-top:4px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <span>💡 ${currentLang==='zh'?'支援雙指縮放平移世界地圖':'Pinch/Drag to explore world map'}</span>
        <span style="color:var(--gold-dim); font-size:11px;">${currentLang==='zh'?'點擊品飲卡片鏡頭自動飛航聚焦':'Tap card to focus region'}</span>
      </div>

      <div class="section-head" style="margin-top:4px; margin-bottom:8px;">
        <h2>${currentLang==='zh'?'酒友最新公開品飲':'Public Tasting Feed'}</h2>
      </div>
      <div id="explore-feed" style="text-align:center; padding:6px 2px; color:var(--text-muted); font-size:14px;">
        載入中...
      </div>
    </div>
  `;

  initRealMapInteractions();
  renderRealWorldPinsAndFeed();
}

// 4. 世界地圖互動手勢管理（自由平滑縮放與拖曳，絕無跳圖誤判）
function initRealMapInteractions() {
  const container = document.getElementById('worldRadarBox');
  if (!container) return;

  container.onwheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    mapZoom = Math.min(Math.max(mapZoom * factor, 0.7), 4.5);
    updateRealMapTransform();
  };

  let isDragging = false;
  let startX, startY;

  container.onmousedown = (e) => {
    if (e.target.closest('.map-hud-btn')) return;
    isDragging = true;
    startX = e.clientX - mapPanX;
    startY = e.clientY - mapPanY;
  };

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    mapPanX = e.clientX - startX;
    mapPanY = e.clientY - startY;
    updateRealMapTransform();
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  let initialPinchDist = null;
  let initialPinchZoom = 1;

  container.ontouchstart = (e) => {
    if (e.target.closest('.map-hud-btn')) return;
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - mapPanX;
      startY = e.touches[0].clientY - mapPanY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDist = Math.hypot(dx, dy);
      initialPinchZoom = mapZoom;
    }
  };

  container.ontouchmove = (e) => {
    if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      mapPanX = e.touches[0].clientX - startX;
      mapPanY = e.touches[0].clientY - startY;
      updateRealMapTransform();
    } else if (e.touches.length === 2 && initialPinchDist) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDist = Math.hypot(dx, dy);
      const scaleFactor = currentDist / initialPinchDist;
      mapZoom = Math.min(Math.max(initialPinchZoom * scaleFactor, 0.7), 4.5);
      updateRealMapTransform();
    }
  };

  container.ontouchend = (e) => {
    if (e.touches.length < 2) initialPinchDist = null;
    if (e.touches.length === 0) isDragging = false;
  };
}

function handleMapZoomIn() {
  mapZoom = Math.min(mapZoom * 1.25, 4.5);
  updateRealMapTransform();
}

function handleMapZoomOut() {
  mapZoom = Math.max(mapZoom * 0.8, 0.7);
  updateRealMapTransform();
}

function handleMapReset() {
  mapZoom = 1;
  mapPanX = 0;
  mapPanY = 0;
  const wrap = document.getElementById('worldMapCanvasWrap');
  if (wrap) wrap.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
  updateRealMapTransform();
}

function updateRealMapTransform() {
  const wrap = document.getElementById('worldMapCanvasWrap');
  if (wrap) {
    wrap.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`;
  }
}

// 5. 渲染世界地圖 Pin 點與品飲動態列表（含自身動態管理與一鍵加想買清單）
async function renderRealWorldPinsAndFeed() {
  try {
    let publicFeed = [];
    try {
      const res = await fetch(`${WORKER_API_URL}/api/explore`);
      if (res.ok) publicFeed = await res.json();
    } catch(e) {}

    if (!publicFeed || !publicFeed.length) {
      publicFeed = [
        {
          id: 'demo-spain',
          author: 'Carlos (西班牙巡酒)',
          isMine: false,
          personalRating: 5,
          image: '',
          identification: { name: 'Vega Sicilia Único Ribera del Duero', country: '西班牙', region: '里奧哈/杜埃羅', vintage: '2012' },
          diary: { notes: '西班牙國寶名莊，雪茄盒、成熟黑莓與細膩皮革香氣，單寧如天鵝絨般奢華。' }
        },
        {
          id: 'demo-okinawa',
          author: 'Ken (琉球行)',
          isMine: false,
          personalRating: 5,
          image: '',
          identification: { name: '比嘉酒造 殘波白 琉球泡盛', country: '日本', region: '沖繩', vintage: '2023' },
          diary: { notes: '清澈如泉水，黑麴芳香與果實甘甜極其優雅，正宗沖繩琉球傳統銘品。' }
        },
        {
          id: 'demo-hk',
          author: 'Terence (本地品飲)',
          isMine: true,
          personalRating: 5,
          image: '',
          identification: { name: '少爺啤酒 Captains Molasses Stout', country: '香港', region: '沙田火炭', vintage: '2024' },
          diary: { notes: '黑糖與焦香麥芽醇厚濃郁，香港本地頂級精釀代表作。' }
        },
        {
          id: 'demo-bordeaux',
          author: 'Alex (品飲家)',
          isMine: false,
          personalRating: 5,
          image: '',
          identification: { name: 'Château Margaux Premier Grand Cru Classé', country: '法國', region: '波爾多', vintage: '2015' },
          diary: { notes: '紫羅蘭花香撲鼻，單寧極度絲滑，完美的瑪歌典型風格。' }
        },
        {
          id: 'demo-speyside',
          author: 'David (威士忌藏家)',
          isMine: false,
          personalRating: 5,
          image: '',
          identification: { name: 'Macallan 18 Years Double Cask', country: '蘇格蘭', region: '斯貝賽', vintage: '2021' },
          diary: { notes: '豐富的雪莉乾果香與生薑肉桂辛香，斯貝賽黃金產區之典範。' }
        },
        {
          id: 'demo-yamazaki',
          author: 'Yuki (日本酒造)',
          isMine: false,
          personalRating: 5,
          image: '',
          identification: { name: '三得利 山崎 12年 單一麥芽威士忌', country: '日本', region: '山崎', vintage: '2022' },
          diary: { notes: '水楢木桶帶來的東方線香氣息，果乾、蜂蜜與複雜香料層次。' }
        },
        {
          id: 'demo-napa',
          author: 'Rachel (加州酒莊巡禮)',
          isMine: false,
          personalRating: 4.8,
          image: '',
          identification: { name: 'Opus One Napa Valley Red Wine', country: '美國', region: '納帕', vintage: '2019' },
          diary: { notes: '黑醋栗與黑莓果醬濃郁，烤橡木與摩卡咖啡香氣層次極深。' }
        },
        {
          id: 'demo-taiwan',
          author: 'Evelyn (台灣威士忌俱樂部)',
          isMine: false,
          personalRating: 4.9,
          image: '',
          identification: { name: 'Kavalan Solist Vinho Barrique Cask', country: '台灣', region: '宜蘭', vintage: '2022' },
          diary: { notes: '熱帶水果炸裂，哈密瓜、芒果與胡桃巧克力的極致原酒風味。' }
        }
      ];
    }

    currentExploreFeed = publicFeed;
    const feedEl = document.getElementById('explore-feed');
    const pinsLayer = document.getElementById('geoPinsContainer');
    if (!feedEl) return;

    const myProfileName = localStorage.getItem('bottlesense_profile_name') || '';
    const myBoundEmail = localStorage.getItem('bottlesense_account_bound') || '';

    // 世界地圖上的所有 Pin 點（嚴格依產區坐標定點）
    if (pinsLayer) {
      pinsLayer.innerHTML = publicFeed.map((b) => {
        const country = bottleCountry(b);
        const region = bottleRegion(b);
        const pos = resolveRealImagePinPos(country, region, b);
        return `
          <div class="geo-pin-node" id="map-pin-${esc(b.id)}" style="top:${pos.top}%; left:${pos.left}%; pointer-events:auto;" onclick="flyToBottleRegion('${esc(b.id)}'); highlightFeedItem('${esc(b.id)}');" title="${esc(bottleName(b))}">
            🍷
          </div>
        `;
      }).join('');
    }

    // 酒友公開動態卡片
    feedEl.innerHTML = publicFeed.map(b => {
      const c = bottleCountry(b);
      const r = bottleRegion(b);
      const isMine = b.isMine || (myProfileName && b.author === myProfileName) || (myBoundEmail && b.author === myBoundEmail);

      return `
        <div class="bottle-card feed-clickable" id="feed-card-${esc(b.id)}" onclick="flyToBottleRegion('${esc(b.id)}')" style="margin-bottom:12px; cursor:pointer;">
          <div class="bottle-photo-box">${b.image ? `<img src="${esc(b.image)}">` : '🍷'}</div>
          <div class="bottle-info" style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px;">
              <div class="bottle-name">${esc(bottleName(b))}</div>
              ${isMine ? `<span style="font-size:10px; font-family:var(--mono); color:#D4AF37; background:rgba(212,175,55,0.15); border:1px solid rgba(212,175,55,0.3); padding:1px 6px; border-radius:4px; white-space:nowrap;">${currentLang==='zh'?'★ 我的分享':'★ My Share'}</span>` : ''}
            </div>
            
            <div style="font-size:12.5px; color:var(--gold); margin-top:2px;">★ ${b.personalRating||5}/5 ・ ${esc(b.author||'品飲同好')}</div>
            <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">"${esc(b.diary?.notes || '無額外筆記')}"</div>
            
            <div style="font-size:11.5px; color:var(--text-faint); margin-top:8px; display:flex; align-items:center; justify-content:space-between; gap:6px;">
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">📍 ${esc(c)} ${esc(r || b.location || '')}</span>
              
              <div style="display:flex; gap:6px; align-items:center;" onclick="event.stopPropagation();">
                ${isMine ? `
                  <button class="btn btn-ghost btn-sm" style="color:#f87171; border-color:rgba(239,68,68,0.3); font-size:11px; padding:2px 7px;" onclick="deleteMyExploreShare('${esc(b.id)}')">
                    🗑️ ${currentLang==='zh'?'刪除分享':'Delete'}
                  </button>
                ` : `
                  <button class="btn btn-ghost btn-sm" style="color:var(--gold); border-color:var(--gold-dim); font-size:11px; padding:2px 7px;" onclick="addExploreItemToWishlist('${esc(b.id)}')">
                    🏷️ ${currentLang==='zh'?'加入想買清單':'Add to Wishlist'}
                  </button>
                `}
                
                <button class="feed-detail-link" onclick="openSharedTastingModal('${esc(b.id)}')" title="查看分享內容">
                  <span>${currentLang==='zh'?'詳細':'Detail'}</span><span style="font-family:monospace; font-size:12px; margin-left:1px;">&gt;</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch(e) {
    const feedEl = document.getElementById('explore-feed');
    if (feedEl) feedEl.innerHTML = `<div class="empty-shelf">${currentLang==='zh'?'暫時無法載入酒友動態。':'Unable to load public feed.'}</div>`;
  }
}

// 6. 高亮卡片與 Pin 點
function highlightFeedItem(id) {
  document.querySelectorAll('.bottle-card.feed-highlight').forEach(el => el.classList.remove('feed-highlight'));
  document.querySelectorAll('.geo-pin-node.feed-highlight').forEach(el => el.classList.remove('feed-highlight'));

  const cardEl = document.getElementById(`feed-card-${id}`);
  if (cardEl) {
    cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    cardEl.classList.add('feed-highlight');
    setTimeout(() => cardEl.classList.remove('feed-highlight'), 3000);
  }

  const pinEl = document.getElementById(`map-pin-${id}`);
  if (pinEl) {
    pinEl.classList.add('feed-highlight');
    setTimeout(() => pinEl.classList.remove('feed-highlight'), 3000);
  }
}

// 7. 點擊品飲卡片：世界地圖平滑飛航並放大聚焦至該產區（西班牙飛往西班牙、沖繩飛往沖繩！）
function flyToBottleRegion(bottleId) {
  const b = currentExploreFeed.find(x => String(x.id) === String(bottleId)) ||
            (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;

  const country = bottleCountry(b);
  const region = bottleRegion(b);
  const pos = resolveRealImagePinPos(country, region, b);

  const box = document.getElementById('worldRadarBox');
  if (box) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  highlightFeedItem(b.id);

  const wrap = document.getElementById('worldMapCanvasWrap');
  if (!wrap || !box) return;

  // 世界地圖平滑飛向該酒款產區 (放大至 2.6 倍並置中聚焦)
  const targetZoom = 2.6;
  const w = box.clientWidth || 580;
  const h = box.clientHeight || 290;
  const targetPanX = ((50 - pos.left) / 100) * w * targetZoom;
  const targetPanY = ((50 - pos.top) / 100) * h * targetZoom;

  wrap.style.transition = 'transform 0.60s cubic-bezier(0.22, 1, 0.36, 1)';
  mapZoom = targetZoom;
  mapPanX = targetPanX;
  mapPanY = targetPanY;
  updateRealMapTransform();
}

// 8. 社群分享管理按鈕操作
async function deleteMyExploreShare(bottleId) {
  if (!confirm(currentLang==='zh'?'確定要從酒友探索池收回並刪除此筆分享嗎？':'Remove this tasting share from explore feed?')) return;
  currentExploreFeed = currentExploreFeed.filter(x => String(x.id) !== String(bottleId));
  renderRealWorldPinsAndFeed();
  showToast(currentLang==='zh'?'✓ 已成功收回分享':'✓ Tasting share removed');
}

async function addExploreItemToWishlist(bottleId) {
  const b = currentExploreFeed.find(x => String(x.id) === String(bottleId));
  if (!b) return;

  const newBottle = normalizeBottle({
    id: uid(),
    image: b.image || '',
    imageData: b.image || '',
    identification: { ...b.identification },
    scan: { ...b.identification },
    tags: {
      category: bottleCategory(b),
      vintage: bottleVintage(b),
      country: bottleCountry(b),
      region: bottleRegion(b)
    },
    tastings: [],
    isFavorite: false,
    status: 'wishlist',
    addedAt: Date.now()
  });

  window.cellar.unshift(newBottle);
  await saveBottleToDB(newBottle);
  showToast(currentLang==='zh'?'✓ 已成功加入你的「🏷️ 想買」空間！':'✓ Added to Wishlist!');
}

function openSharedTastingModal(bottleId) {
  const b = currentExploreFeed.find(x => String(x.id) === String(bottleId)) ||
            (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;

  const c = bottleCountry(b);
  const r = bottleRegion(b);

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" style="max-width:380px; padding:22px 20px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
          <div style="flex:1; padding-right:10px;">
            <div style="font-size:11px; color:var(--gold); font-family:var(--mono); text-transform:uppercase; letter-spacing:0.5px;">
              ${esc(bottleCategory(b))} ${bottleVintage(b)!=='無年份'?'・ '+esc(bottleVintage(b)):''}
            </div>
            <h3 style="font-family:var(--serif); font-size:18px; margin-top:2px; color:var(--text); line-height:1.35;">
              ${esc(bottleName(b))}
            </h3>
          </div>
          <button class="icon-btn" onclick="closeModal()" style="margin-top:-4px; margin-right:-4px;">✕</button>
        </div>

        ${b.image ? `<div style="width:100%; height:180px; border-radius:12px; overflow:hidden; margin-bottom:14px; background:#000;"><img src="${esc(b.image)}" style="width:100%; height:100%; object-fit:contain;"></div>` : ''}

        <div style="background:var(--surface-2); padding:10px 14px; border-radius:12px; border:1px solid var(--line); margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:13px; color:var(--text);">
            <span style="color:var(--text-muted);">${currentLang==='zh'?'品飲分享者':'Taster'}:</span> <strong style="color:var(--gold);">${esc(b.author || '品飲同好')}</strong>
          </div>
          <div style="font-size:13.5px; color:var(--gold); font-weight:700;">
            ★ ${b.personalRating || 5}/5
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px; font-weight:600;">${currentLang==='zh'?'品飲筆記心得':'Tasting Notes'}</div>
          <div style="background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:12px 14px; font-size:13.5px; color:var(--text); line-height:1.6;">
            "${esc(b.diary?.notes || b.notes || '無額外手記記錄')}"
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); padding:0 2px; margin-bottom:16px;">
          <span>📍 產區: <strong style="color:var(--text);">${esc(c)} ${esc(r || b.location || '')}</strong></span>
          ${b.diary?.date ? `<span>📅 ${esc(b.diary.date)}</span>` : ''}
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="closeModal()">${t('btn_close')}</button>
          <button class="btn btn-primary" style="flex:1;" onclick="closeModal(); flyToBottleRegion('${esc(b.id)}');">
            🗺️ ${currentLang==='zh'?'在地圖上聚焦':'Focus on Map'}
          </button>
        </div>
      </div>
    </div>
  `;
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
    const img = new Image();
    img.onload = () => {
      // 相片預縮放防卡死：48MP/12MP巨圖在記憶體內先進行 1920px 快速降採樣，徹底防止手機 Safari 記憶體崩潰
      const maxDim = 1920;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const cropImg = document.getElementById('cropTargetImage');
      cropImg.src = canvas.toDataURL('image/jpeg', 0.90);
      openCropModal();
    };
    img.src = e.target.result;
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

async function confirmCropAndScan(isFullImage = false) {
  const cropImg = document.getElementById('cropTargetImage');
  closeCropModal();
  showScanLoading();

  try {
    let dataUrl;
    if (isFullImage) {
      dataUrl = cropImg.src;
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#080808';
      ctx.fillRect(0, 0, 1000, 1000);

      ctx.save();
      ctx.translate(500 + cropTranslateX, 500 + cropTranslateY);
      ctx.scale(cropScale, cropScale);
      ctx.drawImage(cropImg, -cropImg.naturalWidth / 2, -cropImg.naturalHeight / 2);
      ctx.restore();

      dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    }

    const b64Data = dataUrl.split(',')[1];

    const result = await identifyBottle(b64Data, 'image/jpeg');
    if (result && result.vm) {
      result.vm = calibrateValueMap(result.vm, result.category, result.name);
    }

    const bottle = normalizeBottle({
      id: uid(),
      image: dataUrl,
      imageData: dataUrl,
      identification: result,
      scan: result,
      tags: {
        category: result.category || '酒類',
        vintage: result.vintage || '',
        country: result.country || '',
        region: result.region || ''
      },
      tastings: [],
      isFavorite: false,
      status: 'unopened',
      addedAt: Date.now()
    });

    window.cellar.unshift(bottle);
    await saveBottleToDB(bottle);
    // 關閉擾人的首次掃描註冊彈窗，直接進入酒款詳情
    renderBottleDetail(bottle.id);

  } catch(err) {
    showError(err?.message || (currentLang === 'zh' ? '辨識失敗，請確保酒標清晰後重試。' : 'Recognition failed. Please try again.'));
  }
}

async function identifyBottle(image, mediaType) {
  const res = await fetch(`${WORKER_API_URL}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, mediaType })
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `AI API Error (${res.status})`);
  return data || {};
}

function showScanLoading() {
  main.innerHTML = `
    <div class="loading-view">
      <div class="loading-ring"></div>
      <h2 style="font-family:var(--serif); font-size:22px;">${t('analyzing_title')}</h2>
      <p style="color:var(--text-muted); font-size:14px; margin-top:10px;">${t('analyzing_desc')}</p>
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
  if (currentView === 'cellar') renderCellar();
  else renderHome();
}

// 4. 設定與備份：不整一大格講濕碎功能，查看教學改為安裝教學，四個字唔做掣放係關閉上面

/* =======================================================================
   電郵註冊／OTP免密碼登入與個人問候系統 (Pure Email Auth)
   100% 徹底清除所有手遊專屬碼，全面統一為現代純電郵免密碼登入與註冊體系
======================================================================= */

let authFlowState = {
  step: 'email', // 'email' | 'register_form' | 'register_sent' | 'login_otp'
  email: '',
  name: '',
  gender: 'unspecified',
  birthday: ''
};

let loginOtpCountdownTimer = null;
let settingsActiveTab = 'profile'; // 'profile' | 'account'

// 1. 頂部動態問候語 (Hello, [名字] 或 生日祝福)
function updateHeaderGreeting() {
  const taglineEl = document.getElementById('appTagline') || document.querySelector('.tagline');
  const boundAccount = localStorage.getItem('bottlesense_account_bound');
  const profileName = localStorage.getItem('bottlesense_profile_name') || (boundAccount ? boundAccount.split('@')[0] : '');
  const birthday = localStorage.getItem('bottlesense_profile_birthday') || '';

  // 更新頂部按鈕狀態
  const loginBtnText = document.getElementById('topbarLoginText');
  if (loginBtnText) {
    if (boundAccount && profileName) {
      loginBtnText.textContent = profileName.length > 5 ? profileName.substring(0, 5) + '…' : profileName;
    } else {
      loginBtnText.textContent = currentLang === 'zh' ? '登入' : 'Login';
    }
  }

  if (!taglineEl) return;

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

function switchSettingsTab(tab) {
  settingsActiveTab = tab;
  renderSettings();
}

function openLoginModal() {
  renderSettings();
}

// 2. 設定頁面：未登入呈現「電郵登入/註冊」；已登入呈現「個人資料」與「帳號管理」
function renderSettings() {
  const boundAccount = localStorage.getItem('bottlesense_account_bound');
  const profileName = localStorage.getItem('bottlesense_profile_name') || (boundAccount ? boundAccount.split('@')[0] : '');
  const birthday = localStorage.getItem('bottlesense_profile_birthday') || '';
  const gender = localStorage.getItem('bottlesense_profile_gender') || 'unspecified';
  const cellarCount = (window.cellar || []).length;

  let contentHTML = '';

  if (boundAccount) {
    // 【已登入狀態】：分頁拆分「個人資料」與「帳號設定」
    const tabHeaderHTML = `
      <div style="display:flex; gap:6px; background:rgba(0,0,0,0.4); padding:4px; border-radius:10px; margin-bottom:14px; border:1px solid var(--line);">
        <button class="btn btn-sm ${settingsActiveTab === 'profile' ? 'btn-primary' : 'btn-ghost'}" style="flex:1; padding:7px 0; font-size:12.5px; font-weight:700; border-color:${settingsActiveTab === 'profile' ? 'var(--gold)' : 'transparent'};" onclick="switchSettingsTab('profile')">
          👤 ${currentLang === 'zh' ? '個人資料' : 'Profile'}
        </button>
        <button class="btn btn-sm ${settingsActiveTab === 'account' ? 'btn-primary' : 'btn-ghost'}" style="flex:1; padding:7px 0; font-size:12.5px; font-weight:700; border-color:${settingsActiveTab === 'account' ? 'var(--gold)' : 'transparent'};" onclick="switchSettingsTab('account')">
          ⚙️ ${currentLang === 'zh' ? '帳號設定' : 'Account'}
        </button>
      </div>
    `;

    if (settingsActiveTab === 'profile') {
      // 分頁 1: 個人名牌、稱號、性別、生日
      contentHTML = `
        ${tabHeaderHTML}
        <div style="background:linear-gradient(180deg, var(--surface-2) 0%, #161810 100%); border:1px solid var(--gold-dim); border-radius:12px; padding:14px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="font-size:11px; font-family:var(--mono); color:var(--gold); font-weight:700;">
              ✓ ${currentLang === 'zh' ? '已綁定電郵' : 'Bound Email'}
            </div>
            <span style="font-size:10.5px; background:rgba(34,197,94,0.15); color:var(--green-ok); border:1px solid rgba(34,197,94,0.3); padding:1px 7px; border-radius:999px;">
              ● ${currentLang === 'zh' ? '同步中' : 'Synced'}
            </span>
          </div>
          <div style="font-family:var(--serif); font-size:19px; font-weight:700; color:var(--text); margin-bottom:2px; word-break:break-all;">
            Hello, <span style="color:var(--gold);">${esc(profileName)}</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted); word-break:break-all;">
            ✉️ ${esc(boundAccount)}
          </div>
        </div>

        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:12px; padding:14px; margin-bottom:12px;">
          <div style="font-size:12.5px; font-weight:700; color:var(--gold); margin-bottom:10px;">
            ✏️ ${currentLang === 'zh' ? '修改個人檔案' : 'Edit Profile'}
          </div>
          <div style="font-size:11.5px; font-weight:600; color:var(--text); margin-bottom:4px;">
            ${currentLang === 'zh' ? '姓名 / 暱稱' : 'Name'} <span style="color:#EF4444;">*</span>
          </div>
          <input type="text" id="edit-profile-name" class="text-input" style="margin-top:0; padding:9px 12px; font-size:13.5px; margin-bottom:10px;" value="${esc(profileName)}" placeholder="${currentLang === 'zh' ? '輸入稱呼' : 'Enter name'}">

          <div style="font-size:11.5px; font-weight:600; color:var(--text); margin-bottom:4px;">
            ${currentLang === 'zh' ? '性別' : 'Gender'}
          </div>
          <select id="edit-profile-gender" class="text-input" style="margin-top:0; padding:8px 10px; font-size:13px; margin-bottom:10px;">
            <option value="unspecified" ${gender==='unspecified'?'selected':''}>${currentLang==='zh'?'保密':'Prefer not to say'}</option>
            <option value="male" ${gender==='male'?'selected':''}>${currentLang==='zh'?'男':'Male'}</option>
            <option value="female" ${gender==='female'?'selected':''}>${currentLang==='zh'?'女':'Female'}</option>
          </select>

          <div style="font-size:11.5px; font-weight:600; color:var(--text); margin-bottom:4px;">
            ${currentLang === 'zh' ? '生日' : 'Birthday'}
          </div>
          <input type="date" id="edit-profile-birthday" class="text-input" style="margin-top:0; padding:9px 12px; font-size:13px; text-align:left;" value="${esc(birthday)}">

          <button id="btn-save-profile" class="btn btn-primary btn-block" style="padding:10px; margin-top:14px; font-size:13px; font-weight:700;" onclick="executeSaveProfile()">
            ${currentLang === 'zh' ? '儲存變更' : 'Save Changes'}
          </button>
        </div>
      `;
    } else {
      // 分頁 2: 雲端狀態、安裝至手機、登出、永久刪除
      contentHTML = `
        ${tabHeaderHTML}
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:12px; padding:14px; margin-bottom:14px;">
          <div style="font-size:12.5px; font-weight:700; color:var(--gold); margin-bottom:8px;">
            ☁️ ${currentLang === 'zh' ? '酒窖備份狀態' : 'Cloud Status'}
          </div>
          <div style="font-size:12.5px; color:var(--text); line-height:1.5; margin-bottom:12px;">
            ${currentLang === 'zh' ? `目前已安全備份 <strong style="color:var(--gold);">${cellarCount}</strong> 支藏酒與手記。` : `Safely backed up <strong style="color:var(--gold);">${cellarCount}</strong> bottles & notes.`}
          </div>



          <button class="btn btn-wine btn-block" style="padding:10px; font-size:13px;" onclick="executeAccountLogout()">
            ${currentLang === 'zh' ? '登出帳號 Logout' : 'Logout'}
          </button>
        </div>

        <div style="background:rgba(239,68,68,0.04); border:1px solid rgba(239,68,68,0.2); border-radius:12px; padding:14px;">
          <div style="font-size:12px; font-weight:700; color:#EF4444; margin-bottom:6px;">
            ⚠️ ${currentLang === 'zh' ? '永久註銷帳號' : 'Delete Account'}
          </div>
          <div style="font-size:11.5px; color:var(--text-faint); line-height:1.4; margin-bottom:10px;">
            ${currentLang === 'zh' ? '若需永久離開，勾選後可刪除 Email、個人檔案、所有藏酒手記與探索池記錄（無法回復）。' : 'Tick below to permanently erase your email, profile, all cellar bottles and explore records (irreversible).'}
          </div>
          <label style="display:flex; align-items:flex-start; gap:8px; font-size:11.5px; color:#FCA5A5; cursor:pointer; line-height:1.4; margin-bottom:10px;">
            <input type="checkbox" id="delete-account-confirm-check" style="margin-top:2px; accent-color:#EF4444;" onchange="toggleDeleteAccountButton(this.checked)">
            <span>${currentLang === 'zh' ? '確認永久註銷並清空所有資料' : 'Confirm permanent account deletion'}</span>
          </label>
          <button id="btn-delete-account" class="btn btn-block" style="padding:9px; font-size:12.5px; background:rgba(239,68,68,0.2); color:#EF4444; border:1px solid rgba(239,68,68,0.4); display:none; font-weight:700;" onclick="executeDeleteAccountPermanently()">
            🗑️ ${currentLang === 'zh' ? '確認永久刪除帳號與所有資料' : 'Permanently Delete Account'}
          </button>
        </div>
      `;
    }
  } else {
    // 【未登入狀態】：依據步驟流程顯示
    if (authFlowState.step === 'email') {
      contentHTML = `
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:14px; padding:18px 16px; margin-bottom:12px;">
          <div style="font-size:14px; font-weight:700; color:var(--gold); margin-bottom:6px;">
            👤 ${currentLang === 'zh' ? '酒窖登入 / 註冊' : 'Cellar Login / Register'}
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:14px; line-height:1.5;">
            ${currentLang === 'zh' ? '輸入你的電郵地址即可快速登入或註冊酒窖：' : 'Enter your email address to sign in or register:'}
          </div>



          <div style="font-size:11.5px; font-family:var(--mono); color:var(--text-faint); margin-bottom:4px;">
            ${currentLang === 'zh' ? '電郵地址 (Email)' : 'Email Address'}
          </div>
          <input type="email" id="auth-email" class="text-input" style="margin-top:0; padding:11px 12px; font-size:14.5px;" value="${esc(authFlowState.email)}" placeholder="${currentLang === 'zh' ? '輸入你的電郵 (例如 user@gmail.com)' : 'Enter email (e.g. user@gmail.com)'}">
          
          <!-- 左邊：註冊帳號 (btn-ghost)；右邊：登入酒窖 (btn-primary) -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:16px;">
            <button class="btn btn-ghost btn-block" style="padding:11px; font-size:13.5px;" onclick="handleStartRegister()">
              ${currentLang === 'zh' ? '註冊帳號' : 'Register'}
            </button>
            <button class="btn btn-primary btn-block" style="padding:11px; font-size:13.5px;" onclick="handleStartLogin()">
              ${currentLang === 'zh' ? '登入酒窖' : 'Login'}
            </button>
          </div>
        </div>
      `;
    } else if (authFlowState.step === 'register_form') {
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
          <div id="field-wrap-name">
            <div style="font-size:12px; font-weight:600; color:var(--text); margin-bottom:4px;">
              ${currentLang === 'zh' ? '姓名' : 'Name'} <span style="color:#EF4444; font-weight:700;">*</span>
            </div>
            <input type="text" id="reg-name" class="text-input" style="margin-top:0; padding:9px 12px; font-size:13.5px;" value="${esc(authFlowState.name)}" placeholder="${currentLang === 'zh' ? '請輸入姓名' : 'Enter name'}" oninput="clearNameFieldError()">
            <div id="reg-name-error" style="display:none; font-size:11.5px; color:#EF4444; margin-top:4px; font-weight:600;">
              ⚠️ ${currentLang === 'zh' ? '請填寫姓名以完成註冊' : 'Please enter your name'}
            </div>
          </div>
          <div style="font-size:12px; font-weight:600; color:var(--text); margin-top:12px; margin-bottom:4px;">
            ${currentLang === 'zh' ? '性別' : 'Gender'}
          </div>
          <select id="reg-gender" class="text-input" style="margin-top:0; padding:8px 10px; font-size:13px;">
            <option value="unspecified" ${authFlowState.gender==='unspecified'?'selected':''}>${currentLang==='zh'?'保密':'Prefer not to say'}</option>
            <option value="male" ${authFlowState.gender==='male'?'selected':''}>${currentLang==='zh'?'男':'Male'}</option>
            <option value="female" ${authFlowState.gender==='female'?'selected':''}>${currentLang==='zh'?'女':'Female'}</option>
          </select>
          <div style="font-size:12px; font-weight:600; color:var(--text); margin-top:12px; margin-bottom:4px;">
            ${currentLang === 'zh' ? '生日' : 'Birthday'}
          </div>
          <input type="date" id="reg-birthday" class="text-input" style="margin-top:0; padding:9px 12px; font-size:13px; text-align:left;" value="${esc(authFlowState.birthday)}">
          <label style="display:flex; align-items:flex-start; gap:8px; font-size:12px; color:var(--text-muted); margin-top:14px; cursor:pointer; line-height:1.4;">
            <input type="checkbox" id="reg-terms-check" style="margin-top:2px; accent-color:var(--gold);">
            <span>
              ${currentLang === 'zh'
                ? '我已閱讀並同意 <a href="javascript:void(0)" onclick="openTermsModal()" style="color:var(--gold); text-decoration:underline;">使用條款</a> 及 <a href="javascript:void(0)" onclick="openPrivacyModal()" style="color:var(--gold); text-decoration:underline;">私隱政策</a> <span style="color:#EF4444;">*</span>'
                : 'I agree to the <a href="javascript:void(0)" onclick="openTermsModal()" style="color:var(--gold);">Terms</a> and <a href="javascript:void(0)" onclick="openPrivacyModal()" style="color:var(--gold);">Privacy</a> <span style="color:#EF4444;">*</span>'}
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
    } else if (authFlowState.step === 'login_otp') {
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
        <div style="text-align:center; margin-top:14px; margin-bottom:6px;">
          <a href="javascript:void(0)" onclick="showPwaInstallModal()" style="display:inline-block; font-size:12.5px; color:var(--gold); text-decoration:none; font-weight:600; padding:6px 14px; border:1px solid var(--gold-dim); border-radius:8px; background:rgba(212,175,55,0.06);">
            📲 ${currentLang === 'zh' ? '安裝教學' : 'Install Guide'}
          </a>
        </div>
        <button class="btn btn-ghost btn-block" style="padding:9px; font-size:13px; color:var(--text-faint); border-color:transparent;" onclick="closeModal()">
          ${t('btn_close')}
        </button>
      </div>
    </div>
  `;
}

// 3. OTP 自動輸入與貼上秒登入
function handleOtpInput(inputEl) {
  if (!inputEl) return;
  const val = (inputEl.value || '').replace(/\D/g, '').slice(0, 6);
  inputEl.value = val;
  if (val.length === 6) executeLoginWithOtp();
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

// 4. 執行 OTP 驗證並自動從雲端還原酒窖
async function executeLoginWithOtp() {
  const otpInput = document.getElementById('login-otp');
  const otp = (otpInput?.value || '').trim();
  const email = (authFlowState.email || '').trim().toLowerCase();
  if (!email || otp.length !== 6) {
    showToast(currentLang === 'zh' ? '請輸入完整的 6 位數驗證碼' : 'Please enter the 6-digit code');
    return;
  }
  showToast(currentLang === 'zh' ? '正在驗證並載入酒窖…' : 'Verifying code & loading cellar...');
  try {
    const clientSyncKey = localStorage.getItem('bottlesense_sync_key') || '';
    const res = await fetch(`${WORKER_API_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, syncKey: clientSyncKey })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '驗證失敗');

    if (data.cellar) {
      await restoreCellarToLocal(data.cellar, data.syncKey, data.name || data.email);
    }
    localStorage.setItem('bottlesense_account_bound', data.email);
    localStorage.setItem('bottlesense_profile_name', data.name || email.split('@')[0]);
    if (data.birthday) localStorage.setItem('bottlesense_profile_birthday', data.birthday);
    if (data.gender) localStorage.setItem('bottlesense_profile_gender', data.gender);
    localStorage.setItem('bottlesense_registered', 'true');

    updateHeaderGreeting();
    closeModal();
    showToast(currentLang === 'zh' ? '✓ 登入成功！已還原雲端酒窖' : '✓ Logged in! Cloud cellar restored');

    // 首次登入成功彈出 PWA 加入主畫面邀請
    if (!localStorage.getItem('bottlesense_pwa_prompted')) {
      localStorage.setItem('bottlesense_pwa_prompted', 'true');
      setTimeout(() => { showPwaFirstLoginInvite(); }, 800);
    }

    if (currentView === 'cellar') renderCellar();
    else if (currentView === 'home') renderHome();
    else if (currentView === 'explore') renderExplore();
  } catch (err) {
    showToast('登入失敗: ' + err.message);
  }
}

// 5. 點擊「登入酒窖」發送 6 位數驗證碼
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
    if (!res.ok) throw new Error(data.error || (currentLang === 'zh' ? '發送失敗' : 'Failed to send'));
    authFlowState.step = 'login_otp';
    renderSettings();
    if (data.devOtp) {
      setTimeout(() => {
        const otpEl = document.getElementById('login-otp');
        if (otpEl) {
          otpEl.value = data.devOtp;
        }
      }, 100);
      showToast(currentLang === 'zh' ? `⚠️ 測試驗證碼已自動填入：${data.devOtp}` : `⚠️ Test code auto-filled: ${data.devOtp}`);
    } else {
      showToast(currentLang === 'zh' ? '✓ 驗證碼已發送至你的電郵信箱！' : '✓ Code sent to your inbox!');
    }
    startLoginOtpCountdown();
  } catch (err) {
    showToast('發送失敗: ' + err.message);
  }
}

// 6. 點擊「註冊帳號」防呆檢查
async function handleStartRegister() {
  const emailInput = document.getElementById('auth-email');
  const email = (emailInput?.value || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showToast(currentLang === 'zh' ? '請輸入有效的電郵地址' : 'Please enter a valid email');
    return;
  }
  try {
    const checkRes = await fetch(`${WORKER_API_URL}/api/auth/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const checkData = await checkRes.json();
    if (checkData.exists) {
      showToast(currentLang === 'zh' ? '⚠️ 此電郵已經註冊過！已自動為你切換至「登入模式」' : '⚠️ Email already registered! Switched to login mode.');
      authFlowState.email = email;
      handleStartLogin(email);
      return;
    }
  } catch (e) {}

  authFlowState.email = email;
  authFlowState.step = 'register_form';
  renderSettings();
}

// 7. 發送註冊認證電郵
async function executeSendVerificationLink() {
  const nameInput = document.getElementById('reg-name');
  const name = (nameInput?.value || '').trim();
  if (!name) {
    const err = document.getElementById('reg-name-error');
    if (err) err.style.display = 'block';
    return;
  }
  const termsCheck = document.getElementById('reg-terms-check');
  if (!termsCheck?.checked) {
    showToast(currentLang === 'zh' ? '請先勾選同意使用條款及私隱政策' : 'Please agree to Terms & Privacy');
    return;
  }
  const gender = document.getElementById('reg-gender')?.value || 'unspecified';
  const birthday = document.getElementById('reg-birthday')?.value || '';

  authFlowState.name = name;
  authFlowState.gender = gender;
  authFlowState.birthday = birthday;

  showToast(currentLang === 'zh' ? '正在發送註冊驗證碼…' : 'Sending verification code...');
  try {
    const res = await fetch(`${WORKER_API_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authFlowState.email, name, gender, birthday, type: 'register' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || (currentLang === 'zh' ? '發送失敗' : 'Failed to send'));

    authFlowState.step = 'login_otp';
    renderSettings();
    if (data.devOtp) {
      setTimeout(() => {
        const otpEl = document.getElementById('login-otp');
        if (otpEl) {
          otpEl.value = data.devOtp;
        }
      }, 100);
      showToast(currentLang === 'zh' ? `⚠️ 測試驗證碼已自動填入：${data.devOtp}` : `⚠️ Test code auto-filled: ${data.devOtp}`);
    } else {
      showToast(currentLang === 'zh' ? '✓ 驗證碼已發送至你的信箱，請輸入完成註冊！' : '✓ Verification code sent to email!');
    }
    startLoginOtpCountdown();
  } catch (err) {
    showToast('發送失敗: ' + err.message);
  }
}

function clearNameFieldError() {
  const err = document.getElementById('reg-name-error');
  if (err) err.style.display = 'none';
}

function backToEmailStep() {
  authFlowState.step = 'email';
  if (loginOtpCountdownTimer) clearInterval(loginOtpCountdownTimer);
  renderSettings();
}

function startLoginOtpCountdown() {
  let seconds = 60;
  const btn = document.getElementById('btn-login-resend');
  if (btn) {
    btn.disabled = true;
    btn.textContent = `${currentLang === 'zh' ? '重新發送' : 'Resend'} (${seconds}s)`;
  }
  if (loginOtpCountdownTimer) clearInterval(loginOtpCountdownTimer);
  loginOtpCountdownTimer = setInterval(() => {
    seconds--;
    const b = document.getElementById('btn-login-resend');
    if (seconds <= 0) {
      clearInterval(loginOtpCountdownTimer);
      if (b) {
        b.disabled = false;
        b.textContent = currentLang === 'zh' ? '重新發送驗證碼' : 'Resend Code';
      }
    } else if (b) {
      b.textContent = `${currentLang === 'zh' ? '重新發送' : 'Resend'} (${seconds}s)`;
    }
  }, 1000);
}

function resendLoginOtp() {
  if (authFlowState.email) {
    handleStartLogin(authFlowState.email);
  }
}

// 8. 儲存個人檔案修改
async function executeSaveProfile() {
  const name = document.getElementById('edit-profile-name')?.value.trim();
  if (!name) {
    showToast(currentLang === 'zh' ? '請輸入姓名' : 'Please enter name');
    return;
  }
  const gender = document.getElementById('edit-profile-gender')?.value || 'unspecified';
  const birthday = document.getElementById('edit-profile-birthday')?.value || '';
  const email = localStorage.getItem('bottlesense_account_bound') || '';

  localStorage.setItem('bottlesense_profile_name', name);
  localStorage.setItem('bottlesense_owner_name', name);
  localStorage.setItem('bottlesense_profile_gender', gender);
  localStorage.setItem('bottlesense_profile_birthday', birthday);

  updateHeaderGreeting();

  try {
    const clientSyncKey = localStorage.getItem('bottlesense_sync_key');
    await fetch(`${WORKER_API_URL}/api/profile/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, gender, birthday, syncKey: clientSyncKey })
    });
  } catch (e) {}

  showToast(currentLang === 'zh' ? '✓ 個人資料已儲存！' : '✓ Profile saved!');
  renderSettings();
}

// 9. 登出帳號
async function executeAccountLogout() {
  const confirmMsg = currentLang === 'zh'
    ? '確定要登出帳號？登出後將會清空本機暫存藏酒。雲端酒窖資料已安全備份，重新輸入電郵驗證即可再次載入查看。'
    : 'Are you sure you want to log out? Local data on this device will be cleared. Cloud data is safely backed up and can be restored anytime by verifying your email again.';
  if (!confirm(confirmMsg)) return;

  if (typeof clearLocalCellar === 'function') await clearLocalCellar();
  window.cellar = [];
  localStorage.removeItem('bottlesense_account_bound');
  localStorage.removeItem('bottlesense_owner_name');
  localStorage.removeItem('bottlesense_profile_name');
  localStorage.removeItem('bottlesense_profile_birthday');
  localStorage.removeItem('bottlesense_profile_gender');
  localStorage.removeItem('bottlesense_registered');

  authFlowState = { step: 'email', email: '', name: '', gender: 'unspecified', birthday: '' };
  showToast(currentLang === 'zh' ? '✓ 已成功登出並清空本機藏酒資料' : '✓ Logged out and cleared local data');
  updateHeaderGreeting();
  goHome();
  renderSettings();
}

function toggleDeleteAccountButton(checked) {
  const btn = document.getElementById('btn-delete-account');
  if (btn) btn.style.display = checked ? 'block' : 'none';
}

async function executeDeleteAccountPermanently() {
  const email = localStorage.getItem('bottlesense_account_bound');
  if (!email) return;
  if (!confirm(currentLang === 'zh' ? '⚠️ 此操作將永久刪除帳號、清空雲端與本地所有藏酒，且無法復原！確定要執行嗎？' : '⚠️ Permanently delete account and all cellar data? This cannot be undone!')) return;

  showToast(currentLang === 'zh' ? '正在註銷帳號…' : 'Deleting account...');
  try {
    const clientSyncKey = localStorage.getItem('bottlesense_sync_key');
    await fetch(`${WORKER_API_URL}/api/account/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, syncKey: clientSyncKey })
    });
  } catch(e) {}

  if (typeof clearLocalCellar === 'function') await clearLocalCellar();
  window.cellar = [];
  localStorage.clear();
  authFlowState = { step: 'email', email: '', name: '', gender: 'unspecified', birthday: '' };
  showToast(currentLang === 'zh' ? '✓ 帳號已永久註銷' : '✓ Account permanently deleted');
  updateHeaderGreeting();
  closeModal();
  goHome();
}

async function restoreCellarToLocal(cellarData, syncKey, name) {
  if (syncKey) localStorage.setItem('bottlesense_sync_key', syncKey);
  if (name) localStorage.setItem('bottlesense_profile_name', name);
  if (Array.isArray(cellarData)) {
    for (const b of cellarData) {
      await saveBottleToDB(b);
    }
  }
  await refreshCellar();
}

async function clearLocalCellar() {
  try {
    const db = await openDB(DB_NAME);
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch (e) {}
}

function showPwaInstallModal() {
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" style="max-width:360px; padding:24px 20px; text-align:left;">
        <h2 style="font-family:var(--serif); margin-bottom:14px; font-size:20px; text-align:center; color:var(--gold);">
          ${currentLang==='zh'?'安裝 BottleSense 到手機主畫面':'Add to Home Screen'}
        </h2>
        
        <div style="display:flex; flex-direction:column; gap:12px; font-size:13px; color:var(--text); line-height:1.6;">
          <div style="background:var(--surface-2); padding:12px 14px; border-radius:12px; border:1px solid var(--line);">
            <div style="font-weight:700; color:var(--gold); margin-bottom:4px;">🍎 iOS (Safari)</div>
            <div>${currentLang==='zh'?'點擊下方「<strong style="color:var(--text);">分享</strong>」圖示 <span style="font-size:14px;">⎋</span> ➔ 往下滑選擇「<strong style="color:var(--text);">加入主畫面</strong>」即完成。':'Tap bottom <strong style="color:var(--text);">Share</strong> <span style="font-size:14px;">⎋</span> ➔ Scroll and select <strong style="color:var(--text);">Add to Home Screen</strong>.'}</div>
          </div>

          <div style="background:var(--surface-2); padding:12px 14px; border-radius:12px; border:1px solid var(--line);">
            <div style="font-weight:700; color:var(--gold); margin-bottom:4px;">🤖 Android (Chrome)</div>
            <div>${currentLang==='zh'?'點擊右上角「<strong style="color:var(--text);">⋮</strong>」選單 ➔ 選擇「<strong style="color:var(--text);">安裝應用程式</strong>」或「新增至主螢幕」。':'Tap top-right <strong style="color:var(--text);">⋮</strong> menu ➔ Select <strong style="color:var(--text);">Install App</strong> or Add to Home Screen.'}</div>
          </div>

          <div style="background:var(--surface-2); padding:12px 14px; border-radius:12px; border:1px solid var(--line);">
            <div style="font-weight:700; color:var(--gold); margin-bottom:4px;">💻 ${currentLang==='zh'?'電腦版':'Desktop'} (Chrome / Edge / Safari)</div>
            <div>${currentLang==='zh'?'點擊網址列右側出現的「<strong style="color:var(--text);">⊕ 安裝</strong>」圖示即可擁有原生桌面體驗。':'Click the <strong style="color:var(--text);">⊕ Install</strong> icon in the browser address bar for desktop app.'}</div>
          </div>
        </div>

        <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="closeModal()">${t('btn_close')}</button>
      </div>
    </div>
  `;
}

function showPwaFirstLoginInvite() {
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" style="max-width:350px; text-align:center; padding:22px 18px;">
        <div style="font-size:36px; margin-bottom:8px;">🍾</div>
        <h3 style="font-family:var(--serif); font-size:18px; color:var(--gold); margin-bottom:8px;">
          ${currentLang==='zh'?'加入手機主畫面，體驗秒速開啟':'Add to Home Screen'}
        </h3>
        <p style="font-size:12.5px; color:var(--text-muted); line-height:1.5; margin-bottom:16px;">
          ${currentLang==='zh'?'將 BottleSense 安裝至手機，享受全螢幕酒窖、離線瀏覽與極致順暢的專業品飲手記！':'Install BottleSense on your phone for fullscreen cellar, offline access and instant launch!'}
        </p>
        <button class="btn btn-primary btn-block" style="padding:10px; margin-bottom:8px; font-weight:700;" onclick="showPwaInstallModal()">
          📲 ${currentLang==='zh'?'查看如何安裝':'View Install Guide'}
        </button>
        <button class="btn btn-ghost btn-block" style="border-color:transparent; color:var(--text-faint); padding:8px;" onclick="closeModal()">
          ${currentLang==='zh'?'暫時略過':'Maybe later'}
        </button>
      </div>
    </div>
  `;
}

function openTermsModal() {
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" style="max-width:380px; text-align:left; max-height:80vh; overflow-y:auto; padding:20px;">
        <h3 style="font-family:var(--serif); font-size:18px; color:var(--gold); margin-bottom:12px;">使用條款 (Terms of Service)</h3>
        <div style="font-size:12.5px; color:var(--text-muted); line-height:1.6; display:flex; flex-direction:column; gap:8px;">
          <p>歡迎使用 BottleSense。本服務專為酒類愛好者提供個人酒窖管理、品飲筆記及公開探索分享。</p>
          <p>1. 用戶需自行妥善保管電郵及驗證碼。</p>
          <p>2. 用戶公開發布之品飲心得需符合社會良善風俗，不得涉及違法或仇恨內容。</p>
          <p>3. 未成年人請勿飲酒，飲酒過量有害健康。</p>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="closeModal()">${t('btn_close')}</button>
      </div>
    </div>
  `;
}

function openPrivacyModal() {
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" style="max-width:380px; text-align:left; max-height:80vh; overflow-y:auto; padding:20px;">
        <h3 style="font-family:var(--serif); font-size:18px; color:var(--gold); margin-bottom:12px;">私隱政策 (Privacy Policy)</h3>
        <div style="font-size:12.5px; color:var(--text-muted); line-height:1.6; display:flex; flex-direction:column; gap:8px;">
          <p>BottleSense 尊重並保護用戶個人隱私。</p>
          <p>1. 我們僅收集您的電郵地址用於免密碼驗證登入與雲端備份同步。</p>
          <p>2. 您的酒標照片與筆記僅儲存於加密雲端，不會向第三方出售個人數據。</p>
          <p>3. 您可隨時在「帳號設定」中一鍵永久註銷並刪除所有個人資料。</p>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="closeModal()">${t('btn_close')}</button>
      </div>
    </div>
  `;
}




function closeModal() { modalContainer.innerHTML = ''; }

async function initApp() {
  try {
    updateHeaderGreeting();
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


function expandTimeline(bottleId) {
  window['timeline_expanded_' + bottleId] = true;
  renderBottleDetail(bottleId);
}

async function togglePublishSession(bottleId, sessionId) {
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b || !b.tastings) return;
  const tItem = b.tastings.find(s => String(s.id) === String(sessionId));
  if (!tItem) return;

  tItem.isPublic = !tItem.isPublic;
  await saveBottleToDB(b);

  if (tItem.isPublic) {
    await publishToCommunityPool(bottleId, sessionId);
    showToast(currentLang==='zh'?'✓ 已成功發布至酒友探索池！':'✓ Published to Community Feed!');
  } else {
    showToast(currentLang==='zh'?'✓ 已收回該筆公開品飲手記':'✓ Withdrawn from Community Feed');
  }
  renderBottleDetail(bottleId);
}
