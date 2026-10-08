/* BottleSense app.js
 * 旗艦完整版：含城市天際線探索、分享到公開池、首支酒手遊引繼/註冊彈窗、多語言、HUD相機
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
    spaces_title: "五大藏酒空間",
    open_cellar: "打開酒櫃 →",
    recent_title: "最近加入",
    view_all: "查看全部 →",
    empty_cellar: "酒櫃目前是空的<br>先拍一瓶酒標開始吧。",
    space_cooler: "⚡ 未飲",
    space_wood: "🪵 已飲",
    space_bar: "🥃 飲完",
    space_wish: "🏷️ 想買",
    space_fav: "⭐ 最愛",
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
    explore_title: "都市夜色・酒友探索",
    explore_hint: "點擊天際線上的微光節點，看看同好在此刻分享的佳釀。",
    confirm_delete: "確定要從酒庫移除這瓶酒？"
  },
  en: {
    nav_scan: "Scan",
    nav_cellar: "Cellar",
    nav_explore: "Explore",
    hero_title: "Know What To Do With It",
    hero_desc: "Snap a label. Let AI analyze flavor profiles, peak window & drinking decisions.",
    choose_album: "Upload from Photos",
    spaces_title: "5 Cellar Spaces",
    open_cellar: "Open Cellar →",
    recent_title: "Recently Added",
    view_all: "View All →",
    empty_cellar: "Your cellar is empty.<br>Snap a bottle label to begin.",
    space_cooler: "⚡ Unopened",
    space_wood: "🪵 Opened",
    space_bar: "🥃 Finished",
    space_wish: "🏷️ Wishlist",
    space_fav: "⭐ Favorite",
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
    explore_title: "City Skyline & Community",
    explore_hint: "Tap on skyline glowing beacons to discover fellow tasters' shared bottles.",
    confirm_delete: "Are you sure you want to remove this bottle?"
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

      <div class="stat-grid-5">
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

/* ---------------- 6. 酒款詳情頁 (大字體排版) ---------------- */
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
        <!-- 2. 分享入口：引導私密分享或社群公開發布 -->
        <button class="share-plane-btn" onclick="openShareActionSheet('${esc(b.id)}')">
          ${TELEGRAM_PLANE_SVG}
          <span>${t('share_bottle')}</span>
        </button>
      </div>

      ${img ? `<div class="detail-photo-hero"><img src="${esc(img)}" alt=""></div>` : ''}

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

      <div class="info-block">
        <h3>${t('transfer_title')}</h3>
        <div class="destination-grid">
          ${statuses.map(s => `
            <div class="dest-card" style="${b.status===s.key?'border-color:var(--gold); color:var(--gold);':''}" onclick="moveStatus('${esc(b.id)}','${s.key}')">
              <div class="title">${s.label}</div>
            </div>
          `).join('')}
        </div>
      </div>

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

      ${renderRadar(vm)}
      ${renderRecommendation(rec)}

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

/* =======================================================================
   2. 釐清分享流程：私密好友分享 vs 探索池公開發布 (ActionSheet)
======================================================================= */
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
          <!-- 選項一：公開到社群探索池 -->
          <button class="btn btn-primary btn-block" onclick="publishToCommunityPool('${esc(b.id)}', '${esc(sessionId||'')}'); closeModal();">
            🌍 ${currentLang==='zh'?'發布到酒友公開探索池':'Publish to Community Feed'}
          </button>
          
          <!-- 選項二：手機/私密連結分享給好友 -->
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

// 發布到探索池 (寫入 Worker /api/explore/publish)
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
    location: s?.location || '城市角落',
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

// 私密好友分享 (原生選單或複製連結)
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
   1. 探索頁面 (城市天際線 Skyline Vector + 社群酒友公開池)
======================================================================= */
async function renderExplore() {
  currentView = 'explore';
  setActiveNav('nav-explore');

  main.innerHTML = `
    <div class="view" style="padding-bottom: 50px;">
      <div class="section-head"><h2>${t('explore_title')}</h2></div>

      <!-- 簡約城市輪廓天際線雷達 (City Skyline) -->
      <div class="skyline-radar-container">
        <svg class="skyline-svg" viewBox="0 0 600 220" preserveAspectRatio="none">
          <!-- 遠景淡色大樓輪廓 -->
          <polygon points="0,220 0,160 40,160 40,140 70,140 70,170 120,170 120,110 160,110 160,180 220,180 220,130 260,130 260,190 320,190 320,100 370,100 370,160 420,160 420,120 460,120 460,170 510,170 510,130 550,130 550,180 600,180 600,220" fill="rgba(212,175,55,0.06)" />
          <!-- 前景深色現代線條 -->
          <polygon points="0,220 0,180 30,180 30,150 60,150 60,185 90,185 90,130 110,130 110,90 130,70 150,90 150,190 200,190 200,140 240,140 240,195 290,195 290,115 330,115 330,200 380,200 380,120 410,120 410,180 470,180 470,85 500,85 500,190 560,190 560,150 600,150 600,220" fill="rgba(212,175,55,0.12)" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.3" />
        </svg>

        <!-- 天際線酒友光點 -->
        <div class="radar-points-layer" id="radarNodesLayer"></div>
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

  renderSkylineRadarFeed();
}

async function renderSkylineRadarFeed() {
  try {
    const res = await fetch(`${WORKER_API_URL}/api/explore`);
    const publicFeed = res.ok ? await res.json() : [];
    const feedEl = document.getElementById('explore-feed');
    const nodesLayer = document.getElementById('radarNodesLayer');
    if (!feedEl) return;

    if (!publicFeed.length) {
      feedEl.innerHTML = `<div class="empty-shelf">目前尚無公開分享記錄。點擊酒款右上角的紙飛機即可將品飲手記發布到此處！</div>`;
      return;
    }

    // 渲染天際線互動光點 (散落在城市高樓間)
    if (nodesLayer) {
      const positions = [
        {top: 45, left: 24}, {top: 35, left: 48}, {top: 55, left: 72}, {top: 38, left: 85}, {top: 60, left: 15}
      ];
      nodesLayer.innerHTML = publicFeed.slice(0, 5).map((b, i) => {
        const pos = positions[i] || {top: 50, left: 50};
        return `
          <div class="radar-node" style="top:${pos.top}%; left:${pos.left}%;" onclick="highlightFeedItem('${esc(b.id)}')">
            🍷
          </div>
        `;
      }).join('');
    }

    feedEl.innerHTML = publicFeed.map(b => `
      <div class="bottle-card" id="feed-card-${esc(b.id)}" style="margin-bottom:14px; transition: border-color 0.3s ease;">
        <div class="bottle-photo-box">${b.image ? `<img src="${esc(b.image)}">` : '🍷'}</div>
        <div class="bottle-info">
          <div class="bottle-name">${esc(b.identification?.name || '酒款')}</div>
          <div style="font-size:13px; color:var(--gold); margin-top:3px;">★ ${b.personalRating||5}/5 ・ ${esc(b.author||'品飲同好')}</div>
          <div style="font-size:14px; color:var(--text-muted); margin-top:5px;">"${esc(b.diary?.notes || '無額外筆記')}"</div>
          ${b.location ? `<div style="font-size:11px; color:var(--text-faint); margin-top:3px;">📍 ${esc(b.location)}</div>` : ''}
        </div>
      </div>
    `).join('');
  } catch(e) {
    const feedEl = document.getElementById('explore-feed');
    if (feedEl) feedEl.innerHTML = `<div class="empty-shelf">暫時無法載入酒友動態。</div>`;
  }
}

function highlightFeedItem(id) {
  const el = document.getElementById(`feed-card-${id}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.borderColor = 'var(--gold)';
    setTimeout(() => el.style.borderColor = 'rgba(255,255,255,0.08)', 2000);
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

// 確認裁切並觸發辨識
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

    // 3. 第一支酒成功存入後，觸發手遊式註冊/引繼提問
    if (isFirstBottle && !localStorage.getItem('bottlesense_registered')) {
      promptFirstBottleRegistration(bottle.id);
    } else {
      renderBottleDetail(bottle.id);
    }

  } catch(err) {
    showError(err?.message || (currentLang === 'zh' ? '辨識失敗，請確保酒標清晰後重試。' : 'Recognition failed. Please try again.'));
  }
}

/* =======================================================================
   3. 手遊式首酒註冊 / 帳號引繼提示機制 (Registration/Takeover Modal)
======================================================================= */
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

        <!-- 方案 A：快速綁定 -->
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:12px; padding:12px; margin-bottom:12px;">
          <div style="font-size:12px; font-weight:600; color:var(--gold); margin-bottom:6px;">方案 A：設定暱稱與備份密碼</div>
          <input type="text" id="reg-name" class="text-input" style="margin-top:0; padding:8px; font-size:13px;" placeholder="品飲家稱號 (姓名/暱稱)">
          <input type="password" id="reg-pass" class="text-input" style="padding:8px; font-size:13px;" placeholder="備用還原密碼 (非必填)">
          <button class="btn btn-primary btn-block" style="padding:9px; margin-top:10px; font-size:13px;" onclick="saveRegistrationProfile('${esc(bottleId)}')">
            立即綁定備份
          </button>
        </div>

        <!-- 方案 B：手遊引繼碼警示模式 -->
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

function renderSettings() {
  const key = localStorage.getItem('bottlesense_sync_key') || '';
  const owner = localStorage.getItem('bottlesense_owner_name') || '品飲同好';

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card">
        <h2 style="font-family:var(--serif); margin-bottom:10px; font-size:21px;">${t('settings_title')}</h2>
        
        <div style="font-size:13px; color:var(--text-muted); margin-bottom:10px;">目前暱稱: <strong style="color:var(--gold);">${esc(owner)}</strong></div>

        <p style="font-size:13px; color:var(--text-muted); line-height:1.6;">${t('sync_key_label')}</p>
        <div class="text-input" style="text-align:center; font-family:var(--mono); margin-top:8px;">${esc(key)}</div>
        <button id="btn-copy-sync" class="btn btn-primary btn-block" style="margin-top:16px;" onclick="copySyncKey()">${t('btn_copy_sync')}</button>
        <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="closeModal()">${t('btn_close')}</button>
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
