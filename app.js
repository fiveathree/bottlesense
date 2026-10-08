// app.js - 核心互動邏輯
const TELEGRAM_PLANE_SVG = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
const DIM_LABELS = { mv:"市場價值", ql:"品質", dv:"飲用價值", pv:"配餐價值", sv:"社交話題", gv:"送禮價值", cv:"收藏價值", sto:"保存價值" };
const ACTION_ICONS = { drink:"🥃", pair:"🍽️", share:"👥", gift:"🎁", collect:"💎", sell:"💰", store:"🌡️", keep:"💎" };

window.cellar = [];
let currentScan = null;
let currentScene = 'cooler';

function setActiveNav(id){
  document.querySelectorAll('.navbtn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById(id);
  if(el) el.classList.add('active');
}

function goHome(){ setActiveNav('nav-home'); renderHome(); }

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
        <p>AI 視覺分析風味建議，滑動卡片即可收藏或移除。</p>
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
  renderCellar();
}

function renderCellar(){
  setActiveNav('nav-cellar');
  const coolerBottles = window.cellar.filter(b => b.status === 'unopened');
  const woodBottles = window.cellar.filter(b => b.status === 'opened');
  const barBottles = window.cellar.filter(b => ['finished','gifted','sold'].includes(b.status));
  const wishBottles = window.cellar.filter(b => b.status === 'wishlist');
  const favBottles = window.cellar.filter(b => b.isFavorite);

  let activeList = [];
  let shelfTitle = '';
  let shelfKey = currentScene;

  if (currentScene === 'cooler') { activeList = coolerBottles; shelfTitle = '⚡ 電子恆溫酒櫃 (未飲)'; }
  else if (currentScene === 'wood') { activeList = woodBottles; shelfTitle = '🪵 實木日常酒架 (已飲中)'; }
  else if (currentScene === 'bar') { activeList = barBottles; shelfTitle = '🥃 吧台展示桌 (飲完紀念)'; }
  else if (currentScene === 'wishlist') { activeList = wishBottles; shelfTitle = '🏷️ 願望清單 (想買)'; }
  else { activeList = favBottles; shelfTitle = '⭐ 心頭好精選 (最愛)'; shelfKey = 'fav'; }

  document.getElementById('main').innerHTML = `
    <div class="view">
      <div class="section-head" style="margin-top:8px;">
        <h2>私人酒窖全景</h2>
        <div style="display:flex; gap:6px;">
          <button class="share-plane-btn" onclick="shareCurrentShelf()">${TELEGRAM_PLANE_SVG}<span>分享此架</span></button>
          <button class="share-plane-btn" style="background:rgba(212,175,55,0.25);" onclick="shareEntireCellar()">${TELEGRAM_PLANE_SVG}<span>分享全窖</span></button>
        </div>
      </div>

      <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:8px; font-family:var(--mono);">
        💡 點擊卡片看詳細分析 | 👉 右滑加最愛 | 👈 左滑移除
      </div>

      <div class="cellar-scene-tabs">
        <div class="scene-tab ${currentScene==='cooler'?'active-cooler':''}" onclick="switchScene('cooler')"><span class="scene-icon">⚡</span><div class="scene-name">未飲</div><div class="scene-count">${coolerBottles.length}</div></div>
        <div class="scene-tab ${currentScene==='wood'?'active-wood':''}" onclick="switchScene('wood')"><span class="scene-icon">🪵</span><div class="scene-name">已飲</div><div class="scene-count">${woodBottles.length}</div></div>
        <div class="scene-tab ${currentScene==='bar'?'active-bar':''}" onclick="switchScene('bar')"><span class="scene-icon">🥃</span><div class="scene-name">飲完</div><div class="scene-count">${barBottles.length}</div></div>
        <div class="scene-tab ${currentScene==='wishlist'?'active-wish':''}" onclick="switchScene('wishlist')"><span class="scene-icon">🏷️</span><div class="scene-name">想買</div><div class="scene-count">${wishBottles.length}</div></div>
        <div class="scene-tab ${currentScene==='favorite'?'active-fav':''}" onclick="switchScene('favorite')"><span class="scene-icon">⭐</span><div class="scene-name">最愛</div><div class="scene-count">${favBottles.length}</div></div>
      </div>

      <div class="shelf-container shelf-${shelfKey}">
        <div style="font-family:var(--serif); font-size:14px; font-weight:600; margin-bottom:8px;">${shelfTitle}</div>
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

function switchScene(scene){ currentScene = scene; renderCellar(); }

function bottleCardHtml(b){
  const idf = b.identification || {};
  const tags = b.tags || {};
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
            ${b.personalRating ? `<span class="tag-badge secondary">★ ${b.personalRating}/5</span>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// 徹底修正點擊與滑動衝突
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
        // 純點擊直接進入詳情頁！
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

// 完整恢復詳情頁（數值、八維圖、決策）
function renderDetail(id){
  const b = window.cellar.find(x => x.id === id);
  if(!b) return;

  const idf = b.identification || {};
  const r = b.scan || {};
  const vm = r.vm || {};
  const rec = r.rec || {};
  const tier = (idf.conf >= 80) ? {cls:'seal-high', label:'high'} : (idf.conf >= 55 ? {cls:'seal-medium', label:'medium'} : {cls:'seal-low', label:'low'});

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
        <button class="share-plane-btn" onclick="shareSingleBottle('${b.id}')">${TELEGRAM_PLANE_SVG}<span>分享酒評</span></button>
      </div>

      <div class="detail-photo-hero">${b.image ? `<img src="${b.image}">` : '🍷'}</div>

      <div class="label-card">
        <div class="confidence-seal ${tier.cls}"><div class="seal-pct">${idf.conf ?? '95'}%</div><div class="seal-label">${tier.label}</div></div>
        <div class="label-eyebrow">${escapeHtml(b.tags?.category || idf.category || '酒款')}</div>
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

      <div class="info-block">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3>⭐ 品飲星級與筆記</h3>
          <button class="icon-btn" onclick="toggleFavInDetail('${b.id}')" style="color:${b.isFavorite?'var(--gold)':'var(--text-muted)'};">
            ${b.isFavorite ? '★' : '☆'}
          </button>
        </div>
        <div class="star-row">
          ${[1,2,3,4,5].map(n=>`<button class="star-btn ${b.personalRating>=n?'filled':''}" onclick="setRating('${b.id}',${n})">★</button>`).join('')}
        </div>
        <textarea id="dt-notes" class="text-input" placeholder="品飲心得...">${b.diary?.notes || ''}</textarea>
        <button class="btn btn-primary btn-block" style="margin-top:10px;" onclick="saveQuickNote('${b.id}')">儲存筆記</button>
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

async function toggleFavInDetail(id){
  const b = window.cellar.find(x => x.id === id);
  if(!b) return;
  b.isFavorite = !b.isFavorite;
  await saveBottleToDB(b);
  renderDetail(id);
}

async function moveStatus(id, newStatus){
  const b = window.cellar.find(x => x.id === id);
  if(!b) return;
  b.status = newStatus;
  await saveBottleToDB(b);
  renderDetail(id);
}

async function setRating(id, n){
  const b = window.cellar.find(x=>x.id===id);
  if(!b) return;
  b.personalRating = n;
  await saveBottleToDB(b);
  renderDetail(id);
}

async function saveQuickNote(id){
  const b = window.cellar.find(x => x.id === id);
  if(!b) return;
  if(!b.diary) b.diary = {};
  b.diary.notes = document.getElementById('dt-notes').value;
  await saveBottleToDB(b);
  alert("品飲筆記已更新！");
}

// 分享函式（優先手機原生分享）
async function shareSingleBottle(id){
  const b = window.cellar.find(x => x.id === id);
  if(!b) return;
  const name = b.identification?.name || '我的酒款';
  const stars = b.personalRating ? ` (${b.personalRating}★)` : '';
  const notes = b.diary?.notes ? `\n心得：「${b.diary.notes}」` : '';
  const shareText = `🍾 BottleSense 品飲筆記：${name}${stars}${notes}\n來自我的私人酒窖收藏。`;

  if (navigator.share) {
    try {
      await navigator.share({ title: name, text: shareText, url: window.location.href });
      return;
    } catch(err){}
  }
  navigator.clipboard.writeText(shareText);
  alert("酒評已複製至剪貼簿！");
}

async function shareCurrentShelf(){
  const count = window.cellar.filter(b => b.status === currentScene).length;
  const shareText = `🍷 我的 BottleSense 私人酒架：目前精選 ${count} 款佳釀！快來看看我的收藏。`;
  if (navigator.share) {
    try {
      await navigator.share({ title: '我的酒架', text: shareText, url: window.location.href });
      return;
    } catch(err){}
  }
  navigator.clipboard.writeText(shareText);
  alert("酒架內容已複製至剪貼簿！");
}

async function shareEntireCellar(){
  if(!window.cellar.length){ alert("酒櫃暫無酒款！"); return; }
  try {
    fetch(`${WORKER_API_URL}/api/cellar/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncKey: mySyncKey, cellar: window.cellar, ownerName: '品飲家' })
    });
  } catch(e){}

  const shareUrl = `${window.location.origin}${window.location.pathname}?cellar=${mySyncKey}`;
  const shareText = `🍾 歡迎參觀我的私人酒窖 (BottleSense)：\n內有 ${window.cellar.length} 款精選佳釀與真實品飲日記！\n${shareUrl}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: '我的 BottleSense 私人酒窖', text: shareText, url: shareUrl });
      return;
    } catch(err){}
  }
  navigator.clipboard.writeText(shareUrl);
  alert(`酒窖公開連結已複製！\n${shareUrl}`);
}

// 拍照上傳與分析
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
    tags: { category: currentScan.raw.id?.category || '酒類', vintage: currentScan.raw.id?.vintage || '' },
    addedAt: Date.now()
  };
  window.cellar.unshift(item);
  await saveBottleToDB(item);
  currentScene = isFav ? 'favorite' : status;
  renderCellar();
}

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
  goHome();
})();