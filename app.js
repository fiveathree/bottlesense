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
  document.getElementById('langSwitchBtn').textContent = currentLang === 'zh' ? 'EN' : '繁';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.innerHTML = t(key);
  });
  if (currentView === 'home') renderHome();
  else if (currentView === 'cellar') renderCellar();
  else if (currentView === 'explore') renderExplore();
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
          `).join('') : `<div style="font-size:14px; color:var(--text-faint); text-align:center; padding:18px 0;">${t('no_logs')}</div>`}
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
const REAL_IMAGE_GEO_POINTS = {
  // 英國 / 蘇格蘭 (威士忌聖地)
  '蘇格蘭': { top: 22.5, left: 47.8 }, '英國': { top: 24.5, left: 47.8 }, 'Scotland': { top: 22.5, left: 47.8 }, 'UK': { top: 24.5, left: 47.8 },
  // 法國 (波爾多 / 香檳 / 勃艮第)
  '法國': { top: 28.5, left: 49.5 }, '波爾多': { top: 30.0, left: 48.8 }, '香檳': { top: 27.2, left: 49.8 }, '勃艮第': { top: 28.6, left: 50.2 }, 'France': { top: 28.5, left: 49.5 },
  // 義大利 / 西班牙
  '義大利': { top: 31.0, left: 52.2 }, '意大利': { top: 31.0, left: 52.2 }, '西班牙': { top: 32.5, left: 47.2 }, 'Italy': { top: 31.0, left: 52.2 }, 'Spain': { top: 32.5, left: 47.2 },
  // 日本 (余市 / 山崎 / 沖繩 / 東京)
  '日本': { top: 32.0, left: 83.5 }, '余市': { top: 27.5, left: 84.5 }, '北海道': { top: 27.5, left: 84.5 }, '山崎': { top: 33.0, left: 83.0 }, '沖繩': { top: 39.0, left: 80.5 }, 'Japan': { top: 32.0, left: 83.5 },
  // 台灣 / 香港 / 中國
  '台灣': { top: 40.5, left: 79.5 }, 'Taiwan': { top: 40.5, left: 79.5 }, '香港': { top: 41.2, left: 77.8 }, 'Hong Kong': { top: 41.2, left: 77.8 }, '中國': { top: 33.0, left: 73.0 },
  // 美國 (納帕 / 加州 / 肯塔基)
  '美國': { top: 31.0, left: 21.0 }, '加州': { top: 32.5, left: 16.5 }, '納帕': { top: 31.8, left: 16.5 }, 'USA': { top: 31.0, left: 21.0 },
  // 澳洲 / 紐西蘭
  '澳洲': { top: 72.0, left: 80.5 }, '澳大利亞': { top: 72.0, left: 80.5 }, '紐西蘭': { top: 81.5, left: 91.0 }, 'Australia': { top: 72.0, left: 80.5 }
};

let mapZoom = 1;
let mapPanX = 0, mapPanY = 0;

let currentExploreFeed = [];
let isRegionalMapActive = false;

async function renderExplore() {
  currentView = 'explore';
  setActiveNav('nav-explore');
  isRegionalMapActive = false;

  // 安全內嵌金線世界地圖 SVG（維持嚴格 2:1 比例，絕不拉長，結合 WebP 支援與金色向量陸地輪廓）
  const inlineGoldMapSVG = `
    <svg class="real-gold-map-img" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">
      <rect width="1000" height="500" fill="#000000"/>
      <!-- 背景 WebP 照片 (若存在即顯示真實光暈) -->
      <image href="world-map.webp" width="1000" height="500" preserveAspectRatio="xMidYMid meet" opacity="0.85" onerror="this.style.display=\'none\'"/>
      <!-- 細緻金線經緯網格 -->
      <g stroke="rgba(212,175,55,0.08)" stroke-width="0.8" stroke-dasharray="4,4">
        <line x1="0" y1="250" x2="1000" y2="250"/>
        <line x1="0" y1="125" x2="1000" y2="125"/>
        <line x1="0" y1="375" x2="1000" y2="375"/>
        <line x1="500" y1="0" x2="500" y2="500"/>
        <line x1="250" y1="0" x2="250" y2="500"/>
        <line x1="750" y1="0" x2="750" y2="500"/>
      </g>
      <!-- 高解析度金色陸地邊界輪廓 -->
      <g fill="rgba(212,175,55,0.06)" stroke="#D4AF37" stroke-width="1.4" stroke-linejoin="round">
        <!-- 北美洲 -->
        <path d="M75,55 Q110,40 150,45 Q190,30 240,42 T290,65 Q330,80 315,115 T280,145 Q265,160 250,195 T215,230 Q195,250 185,245 T170,215 Q150,190 120,180 T75,130 Q65,95 75,55 Z"/>
        <!-- 格陵蘭島 -->
        <path d="M335,30 Q370,25 390,45 T370,85 Q340,95 325,70 Z"/>
        <!-- 南美洲 -->
        <path d="M225,260 Q270,265 295,290 T350,335 Q365,370 335,420 T290,480 Q275,485 270,450 T260,370 Q240,320 220,290 Z"/>
        <!-- 歐洲 -->
        <path d="M465,65 Q500,45 520,70 T495,115 Q515,125 540,110 T565,140 Q530,165 495,165 T455,185 Q440,175 445,150 T465,120 Q445,95 465,65 Z"/>
        <!-- 英國與愛爾蘭 -->
        <path d="M440,110 Q455,105 450,130 T435,140 Q430,120 440,110 Z"/>
        <!-- 非洲 -->
        <path d="M455,195 Q520,190 560,225 T585,285 Q560,345 530,410 T495,435 Q465,385 450,320 T420,245 Q430,210 455,195 Z"/>
        <!-- 亞洲大陸 -->
        <path d="M565,75 Q680,50 820,55 T940,95 Q910,145 870,175 T815,225 Q785,275 745,280 T705,250 Q670,285 640,250 T605,200 Q565,185 565,140 Z"/>
        <!-- 日本列島 -->
        <path d="M860,150 Q875,165 865,185 T850,210 Q845,195 855,170 Z"/>
        <!-- 台灣島 -->
        <path d="M805,245 Q812,250 810,260 T802,255 Z"/>
        <!-- 大洋洲 (澳洲本土與紐西蘭) -->
        <path d="M780,335 Q860,315 905,340 T925,410 Q870,445 810,430 T760,375 Z"/>
        <path d="M935,420 Q950,430 940,455 T925,440 Z"/>
      </g>
    </svg>
  `;

  // 1. 探索：唔要上面所有地區tag (無地區tag，清爽優雅)
  // 2. 幅地圖唔要拉長，下面框縮返上去啲 (2:1 比例鎖定，間距大幅收斂)
  main.innerHTML = `
    <div class="view" style="padding-bottom: 50px;">
      <div class="section-head" style="margin-top:6px; margin-bottom:10px;">
        <h2>${t('explore_title')}</h2>
      </div>

      <!-- 真實金線世界地圖容器 (2:1 比例鎖定，杜絕拉長，支援平移縮放與產區轉換) -->
      <div class="world-radar-container" id="worldRadarBox">
        <div class="world-map-canvas-wrap" id="worldMapCanvasWrap">
          ${inlineGoldMapSVG}
          <!-- 釘選在實體地圖上的酒友/產區光點層 -->
          <div id="geoPinsContainer" style="position:absolute; inset:0; pointer-events:none;"></div>
        </div>

        <!-- 區域地圖視圖 (點擊酒款後即時轉換) -->
        <div class="regional-map-wrap" id="regionalMapView" style="display:none; opacity:0;"></div>

        <!-- 縮放與重設 HUD 控制項 -->
        <div class="map-controls-hud" id="worldMapHud">
          <button class="map-hud-btn" onclick="zoomWorldMap(1.25)">+</button>
          <button class="map-hud-btn" onclick="zoomWorldMap(0.8)">−</button>
          <button class="map-hud-btn" onclick="resetWorldMap()">↺</button>
        </div>
      </div>

      <!-- 下方提示與卡片框緊貼縮上去 -->
      <div style="font-size:11.5px; color:var(--text-faint); margin-top:4px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <span>💡 ${t('explore_hint')}</span>
        <span style="color:var(--gold-dim); font-size:11px;">${currentLang==='zh'?'點擊酒款直飛產區地圖':'Click wine to fly'}</span>
      </div>

      <div class="section-head" style="margin-top:2px; margin-bottom:8px;">
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

function initRealMapInteractions() {
  const container = document.getElementById('worldRadarBox');
  if (!container) return;

  // 滑鼠滾輪縮放 (PC)
  container.onwheel = (e) => {
    if (isRegionalMapActive) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    zoomWorldMap(factor);
  };

  let isDragging = false;
  let startX, startY;

  container.onmousedown = (e) => {
    if (isRegionalMapActive) return;
    if (e.target.closest('.map-hud-btn') || e.target.closest('.btn-back-world')) return;
    isDragging = true;
    startX = e.clientX - mapPanX;
    startY = e.clientY - mapPanY;
  };

  window.addEventListener('mousemove', (e) => {
    if (!isDragging || isRegionalMapActive) return;
    mapPanX = e.clientX - startX;
    mapPanY = e.clientY - startY;
    updateRealMapTransform();
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  // 移動端觸控雙指捏合縮放 (Pinch) 與單指拖曳平移
  let initialPinchDist = null;
  let initialPinchZoom = 1;

  container.ontouchstart = (e) => {
    if (isRegionalMapActive) return;
    if (e.target.closest('.map-hud-btn') || e.target.closest('.btn-back-world')) return;
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
    if (isRegionalMapActive) return;
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

function zoomWorldMap(factor) {
  if (isRegionalMapActive) return;
  mapZoom = Math.min(Math.max(mapZoom * factor, 0.7), 4.5);
  updateRealMapTransform();
}

function resetWorldMap() {
  mapZoom = 1;
  mapPanX = 0;
  mapPanY = 0;
  const wrap = document.getElementById('worldMapCanvasWrap');
  if (wrap) wrap.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
  updateRealMapTransform();
}

function updateRealMapTransform() {
  const wrap = document.getElementById('worldMapCanvasWrap');
  if (wrap) {
    wrap.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`;
  }
}

function resolveRealImagePinPos(country, region) {
  if (region && REAL_IMAGE_GEO_POINTS[region]) return REAL_IMAGE_GEO_POINTS[region];
  if (country && REAL_IMAGE_GEO_POINTS[country]) return REAL_IMAGE_GEO_POINTS[country];
  for (const k in REAL_IMAGE_GEO_POINTS) {
    if (region && region.includes(k)) return REAL_IMAGE_GEO_POINTS[k];
    if (country && country.includes(k)) return REAL_IMAGE_GEO_POINTS[k];
  }
  const fallbackList = [
    { top: 28.5, left: 49.5 }, // 法國
    { top: 22.5, left: 47.8 }, // 蘇格蘭
    { top: 32.0, left: 83.5 }, // 日本
    { top: 31.0, left: 21.0 }, // 美國
    { top: 40.5, left: 79.5 }, // 台灣
    { top: 72.0, left: 80.5 }  // 澳洲
  ];
  return fallbackList[Math.floor(Math.random() * fallbackList.length)];
}

async function renderRealWorldPinsAndFeed() {
  try {
    let publicFeed = [];
    try {
      const res = await fetch(`${WORKER_API_URL}/api/explore`);
      if (res.ok) publicFeed = await res.json();
    } catch(e) {}

    // 如果後端暫無公開記錄，載入高品質多產區範例，確保即時可體驗飛航與區域地圖轉換
    if (!publicFeed || !publicFeed.length) {
      publicFeed = [
        {
          id: 'demo-1',
          author: 'Alex (品飲家)',
          personalRating: 5,
          image: '',
          identification: { name: 'Château Margaux Premier Grand Cru Classé', country: '法國', region: '波爾多', vintage: '2015' },
          diary: { notes: '紫羅蘭花香撲鼻，單寧極度絲滑，完美的瑪歌典型風格。' }
        },
        {
          id: 'demo-2',
          author: 'Ken (威士忌狂)',
          personalRating: 5,
          image: '',
          identification: { name: 'Macallan 18 Years Double Cask', country: '蘇格蘭', region: '斯貝賽', vintage: '2021' },
          diary: { notes: '豐富的雪莉乾果香與生薑肉桂辛香，尾韻悠長溫暖。' }
        },
        {
          id: 'demo-3',
          author: 'Yuki (日本酒造)',
          personalRating: 5,
          image: '',
          identification: { name: '獺祭 磨き二割三分 純米大吟釀', country: '日本', region: '山崎', vintage: '2023' },
          diary: { notes: '精米步合23%，哈密瓜蜜香細膩奔放，入口如泉水般純淨。' }
        },
        {
          id: 'demo-4',
          author: 'David (Napa Explorer)',
          personalRating: 4.8,
          image: '',
          identification: { name: 'Opus One Napa Valley Red Wine', country: '美國', region: '納帕', vintage: '2019' },
          diary: { notes: '黑醋栗與黑莓果醬濃郁，烤橡木與摩卡咖啡香氣層次極深。' }
        },
        {
          id: 'demo-5',
          author: 'Evelyn (台灣威士忌俱樂部)',
          personalRating: 4.9,
          image: '',
          identification: { name: 'Kavalan Solist Vinho Barrique Cask', country: '台灣', region: '台灣', vintage: '2022' },
          diary: { notes: '熱帶水果炸裂，哈密瓜、芒果與胡桃巧克力的極致原酒風味。' }
        }
      ];
    }

    currentExploreFeed = publicFeed;
    const feedEl = document.getElementById('explore-feed');
    const pinsLayer = document.getElementById('geoPinsContainer');
    if (!feedEl) return;

    if (pinsLayer) {
      pinsLayer.innerHTML = publicFeed.slice(0, 10).map((b) => {
        const country = bottleCountry(b);
        const region = bottleRegion(b);
        const pos = resolveRealImagePinPos(country, region);
        return `
          <div class="geo-pin-node" style="top:${pos.top}%; left:${pos.left}%; pointer-events:auto;" onclick="flyToBottleRegion('${esc(b.id)}'); highlightFeedItem('${esc(b.id)}');" title="${esc(bottleName(b))}">
            🍷
          </div>
        `;
      }).join('');
    }

    // 3. 點擊支酒時即走係世界地圖飛去該地，然後馬上轉換成該地地圖
    feedEl.innerHTML = publicFeed.map(b => {
      const c = bottleCountry(b);
      const r = bottleRegion(b);
      return `
        <div class="bottle-card feed-clickable" id="feed-card-${esc(b.id)}" onclick="flyToBottleRegion('${esc(b.id)}')" style="margin-bottom:10px; transition: border-color 0.3s ease, transform 0.2s ease;">
          <div class="bottle-photo-box">${b.image ? `<img src="${esc(b.image)}">` : '🍷'}</div>
          <div class="bottle-info">
            <div class="bottle-name">${esc(bottleName(b))}</div>
            <div style="font-size:12.5px; color:var(--gold); margin-top:2px;">★ ${b.personalRating||5}/5 ・ ${esc(b.author||'品飲同好')}</div>
            <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">"${esc(b.diary?.notes || '無額外筆記')}"</div>
            <div style="font-size:11.5px; color:var(--gold-dim); margin-top:4px; display:flex; align-items:center; justify-content:space-between;">
              <span>📍 ${esc(c)} ${esc(r || b.location || '')}</span>
              <span style="font-size:11px; color:var(--cyan-glow); display:flex; align-items:center; gap:2px;">✈️ 直飛產區</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch(e) {
    const feedEl = document.getElementById('explore-feed');
    if (feedEl) feedEl.innerHTML = `<div class="empty-shelf">暫時無法載入酒友動態。</div>`;
  }
}

function highlightFeedItem(id) {
  document.querySelectorAll('.bottle-card.feed-highlight').forEach(el => el.classList.remove('feed-highlight'));
  const el = document.getElementById(`feed-card-${id}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.classList.add('feed-highlight');
    setTimeout(() => el.classList.remove('feed-highlight'), 3000);
  }
}

// 核心功能：點擊酒款 ➔ 世界地圖飛航聚焦 ➔ 即時轉換為專屬產區地圖
function flyToBottleRegion(bottleId) {
  const b = currentExploreFeed.find(x => String(x.id) === String(bottleId)) ||
            (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;

  const country = bottleCountry(b);
  const region = bottleRegion(b);
  const pos = resolveRealImagePinPos(country, region);

  const box = document.getElementById('worldRadarBox');
  if (box) {
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  highlightFeedItem(b.id);

  const wrap = document.getElementById('worldMapCanvasWrap');
  if (!wrap || !box) return;

  if (isRegionalMapActive) {
    showRegionalMap(country, region, b);
    return;
  }

  // 1. 世界地圖平滑飛往座標
  const targetZoom = 3.6;
  const w = box.clientWidth || 580;
  const h = box.clientHeight || 290;
  const targetPanX = ((50 - pos.left) / 100) * w * targetZoom;
  const targetPanY = ((50 - pos.top) / 100) * h * targetZoom;

  wrap.style.transition = 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)';
  mapZoom = targetZoom;
  mapPanX = targetPanX;
  mapPanY = targetPanY;
  wrap.style.transform = `translate(${targetPanX}px, ${targetPanY}px) scale(${targetZoom})`;

  // 2. 飛抵後馬上轉換成該地專屬產區地圖
  setTimeout(() => {
    showRegionalMap(country, region, b);
  }, 550);
}

function showRegionalMap(country, region, b) {
  isRegionalMapActive = true;
  const regView = document.getElementById('regionalMapView');
  const wrap = document.getElementById('worldMapCanvasWrap');
  const hud = document.getElementById('worldMapHud');
  if (!regView || !wrap) return;

  const svgContent = getRegionalMapSVG(country, region, b);
  const regionLabel = getRegionalHeaderLabel(country, region);

  regView.innerHTML = `
    <button class="btn-back-world" onclick="exitRegionalMap()">
      <span>←</span>
      <span>${currentLang==='zh'?'返回世界地圖':'World Map'}</span>
    </button>
    <div class="region-header-badge">${regionLabel}</div>
    ${svgContent}
    <div class="region-bottle-pill">
      🍷 ${esc(bottleName(b))} ${bottleVintage(b)!=='無年份'?'('+esc(bottleVintage(b))+')':''} ・ ${esc(region||country)}
    </div>
  `;

  wrap.style.opacity = '0';
  wrap.style.pointerEvents = 'none';
  if (hud) hud.style.display = 'none';

  regView.style.display = 'flex';
  void regView.offsetWidth;
  regView.style.opacity = '1';
}

function exitRegionalMap() {
  isRegionalMapActive = false;
  const regView = document.getElementById('regionalMapView');
  const wrap = document.getElementById('worldMapCanvasWrap');
  const hud = document.getElementById('worldMapHud');
  if (!regView || !wrap) return;

  regView.style.opacity = '0';
  setTimeout(() => {
    regView.style.display = 'none';
    regView.innerHTML = '';
    wrap.style.display = 'block';
    wrap.style.opacity = '1';
    wrap.style.pointerEvents = 'auto';
    if (hud) hud.style.display = 'flex';
    resetWorldMap();
  }, 300);
}

function getRegionalHeaderLabel(country, region) {
  const c = country || '';
  const r = region || '';
  if (c.includes('法') || r.includes('波爾多') || r.includes('香檳') || r.includes('勃艮第') || c.toLowerCase().includes('france')) {
    return '🇫🇷 法國・' + (r || '波爾多產區');
  }
  if (c.includes('英') || c.includes('蘇格蘭') || r.includes('斯貝賽') || r.includes('艾雷') || c.toLowerCase().includes('scotland')) {
    return '🇬🇧 蘇格蘭・' + (r || '斯貝賽產區');
  }
  if (c.includes('日') || r.includes('山崎') || r.includes('余市') || c.toLowerCase().includes('japan')) {
    return '🇯🇵 日本・' + (r || '關西與北海道');
  }
  if (c.includes('美') || r.includes('納帕') || r.includes('加州') || c.toLowerCase().includes('usa')) {
    return '🇺🇸 美國・' + (r || '加州納帕山谷');
  }
  if (c.includes('台') || c.includes('臺灣') || r.includes('宜蘭') || r.includes('南投')) {
    return '🇹🇼 台灣・' + (r || '宜蘭與南投');
  }
  return '🌍 ' + c + (r ? '・' + r : ' 產區');
}

function getRegionalMapSVG(country, region, bottle) {
  const c = country || '';
  const r = region || '';

  // 1. 法國・波爾多 / 香檳 / 勃艮第
  if (c.includes('法') || r.includes('波爾多') || r.includes('香檳') || r.includes('勃艮第') || c.toLowerCase().includes('france')) {
    return `
      <svg viewBox="0 0 600 300" class="regional-map-svg" preserveAspectRatio="xMidYMid meet">
        <rect width="600" height="300" fill="#060704"/>
        <g stroke="rgba(212,175,55,0.06)" stroke-dasharray="3,3">
          <line x1="0" y1="150" x2="600" y2="150"/>
          <line x1="300" y1="0" x2="300" y2="300"/>
        </g>
        <!-- 法國整體邊界輪廓（低調金色） -->
        <path d="M110,40 Q180,20 250,30 T320,60 Q380,80 390,140 T360,220 Q320,260 260,280 T160,260 Q110,210 100,150 T110,40 Z" fill="rgba(212,175,55,0.03)" stroke="rgba(212,175,55,0.3)" stroke-width="1.2" stroke-dasharray="4,2"/>
        <!-- 吉倫特河口與加龍河、多爾多涅河 -->
        <path d="M140,110 Q170,125 200,140 Q225,148 250,155 Q280,165 310,185" fill="none" stroke="rgba(56,189,248,0.45)" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M225,148 Q250,140 280,135 Q310,132 340,138" fill="none" stroke="rgba(56,189,248,0.35)" stroke-width="2" stroke-linecap="round"/>
        <!-- 波爾多左岸 (Médoc) -->
        <path d="M165,115 Q190,130 185,150 Q160,145 155,125 Z" fill="rgba(212,175,55,0.2)" stroke="#D4AF37" stroke-width="1.2"/>
        <text x="140" y="142" fill="#D4AF37" font-size="10.5" font-family="monospace" font-weight="bold">左岸 Médoc</text>
        <!-- 波爾多右岸 (Saint-Émilion) -->
        <path d="M255,130 Q285,125 290,145 Q265,155 245,145 Z" fill="rgba(212,175,55,0.2)" stroke="#D4AF37" stroke-width="1.2"/>
        <text x="260" y="125" fill="#D4AF37" font-size="10.5" font-family="monospace" font-weight="bold">右岸 St-Émilion</text>
        <!-- 格拉夫與索甸 -->
        <path d="M205,160 Q235,170 230,195 Q195,185 200,165 Z" fill="rgba(212,175,55,0.15)" stroke="#D4AF37" stroke-width="1"/>
        <text x="210" y="190" fill="#D4AF37" font-size="9.5" font-family="monospace">格拉夫 Graves</text>
        <!-- 香檳區 -->
        <circle cx="280" cy="70" r="14" fill="rgba(212,175,55,0.12)" stroke="var(--gold-dim)" stroke-width="1"/>
        <text x="260" y="52" fill="#A3A290" font-size="9.5" font-family="monospace">香檳 Champagne</text>
        <!-- 勃艮第 -->
        <ellipse cx="320" cy="115" rx="12" ry="20" fill="rgba(212,175,55,0.12)" stroke="var(--gold-dim)" stroke-width="1"/>
        <text x="336" y="118" fill="#A3A290" font-size="9.5" font-family="monospace">勃艮第 Bourgogne</text>
        <!-- 目標產區動態光暈 Pin -->
        <g transform="translate(195, 142)">
          <circle cx="0" cy="0" r="18" fill="none" stroke="#D4AF37" stroke-width="1.5" class="radar-ring"/>
          <circle cx="0" cy="0" r="7" fill="#D4AF37"/>
          <text x="0" y="4" text-anchor="middle" font-size="11">🍷</text>
        </g>
      </svg>
    `;
  }

  // 2. 蘇格蘭・斯貝賽與高地
  if (c.includes('英') || c.includes('蘇格蘭') || r.includes('斯貝賽') || r.includes('艾雷') || c.toLowerCase().includes('scotland')) {
    return `
      <svg viewBox="0 0 600 300" class="regional-map-svg" preserveAspectRatio="xMidYMid meet">
        <rect width="600" height="300" fill="#060704"/>
        <g stroke="rgba(212,175,55,0.06)" stroke-dasharray="3,3">
          <line x1="0" y1="150" x2="600" y2="150"/>
          <line x1="300" y1="0" x2="300" y2="300"/>
        </g>
        <!-- 蘇格蘭本土地圖邊界 -->
        <path d="M220,30 Q270,20 310,40 T380,80 Q410,120 390,160 T350,220 Q310,270 260,280 T210,240 Q170,200 180,150 T200,90 Z" fill="rgba(212,175,55,0.04)" stroke="rgba(212,175,55,0.35)" stroke-width="1.4"/>
        <!-- 斯貝河與斯貝賽 -->
        <path d="M310,75 Q340,95 330,120" fill="none" stroke="rgba(56,189,248,0.5)" stroke-width="2"/>
        <path d="M305,70 Q345,75 350,105 T315,115 Z" fill="rgba(212,175,55,0.22)" stroke="#D4AF37" stroke-width="1.2"/>
        <text x="345" y="85" fill="#D4AF37" font-size="11" font-weight="bold" font-family="monospace">斯貝賽 Speyside</text>
        <text x="235" y="110" fill="#A3A290" font-size="10" font-family="monospace">高地區 Highlands</text>
        <!-- 艾雷島 -->
        <ellipse cx="170" cy="195" rx="14" ry="10" fill="rgba(212,175,55,0.2)" stroke="#D4AF37" stroke-width="1.2"/>
        <text x="120" y="200" fill="#D4AF37" font-size="10" font-family="monospace">艾雷島 Islay</text>
        <text x="260" y="240" fill="#A3A290" font-size="10" font-family="monospace">低地區 Lowlands</text>
        <!-- 目標釘選點 (斯貝賽 / 麥卡倫) -->
        <g transform="translate(325, 90)">
          <circle cx="0" cy="0" r="18" fill="none" stroke="#D4AF37" stroke-width="1.5" class="radar-ring"/>
          <circle cx="0" cy="0" r="7" fill="#D4AF37"/>
          <text x="0" y="4" text-anchor="middle" font-size="11">🥃</text>
        </g>
      </svg>
    `;
  }

  // 3. 日本・山崎 / 余市 / 關西與北海道
  if (c.includes('日') || r.includes('山崎') || r.includes('余市') || c.toLowerCase().includes('japan')) {
    return `
      <svg viewBox="0 0 600 300" class="regional-map-svg" preserveAspectRatio="xMidYMid meet">
        <rect width="600" height="300" fill="#060704"/>
        <g stroke="rgba(212,175,55,0.06)" stroke-dasharray="3,3">
          <line x1="0" y1="150" x2="600" y2="150"/>
          <line x1="300" y1="0" x2="300" y2="300"/>
        </g>
        <!-- 北海道島嶼 -->
        <path d="M380,40 Q430,30 460,50 T440,90 Q400,105 370,80 Z" fill="rgba(212,175,55,0.06)" stroke="rgba(212,175,55,0.35)" stroke-width="1.2"/>
        <circle cx="395" cy="65" r="4" fill="#D4AF37"/>
        <text x="410" y="70" fill="#D4AF37" font-size="10" font-family="monospace">余市 Yoichi</text>
        <!-- 本州島與關西山崎 -->
        <path d="M360,100 Q330,130 300,160 T230,195 Q180,210 160,200 T210,180 Q270,140 330,105 Z" fill="rgba(212,175,55,0.08)" stroke="rgba(212,175,55,0.4)" stroke-width="1.4"/>
        <circle cx="260" cy="180" r="5" fill="#D4AF37"/>
        <text x="270" y="175" fill="#D4AF37" font-size="11" font-weight="bold" font-family="monospace">山崎 Yamazaki</text>
        <circle cx="310" cy="150" r="4" fill="#D4AF37"/>
        <text x="320" y="150" fill="#A3A290" font-size="10" font-family="monospace">白州 Hakushu</text>
        <!-- 九州與沖繩 -->
        <path d="M150,215 Q130,230 140,250 T165,240 Z" fill="rgba(212,175,55,0.05)" stroke="rgba(212,175,55,0.3)" stroke-width="1"/>
        <text x="95" y="240" fill="#A3A290" font-size="9.5" font-family="monospace">九州・沖繩</text>
        <!-- 目標釘選點 -->
        <g transform="translate(260, 180)">
          <circle cx="0" cy="0" r="18" fill="none" stroke="#D4AF37" stroke-width="1.5" class="radar-ring"/>
          <circle cx="0" cy="0" r="7" fill="#D4AF37"/>
          <text x="0" y="4" text-anchor="middle" font-size="11">🍶</text>
        </g>
      </svg>
    `;
  }

  // 4. 美國・加州納帕山谷
  if (c.includes('美') || r.includes('納帕') || r.includes('加州') || c.toLowerCase().includes('usa')) {
    return `
      <svg viewBox="0 0 600 300" class="regional-map-svg" preserveAspectRatio="xMidYMid meet">
        <rect width="600" height="300" fill="#060704"/>
        <g stroke="rgba(212,175,55,0.06)" stroke-dasharray="3,3">
          <line x1="0" y1="150" x2="600" y2="150"/>
          <line x1="300" y1="0" x2="300" y2="300"/>
        </g>
        <path d="M140,40 Q180,100 220,180 T260,280" fill="none" stroke="rgba(212,175,55,0.25)" stroke-width="1.2" stroke-dasharray="4,2"/>
        <!-- 納帕河與山谷 AVA 輪廓 -->
        <path d="M280,50 Q305,100 330,160 T360,240" fill="none" stroke="rgba(56,189,248,0.5)" stroke-width="2.2"/>
        <path d="M260,60 Q300,50 320,80 T350,170 Q370,230 340,250 T280,210 Q250,140 260,60 Z" fill="rgba(212,175,55,0.08)" stroke="#D4AF37" stroke-width="1.2"/>
        <text x="245" y="80" fill="#A3A290" font-size="9.5" font-family="monospace">卡利斯托加 Calistoga</text>
        <text x="265" y="115" fill="#A3A290" font-size="9.5" font-family="monospace">聖海倫娜 St. Helena</text>
        <text x="290" y="150" fill="#D4AF37" font-size="11" font-weight="bold" font-family="monospace">奧克維爾 Oakville</text>
        <text x="310" y="185" fill="#A3A290" font-size="9.5" font-family="monospace">鹿躍區 Stags Leap</text>
        <text x="330" y="225" fill="#A3A290" font-size="9.5" font-family="monospace">卡內羅斯 Carneros</text>
        <g transform="translate(290, 150)">
          <circle cx="0" cy="0" r="18" fill="none" stroke="#D4AF37" stroke-width="1.5" class="radar-ring"/>
          <circle cx="0" cy="0" r="7" fill="#D4AF37"/>
          <text x="0" y="4" text-anchor="middle" font-size="11">🍷</text>
        </g>
      </svg>
    `;
  }

  // 5. 台灣・宜蘭與南投
  if (c.includes('台') || c.includes('臺灣') || r.includes('宜蘭') || r.includes('南投')) {
    return `
      <svg viewBox="0 0 600 300" class="regional-map-svg" preserveAspectRatio="xMidYMid meet">
        <rect width="600" height="300" fill="#060704"/>
        <g stroke="rgba(212,175,55,0.06)" stroke-dasharray="3,3">
          <line x1="0" y1="150" x2="600" y2="150"/>
          <line x1="300" y1="0" x2="300" y2="300"/>
        </g>
        <path d="M280,45 Q310,55 330,85 T320,160 Q300,220 280,265 T255,255 Q235,180 240,110 T280,45 Z" fill="rgba(212,175,55,0.08)" stroke="#D4AF37" stroke-width="1.4"/>
        <path d="M285,75 Q295,120 290,170 T275,230" fill="none" stroke="rgba(212,175,55,0.3)" stroke-width="1" stroke-dasharray="2,2"/>
        <circle cx="315" cy="85" r="4.5" fill="#D4AF37"/>
        <text x="325" y="85" fill="#D4AF37" font-size="10.5" font-weight="bold" font-family="monospace">宜蘭・噶瑪蘭 (Kavalan)</text>
        <circle cx="275" cy="145" r="4" fill="#D4AF37"/>
        <text x="200" y="145" fill="#D4AF37" font-size="10" font-family="monospace">南投・Omar</text>
        <g transform="translate(315, 85)">
          <circle cx="0" cy="0" r="18" fill="none" stroke="#D4AF37" stroke-width="1.5" class="radar-ring"/>
          <circle cx="0" cy="0" r="7" fill="#D4AF37"/>
          <text x="0" y="4" text-anchor="middle" font-size="11">🥃</text>
        </g>
      </svg>
    `;
  }

  // 6. 通用產區地圖 (義大利/西班牙/澳洲/其他名釀產區)
  return `
    <svg viewBox="0 0 600 300" class="regional-map-svg" preserveAspectRatio="xMidYMid meet">
      <rect width="600" height="300" fill="#060704"/>
      <g stroke="rgba(212,175,55,0.08)" stroke-width="1">
        <circle cx="300" cy="150" r="100" fill="none" stroke-dasharray="4,4"/>
        <circle cx="300" cy="150" r="60" fill="none"/>
        <circle cx="300" cy="150" r="25" fill="none"/>
        <line x1="160" y1="150" x2="440" y2="150"/>
        <line x1="300" y1="20" x2="300" y2="280"/>
      </g>
      <!-- 風土等高線 -->
      <path d="M220,130 Q260,110 300,120 T380,140" fill="none" stroke="rgba(212,175,55,0.25)" stroke-width="1.2"/>
      <path d="M200,160 Q250,180 300,170 T390,155" fill="none" stroke="rgba(212,175,55,0.25)" stroke-width="1.2"/>
      <!-- 風土標記 -->
      <text x="300" y="90" text-anchor="middle" fill="#D4AF37" font-size="13" font-family="monospace" font-weight="bold">${esc(c)} ・ ${esc(r||'名釀微氣候')}</text>
      <text x="300" y="225" text-anchor="middle" fill="#A3A290" font-size="10.5" font-family="monospace">TERROIR APPELLATION GRID</text>
      <g transform="translate(300, 150)">
        <circle cx="0" cy="0" r="22" fill="none" stroke="#D4AF37" stroke-width="1.8" class="radar-ring"/>
        <circle cx="0" cy="0" r="8" fill="#D4AF37"/>
        <text x="0" y="4" text-anchor="middle" font-size="12">🍷</text>
      </g>
    </svg>
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
    const cropImg = document.getElementById('cropTargetImage');
    cropImg.src = e.target.result;
    openCropModal();
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

async function confirmCropAndScan() {
  const cropImg = document.getElementById('cropTargetImage');
  closeCropModal();
  showScanLoading();

  try {
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

/* ---------------- 手遊式首酒註冊 / 帳號引繼提示機制 ---------------- */
function promptFirstBottleRegistration(bottleId) {
  const syncKey = localStorage.getItem('bottlesense_sync_key') || '';

  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="text-align:left;" onclick="event.stopPropagation()">
        <div style="font-family:var(--serif); font-size:20px; font-weight:700; color:var(--gold); margin-bottom:10px;">
          🎉 成功收納第一瓶酒！
        </div>

        <p style="font-size:13.5px; color:var(--text); line-height:1.6; margin-bottom:14px;">
          為防止未來更換手機或清除瀏覽器快取時藏酒遺失，建議立即綁定身分，或將你的專屬引繼碼妥善備份：
        </p>

        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:12px; padding:12px; margin-bottom:12px;">
          <div style="font-size:12px; font-weight:600; color:var(--gold); margin-bottom:6px;">方案 A：設定暱稱與備份密碼</div>
          <input type="text" id="reg-name" class="text-input" style="margin-top:0; padding:8px; font-size:13px;" placeholder="品飲家稱號 (姓名/暱稱)">
          <input type="password" id="reg-pass" class="text-input" style="padding:8px; font-size:13px;" placeholder="備用還原密碼 (非必填)">
          <button class="btn btn-primary btn-block" style="padding:9px; margin-top:10px; font-size:13px;" onclick="saveRegistrationProfile('${esc(bottleId)}')">
            立即綁定備份
          </button>
        </div>

        <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:12px; padding:12px; margin-bottom:14px;">
          <div style="font-size:11.5px; color:#f87171; font-weight:600; margin-bottom:4px;">⚠️ 略過綁定警示：</div>
          <div style="font-size:11px; color:var(--text-muted); line-height:1.5;">
            若不設定帳號，請務必<strong>截圖保存下方專屬同步代碼</strong>，遺失將無法救回資料！
          </div>
          <div style="font-family:var(--mono); font-size:13px; color:var(--gold); font-weight:700; margin-top:6px; user-select:all;">
            ${esc(syncKey)}
          </div>
        </div>

        <button class="btn btn-ghost btn-block" style="font-size:13px;" onclick="skipRegistration('${esc(bottleId)}')">
          我已記下專屬碼，以遊客身分繼續
        </button>
      </div>
    </div>
  `;
}

function saveRegistrationProfile(bottleId) {
  const name = document.getElementById('reg-name').value.trim() || '品飲同好';
  localStorage.setItem('bottlesense_owner_name', name);
  localStorage.setItem('bottlesense_registered', 'true');
  syncPublishCellarAsync();
  closeModal();
  showToast("✓ 帳號資料已成功登記！");
  renderBottleDetail(bottleId);
}

function skipRegistration(bottleId) {
  localStorage.setItem('bottlesense_registered', 'skipped');
  closeModal();
  renderBottleDetail(bottleId);
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
function renderSettings() {
  const key = localStorage.getItem('bottlesense_sync_key') || '';
  const owner = localStorage.getItem('bottlesense_owner_name') || '品飲同好';

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" style="max-width:340px; padding:22px 20px;">
        <h2 style="font-family:var(--serif); margin-bottom:12px; font-size:20px; text-align:center;">${t('settings_title')}</h2>
        
        <div style="font-size:13px; color:var(--text-muted); margin-bottom:14px; text-align:center;">
          ${currentLang==='zh'?'目前暱稱':'Nickname'}: <strong style="color:var(--gold);">${esc(owner)}</strong>
        </div>

        <div style="font-size:12.5px; color:var(--text-muted); margin-bottom:6px;">${t('sync_key_label')}</div>
        <div class="text-input" style="text-align:center; font-family:var(--mono); font-size:14px; letter-spacing:0.5px; padding:10px;">${esc(key)}</div>
        
        <button id="btn-copy-sync" class="btn btn-primary btn-block" style="margin-top:14px;" onclick="copySyncKey()">${t('btn_copy_sync')}</button>
        
        <!-- 安裝教學：四個字唔做掣，優雅文字放係關閉按鈕上方 -->
        <div class="install-guide-link" onclick="openInstallGuideModal()" style="text-align:center; margin-top:18px; margin-bottom:10px; font-size:13.5px; color:var(--gold); cursor:pointer; text-decoration:underline; font-weight:500;">
          ${currentLang==='zh' ? '安裝教學' : 'Install Guide'}
        </div>

        <button class="btn btn-ghost btn-block" onclick="closeModal()">${t('btn_close')}</button>
      </div>
    </div>
  `;
}

function openInstallGuideModal() {
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" style="max-width:360px; padding:24px 20px;">
        <h2 style="font-family:var(--serif); margin-bottom:14px; font-size:20px; text-align:center; color:var(--gold);">
          ${currentLang==='zh'?'安裝教學 (PWA)':'PWA Install Guide'}
        </h2>
        
        <div style="display:flex; flex-direction:column; gap:12px; font-size:13px; color:var(--text); line-height:1.6;">
          <div style="background:var(--surface-2); padding:12px 14px; border-radius:12px; border:1px solid var(--line);">
            <div style="font-weight:700; color:var(--gold); margin-bottom:4px;">🍎 iOS (Safari)</div>
            <div>點擊下方「<strong style="color:var(--text);">分享</strong>」圖示 <span style="font-size:14px;">⎋</span> ➔ 往下滑選擇「<strong style="color:var(--text);">加入主畫面</strong>」即完成。</div>
          </div>

          <div style="background:var(--surface-2); padding:12px 14px; border-radius:12px; border:1px solid var(--line);">
            <div style="font-weight:700; color:var(--gold); margin-bottom:4px;">🤖 Android (Chrome)</div>
            <div>點擊右上角「<strong style="color:var(--text);">⋮</strong>」選單 ➔ 選擇「<strong style="color:var(--text);">安裝應用程式</strong>」或「新增至主螢幕」。</div>
          </div>

          <div style="background:var(--surface-2); padding:12px 14px; border-radius:12px; border:1px solid var(--line);">
            <div style="font-weight:700; color:var(--gold); margin-bottom:4px;">💻 電腦版 (Chrome / Edge / Safari)</div>
            <div>點擊網址列右側出現的「<strong style="color:var(--text);">⊕ 安裝</strong>」圖示即可擁有原生桌面體驗。</div>
          </div>
        </div>

        <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="renderSettings()">${currentLang==='zh'?'返回設定':'Back'}</button>
      </div>
    </div>
  `;
}

function copySyncKey() {
  const key = localStorage.getItem('bottlesense_sync_key') || '';
  const btn = document.getElementById('btn-copy-sync');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(key).then(() => {
      if (btn) btn.textContent = '✓ ' + (currentLang==='zh'?'已複製到剪貼簿！':'Copied!');
      showToast(t('copied_toast'));
    }).catch(() => fallbackCopyText(key, btn));
  } else {
    fallbackCopyText(key, btn);
  }
}

function fallbackCopyText(text, btn) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    if (btn) btn.textContent = '✓ ' + (currentLang==='zh'?'已複製！':'Copied!');
    showToast(t('copied_toast'));
  } catch (err) {}
  document.body.removeChild(ta);
}

function closeModal() { modalContainer.innerHTML = ''; }

async function initApp() {
  try {
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
