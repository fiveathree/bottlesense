/* BottleSense app.js
 * 旗艦完整版：含向量世界地圖釘選與自由平移拖曳、首頁隨機抽酒6格、Know Your Bottle排版優化、單行極致收窄轉移列
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
    explore_title: "世界名釀・酒友足跡",
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
    explore_title: "World Terroir & Community Radar",
    explore_hint: "Terroir origins and pours are pinned. Pan and zoom around the globe!",
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

/* ---------------- 3. 首頁湊齊 6 格 (加隨機抽酒) ---------------- */
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

      <!-- 6 格工整排列 -->
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
        <!-- 第 6 格：隨機抽酒欣賞 -->
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
            <div class="bottle-name">${esc(bottleName(b))}</div>${b.isFavorite ? '<span class="fav-star-badge">★</span>' : ''}
          </div>
          <div class="bottle-sub">${esc(safeIdentification(b).producer \vert{}\vert{} '')}${vintage ? ' · ' + esc(vintage) : ''}</div>
          <div class="tag-cluster">
            <span class="tag-badge">${esc(cat)}</span>${region ? `<span class="tag-badge secondary">${esc(region)}</span>` : ''}
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

/* ---------------- 4. Know your bottle: 酒款介紹拉高，處置建議置頂，轉移與時間軸移後 ---------------- */
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

      <!-- 核心身分卡片 (拉高最先閱讀) -->
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
            ${EDIT_PENCIL_SVG}${t('edit_info')}
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

      <!-- 八維價值地圖雷達圖 (Know your bottle 核心) -->
      ${renderRadar(vm)}

      <!-- 專業處置建議 (移至上方，先知點做) -->
      ${renderRecommendation(rec)}

      <!-- 5. 轉移藏酒空間 (一行過極致收窄) -->
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

      <!-- 品飲歷史時間軸 (移至處置建議下方) -->
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
        ${rings}${axes}
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
      <div class="rec-reason">${esc(rec.reason \vert{}\vert{} '')}</div>${(rec.actions || [
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
      <div class="
