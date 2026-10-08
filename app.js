// app.js - 完整支援專屬分享路由、動態篩選、原生時間選擇與酒款編輯
const TELEGRAM_PLANE_SVG = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
const EDIT_PENCIL_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const DIM_LABELS = { mv:"市場價值", ql:"品質", dv:"飲用價值", pv:"配餐價值", sv:"社交話題", gv:"送禮價值", cv:"收藏價值", sto:"保存價值" };
const ACTION_ICONS = { drink:"🥃", pair:"🍽️", share:"👥", gift:"🎁", collect:"💎", sell:"💰", store:"🌡️", keep:"💎" };

window.cellar = [];
let currentScan = null;
let currentScene = 'cooler';
let activeFilter = 'all';

// 訪客展示狀態
let isVisitorMode = false;
let visitorCellarData = null;

function setActiveNav(id){
  document.querySelectorAll('.navbtn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById(id);
  if(el) el.classList.add('active');
}

function goHome(){ 
  if(isVisitorMode) exitVisitorMode();
  setActiveNav('nav-home'); 
  renderHome(); 
}

/* ---------------- 1. 訪客專屬 URL 路由解析 ---------------- */
async function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const sharedKey = params.get('cellar');
  const sharedShelf = params.get('shelf');
  const sharedBottleId = params.get('bottle');

  if (sharedKey) {
    isVisitorMode = true;
    document.getElementById('main').innerHTML = `
      <div class="view loading-view">
        <div class="loading-ring"></div>
        <div style="font-size:13px; color:var(--gold);">正在連線酒友私人酒窖...</div>
      </div>
    `;
    try {
      const res = await fetch(`${WORKER_API_URL}/api/cellar/get?key=${encodeURIComponent(sharedKey)}`);
      if(!res.ok) throw new Error("Not found");
      visitorCellarData = await res.json();
      
      if(sharedBottleId) {
        // 直接開啟該支酒專屬訪客頁面
        renderVisitorBottleDetail(sharedBottleId);
      } else {
        if(sharedShelf) currentScene = sharedShelf;
        renderVisitorShowroom();
      }
    } catch(e) {
      alert("找不到該分享或連結已失效");
      exitVisitorMode();
    }
  } else {
    goHome();
  }
}

function exitVisitorMode(){
  isVisitorMode = false;
  visitorCellarData = null;
  window.history.replaceState({}, '', window.location.pathname);
  goHome();
}

/* ---------------- 首頁 ---------------- */
function renderHome(){
  setActiveNav('nav-home');
  const countCooler = window.cellar.filter(b => b.status === 'unopened').length;
  const countWood = window.cellar.filter(b => b.status === 'opened').length;
  const countBar = window.cellar.filter(b => ['finished','gifted','sold'].includes(b.status)).length;
  const countWish = window.cellar.filter(b => b.status === 'wishlist').length;
  const countFav = window.cellar.filter(b => b.isFavorite).length;

  document.getElementById('main').innerHTML = `
    <div class="view">
      <div class="scan-hero">
        <h1>影一張酒標，<br>知道下一步應該點做</h1>
        <p>AI 視覺分析風味建議，記錄每次與同伴品飲的美好時光。</p>
        <div class="scan-center-box">
          <button class="scan-btn" onclick="document.getElementById('cameraInput').click()" aria-label="Take Photo">
            <svg viewBox="0 0 24 24" fill="none" stroke="#191A11" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
          <div class="upload-subtext" onclick="document.getElementById('galleryInput').click()">從相簿上傳</div>
        </div>
      </div>

      <div class="section-head">
        <h2>我的藏酒空間</h2>
        <a onclick="renderCellar()">打開酒櫃 →</a>
      </div>
      <div class="stat-grid-5">
        <div class="stat-card" onclick="openScene('cooler')"><div class="stat-num" style="color:var(--cyan-glow);">${countCooler}</div><div class="stat-label">⚡ 未飲</div></div>
        <div class="stat-card" onclick="openScene('wood')"><div class="stat-num" style="color:#fbbf24;">${countWood}</div><div class="stat-label">🪵 已飲</div></div>
        <div class="stat-card" onclick="openScene('bar')"><div class="stat-num" style="color:var(--gold);">${countBar}</div><div class="stat-label">🥃 飲完</div></div>
        <div class="stat-card" onclick="openScene('wishlist')"><div class="stat-num" style="color:var(--purple-glow);">${countWish}</div><div class="stat-label">🏷️ 想買</div></div>
        <div class="stat-card" onclick="openScene('favorite')"><div class="stat-num" style="color:var(--rose-glow);">${countFav}</div><div class="stat-label">⭐ 最愛</div></div>
      </div>
    </div>
  `;
}

function openScene(scene){
  currentScene = scene;
  activeFilter = 'all';
  renderCellar();
}

/* ---------------- 酒窖主頁面 ---------------- */
function renderCellar(){
  setActiveNav('nav-cellar');
  const coolerBottles = window.cellar.filter(b => b.status === 'unopened');
  const woodBottles = window.cellar.filter(b => b.status === 'opened');
  const barBottles = window.cellar.filter(b => ['finished','gifted','sold'].includes(b.status));
  const wishBottles = window.cellar.filter(b => b.status === 'wishlist');
  const favBottles = window.cellar.filter(b => b.isFavorite);

  let spaceList = [];
  let shelfTitle = '';
  let shelfKey = currentScene;

  if (currentScene === 'cooler') { spaceList = coolerBottles; shelfTitle = '⚡ 電子恆溫酒櫃 (未飲)'; }
  else if (currentScene === 'wood') { spaceList = woodBottles; shelfTitle = '🪵 實木日常酒架 (已飲中)'; }
  else if (currentScene === 'bar') { spaceList = barBottles; shelfTitle = '🥃 吧台展示桌 (飲完紀念)'; }
  else if (currentScene === 'wishlist') { spaceList = wishBottles; shelfTitle = '🏷️ 願望清單 (想買)'; }
  else { spaceList = favBottles; shelfTitle = '⭐ 心頭好精選 (最愛)'; shelfKey = 'fav'; }

  // 取得當前架上所有分類與產區標籤
  const filterSet = new Set();
  spaceList.forEach(b => {
    if (b.tags?.category) filterSet.add(b.tags.category);
    if (b.tags?.region && b.tags.region !== '未知產區') filterSet.add(b.tags.region);
    if (b.tags?.vintage && b.tags.vintage !== '無年份') filterSet.add(b.tags.vintage);
  });
  const filterOptions = ['all', ...Array.from(filterSet)];

  // 安全篩選邏輯：如果揀咗 'all'，100% 顯示所有藏酒
  const activeList = (activeFilter === 'all')
    ? spaceList
    : spaceList.filter(b => {
        const cat = b.tags?.category || '';
        const reg = b.tags?.region || '';
        const vin = b.tags?.vintage || '';
        return cat === activeFilter || reg === activeFilter || vin === activeFilter;
      });

  document.getElementById('main').innerHTML = `
    <div class="view">
      <div class="section-head" style="margin-top:8px;">
        <h2>私人酒窖全景</h2>
        <button class="share-plane-btn" style="background:rgba(212,175,55,0.25);" onclick="shareEntireCellar()">
          ${TELEGRAM_PLANE_SVG}
          <span>分享全窖</span>
        </button>
      </div>

      <!-- 5 大空間切換 Tabs -->
      <div class="cellar-scene-tabs">
        <div class="scene-tab ${currentScene==='cooler'?'active-cooler':''}" onclick="switchScene('cooler')"><span class="scene-icon">⚡</span><div class="scene-name">未飲</div><div class="scene-count">${coolerBottles.length}</div></div>
        <div class="scene-tab ${currentScene==='wood'?'active-wood':''}" onclick="switchScene('wood')"><span class="scene-icon">🪵</span><div class="scene-name">已飲</div><div class="scene-count">${woodBottles.length}</div></div>
        <div class="scene-tab ${currentScene==='bar'?'active-bar':''}" onclick="switchScene('bar')"><span class="scene-icon">🥃</span><div class="scene-name">飲完</div><div class="scene-count">${barBottles.length}</div></div>
        <div class="scene-tab ${currentScene==='wishlist'?'active-wish':''}" onclick="switchScene('wishlist')"><span class="scene-icon">🏷️</span><div class="scene-name">想買</div><div class="scene-count">${wishBottles.length}</div></div>
        <div class="scene-tab ${currentScene==='favorite'?'active-fav':''}" onclick="switchScene('favorite')"><span class="scene-icon">⭐</span><div class="scene-name">最愛</div><div class="scene-count">${favBottles.length}</div></div>
      </div>

      <!-- 只要有超過 1 個分類選項即出 Filter Bar -->
      ${filterOptions.length > 1 ? `
        <div class="filter-row">
          ${filterOptions.map(opt => `
            <div class="filter-chip ${activeFilter===opt?'active':''}" onclick="setShelfFilter('${opt}')">
              ${opt === 'all' ? '全部' : escapeHtml(opt)}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- 中間酒架主格容器 -->
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
          ${activeList.length ? activeList.map(b => bottleCardHtml(b)).join('') : '<div class="empty-shelf">此空間暫無藏酒</div>'}
        </div>
        <div class="shelf-beam"></div>
      </div>
    </div>
  `;

  attachSwipeListeners();
}

function switchScene(scene){
  currentScene = scene;
  activeFilter = 'all';
  renderCellar();
}

function setShelfFilter(f){
  activeFilter = f;
  renderCellar();
}

function bottleCardHtml(b){
  const idf = b.identification || {};
  const tags = b.tags || {};
  const pourCount = (b.tastings || []).length;

  return `
    <div class="swipe-item-wrapper" id="wrap-${b.id}">
      <div class="swipe-action-left" onclick="confirmToggleFavorite('${b.id}')">
        <span class="swipe-action-icon">${b.isFavorite ? '★' : '☆'}</span>
        <span>${b.isFavorite ? '取消' : '最愛'}</span>
      </div>
      <div class="swipe-action-right" onclick="confirmDeleteBottle('${b.id}')">
        <span class="swipe-action-icon">✕</span>
        <span>移除</span>
      </div>
      <div class="bottle-card" id="card-${b.id}">
        <div class="bottle-photo-box">${b.image ? `<img src="${b.image}">` : `<div class="emoji-fallback">🍷</div>`}</div>
        <div class="bottle-info">
          <div style="display:flex; align-items:center;">
            <div class="bottle-name">${escapeHtml(idf.name || '酒款')}</div>
            ${b.isFavorite ? `<span class="fav-star-badge">★</span>` : ''}
          </div>
          <div class="bottle-sub">${escapeHtml(idf.producer || '')} · ${escapeHtml(tags.vintage || '')}</div>
          <div class="tag-cluster">
            <span class="tag-badge">${escapeHtml(tags.category || '酒類')}</span>
            ${tags.region ? `<span class="tag-badge secondary">${escapeHtml(tags.region)}</span>` : ''}
            ${pourCount > 0 ? `<span class="tag-badge" style="background:rgba(56,189,248,0.15); color:var(--cyan-glow); border-color:rgba(56,189,248,0.3);">品飲 ×${pourCount}</span>` : ''}
            ${b.personalRating ? `<span class="tag-badge secondary">★ ${b.personalRating}/5</span>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function attachSwipeListeners(){
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
      if(!isDragging) return;
      const touch = e.touches ? e.touches[0] : e;
      currentX = touch.clientX;
      const diffX = currentX - startX;
      const diffY = touch.clientY - startY;

      if(Math.abs(diffY) > Math.abs(diffX) && !hasMoved) {
        isDragging = false;
        return;
      }
      if(Math.abs(diffX) > 10) hasMoved = true;
      if (hasMoved && diffX > -100 && diffX < 100) card.style.transform = `translateX(${diffX}px)`;
    };

    const onEnd = () => {
      if(!isDragging) return;
      isDragging = false;
      card.style.transition = 'transform 0.25s ease';
      const diffX = currentX - startX;

      if (hasMoved) {
        if (diffX > 40) card.style.transform = 'translateX(76px)';
        else if (diffX < -40) card.style.transform = 'translateX(-76px)';
        else card.style.transform = 'translateX(0px)';
      } else {
        renderDetail(id);
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

function confirmToggleFavorite(id){
  const b = window.cellar.find(x => x.id === id);
  if(!b) return;
  const isFav = !!b.isFavorite;
  showModal({
    title: isFav ? '取消最愛？' : '加入最愛？',
    desc: `是否變更「${b.identification?.name || '此酒款'}」的最愛狀態？`,
    confirmText: isFav ? '確認取消' : '加入最愛',
    confirmColor: 'var(--gold)',
    onConfirm: async () => {
      b.isFavorite = !isFav;
      await saveBottleToDB(b);
      closeModal();
      renderCellar();
    }
  });
}

function confirmDeleteBottle(id){
  const b = window.cellar.find(x => x.id === id);
  if(!b) return;
  showModal({
    title: '確定移除此酒？',
    desc: `將「${b.identification?.name || '此酒款'}」從酒庫中移除。`,
    confirmText: '確定移除',
    confirmColor: 'var(--wine-bright)',
    onConfirm: async () => {
      window.cellar = window.cellar.filter(x => x.id !== id);
      await deleteBottleFromDB(id);
      closeModal();
      renderCellar();
    }
  });
}

function showModal({ title, desc, confirmText, confirmColor, onConfirm }){
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" onclick="event.stopPropagation()">
        <div style="font-family:var(--serif); font-size:17px; font-weight:600; margin-bottom:8px;">${title}</div>
        <div style="font-size:12.5px; color:var(--text-muted); line-height:1.5; margin-bottom:18px;">${desc}</div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-ghost btn-block" onclick="closeModal()">取消</button>
          <button class="btn btn-block" style="background:${confirmColor}; color:#111;" id="modal-confirm-btn">${confirmText}</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-confirm-btn').onclick = onConfirm;
}

function closeModal(){ document.getElementById('modal-container').innerHTML = ''; }

/* ---------------- 詳情頁（含 5. 編輯掣 與 品飲歷史） ---------------- */
function renderDetail(id){
  const b = window.cellar.find(x => x.id === id);
  if(!b) return;

  const idf = b.identification || {};
  const r = b.scan || {};
  const vm = r.vm || {};
  const rec = r.rec || {};
  const tier = (idf.conf >= 80) ? {cls:'seal-high', label:'high'} : (idf.conf >= 55 ? {cls:'seal-medium', label:'medium'} : {cls:'seal-low', label:'low'});
  
  if(!b.tastings) b.tastings = [];

  const statuses = [
    { key:'unopened', label:'⚡ 未飲' },
    { key:'opened', label:'🪵 已飲' },
    { key:'finished', label:'🥃 飲完' },
    { key:'wishlist', label:'🏷️ 想買' }
  ];

  document.getElementById('main').innerHTML = `
    <div class="view">
      <div class="back-row">
        <span onclick="renderCellar()" style="cursor:pointer;">← 返回酒庫</span>
        <button class="share-plane-btn" onclick="shareSingleBottle('${b.id}')">${TELEGRAM_PLANE_SVG}<span>分享此酒</span></button>
      </div>

      <div class="detail-photo-hero">${b.image ? `<img src="${b.image}">` : '🍷'}</div>

      <!-- 標籤與身分卡（附帶 5. 小 Edit 掣） -->
      <div class="label-card">
        <div class="confidence-seal ${tier.cls}"><div class="seal-pct">${idf.conf ?? '95'}%</div><div class="seal-label">${tier.label}</div></div>
        
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <div class="label-eyebrow" style="margin-bottom:0;">${escapeHtml(b.tags?.category || idf.category || '酒款')}</div>
          <!-- 5. 編輯資料按鈕 -->
          <button class="edit-badge-btn" onclick="openEditBottleModal('${b.id}')">
            ${EDIT_PENCIL_SVG} 編輯資料
          </button>
        </div>

        <div class="label-name">${escapeHtml(idf.name || idf.producer || '酒款')}</div>
        <div class="label-sub">${escapeHtml(idf.producer || '')}${idf.region ? ' · ' + escapeHtml(idf.region) : ''}</div>
        
        <div class="label-facts">
          <div><div class="fact-label">Vintage / 年份</div><div class="fact-value">${escapeHtml(b.tags?.vintage || idf.vintage || '—')}</div></div>
          <div><div class="fact-label">ABV / 酒精</div><div class="fact-value">${escapeHtml(idf.abv || '—')}</div></div>
          <div><div class="fact-label">Volume / 容量</div><div class="fact-value">${escapeHtml(idf.vol || '—')}</div></div>
          <div><div class="fact-label">Origin / 產區</div><div class="fact-value">${escapeHtml([b.tags?.country, b.tags?.region].filter(Boolean).join(' ') || idf.region || '—')}</div></div>
        </div>
      </div>

      <div class="info-block">
        <h3>📍 轉移藏酒空間</h3>
        <div class="destination-grid">
          ${statuses.map(s => `
            <div class="dest-card" style="${b.status===s.key?'border-color:var(--gold); color:var(--gold);':''}" onclick="moveStatus('${b.id}','${s.key}')">
              <div class="title">${s.label}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 品飲歷史時間軸 -->
      <div class="info-block">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <h3>🥃 品飲記錄時間軸 (${b.tastings.length})</h3>
          <button class="btn btn-primary" style="padding:5px 12px; font-size:11.5px;" onclick="openAddSessionModal('${b.id}')">
            ＋ 記錄這次品飲
          </button>
        </div>
        <div style="font-size:11px; color:var(--text-faint); margin-bottom:10px;">記錄不同時間、地點與同伴帶來的獨特體驗。</div>

        <div class="timeline-list">
          ${b.tastings.length ? b.tastings.map((t, idx) => `
            <div class="timeline-card">
              <div class="timeline-header">
                <div>
                  <span class="timeline-time">#${idx+1} ·${escapeHtml(t.dateStr)}</span>
                  <div style="color:var(--gold); font-size:12px; margin-top:2px;">${'★'.repeat(t.rating || 5)}</div>
                </div>
                <button class="timeline-share-btn" onclick="shareSingleSession('${b.id}', '${t.id}')" title="分享這次品飲">
                  ${TELEGRAM_PLANE_SVG}
                </button>
              </div>
              <div class="timeline-meta">
                ${t.location ? `<span>📍 ${escapeHtml(t.location)}</span>` : ''}
                ${t.companions ? `<span>👥 同行：${escapeHtml(t.companions)}</span>` : ''}
              </div>
              ${t.notes ? `<div class="timeline-notes">"${escapeHtml(t.notes)}"</div>` : ''}
            </div>
          `).join('') : '<div style="font-size:12px; color:var(--text-faint); text-align:center; padding:16px 0;">尚未記錄任何品飲歷史。點擊上方按鈕記錄你的第一杯！</div>'}
        </div>
      </div>

      ${renderRadar(vm)}

      <div class="rec-card">
        <h3>專業處置建議</h3>
        <div class="rec-reason">${escapeHtml(rec.reason || '正值最佳適飲期，風味醇厚。')}</div>
        ${(rec.actions || [
          {a:"drink", reason:"現在正是最佳風味表現期"},
          {a:"share", reason:"適合與同好一同品嚐"},
          {a:"store", reason:"常溫避光存放即可"}
        ]).map((a,i)=>`
          <div class="action-item">
            <div class="action-rank">${['🥇','🥈','🥉'][i]||(i+1)}</div>
            <div class="action-icon">${ACTION_ICONS[a.a]||'🍷'}</div>
            <div class="action-body">
              <div class="action-title">${escapeHtml(a.a||'')}</div>
              <div class="action-reason">${escapeHtml(a.reason||'')}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="info-block">
        <h3>🌡️ 保存建議</h3>
        <div class="storage-row"><div class="storage-tag">Unopened</div><div class="storage-desc">${escapeHtml((r.storage||{}).unopened || '陰涼避光保存')}</div></div>
        <div class="storage-row"><div class="storage-tag">Opened</div><div class="storage-desc">${escapeHtml((r.storage||{}).opened || '開瓶後一年內飲畢')}</div></div>
      </div>

      <div class="info-block">
        <h3>🍽️ 搭配食物推薦</h3>
        ${(r.pairing || ["牛扒", "煙燻三文魚", "陳年芝士"]).map(p=>`<span class="pairing-pill">${escapeHtml(p)}</span>`).join('')}
      </div>

      <button class="btn btn-wine btn-block" style="margin-top:20px;" onclick="confirmDeleteBottle('${b.id}')">從酒庫中移除</button>
    </div>
  `;
}

/* ---------------- 5. 編輯酒款資訊彈窗 (Edit Bottle Modal) ---------------- */
function openEditBottleModal(id){
  const b = window.cellar.find(x => x.id === id);
  if(!b) return;
  const idf = b.identification || {};
  const tags = b.tags || {};

  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="max-width:380px; text-align:left;" onclick="event.stopPropagation()">
        <div style="font-family:var(--serif); font-size:17px; font-weight:600; margin-bottom:12px; color:var(--gold);">
          ✏️ 修正酒款資訊
        </div>

        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint);">酒款名稱</div>
        <input type="text" id="edit-name" class="text-input" value="${escapeHtml(idf.name || '')}">

        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">酒莊 / 品牌 (Producer)</div>
        <input type="text" id="edit-producer" class="text-input" value="${escapeHtml(idf.producer || '')}">

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:8px;">
          <div>
            <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint);">酒類別</div>
            <input type="text" id="edit-category" class="text-input" value="${escapeHtml(tags.category || idf.category || '威士忌')}">
          </div>
          <div>
            <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint);">年份 / 陳年</div>
            <input type="text" id="edit-vintage" class="text-input" value="${escapeHtml(tags.vintage || idf.vintage || '')}">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:8px;">
          <div>
            <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint);">產國</div>
            <input type="text" id="edit-country" class="text-input" value="${escapeHtml(tags.country || idf.country || '')}">
          </div>
          <div>
            <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint);">產區 / 子產區</div>
            <input type="text" id="edit-region" class="text-input" value="${escapeHtml(tags.region || idf.region || '')}">
          </div>
        </div>

        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost btn-block" onclick="closeModal()">取消</button>
          <button class="btn btn-primary btn-block" onclick="saveEditedBottle('${b.id}')">儲存修正</button>
        </div>
      </div>
    </div>
  `;
}

async function saveEditedBottle(id){
  const b = window.cellar.find(x => x.id === id);
  if(!b) return;

  if(!b.identification) b.identification = {};
  if(!b.tags) b.tags = {};

  b.identification.name = document.getElementById('edit-name').value.trim();
  b.identification.producer = document.getElementById('edit-producer').value.trim();
  
  b.tags.category = document.getElementById('edit-category').value.trim();
  b.tags.vintage = document.getElementById('edit-vintage').value.trim();
  b.tags.country = document.getElementById('edit-country').value.trim();
  b.tags.region = document.getElementById('edit-region').value.trim();

  // 同步更新 identification 欄位
  b.identification.category = b.tags.category;
  b.identification.vintage = b.tags.vintage;
  b.identification.country = b.tags.country;
  b.identification.region = b.tags.region;

  await saveBottleToDB(b);
  closeModal();
  renderDetail(id);
}

function renderRadar(vm){
  const order = ['mv','ql','dv','pv','sv','gv','cv','sto'];
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

/* ---------------- 3. 原生時間選單品飲彈窗 ---------------- */
let currentSessionRating = 5;

function openAddSessionModal(bottleId){
  // 3. 取得原生 datetime-local 格式 (YYYY-MM-DDTHH:mm)
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const defaultIso = now.toISOString().slice(0, 16);
  currentSessionRating = 5;

  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" style="max-width:380px; text-align:left;" onclick="event.stopPropagation()">
        <div style="font-family:var(--serif); font-size:17px; font-weight:600; margin-bottom:12px; color:var(--gold);">
          ＋ 記錄這次品飲時光
        </div>

        <!-- 原生日期時間選單 (點擊直接開滾輪) -->
        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint);">日期與時間 (點擊選擇)</div>
        <input type="datetime-local" id="sess-date" class="text-input" value="${defaultIso}">

        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">地點 / 酒吧</div>
        <input type="text" id="sess-loc" class="text-input" placeholder="例如：尖沙咀 Whisky Bar / 屋企陽台">

        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">同飲同伴</div>
        <input type="text" id="sess-comp" class="text-input" placeholder="例如：Rex、阿明、獨酌深思">

        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">這次星級</div>
        <div class="star-row" style="margin-top:2px;">
          ${[1,2,3,4,5].map(n => `<button class="star-btn filled" id="sess-star-${n}" onclick="setModalRating(${n})">★</button>`).join('')}
        </div>

        <div style="font-size:11px; font-family:var(--mono); color:var(--text-faint); margin-top:8px;">品飲感受與筆記</div>
        <textarea id="sess-notes" class="text-input" style="height:70px; resize:none;" placeholder="例如：放咗三個月後黑朱古力味出晒嚟，同朋友傾得好盡興..."></textarea>

        <div style="display:flex; gap:10px; margin-top:14px;">
          <button class="btn btn-ghost btn-block" onclick="closeModal()">取消</button>
          <button class="btn btn-primary btn-block" onclick="saveNewSession('${bottleId}')">儲存品飲</button>
        </div>
      </div>
    </div>
  `;
}

function setModalRating(n){
  currentSessionRating = n;
  for(let i=1; i<=5; i++){
    const el = document.getElementById(`sess-star-${i}`);
    if(el) {
      if(i <= n) el.classList.add('filled');
      else el.classList.remove('filled');
    }
  }
}

async function saveNewSession(bottleId){
  const b = window.cellar.find(x => x.id === bottleId);
  if(!b) return;

  const rawDate = document.getElementById('sess-date').value;
  const formattedDate = rawDate ? rawDate.replace('T', ' ') : new Date().toLocaleString();

  const newSession = {
    id: 't_' + Date.now(),
    dateStr: formattedDate,
    location: document.getElementById('sess-loc').value.trim(),
    companions: document.getElementById('sess-comp').value.trim(),
    rating: currentSessionRating,
    notes: document.getElementById('sess-notes').value.trim()
  };

  if(!b.tastings) b.tastings = [];
  b.tastings.unshift(newSession);

  b.personalRating = newSession.rating;
  if(!b.diary) b.diary = {};
  b.diary.notes = newSession.notes;

  await saveBottleToDB(b);
  closeModal();
  renderDetail(bottleId);
}

/* ---------------- 1. 專屬分享連結生成 (全窖 / 單架 / 單酒) ---------------- */
async function syncPublishCellar(){
  try {
    await fetch(`${WORKER_API_URL}/api/cellar/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncKey: mySyncKey, cellar: window.cellar, ownerName: '品飲家' })
    });
  } catch(e){}
}

// 1. 全酒窖專屬分享
async function shareEntireCellar(){
  if(!window.cellar.length){ alert("酒櫃暫無酒款！"); return; }
  await syncPublishCellar();

  const shareUrl = `${window.location.origin}${window.location.pathname}?cellar=${mySyncKey}`;
  const shareText = `🍾 歡迎參觀我的私人酒窖 (BottleSense)：\n內有 ${window.cellar.length} 款精選佳釀與真實品飲手記！\n${shareUrl}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: '我的私人酒窖', text: shareText, url: shareUrl });
      return;
    } catch(err){}
  }
  navigator.clipboard.writeText(shareUrl);
  alert(`酒窖公開專屬連結已複製！\n${shareUrl}`);
}

// 1. 單個酒架專屬分享 (?cellar=KEY&shelf=xxx)
async function shareCurrentShelf(){
  const count = window.cellar.filter(b => b.status === currentScene).length;
  await syncPublishCellar();

  const names = { cooler:'未飲電子酒櫃', wood:'已飲實木酒架', bar:'飲完吧台', wishlist:'想買願望清單', favorite:'心頭好最愛' };
  const shareUrl = `${window.location.origin}${window.location.pathname}?cellar=${mySyncKey}&shelf=${currentScene}`;
  const shareText = `🍷 邀請你睇我嘅 BottleSense [${names[currentScene]||'酒架'}]：\n目前精選 ${count} 款酒！\n點擊直接瀏覽該架：\n${shareUrl}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: names[currentScene], text: shareText, url: shareUrl });
      return;
    } catch(err){}
  }
  navigator.clipboard.writeText(shareUrl);
  alert(`此酒架專屬連結已複製！\n${shareUrl}`);
}

// 1. 單支酒專屬分享 (?cellar=KEY&bottle=ID)
async function shareSingleBottle(id){
  const b = window.cellar.find(x => x.id === id);
  if(!b) return;
  await syncPublishCellar();

  const name = b.identification?.name || '我的酒款';
  const shareUrl = `${window.location.origin}${window.location.pathname}?cellar=${mySyncKey}&bottle=${b.id}`;
  const shareText = `🍾 BottleSense 藏酒推薦：${name}\n點擊查看這支酒的八維雷達圖與完整品飲歷程：\n${shareUrl}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: name, text: shareText, url: shareUrl });
      return;
    } catch(err){}
  }
  navigator.clipboard.writeText(shareUrl);
  alert(`這支酒的專屬連結已複製！\n${shareUrl}`);
}

// 1. 單次品飲紀錄專屬分享
async function shareSingleSession(bottleId, sessionId){
  const b = window.cellar.find(x => x.id === bottleId);
  if(!b) return;
  const s = (b.tastings || []).find(t => t.id === sessionId);
  if(!s) return;
  await syncPublishCellar();

  const name = b.identification?.name || '酒款';
  const stars = '★'.repeat(s.rating || 5);
  const locStr = s.location ? `\n📍 地點：${s.location}` : '';
  const compStr = s.companions ? `\n👥 同伴：${s.companions}` : '';
  const noteStr = s.notes ? `\n📝 品飲感受：「${s.notes}」` : '';
  const shareUrl = `${window.location.origin}${window.location.pathname}?cellar=${mySyncKey}&bottle=${b.id}`;

  const shareText = `🥃 BottleSense 品飲手記\n酒款：${name}\n時間：${s.dateStr}${locStr}${compStr}\n評分：${stars}${noteStr}\n\n查看此酒：${shareUrl}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: `${name} 品飲手記`, text: shareText, url: shareUrl });
      return;
    } catch(err){}
  }
  navigator.clipboard.writeText(shareText);
  alert("已複製品飲紀錄與專屬連結至剪貼簿！");
}

/* ---------------- 訪客展示介面 ---------------- */
function renderVisitorShowroom(){
  const data = visitorCellarData;
  const list = data.cellar || [];
  
  const coolerBottles = list.filter(b => b.status === 'unopened');
  const woodBottles = list.filter(b => b.status === 'opened');
  const barBottles = list.filter(b => ['finished','gifted','sold'].includes(b.status));
  const wishBottles = list.filter(b => b.status === 'wishlist');
  const favBottles = list.filter(b => b.isFavorite);

  let activeList = [];
  let shelfTitle = '';
  if (currentScene === 'cooler') { activeList = coolerBottles; shelfTitle = '⚡ 電子恆溫酒櫃 (未飲)'; }
  else if (currentScene === 'wood') { activeList = woodBottles; shelfTitle = '🪵 實木日常酒架 (已飲中)'; }
  else if (currentScene === 'bar') { activeList = barBottles; shelfTitle = '🥃 吧台展示桌 (飲完紀念)'; }
  else if (currentScene === 'wishlist') { activeList = wishBottles; shelfTitle = '🏷️ 考察與願望清單'; }
  else { activeList = favBottles; shelfTitle = '⭐ 心頭好精選 (最愛)'; }

  document.getElementById('main').innerHTML = `
    <div class="view">
      <div style="background:linear-gradient(180deg, var(--surface) 0%, #15170f 100%); border:1px solid var(--gold-dim); border-radius:16px; padding:18px; margin-top:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-family:var(--serif); font-size:18px; font-weight:600; color:var(--gold);">
              ${escapeHtml(data.ownerName || '品飲家')} 的私人酒窖
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:3px; font-family:var(--mono);">
              共典藏 ${list.length} 款佳釀
            </div>
          </div>
          <button class="like-chip" onclick="likeSharedCellar('${data.syncKey}')">
            ❤️ 乾杯 (<span id="like-count">${data.likes || 0}</span>)
          </button>
        </div>
      </div>

      <div class="cellar-scene-tabs" style="margin-top:16px;">
        <div class="scene-tab ${currentScene==='cooler'?'active-cooler':''}" onclick="currentScene='cooler'; renderVisitorShowroom();"><span class="scene-icon">⚡</span><div class="scene-name">未飲</div><div class="scene-count">${coolerBottles.length}</div></div>
        <div class="scene-tab ${currentScene==='wood'?'active-wood':''}" onclick="currentScene='wood'; renderVisitorShowroom();"><span class="scene-icon">🪵</span><div class="scene-name">已飲</div><div class="scene-count">${woodBottles.length}</div></div>
        <div class="scene-tab ${currentScene==='bar'?'active-bar':''}" onclick="currentScene='bar'; renderVisitorShowroom();"><span class="scene-icon">🥃</span><div class="scene-name">飲完</div><div class="scene-count">${barBottles.length}</div></div>
        <div class="scene-tab ${currentScene==='wishlist'?'active-wish':''}" onclick="currentScene='wishlist'; renderVisitorShowroom();"><span class="scene-icon">🏷️</span><div class="scene-name">想買</div><div class="scene-count">${wishBottles.length}</div></div>
        <div class="scene-tab ${currentScene==='favorite'?'active-fav':''}" onclick="currentScene='favorite'; renderVisitorShowroom();"><span class="scene-icon">⭐</span><div class="scene-name">最愛</div><div class="scene-count">${favBottles.length}</div></div>
      </div>

      <div class="shelf-container shelf-${currentScene}">
        <div style="font-family:var(--serif); font-size:14px; font-weight:600; margin-bottom:8px;">${shelfTitle}</div>
        <div class="shelf-beam"></div>
        <div>
          ${activeList.length ? activeList.map(b => `
            <div class="bottle-card" style="margin-bottom:12px;" onclick="renderVisitorBottleDetail('${b.id}')">
              <div class="bottle-photo-box">${b.image ? `<img src="${b.image}">` : `<div class="emoji-fallback">🍷</div>`}</div>
              <div class="bottle-info">
                <div class="bottle-name">${escapeHtml(b.identification?.name || '酒款')}</div>
                <div class="bottle-sub">${escapeHtml(b.identification?.producer \vert{}\vert{} '')} · ${escapeHtml(b.tags?.vintage || '')}</div>
                <div style="font-size:11px; color:var(--gold); margin-top:2px;">★ ${b.personalRating||5}/5</div>
              </div>
            </div>
          `).join('') : '<div class="empty-shelf">此空間暫無藏酒</div>'}
        </div>
        <div class="shelf-beam"></div>
      </div>

      <button class="btn btn-primary btn-block" style="margin-top:10px;" onclick="exitVisitorMode()">返回我的個人酒窖</button>
    </div>
  `;
}

function renderVisitorBottleDetail(bottleId){
  const b = visitorCellarData?.cellar?.find(x => x.id === bottleId);
  if(!b) { renderVisitorShowroom(); return; }
  const idf = b.identification || {};
  const vm = b.scan?.vm || {};

  document.getElementById('main').innerHTML = `
    <div class="view">
      <div class="back-row">
        <span onclick="renderVisitorShowroom()" style="cursor:pointer;">← 返回酒友酒庫</span>
        <button class="like-chip" onclick="likeSharedCellar('${visitorCellarData.syncKey}')">❤️ 乾杯</button>
      </div>

      <div class="detail-photo-hero">${b.image ? `<img src="${b.image}">` : '🍷'}</div>

      <div class="label-card">
        <div class="label-eyebrow">${escapeHtml(b.tags?.category || idf.category || '酒款')}</div>
        <div class="label-name">${escapeHtml(idf.name || '酒款')}</div>
        <div class="label-sub">${escapeHtml(idf.producer || '')}</div>
        <div class="label-facts">
          <div><div class="fact-label">Vintage / 年份</div><div class="fact-value">${escapeHtml(b.tags?.vintage || idf.vintage || '—')}</div></div>
          <div><div class="fact-label">Origin / 產區</div><div class="fact-value">${escapeHtml([b.tags?.country, b.tags?.region].filter(Boolean).join(' ') || idf.region || '—')}</div></div>
        </div>
      </div>

      <div class="info-block">
        <button class="btn btn-primary btn-block" onclick="forkBottleToMine('${b.id}')">
          + 複製此酒到我的願望清單 (想買)
        </button>
      </div>

      <!-- 訪客看到的品飲歷史 -->
      <div class="info-block">
        <h3>🥃 酒友品飲手記 (${(b.tastings||[]).length})</h3>
        <div class="timeline-list">
          ${(b.tastings || []).map((t, idx) => `
            <div class="timeline-card">
              <span class="timeline-time">#${idx+1} ·${escapeHtml(t.dateStr)}</span>
              <div style="color:var(--gold); font-size:12px; margin:2px 0;">${'★'.repeat(t.rating \vert{}\vert{} 5)}</div>${t.location || t.companions ? `<div class="timeline-meta"><span>${t.location?'📍 '+escapeHtml(t.location):''}</span><span>${t.companions?'👥 '+escapeHtml(t.companions):''}</span></div>`:''}
              ${t.notes ? `<div class="timeline-notes">"${escapeHtml(t.notes)}"</div>` : ''}
            </div>
          `).join('') || '<div style="font-size:12px; color:var(--text-faint); text-align:center; padding:10px 0;">尚無詳細品飲筆記</div>'}
        </div>
      </div>

      ${renderRadar(vm)}
    </div>
  `;
}

async function likeSharedCellar(key){
  try {
    const res = await fetch(`${WORKER_API_URL}/api/cellar/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const d = await res.json();
    if(d.success){
      const el = document.getElementById('like-count');
      if(el) el.textContent = d.likes;
      alert("乾杯成功！已向酒友點讚 Cheers 🥂");
    }
  } catch(e){}
}

async function forkBottleToMine(bottleId){
  const bottle = visitorCellarData?.cellar?.find(x => x.id === bottleId);
  if(!bottle) return;
  const clone = {
    ...bottle,
    id: 'b_' + Date.now(),
    status: 'wishlist',
    addedAt: Date.now()
  };
  window.cellar.unshift(clone);
  await saveBottleToDB(clone);
  alert(`已將「${clone.identification?.name || '酒款'}」收藏進你的想買清單！`);
}

async function moveStatus(id, newStatus){
  const b = window.cellar.find(x => x.id === id);
  if(!b) return;
  b.status = newStatus;
  await saveBottleToDB(b);
  renderDetail(id);
}

/* ---------------- 拍照上傳與收納 ---------------- */
document.getElementById('cameraInput').addEventListener('change', handleUpload);
document.getElementById('galleryInput').addEventListener('change', handleUpload);

async function handleUpload(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (ev)=>{
    const dataUrl = ev.target.result;
    document.getElementById('main').innerHTML = `
      <div class="view loading-view">
        <div class="loading-ring"></div>
        <div style="font-size:13px; color:var(--gold);">AI 正在辨識酒標與計算數值...</div>
      </div>
    `;
    try {
      const [head, b64] = dataUrl.split(',');
      const res = await fetch(`${WORKER_API_URL}/api/scan`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ image: b64, mediaType: 'image/jpeg' })
      });
      const parsed = await res.json();
      currentScan = { raw: parsed, image: dataUrl };
      renderScanDestinationSheet();
    } catch(err){
      alert("辨識失敗，請重試");
      goHome();
    }
  };
  reader.readAsDataURL(file);
}

function renderScanDestinationSheet(){
  const parsed = currentScan.raw;
  document.getElementById('main').innerHTML = `
    <div class="view">
      <div class="back-row" onclick="goHome()">← 取消</div>
      <div class="detail-photo-hero"><img src="${currentScan.image}"></div>
      <div class="info-block">
        <div style="font-family:var(--serif); font-size:16px; font-weight:600; color:var(--gold); margin-bottom:4px;">
          ${escapeHtml(parsed.id?.name || '已成功辨識')}
        </div>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">收納至哪個空間？</div>
        <div class="destination-grid">
          <div class="dest-card" onclick="saveNewBottle('unopened', false)"><div class="icon">⚡</div><div class="title">未飲</div></div>
          <div class="dest-card" onclick="saveNewBottle('opened', false)"><div class="icon">🪵</div><div class="title">已飲</div></div>
          <div class="dest-card" onclick="saveNewBottle('finished', false)"><div class="icon">🥃</div><div class="title">飲完</div></div>
          <div class="dest-card" onclick="saveNewBottle('wishlist', false)"><div class="icon">🏷️</div><div class="title">想買</div></div>
          <div class="dest-card" onclick="saveNewBottle('unopened', true)"><div class="icon">⭐</div><div class="title">未飲+最愛</div></div>
        </div>
      </div>
    </div>
  `;
}

async function saveNewBottle(status, isFav){
  const item = {
    id: 'b_' + Date.now(),
    status: status,
    isFavorite: isFav,
    image: currentScan.image,
    identification: currentScan.raw.id || {},
    scan: currentScan.raw,
    tastings: [],
    tags: {
      category: currentScan.raw.id?.category || '酒類',
      vintage: currentScan.raw.id?.vintage || '',
      country: currentScan.raw.id?.country || '',
      region: currentScan.raw.id?.region || ''
    },
    addedAt: Date.now()
  };
  window.cellar.unshift(item);
  await saveBottleToDB(item);
  currentScene = isFav ? 'favorite' : status;
  renderCellar();
}

/* ---------------- Explore 社群評價池 ---------------- */
async function renderExplore(){
  setActiveNav('nav-explore');
  document.getElementById('main').innerHTML = `
    <div class="view">
      <div class="section-head" style="margin-top:8px;"><h2>酒友評價與探索</h2></div>
      <div id="explore-feed" style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:12px;">載入中...</div>
    </div>
  `;
  try {
    const res = await fetch(`${WORKER_API_URL}/api/explore`);
    const publicFeed = res.ok ? await res.json() : [];
    const feedEl = document.getElementById('explore-feed');
    if(!feedEl) return;
    if(!publicFeed.length){
      feedEl.innerHTML = `<div class="empty-shelf">目前尚無公開分享記錄。點擊酒款詳情頁右上角的紙飛機即可分享！</div>`;
      return;
    }
    feedEl.innerHTML = publicFeed.map(b => `
      <div class="bottle-card" style="margin-bottom:10px;">
        <div class="bottle-photo-box">${b.image ? `<img src="${b.image}">` : '🍷'}</div>
        <div class="bottle-info">
          <div class="bottle-name">${escapeHtml(b.identification?.name || '酒款')}</div>
          <div style="font-size:11px; color:var(--gold); margin-top:2px;">★ ${b.personalRating||5}/5 ・ ${escapeHtml(b.author||'酒友')}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">"${escapeHtml(b.diary?.notes || '無筆記')}"</div>
        </div>
      </div>
    `).join('');
  } catch(e){}
}

function renderSettings(){
  document.getElementById('main').innerHTML = `
    <div class="view">
      <div class="back-row" onclick="goHome()">← 返回</div>
      <div class="section-head"><h2>設定與備份</h2></div>
      <div class="info-block">
        <h3 style="color:var(--gold);">專屬同步碼 (Sync Key)</h3>
        <div style="font-family:var(--mono); font-size:15px; color:var(--gold); background:var(--surface-2); padding:10px; border-radius:8px; margin:10px 0;">
          ${mySyncKey}
        </div>
        <button class="btn btn-ghost btn-block" onclick="navigator.clipboard.writeText(mySyncKey); alert('已複製同步碼！');">複製同步碼</button>
      </div>
    </div>
  `;
}

function escapeHtml(str){ return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

(async function init(){
  window.cellar = await loadCellarWithMigration();
  checkUrlParams();
})();
