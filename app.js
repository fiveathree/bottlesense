/* BottleSense app.js
 * 完整恢復 5 大藏酒空間、動態棚架主題、篩選列與安全滾動邊距
 */

const main = document.getElementById('main');
const modalContainer = document.getElementById('modal-container');
const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');

const TELEGRAM_PLANE_SVG = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
const EDIT_PENCIL_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const DIM_LABELS = { mv:"市場價值", ql:"品質", dv:"飲用價值", pv:"配餐價值", sv:"社交話題", gv:"送禮價值", cv:"收藏價值", sto:"保存價值" };
const ACTION_ICONS = { drink:"🥃", pair:"🍽️", share:"👥", gift:"🎁", collect:"💎", sell:"💰", store:"🌡️", keep:"💎" };

let currentView = 'home';
let currentScene = 'cooler'; // 'cooler' | 'wood' | 'bar' | 'wishlist' | 'favorite'
let activeFilter = 'all';

let isVisitorMode = false;
let visitorCellarData = null;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[c]));

const uid = () =>
  'btl-' +
  Date.now().toString(36) +
  '-' +
  Math.random().toString(36).slice(2,8);

function safeIdentification(b) {
  return b?.identification || {};
}

function bottleName(b) {
  const x = safeIdentification(b);
  return x.name || x.brand || x.productName || b?.name || '未辨識酒款';
}

function bottleCategory(b) {
  const x = safeIdentification(b);
  return x.category || b?.tags?.category || '酒類';
}

function bottleCountry(b) {
  const x = safeIdentification(b);
  return x.country || b?.tags?.country || '';
}

function bottleRegion(b) {
  const x = safeIdentification(b);
  return x.region || b?.tags?.region || '';
}

function bottleVintage(b) {
  const x = safeIdentification(b);
  return x.vintage || b?.tags?.vintage || '無年份';
}

function bottleImage(b) {
  return b?.image || b?.imageData || b?.photo || b?.imageUrl || '';
}

function categoryEmoji(c) {
  return ({
    '紅酒':'🍷',
    '白酒':'🥂',
    '威士忌':'🥃',
    '清酒':'🍶',
    '氣泡酒':'🥂',
    '啤酒':'🍺',
    '琴酒':'🍸',
    '蘭姆酒':'🥃',
    '白蘭地':'🥃',
    '泡盛':'🍶',
    '利口酒':'🍹'
  })[c] || '🍾';
}

function setActiveNav(id) {
  document.querySelectorAll('.navbtn').forEach(x => {
    x.classList.remove('active');
  });
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
  window.cellar = Array.isArray(window.cellar)
    ? window.cellar.map(normalizeBottle)
    : [];
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
        <h1>認識你的每一瓶酒</h1>
        <p>拍下酒標，AI 分析風味維度、最佳賞味期與處置決策。</p>
        <div class="scan-center-box">
          <button class="scan-btn" onclick="openCamera()" aria-label="拍照辨識">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/>
              <circle cx="12" cy="13" r="3.5"/>
            </svg>
          </button>
          <span class="upload-subtext" onclick="openGallery()">從相簿選照片</span>
        </div>
      </section>

      <div class="section-head">
        <h2>五大藏酒空間</h2>
        <a onclick="renderCellar()">打開酒櫃 →</a>
      </div>

      <div class="stat-grid-5">
        <div class="stat-card" onclick="openScene('cooler')">
          <div class="stat-num" style="color:var(--cyan-glow);">${s.cooler}</div>
          <div class="stat-label">⚡ 未飲</div>
        </div>
        <div class="stat-card" onclick="openScene('wood')">
          <div class="stat-num" style="color:#fbbf24;">${s.wood}</div>
          <div class="stat-label">🪵 已飲</div>
        </div>
        <div class="stat-card" onclick="openScene('bar')">
          <div class="stat-num" style="color:var(--gold);">${s.bar}</div>
          <div class="stat-label">🥃 飲完</div>
        </div>
        <div class="stat-card" onclick="openScene('wishlist')">
          <div class="stat-num" style="color:var(--purple-glow);">${s.wish}</div>
          <div class="stat-label">🏷️ 想買</div>
        </div>
        <div class="stat-card" onclick="openScene('favorite')">
          <div class="stat-num" style="color:var(--rose-glow);">${s.fav}</div>
          <div class="stat-label">⭐ 最愛</div>
        </div>
      </div>

      <div class="section-head">
        <h2>最近加入</h2>
        <a onclick="renderCellar()">查看全部 →</a>
      </div>
      <div>
        ${recentBottleHTML()}
      </div>
    </div>
  `;
}

function recentBottleHTML() {
  const list = (window.cellar || []).slice(0, 3);
  if (!list.length) {
    return `<div class="empty-shelf">酒櫃目前是空的<br>先拍一瓶酒標開始吧。</div>`;
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

  if (currentScene === 'cooler') { spaceList = coolerBottles; shelfTitle = '⚡ 電子恆溫酒櫃 (未飲)'; }
  else if (currentScene === 'wood') { spaceList = woodBottles; shelfTitle = '🪵 實木日常酒架 (已飲中)'; }
  else if (currentScene === 'bar') { spaceList = barBottles; shelfTitle = '🥃 吧台展示桌 (飲完紀念)'; }
  else if (currentScene === 'wishlist') { spaceList = wishBottles; shelfTitle = '🏷️ 願望清單 (想買)'; }
  else { spaceList = favBottles; shelfTitle = '⭐ 心頭好精選 (最愛)'; shelfKey = 'fav'; }

  // 動態分類篩選
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
        <h2>私人酒窖全景</h2>
        <button class="share-plane-btn" style="background:rgba(212,175,55,0.25);" onclick="shareEntireCellar()">
          ${TELEGRAM_PLANE_SVG}
          <span>分享全窖</span>
        </button>
      </div>

      <!-- 5 大空間切換 Tabs -->
      <div class="cellar-scene-tabs">
        <div class="scene-tab ${currentScene==='cooler'?'active-cooler':''}" onclick="switchScene('cooler')">
          <span class="scene-icon">⚡</span>
          <div class="scene-name">未飲</div>
          <div class="scene-count">${coolerBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='wood'?'active-wood':''}" onclick="switchScene('wood')">
          <span class="scene-icon">🪵</span>
          <div class="scene-name">已飲</div>
          <div class="scene-count">${woodBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='bar'?'active-bar':''}" onclick="switchScene('bar')">
          <span class="scene-icon">🥃</span>
          <div class="scene-name">飲完</div>
          <div class="scene-count">${barBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='wishlist'?'active-wish':''}" onclick="switchScene('wishlist')">
          <span class="scene-icon">🏷️</span>
          <div class="scene-name">想買</div>
          <div class="scene-count">${wishBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='favorite'?'active-fav':''}" onclick="switchScene('favorite')">
          <span class="scene-icon">⭐</span>
          <div class="scene-name">最愛</div>
          <div class="scene-count">${favBottles.length}</div>
        </div>
      </div>

      <!-- 動態篩選 Chip 列 -->
      ${filterOptions.length > 1 ? `
        <div class="filter-row">
          ${filterOptions.map(opt => `
            <div class="filter-chip ${activeFilter===opt?'active':''}" onclick="setShelfFilter('${esc(opt)}')">
              ${opt === 'all' ? '全部' : esc(opt)}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- 中間擬真棚架 -->
      <div class="shelf-container shelf-${shelfKey}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div style="font-family:var(--serif); font-size:14px; font-weight:600;">${shelfTitle}</div>
          <button class="share-plane-btn" onclick="shareCurrentShelf()">
            ${TELEGRAM_PLANE_SVG}
            <span>分享此架</span>
          </button>
        </div>

        <div class="shelf-beam"></div>
        <div>
          ${activeList.length ? activeList.map(bottleCardHTML).join('') : '<div class="empty-shelf">此空間暫無藏酒</div>'}
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
        <span>${b.isFavorite ? '取消' : '最愛'}</span>
      </div>
      <div class="swipe-action-right" onclick="deleteBottle('${esc(b.id)}')">
        <span class="swipe-action-icon">×</span>
        <span>刪除</span>
      </div>

      <article class="bottle-card" id="card-${esc(b.id)}">
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
            ${pourCount > 0 ? `<span class="tag-badge" style="background:rgba(56,189,248,0.15); color:var(--cyan-glow); border-color:rgba(56,189,248,0.3);">品飲 ×${pourCount}</span>` : ''}
            ${b.personalRating ? `<span class="tag-badge secondary">★ ${b.personalRating}/5</span>` : ''}
          </div>
        </div>
      </article>
    </div>
  `;
}

/* ---------------- 手勢與點擊防衝突 ---------------- */
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
        if (diffX > 40) card.style.transform = 'translateX(76px)';
        else if (diffX < -40) card.style.transform = 'translateX(-76px)';
        else card.style.transform = 'translateX(0px)';
      } else {
        renderBottleDetail(id);
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

/* ---------------- 酒款詳情頁 ---------------- */
function renderBottleDetail(id) {
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) { renderCellar(); return; }

  const x = safeIdentification(b);
  const img = bottleImage(b);
  const confidence = Number(x.conf ?? x.confidence ?? 0);
  const vm = b.scan?.vm || x.vm || {};
  const rec = b.scan?.rec || x.rec || {};

  const statuses = [
    { key:'unopened', label:'⚡ 未飲' },
    { key:'opened', label:'🪵 已飲' },
    { key:'finished', label:'🥃 飲完' },
    { key:'wishlist', label:'🏷️ 想買' }
  ];

  main.innerHTML = `
    <div class="view" style="padding-bottom: 60px;">
      <div class="back-row">
        <button class="btn btn-ghost" style="padding:7px 12px" onclick="${currentView === 'cellar' ? 'renderCellar()' : 'goHome()'}">
          ← 返回
        </button>
        <button class="share-plane-btn" onclick="shareSingleBottle('${esc(b.id)}')">
          ${TELEGRAM_PLANE_SVG}
          <span>分享此酒</span>
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

        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <div class="label-eyebrow" style="margin-bottom:0;">${esc(bottleCategory(b))}</div>
          <button class="edit-badge-btn" onclick="openEditBottleModal('${esc(b.id)}')">
            ${EDIT_PENCIL_SVG} 編輯資料
          </button>
        </div>

        <div class="label-name">${esc(bottleName(b))}</div>
        <div class="label-sub">${esc([bottleCountry(b), bottleRegion(b)].filter(Boolean).join(' · '))}</div>

        <div class="label-facts">
          <div><div class="fact-label">VINTAGE</div><div class="fact-value">${esc(bottleVintage(b))}</div></div>
          <div><div class="fact-label">CATEGORY</div><div class="fact-value">${esc(bottleCategory(b))}</div></div>
          <div><div class="fact-label">COUNTRY</div><div class="fact-value">${esc(bottleCountry(b) || '未知')}</div></div>
          <div><div class="fact-label">REGION</div><div class="fact-value">${esc(bottleRegion(b) || '未知')}</div></div>
        </div>
      </div>

      <div class="info-block">
        <h3>📍 轉移藏酒空間</h3>
        <div class="destination-grid">
          ${statuses.map(s => `
            <div class="dest-card" style="${b.status===s.key?'border-color:var(--gold); color:var(--gold);':''}" onclick="moveStatus('${esc(b.id)}','${s.key}')">
              <div class="title">${s.label}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 品飲歷史時間軸 -->
      <div class="info-block">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <h3>🥃 品飲記錄時間軸 (${(b.tastings || []).length})</h3>
          <button class="btn btn-primary" style="padding:5px 12px; font-size:11.5px;" onclick="openAddSessionModal('${esc(b.id)}')">
            ＋ 記錄這次品飲
          </button>
        </div>
        <div style="font-size:11px; color:var(--text-faint); margin-bottom:10px;">記錄不同時間、地點與同伴帶來的獨特體驗。</div>

        <div class="timeline-list">
          ${(b.tastings || []).length ? b.tastings.map((t, idx) => `
            <div class="timeline-card">
              <div class="timeline-header">
                <div>
                  <span class="timeline-time">#${idx+1} ·${esc(t.dateStr || t.date || '')}</span>
                  <div style="color:var(--gold); font-size:12px; margin-top:2px;">${'★'.repeat(t.rating || 5)}</div>
                </div>
                <button class="timeline-share-btn" onclick="shareSingleSession('${esc(b.id)}', '${esc(t.id)}')" title="分享這次品飲">
                  ${TELEGRAM_PLANE_SVG}
                </button>
              </div>
              <div class="timeline-meta">
                ${t.location ? `<span>📍 ${esc(t.location)}</span>` : ''}
                ${t.companions ? `<span>👥 同行：${esc(t.companions)}</span>` : ''}
              </div>
              ${t.notes ? `<div class="timeline-notes">"${esc(t.notes)}"</div>` : ''}
            </div>
          `).join('') : '<div style="font-size:12px; color:var(--text-faint); text-align:center; padding:16px 0;">尚未記錄品飲歷史，點擊上方按鈕記錄你的第一杯！</div>'}
        </div>
      </div>

      ${renderRadar(vm)}
      ${renderRecommendation(rec, b)}

      <div style="margin-top:20px;">
        <button class="btn btn-wine btn-block" onclick="deleteBottle('${esc(b.id)}')">從酒庫中移除</button>
      </div>
    </div>
  `;
}

function renderRadar(vm) {
  const order = ['mv','ql','dv','pv','sv','gv','cv','sto'];
  const vals = order.map(k => Number(vm?.[k] || 0));
  if (!vals.some(v => v > 0)) return '';

  const cx = 130, cy = 130, R = 95;
  const n = order.length;
  const points = order.map((k,i)=>{
    const angle = (Math.PI*2*i/n) - Math.PI/2;
    const val = Math.max(0, Math.min(100, vm[k] || 75));
    const r = (val/100) * R;
    return [cx + r*Math.cos(angle), cy + r*Math.sin(angle)];
  });
  const axisPoints = order.map((k,i)=>{
    const angle = (Math.PI*2*i/n) - Math.PI/2;
    return [cx + R*Math.cos(angle), cy + R*Math.sin(angle)];
  });

  const polygon = points.map(p=>p.join(',')).join(' ');
  const rings = [0.25,0.5,0.75,1].map(f=>{
    const ringPts = order.map((k,i)=>{
      const angle = (Math.PI*2*i/n) - Math.PI/2;
      return [cx + R*f*Math.cos(angle), cy + R*f*Math.sin(angle)].join(',');
    }).join(' ');
    return `<polygon points="${ringPts}" fill="none" stroke="#2E3224" stroke-width="1"/>`;
  }).join('');
  const axes = axisPoints.map(p=>`<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="#2E3224" stroke-width="1"/>`).join('');

  const legend = order.map(k=>`
    <div class="legend-row"><span class="dim">${DIM_LABELS[k]}</span><span class="val">${vm[k] ?? '75'}</span></div>
  `).join('');

  return `
    <div class="radar-wrap">
      <h3>Bottle Value Map</h3>
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
      <h3>專業處置建議</h3>
      <div class="rec-reason">${esc(rec.reason || '正值最佳適飲期，風味醇厚。')}</div>
      ${(rec.actions || [
        {a:"drink", reason:"現在正是最佳風味表現期"},
        {a:"share", reason:"適合與同好一同品嚐"},
        {a:"store", reason:"常溫避光存放即可"}
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

/* ---------------- 彈窗操作 ---------------- */
function openEditBottleModal(id) {
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="max-width:380px; text-align:left;" onclick="event.stopPropagation()">
        <div style="font-family:var(--serif); font-size:17px; font-weight:600; margin-bottom:12px; color:var(--gold);">
          ✏️ 修正酒款資訊
        </div>
        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint);">酒款名稱</div>
        <input type="text" id="edit-name" class="text-input" value="${esc(bottleName(b))}">

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:8px;">
          <div>
            <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint);">酒類別</div>
            <input type="text" id="edit-category" class="text-input" value="${esc(bottleCategory(b))}">
          </div>
          <div>
            <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint);">年份</div>
            <input type="text" id="edit-vintage" class="text-input" value="${esc(bottleVintage(b))}">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:8px;">
          <div>
            <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint);">國家</div>
            <input type="text" id="edit-country" class="text-input" value="${esc(bottleCountry(b))}">
          </div>
          <div>
            <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint);">產區</div>
            <input type="text" id="edit-region" class="text-input" value="${esc(bottleRegion(b))}">
          </div>
        </div>

        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost btn-block" onclick="closeModal()">取消</button>
          <button class="btn btn-primary btn-block" onclick="saveEditedBottle('${esc(b.id)}')">儲存</button>
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
      <div class="modal-card" style="max-width:380px; text-align:left;" onclick="event.stopPropagation()">
        <div style="font-family:var(--serif); font-size:17px; font-weight:600; margin-bottom:12px; color:var(--gold);">
          ＋ 記錄這次品飲時光
        </div>
        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint);">日期與時間</div>
        <input type="datetime-local" id="sess-date" class="text-input" value="${defaultIso}">

        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">地點 / 酒吧</div>
        <input type="text" id="sess-loc" class="text-input" placeholder="例如：尖沙咀 Whisky Bar / 屋企陽台">

        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">同飲同伴</div>
        <input type="text" id="sess-comp" class="text-input" placeholder="例如：好友相聚、獨酌深思">

        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">評分</div>
        <div class="star-row">
          ${[1,2,3,4,5].map(n => `<button class="star-btn filled" id="sess-star-${n}" onclick="setModalRating(${n})">★</button>`).join('')}
        </div>

        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">品飲感受與筆記</div>
        <textarea id="sess-notes" class="text-input" style="height:70px; resize:none;"></textarea>

        <div style="display:flex; gap:10px; margin-top:14px;">
          <button class="btn btn-ghost btn-block" onclick="closeModal()">取消</button>
          <button class="btn btn-primary btn-block" onclick="saveNewSession('${esc(bottleId)}')">儲存品飲</button>
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

/* ---------------- 分享機制 (全窖 / 單架 / 單酒 / 單次品飲) ---------------- */
async function syncPublishCellar() {
  const key = localStorage.getItem('bottlesense_sync_key');
  try {
    await fetch(`${WORKER_API_URL}/api/cellar/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncKey: key, cellar: window.cellar, ownerName: '品飲家' })
    });
  } catch(e) {}
}

async function shareEntireCellar() {
  if (!window.cellar.length) { alert("酒櫃暫無酒款！"); return; }
  await syncPublishCellar();
  const key = localStorage.getItem('bottlesense_sync_key');
  const shareUrl = `${location.origin}${location.pathname}?cellar=${encodeURIComponent(key)}`;
  const shareText = `🍾 歡迎參觀我的私人酒窖 (BottleSense)：\n內有 ${window.cellar.length} 款精選佳釀與真實品飲手記！\n${shareUrl}`;

  if (navigator.share) {
    try { await navigator.share({ title: '我的私人酒窖', text: shareText, url: shareUrl }); return; } catch(err){}
  }
  navigator.clipboard.writeText(shareUrl);
  alert("酒窖公開專屬連結已複製！");
}

async function shareCurrentShelf() {
  const key = localStorage.getItem('bottlesense_sync_key');
  const names = { cooler:'未飲電子酒櫃', wood:'已飲實木酒架', bar:'飲完吧台', wishlist:'想買願望清單', favorite:'心頭好最愛' };
  const shareUrl = `${location.origin}${location.pathname}?cellar=${encodeURIComponent(key)}&shelf=${currentScene}`;
  const shareText = `🍷 邀請你睇我嘅 BottleSense [${names[currentScene]||'酒架'}]：\n${shareUrl}`;

  if (navigator.share) {
    try { await navigator.share({ title: names[currentScene], text: shareText, url: shareUrl }); return; } catch(err){}
  }
  navigator.clipboard.writeText(shareUrl);
  alert("此酒架專屬連結已複製！");
}

async function shareSingleBottle(id) {
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;
  await syncPublishCellar();
  const key = localStorage.getItem('bottlesense_sync_key');
  const shareUrl = `${location.origin}${location.pathname}?cellar=${encodeURIComponent(key)}&bottle=${b.id}`;
  const shareText = `🍾 BottleSense 藏酒推薦：${bottleName(b)}\n${shareUrl}`;

  if (navigator.share) {
    try { await navigator.share({ title: bottleName(b), text: shareText, url: shareUrl }); return; } catch(err){}
  }
  navigator.clipboard.writeText(shareUrl);
  alert("這支酒的專屬連結已複製！");
}

async function shareSingleSession(bottleId, sessionId) {
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;
  const s = (b.tastings || []).find(t => String(t.id) === String(sessionId));
  if (!s) return;
  await syncPublishCellar();

  const key = localStorage.getItem('bottlesense_sync_key');
  const shareUrl = `${location.origin}${location.pathname}?cellar=${encodeURIComponent(key)}&bottle=${b.id}`;
  const shareText = `🥃 BottleSense 品飲手記\n酒款：${bottleName(b)}\n時間：${s.dateStr}\n評分：${'★'.repeat(s.rating||5)}\n心得：「${s.notes}」\n${shareUrl}`;

  if (navigator.share) {
    try { await navigator.share({ title: `${bottleName(b)} 品飲手記`, text: shareText, url: shareUrl }); return; } catch(err){}
  }
  navigator.clipboard.writeText(shareText);
  alert("已複製品飲手記連結至剪貼簿！");
}

/* ---------------- 探索與公開展示 ---------------- */
function renderExplore() {
  currentView = 'explore';
  setActiveNav('nav-explore');
  const s = statCounts();

  main.innerHTML = `
    <div class="view" style="padding-bottom: 50px;">
      <div class="section-head"><h2>探索酒窖</h2></div>
      <div class="info-block">
        <h3>酒窖統計</h3>
        <div class="storage-row"><span class="storage-tag">TOTAL</span><span class="storage-desc">${s.total} 瓶酒</span></div>
        <div class="storage-row"><span class="storage-tag">FAV</span><span class="storage-desc">${s.fav} 瓶收藏</span></div>
      </div>
      <div class="section-head"><h2>快速切換空間</h2></div>
      <div class="destination-grid">
        <div class="dest-card" onclick="openScene('cooler')"><span class="icon">⚡</span><span class="title">未飲櫃</span></div>
        <div class="dest-card" onclick="openScene('wood')"><span class="icon">🪵</span><span class="title">已飲架</span></div>
        <div class="dest-card" onclick="openScene('bar')"><span class="icon">🥃</span><span class="title">吧台</span></div>
        <div class="dest-card" onclick="openScene('wishlist')"><span class="icon">🏷️</span><span class="title">想買</span></div>
        <div class="dest-card" onclick="openScene('favorite')"><span class="icon">⭐</span><span class="title">最愛</span></div>
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

/* ---------------- 拍照與檔案處理 ---------------- */
function openCamera() { if (cameraInput) cameraInput.click(); }
function openGallery() { if (galleryInput) galleryInput.click(); }

if (cameraInput) cameraInput.addEventListener('change', e => handleImageFile(e.target.files?.[0]));
if (galleryInput) galleryInput.addEventListener('change', e => handleImageFile(e.target.files?.[0]));

async function handleImageFile(file) {
  if (!file) return;
  try {
    currentImageData = await resizeImage(file, 1600, 0.85);
    showScanLoading();
    const result = await identifyBottle(currentImageData.data, currentImageData.mediaType);

    const bottle = normalizeBottle({
      id: uid(),
      image: currentImageData.dataUrl,
      imageData: currentImageData.dataUrl,
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
    renderBottleDetail(bottle.id);
  } catch(err) {
    showError(err?.message || '辨識失敗，請再試一次。');
  } finally {
    if (cameraInput) cameraInput.value = '';
    if (galleryInput) galleryInput.value = '';
  }
}

function resizeImage(file, maxSize = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('無法讀取圖片'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('圖片格式不支援'));
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        const scale = Math.min(1, maxSize / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl, data: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function identifyBottle(image, mediaType) {
  const res = await fetch(`${WORKER_API_URL}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, mediaType })
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `AI 辨識錯誤 (${res.status})`);
  return data || {};
}

function showScanLoading() {
  main.innerHTML = `
    <div class="loading-view">
      <div class="loading-ring"></div>
      <h2 style="font-family:var(--serif); font-size:20px;">正在辨識酒標</h2>
      <p style="color:var(--text-muted); font-size:12px; margin-top:8px;">AI 正在分析酒款、年份及產區…</p>
    </div>
  `;
}

function showError(msg) {
  main.innerHTML = `
    <div class="loading-view">
      <div style="font-size:42px; margin-bottom:16px;">⚠️</div>
      <h2 style="font-family:var(--serif); font-size:20px;">出現問題</h2>
      <p style="color:var(--text-muted); font-size:12px; margin:10px 20px 20px;">${esc(msg)}</p>
      <button class="btn btn-primary" onclick="goHome()">返回首頁</button>
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
  if (!confirm('確定要從酒庫移除這瓶酒？')) return;
  const idx = (window.cellar || []).findIndex(x => String(x.id) === String(id));
  if (idx < 0) return;
  window.cellar.splice(idx, 1);
  await deleteBottleFromDB(id);
  if (currentView === 'cellar') renderCellar();
  else renderHome();
}

function renderSettings() {
  const key = localStorage.getItem('bottlesense_sync_key') || '';
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card">
        <h2 style="font-family:var(--serif); margin-bottom:10px;">設定</h2>
        <p style="font-size:11px; color:var(--text-muted); line-height:1.6;">你的專屬同步碼 (Sync Key)</p>
        <div class="text-input" style="text-align:center;">${esc(key)}</div>
        <button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="copySyncKey()">複製同步碼</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="closeModal()">關閉</button>
      </div>
    </div>
  `;
}

function copySyncKey() {
  const key = localStorage.getItem('bottlesense_sync_key') || '';
  if (navigator.clipboard) navigator.clipboard.writeText(key);
  alert('同步碼已複製');
}

function closeModal() { modalContainer.innerHTML = ''; }

async function initApp() {
  try {
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
