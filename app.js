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

// 訪客(查看他人分享連結)只可閱讀，所有寫入動作一律攔截
function blockIfVisitor() {
  if (!isVisitorMode) return false;
  showToast(currentLang === 'zh' ? '👀 訪客模式僅供瀏覽，無法修改' : '👀 View-only: visitors cannot make changes');
  return true;
}

// ==========================================
// 繁英雙語字典系統 (i18n)
// ==========================================
let currentLang = localStorage.getItem('bottlesense_lang') || 'zh';

/* ---------------- 專屬碼管理與八維價值合理化校準 ---------------- */
function getOrCreateSyncKey() {
  let key = localStorage.getItem('bottlesense_sync_key');
  if (!key || key.trim() === '' || key === 'undefined' || key === 'null') {
    key = genStrongKey();
    localStorage.setItem('bottlesense_sync_key', key);
  }
  return key;
}


/* ---------------- API 錯誤訊息 / 登入過期 ---------------- */
function apiErrorMessage(code, data) {
  const zh = currentLang === 'zh';
  const map = {
    RATE_LIMITED: zh ? '操作太頻繁，請稍後再試' : 'Too many requests, please try later',
    RATE_LIMITED_IP: zh ? '您的網路操作太頻繁，請稍後再試' : 'Too many requests from your network',
    RATE_LIMITED_EMAIL: zh ? '此電郵一小時內發送次數已達上限' : 'Too many codes sent to this email',
    COOLDOWN: zh ? '請等約 1 分鐘後再重新發送驗證碼' : 'Please wait a minute before resending',
    INVALID_EMAIL: zh ? '電郵格式不正確' : 'Invalid email',
    QUOTA_EXCEEDED: zh
      ? (data && data.tier === 'guest' ? `本月免費 AI 辨識次數已用完 (${data.limit} 次)。登入帳號可獲更多次數。` : `本月 AI 辨識次數已用完 (${data && data.limit} 次)。`)
      : 'Monthly AI scan limit reached',
    SERVICE_BUSY: zh ? '服務今日使用量已滿，請明天再試' : 'Service is busy today, try tomorrow',
    AUTH_REQUIRED: zh ? '請先重新登入' : 'Please sign in again',
    ID_TAKEN: zh ? '此分享編號已被使用' : 'Share id already used',
    PAYLOAD_TOO_LARGE: zh ? '資料太大，無法上傳' : 'Payload too large',
    BAD_IMAGE_SIZE: zh ? '相片太大或太小，請重新拍攝' : 'Bad image size',
    AI_UPSTREAM_ERROR: zh ? 'AI 服務暫時不可用，請稍後再試' : 'AI service unavailable',
    AI_NOT_CONFIGURED: zh ? 'AI 服務尚未設定' : 'AI not configured',
    CELLAR_TOO_LARGE: zh ? '酒窖資料太大，請聯絡開發者' : 'Cellar too large',
    UNDER_AGE: zh ? `未滿 ${(data && data.minAge) || 18} 歲不可使用本服務` : 'You must be of legal drinking age',
    BIRTHDAY_REQUIRED: zh ? '請填寫有效生日' : 'Please enter a valid birthday',
    AGE_REQUIRED: zh ? '請先在設定填寫生日（需年滿 18 歲）才可公開發布' : 'Please set your birthday (18+) in Settings to publish',
    CONTENT_REJECTED: zh ? '內容未能通過審查，未能公開發布' : 'Content rejected',
    NOT_ALCOHOL_IMAGE: zh ? '相片似乎不是酒類，請使用酒瓶或酒標相片發布' : 'Photo does not look like an alcoholic drink',
    NOT_ALCOHOL: zh ? '這張相片似乎不是酒瓶或酒標，請重新拍攝（不會扣除額度）' : 'This does not look like a bottle or label (not counted)',
    TEMP_BLOCKED: zh ? '嘗試次數過多，辨識功能暫停 24 小時' : 'Scanning paused for 24 hours',
    BANNED: zh ? '此帳號已被限制，如有疑問請聯絡我們' : 'Account restricted',
    KEY_MISMATCH: zh ? '登入狀態異常，請重新登入' : 'Session mismatch, please sign in again',
    CODE_INVALID: zh ? '兌換碼無效' : 'Invalid code',
    CODE_EXPIRED: zh ? '兌換碼已過期' : 'Code expired',
    CODE_USED_UP: zh ? '兌換碼已被領完' : 'Code fully redeemed',
    CODE_ALREADY: zh ? '您已使用過此兌換碼' : 'You already redeemed this code',
  };
  if (code && map[code]) return map[code];
  if (code && /^EMAIL_SEND_FAILED/.test(code)) return (zh ? '驗證郵件發送失敗：' : 'Email failed: ') + code.replace('EMAIL_SEND_FAILED: ', '');
  return code || '';
}

let _authExpiredShown = false;
// 登入已過期 / 舊版帳號需重新登入：保留本機資料，登出登入狀態，重新驗證後會與雲端合併
function handleAuthExpired() {
  if (_authExpiredShown) return;
  const email = localStorage.getItem('bottlesense_account_bound');
  if (!email) return;
  _authExpiredShown = true;
  setSyncStatus('auth');
  setSessionToken('');
  localStorage.removeItem('bottlesense_account_bound');
  authFlowState = { step: 'email', email, name: '', gender: 'unspecified', birthday: '' };
  showToast(currentLang === 'zh' ? '🔒 為保障安全，請重新以電郵登入一次（本機酒款會自動合併）' : '🔒 Please sign in again (local bottles will be merged)');
  updateHeaderGreeting();
  setTimeout(() => { try { openSettings('auth'); } catch (e) {} }, 600);
}

async function reportExploreItem(itemId) {
  if (!confirm(currentLang === 'zh' ? '檢舉此分享內容不當 / 垃圾訊息？' : 'Report this share as inappropriate or spam?')) return;
  try {
    await apiFetch('/api/explore/report', { method: 'POST', body: JSON.stringify({ id: String(itemId) }) });
    showToast(currentLang === 'zh' ? '✓ 已收到檢舉，感謝您' : '✓ Report received');
  } catch (e) { showToast(currentLang === 'zh' ? '檢舉失敗，請稍後再試' : 'Report failed'); }
}

async function logoutAllDevices() {
  if (!confirm(currentLang === 'zh' ? '登出所有裝置並更換同步碼？\n其他裝置需重新登入；您之前分享出去的酒櫃連結會失效，需重新分享。' : 'Sign out all devices and rotate your sync key?\nOther devices must sign in again; previous share links will stop working.')) return;
  try {
    const res = await apiFetch('/api/auth/logout-all', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(apiErrorMessage(data.error));
    localStorage.setItem('bottlesense_sync_key', data.syncKey);
    setSessionToken(data.token);
    _myShareIdCache = null;
    showToast(currentLang === 'zh' ? '✓ 已登出所有其他裝置並更換同步碼' : '✓ Signed out everywhere');
    syncToCloudKV();
  } catch (e) { showToast((currentLang === 'zh' ? '操作失敗：' : 'Failed: ') + e.message); }
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
    nav_scan: "鑑識",
    nav_cellar: "酒窖",
    nav_explore: "探索",
    hero_title: "識酒，更識珍酒",
    hero_desc: "拍攝酒標，AI 即時鑑識<br>該開、該飲、該藏或是該贈，為您決定",
    choose_album: "從相簿選照片",
    spaces_title: "我的電子酒架",
    open_cellar: "前往酒窖 →",
    recent_title: "最近加入",
    view_all: "查看全部 →",
    empty_cellar: "酒櫃目前是空的<br>先拍一瓶酒標開始吧。",
    empty_recent_loggedin: "尚未有最近加入的酒款<br>拍一瓶酒標，開始建立您的酒窖。",
    space_cooler: "未開",
    space_wood: "已飲",
    space_bar: "飲盡",
    space_kept: "珍藏",
    space_gift: "饋贈",
    space_wish: "願望",
    space_fav: "⭐ 最愛",
    space_random: "🎲 隨機賞味",
    shelf_cooler_title: "⚡ 電子恆溫酒櫃（未開封）",
    shelf_wood_title: "🪵 梨花實木酒架（品鑑中）",
    shelf_bar_title: "🥃 紀念空瓶牆（飲盡留念）",
    shelf_kept_title: "💎 珍藏展示櫃（典藏）",
    shelf_gift_title: "🎁 緞帶禮盒櫃（已饋贈）",
    shelf_wish_title: "🏷️ 願望清單（心儀酒款）",
    shelf_fav_title: "⭐ 心頭好精選 (最愛)",
    share_cellar: "分享全窖",
    filter_all: "全部",
    empty_shelf: "此空間暫無藏酒",
    back: "← 返回",
    share_bottle: "分享此酒",
    edit_info: "編輯資料",
    transfer_title: "📍 移至酒窖",
    timeline_title: "🥃 品鑑紀錄",
    btn_add_log: "＋ 記錄這次品鑑",
    timeline_hint: "記錄不同時間、地點與同伴帶來的獨特體驗。",
    no_logs: "尚未記錄品飲歷史，點擊上方按鈕記錄您的第一杯！",
    btn_remove: "從酒庫中移除",
    crop_hint: "雙指縮放拖曳對準酒瓶",
    guide_label_tag: "請將酒標置於框內",
    zoom_label: "縮放:",
    btn_confirm_crop: "確認辨識",
    analyzing_title: "正在辨識酒標",
    analyzing_desc: "AI 正在分析酒款、年份及產區…",
    settings_title: "設定與備份",
    sync_key_label: "您的專屬同步碼 (Sync Key)",
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
    hero_title: "Know what to do with it",
    hero_desc: "Snap the label for an instant AI appraisal<br>Open, drink, keep or gift - decided for you",
    choose_album: "Upload from Photos",
    spaces_title: "Spaces & Random Pick",
    open_cellar: "Open Cellar →",
    recent_title: "Recently Added",
    view_all: "View All →",
    empty_cellar: "Your cellar is empty.<br>Snap a bottle label to begin.",
    empty_recent_loggedin: "No recent bottles yet.<br>Snap a label to start building your cellar.",
    space_cooler: "Sealed",
    space_wood: "Opened",
    space_bar: "Finished",
    space_kept: "Treasured",
    space_gift: "Gifted",
    space_wish: "Wishlist",
    space_fav: "⭐ Favorite",
    space_random: "🎲 Surprise Pick",
    shelf_cooler_title: "⚡ Wine Cooler (Unopened)",
    shelf_wood_title: "🪵 Pear-wood Rack (Opened)",
    shelf_bar_title: "🥃 Memory Wall (Finished)",
    shelf_kept_title: "💎 Collector's Cabinet (Treasured)",
    shelf_gift_title: "🎁 Ribbon Gift Cabinet (Gifted)",
    shelf_wish_title: "🏷️ Wishlist",
    shelf_fav_title: "⭐ Favorites (Top Pick)",
    share_cellar: "Share Cellar",
    filter_all: "All",
    empty_shelf: "No bottles in this space",
    back: "← Back",
    share_bottle: "Share Bottle",
    edit_info: "Edit Details",
    transfer_title: "📍 Move to cellar",
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
    bar: c.filter(b => ['finished','sold'].includes(b.status)).length,
    kept: c.filter(b => b.status === 'kept').length,
    gift: c.filter(b => b.status === 'gifted').length,
    wish: c.filter(b => b.status === 'wishlist').length,
    fav: c.filter(b => b.isFavorite).length
  };
}

function goHome() {
  if (isVisitorMode) exitVisitorMode();
  renderHome();
}

/* ---------------- 首頁 6 格齊整佈局 (含隨機賞味) ---------------- */
function quotaCache() {
  try { return JSON.parse(localStorage.getItem('bottlesense_quota') || 'null'); } catch (e) { return null; }
}
function quotaBarHTML(q) {
  const zh = currentLang === 'zh';
  const guest = !localStorage.getItem('bottlesense_account_bound');
  const c = q || quotaCache() || { tier: guest ? 'guest' : 'free', used: 0, limit: guest ? 8 : 40, bonus: 0 };
  const left = Math.max(0, c.limit - c.used) + (c.bonus || 0);
  const total = Math.max(1, c.limit + (c.bonus || 0));
  const pct = Math.max(0, Math.min(100, Math.round((left / total) * 100)));
  return `
    <div class="quota-head">
      <span>${zh ? '本月 AI 鑑識額度' : 'Monthly AI scans'}</span>
      <span><b>${left}</b> / ${total} ${zh ? '次' : ''}</span>
    </div>
    <div class="quota-track"><div class="quota-fill" style="width:${pct}%"></div></div>
    ${guest ? `<div class="quota-note">${zh ? '登入後可獲得更多額度' : 'Sign in for more scans'}</div>` : ''}`;
}
async function refreshQuota() {
  try {
    const res = await apiFetch('/api/quota');
    if (!res.ok) return;
    const q = await res.json();
    localStorage.setItem('bottlesense_quota', JSON.stringify(q));
    const el = document.getElementById('quotaBar');
    if (el) el.innerHTML = quotaBarHTML(q);
  } catch (e) {}
}

function renderHome() {
  currentView = 'home';
  setActiveNav('nav-home');
  const zh = currentLang === 'zh';

  main.innerHTML = `
    <div class="view home-wrap">
      <section class="scan-hero home-hero">
        <h1 class="hero-slogan ${zh ? 'hero-zh' : 'hero-en'}">${t('hero_title')}</h1>
        <p>${t('hero_desc')}</p>
        <div class="scan-center-box">
          <button class="scan-btn" onclick="openCamera()" aria-label="Scan Bottle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
          <span class="upload-subtext" onclick="openGallery()">${t('choose_album')}</span>
        </div>
      </section>

      <div class="guide-flow">
        <span>${zh ? '點擊按鈕' : 'Tap the button'}</span><i>&rsaquo;</i><span>${zh ? '使用相片' : 'Use a photo'}</span><i>&rsaquo;</i><span>${zh ? 'AI 鑑析' : 'AI appraisal'}</span>
      </div>

      <div class="quota-bar" id="quotaBar">${quotaBarHTML()}</div>
    </div>
  `;
  refreshQuota();
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
  const barBottles = c.filter(b => ['finished', 'sold'].includes(b.status));
  const keptBottles = c.filter(b => b.status === 'kept');
  const giftBottles = c.filter(b => b.status === 'gifted');
  const wishBottles = c.filter(b => b.status === 'wishlist');
  const favBottles = c.filter(b => b.isFavorite);

  let spaceList = [];
  let shelfTitle = '';
  let shelfKey = currentScene;

  if (currentScene === 'cooler') { spaceList = coolerBottles; shelfTitle = t('shelf_cooler_title'); }
  else if (currentScene === 'wood') { spaceList = woodBottles; shelfTitle = t('shelf_wood_title'); }
  else if (currentScene === 'bar') { spaceList = barBottles; shelfTitle = t('shelf_bar_title'); }
  else if (currentScene === 'kept') { spaceList = keptBottles; shelfTitle = t('shelf_kept_title'); shelfKey = 'kept'; }
  else if (currentScene === 'gift') { spaceList = giftBottles; shelfTitle = t('shelf_gift_title'); shelfKey = 'gift'; }
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
      <div class="section-head cellar-head" style="margin-top:8px; margin-bottom:16px;">
        <h2>${currentLang === 'zh' ? '私人酒窖全景' : 'Private Cellar Overview'}</h2>
        <button class="share-plane-btn" style="background:rgba(212,175,55,0.25);" onclick="shareEntireCellar()">
          ${TELEGRAM_PLANE_SVG}
          <span>${t('share_cellar')}</span>
        </button>
      </div>

      ${guestBannerHTML()}

      <div class="cellar-scene-tabs">
        <div class="scene-tab ${currentScene==='cooler'?'active-cooler':''}" onclick="switchScene('cooler')">
          <span class="scene-icon">⚡</span>
          <div class="scene-name">${t('space_cooler').replace(/^\S+\s/, '')}</div>
          <div class="scene-count">${coolerBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='wood'?'active-wood':''}" onclick="switchScene('wood')">
          <span class="scene-icon">🪵</span>
          <div class="scene-name">${t('space_wood').replace(/^\S+\s/, '')}</div>
          <div class="scene-count">${woodBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='bar'?'active-bar':''}" onclick="switchScene('bar')">
          <span class="scene-icon">🥃</span>
          <div class="scene-name">${t('space_bar').replace(/^\S+\s/, '')}</div>
          <div class="scene-count">${barBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='kept'?'active-kept':''}" onclick="switchScene('kept')">
          <span class="scene-icon">💎</span>
          <div class="scene-name">${t('space_kept').replace(/^\S+\s/, '')}</div>
          <div class="scene-count">${keptBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='gift'?'active-gift':''}" onclick="switchScene('gift')">
          <span class="scene-icon">🎁</span>
          <div class="scene-name">${t('space_gift').replace(/^\S+\s/, '')}</div>
          <div class="scene-count">${giftBottles.length}</div>
        </div>
        <div class="scene-tab ${currentScene==='wishlist'?'active-wish':''}" onclick="switchScene('wishlist')">
          <span class="scene-icon">🏷️</span>
          <div class="scene-name">${t('space_wish').replace(/^\S+\s/, '')}</div>
          <div class="scene-count">${wishBottles.length}</div>
        </div>
      </div>

      <div class="filter-row">${filterOptions.length > 1 ? `
          ${filterOptions.map(opt => `
            <div class="filter-chip ${activeFilter===opt?'active':''}" onclick="setShelfFilter('${esc(opt)}')">
              ${opt === 'all' ? t('filter_all') : esc(opt)}
            </div>
          `).join('')}
      ` : ''}</div>

      <div class="shelf-container shelf-${shelfKey}">
        <div style="font-family:var(--serif); font-size:16px; font-weight:700; margin-bottom:10px;">${shelfTitle}</div>
        <div class="shelf-beam"></div>
        ${activeList.length ? shelfRowsHTML(activeList, 3, false) : `<div class="spine-row spine-empty"><div class="empty-shelf">${t('empty_shelf')}</div></div><div class="shelf-beam"></div>`}
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

/* ---------------- 電子酒架：直立酒瓶 (像書架上的書) ---------------- */
const CATEGORY_TINT = {
  '紅酒': ['#5b1426', '#2a0912'], '白酒': ['#6b5d1f', '#2b2509'], '氣泡酒': ['#6b5d1f', '#2b2509'],
  '威士忌': ['#6a3b12', '#2a1707'], '清酒': ['#274a56', '#0f1f25'], '啤酒': ['#7a5a10', '#2e2206'],
  '琴酒': ['#1d4b5c', '#0b1f27'], '白蘭地': ['#6a3b12', '#2a1707'], '蘭姆酒': ['#5a2f12', '#241107']
};
function bottleSpineHTML(b, small) {
  const img = bottleImage(b);
  const cat = bottleCategory(b);
  const tint = CATEGORY_TINT[cat] || ['#3a3520', '#17150c'];
  const vintage = bottleVintage(b);
  const r = rarityOf(b);
  return `
    <div class="spine ${small ? 'spine-sm' : ''} spine-${r.k}" style="--t1:${tint[0]}; --t2:${tint[1]};" onclick="renderBottleDetail('${esc(b.id)}')" role="button" tabindex="0" aria-label="${esc(bottleName(b))}">
      ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<div class="spine-emoji">${categoryEmoji(cat)}</div>`}
      ${b.isFavorite ? '<span class="spine-fav">★</span>' : ''}
      <div class="spine-label">
        <div class="spine-name">${esc(bottleName(b))}</div>
        ${vintage ? `<div class="spine-sub">${esc(vintage)}</div>` : ''}
      </div>
    </div>`;
}
function shelfRowsHTML(list, perRow, small) {
  let html = '';
  for (let i = 0; i < list.length; i += perRow) {
    html += `<div class="spine-row">${list.slice(i, i + perRow).map(b => bottleSpineHTML(b, small)).join('')}</div><div class="shelf-beam"></div>`;
  }
  return html;
}
function homeShelfHTML() {
  const zh = currentLang === 'zh';
  const list = (window.cellar || []).filter(b => b.status !== 'wishlist').slice(0, 4);
  if (!list.length) {
    return `<div class="spine-row spine-empty"><div class="empty-shelf">${zh ? '酒架尚且空置<br>拍攝一瓶酒標，將它放上酒架。' : 'Your shelf is empty.<br>Scan a label to place your first bottle.'}</div></div><div class="shelf-beam"></div>`;
  }
  return shelfRowsHTML(list, 4, true);
}
function guestBannerHTML() {
  if (localStorage.getItem('bottlesense_account_bound') || !(window.cellar || []).length) return '';
  const zh = currentLang === 'zh';
  return `
    <div class="guest-banner">
      <div>${zh ? '尚未登入：酒款目前只儲存在這部裝置。登入後可雲端備份，並在不同裝置同步。' : 'Not signed in: bottles are stored on this device only. Sign in to back up and sync.'}</div>
      <button class="btn btn-primary btn-sm" onclick="openSettings('auth')">${zh ? '登入 / 註冊' : 'Sign in'}</button>
    </div>`;
}

function bottleCardHTML(b) {
  const img = bottleImage(b);
  const vintage = bottleVintage(b);
  const region = bottleRegion(b);
  const cat = bottleCategory(b);
  const pourCount = (b.tastings || []).length;

  return `
    <div class="swipe-item-wrapper" id="wrap-${esc(b.id)}">
      ${isVisitorMode ? '' : `<div class="swipe-action-left" onclick="toggleFavorite('${esc(b.id)}')">
        <span class="swipe-action-icon">${b.isFavorite ? '★' : '☆'}</span>
        <span>${b.isFavorite ? (currentLang==='zh'?'取消':'Unfav') : (currentLang==='zh'?'最愛':'Fav')}</span>
      </div>
      <div class="swipe-action-right" onclick="deleteBottle('${esc(b.id)}')">
        <span class="swipe-action-icon">×</span>
        <span>${currentLang==='zh'?'刪除':'Delete'}</span>
      </div>`}

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
            ${rarityBadge(b)}
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
  if (isVisitorMode) return;
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

/* ---------------- 開 / 飲 / 藏 / 送：幫唔識酒嘅人決定 ---------------- */
const VERDICTS = {
  open:  { emoji: '🍾', zh: '開', en: 'Open',  ctaZh: '邀約共飲', ctaEn: 'Start a pour party',
           headZh: '這瓶適合邀約友人共享', headEn: 'Best opened with friends',
           whenZh: '找個聚會或生日一起開，氣氛最好', whenEn: 'Save it for a gathering' },
  drink: { emoji: '🥃', zh: '飲', en: 'Drink', ctaZh: '我現在開了，記錄一下', ctaEn: 'I opened it - log it',
           headZh: '這瓶適合自己慢慢品嚐', headEn: 'Great for enjoying yourself',
           whenZh: '近期開來飲用最合適，不必久留', whenEn: 'Enjoy it soon' },
  keep:  { emoji: '💎', zh: '藏', en: 'Keep',  ctaZh: '好好收藏，不急著開', ctaEn: 'Keep it safe',
           headZh: '這瓶值得珍藏，等待更好的時機', headEn: 'Worth keeping for later',
           whenZh: '存放於陰涼避光處，遇到重要日子再開', whenEn: 'Store cool and dark, open on a big day' },
  gift:  { emoji: '🎁', zh: '送', en: 'Gift',  ctaZh: '分享給想送的人', ctaEn: 'Share with the lucky person',
           headZh: '這瓶送禮很體面', headEn: 'Makes a great gift',
           whenZh: '下次送禮或探訪長輩時使用', whenEn: 'Use it for your next gift' }
};
const VERDICT_ORDER = ['open', 'drink', 'keep', 'gift'];

function normVerdictKey(a) {
  a = String(a || '').toLowerCase();
  if (a === 'share' || a === 'open') return 'open';
  if (a === 'drink' || a === 'pair') return 'drink';
  if (a === 'keep' || a === 'store' || a === 'collect' || a === 'sell') return 'keep';
  if (a === 'gift') return 'gift';
  return '';
}

function bottleVM(b) {
  return calibrateValueMap(b.scan?.vm || safeIdentification(b).vm || {}, bottleCategory(b), bottleName(b));
}

function deriveVerdict(b) {
  const rec = b.scan?.rec || safeIdentification(b).rec || {};
  const vm = bottleVM(b);
  let key = normVerdictKey(rec.verdict) || normVerdictKey(rec.actions?.[0]?.a);
  if (!key) {
    const cv = Number(vm.cv || 0), sto = Number(vm.sto || 0), gv = Number(vm.gv || 0), sv = Number(vm.sv || 0);
    if (cv >= 60 || sto >= 60) key = 'keep';
    else if (gv >= 70 && gv >= sv) key = 'gift';
    else if (sv >= 65) key = 'open';
    else key = 'drink';
  }
  const zh = currentLang === 'zh';
  const v = VERDICTS[key];
  return {
    key,
    headline: rec.headline || (zh ? v.headZh : v.headEn),
    when: rec.when || (zh ? v.whenZh : v.whenEn),
    reason: rec.reason || ''
  };
}

function actionLabel(a) {
  const k = normVerdictKey(a);
  const v = VERDICTS[k];
  if (!v) return String(a || '');
  return currentLang === 'zh' ? v.zh : v.en;
}

function partyBannerHTML(b) {
  const zh = currentLang === 'zh';
  return b.party && !isVisitorMode ? `
    <div class="party-banner">
      🍾 ${zh ? '品鑑雅集' : 'Tasting gathering'}：${esc(b.party.date || '')} ${esc(b.party.place || '')}
      <button class="btn btn-primary btn-sm" onclick="finishPourParty('${esc(b.id)}')">${zh ? '活動結束，記錄這次' : 'Done - log it'}</button>
    </div>` : '';
}

function scoreReason(k, vm, zh) {
  const n = x => { const v = Number(x); return isFinite(v) && v > 0 ? v : 60; };
  const band = (v, hi, mid) => v >= hi ? 0 : v >= mid ? 1 : 2;
  const T = {
    gift: [['包裝、名氣與價位足以體面送禮','Label, name and price suit a proper gift'],['可作心意小禮，送予相熟朋友','A modest gift for close friends'],['不建議作禮物，較適合與朋友一同開來喝','Not a gift - better opened together with friends']],
    keep: [['具收藏與陳放價值，值得留待更好時機','Collectible and cellar-worthy - keep for later'],['略具收藏價值，可短期存放','Some keeping value - short-term storage'],['不具收藏價值，宜趁新鮮早飲','No keeping value - best drunk fresh']],
    drink: [['入口表現佳，適合自己慢慢品嚐','Drinks well - enjoy it at your own pace'],['表現中規中矩，日常小酌即可','Decent - fine for everyday sipping'],['入口表現一般，可留作料理或調飲','Average - use for cooking or mixing']],
    open: [['適合邀約友人共享，帶動話題','Great to open with friends and spark talk'],['小聚分享皆宜','Fine for a small gathering'],['話題性較低，宜自行品飲','Low talking-point - enjoy it alone']]
  };
  let i;
  if (k === 'gift') i = band(n(vm.gv), 70, 50);
  else if (k === 'keep') i = band(Math.max(n(vm.cv), n(vm.sto)), 65, 45);
  else if (k === 'drink') i = band(n(vm.dv), 70, 50);
  else i = band(n(vm.sv), 70, 50);
  return T[k][i][zh ? 0 : 1];
}

function renderVerdictCard(b) {
  const vmScore = bottleVM(b);
  const d = deriveVerdict(b);
  const v = VERDICTS[d.key];
  const zh = currentLang === 'zh';
  const rec = b.scan?.rec || safeIdentification(b).rec || {};
  const others = VERDICT_ORDER.filter(k => k !== d.key).map(k => {
    const hit = (rec.actions || []).find(a => normVerdictKey(a.a) === k);
    return { k, reason: hit?.reason || '' };
  });
  return `
    <div class="verdict-card verdict-${d.key}">
      <div class="verdict-eyebrow">${zh ? '這瓶酒該如何處理？' : 'What to do with it?'}</div>
      <div class="verdict-main">
        <div class="verdict-word">${v.emoji}<span>${zh ? v.zh : v.en}</span></div>
        <div class="verdict-text">
          <div class="verdict-headline">${esc(d.headline)}</div>
          <div class="verdict-when">🕒 ${esc(d.when)}</div>
        </div>
      </div>
      ${d.reason ? `<div class="verdict-reason">${esc(d.reason)}</div>` : ''}
      <details class="verdict-others" open>
        <summary>${zh ? '其他選擇' : 'Other options'}</summary>
        ${others.map(o => `
          <div class="verdict-other-row">
            <span class="verdict-other-tag">${VERDICTS[o.k].emoji} ${zh ? VERDICTS[o.k].zh : VERDICTS[o.k].en}</span>
            <span>${esc(scoreReason(o.k, vmScore, zh))}</span>
          </div>`).join('')}
      </details>
    </div>`;
}

async function verdictAct(id, key) {
  if (blockIfVisitor()) return;
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;
  if (key === 'drink') {
    if (b.status !== 'opened') { b.status = 'opened'; await saveBottleToDB(b); }
    renderBottleDetail(id);
    openAddSessionModal(id);
  } else if (key === 'open') {
    openPourParty(id);
  } else if (key === 'keep') {
    b.status = 'kept';
    await saveBottleToDB(b);
    showToast(currentLang === 'zh' ? '💎 已放入「收藏」，不急著開' : '💎 Moved to Kept');
    renderBottleDetail(id);
  } else if (key === 'gift') {
    openShareActionSheet(id);
    showToast(currentLang === 'zh' ? '🎁 贈出後，請在下方將酒移至「饋贈」' : '🎁 Tap "Gifted" below once given');
  }
}

/* ---------------- 稀有度與收集冊 ---------------- */
function rarityOf(b) {
  const vm = bottleVM(b);
  const score = Math.max(Number(vm.cv || 0), Number(vm.mv || 0) * 0.9);
  if (score >= 80) return { k: 'ssr', label: currentLang === 'zh' ? '傳說' : 'Legend' };
  if (score >= 60) return { k: 'sr', label: currentLang === 'zh' ? '珍稀' : 'Rare' };
  if (score >= 40) return { k: 'r', label: currentLang === 'zh' ? '精選' : 'Select' };
  return { k: 'n', label: currentLang === 'zh' ? '日常' : 'Everyday' };
}
function rarityBadge(b) {
  const r = rarityOf(b);
  return `<span class="rarity-badge rarity-${r.k}">${r.label}</span>`;
}

function collectionStats() {
  const c = window.cellar || [];
  const owned = c.filter(b => b.status !== 'wishlist');
  const countries = new Set(owned.map(b => bottleCountry(b)).filter(Boolean));
  const cats = new Set(owned.map(b => bottleCategory(b)).filter(Boolean));
  const pours = owned.reduce((n, b) => n + (b.tastings || []).length, 0);
  const ssr = owned.filter(b => rarityOf(b).k === 'ssr' || rarityOf(b).k === 'sr').length;
  return { total: owned.length, countries: countries.size, cats: cats.size, pours, rare: ssr };
}

function collectionCardHTML() {
  const s = collectionStats();
  if (!s.total) return '';
  const zh = currentLang === 'zh';
  const steps = [1, 5, 10, 25, 50, 100, 200];
  const next = steps.find(n => n > s.total) || (Math.ceil(s.total / 100) + 1) * 100;
  const prev = [...steps].reverse().find(n => n <= s.total) || 0;
  const pct = Math.max(4, Math.round(((s.total - prev) / (next - prev)) * 100));
  return `
    <div class="collect-card">
      <div class="collect-head">
        <div class="collect-title">🎴 ${zh ? '我的珍藏圖鑑' : 'My collection'}</div>
        <div class="collect-count">${s.total} / ${next}</div>
      </div>
      <div class="collect-bar"><div class="collect-fill" style="width:${pct}%"></div></div>
      <div class="collect-hint">${zh ? `再收 ${next - s.total} 張，就解鎖下一個里程碑` : `${next - s.total} more to the next milestone`}</div>
      <div class="collect-chips">
        <span>🌍 ${s.countries} ${zh ? '個國家' : 'countries'}</span>
        <span>🥂 ${s.cats} ${zh ? '種酒類' : 'types'}</span>
        <span>🥃 ${s.pours} ${zh ? '次開瓶' : 'pours'}</span>
        <span>✨ ${s.rare} ${zh ? '張珍稀卡' : 'rare'}</span>
      </div>
    </div>`;
}

/* ---------------- 開瓶局 ---------------- */
function openPourParty(id) {
  if (blockIfVisitor()) return;
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;
  const zh = currentLang === 'zh';
  const d = new Date(); d.setDate(d.getDate() + 7);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:370px; text-align:left;" onclick="event.stopPropagation()">
        <div style="font-family:var(--serif); font-size:19px; font-weight:700; color:var(--gold); margin-bottom:4px;">🍾 ${zh ? '邀約共飲' : 'Tasting gathering'}</div>
        <div style="font-size:13px; color:var(--text-muted); margin-bottom:10px;">${esc(bottleName(b))}</div>
        <div style="font-size:12px; color:var(--text-faint);">${zh ? '日期同時間' : 'When'}</div>
        <input type="datetime-local" id="party-date" class="text-input" value="${d.toISOString().slice(0, 16)}">
        <div style="font-size:12px; color:var(--text-faint); margin-top:8px;">${zh ? '地點' : 'Where'}</div>
        <input type="text" id="party-place" class="text-input" maxlength="40" placeholder="${zh ? '例如：我家、某間餐廳' : 'e.g. my place'}">
        <div style="font-size:12px; color:var(--text-faint); margin-top:8px;">${zh ? '想對朋友說的話（可留空）' : 'Message (optional)'}</div>
        <input type="text" id="party-msg" class="text-input" maxlength="80" placeholder="${zh ? '例如：珍藏了很久，終於可以打開' : ''}">
        <div style="display:flex; gap:8px; margin-top:14px;">
          <button class="btn btn-ghost btn-block" onclick="closeModal()">${zh ? '取消' : 'Cancel'}</button>
          <button class="btn btn-primary btn-block" onclick="sendPourParty('${esc(b.id)}')">${zh ? '發送邀請' : 'Send invite'}</button>
        </div>
      </div>
    </div>`;
}

async function sendPourParty(id) {
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;
  const zh = currentLang === 'zh';
  const raw = document.getElementById('party-date').value;
  const place = document.getElementById('party-place').value.trim();
  const msg = document.getElementById('party-msg').value.trim();
  const date = raw ? raw.replace('T', ' ') : '';
  b.party = { date, place, msg };
  await saveBottleToDB(b);
  const link = (typeof inviteLink === 'function' && inviteLink()) || location.origin + location.pathname;
  const text = zh
    ? `🍾 我想開「${bottleName(b)}」，${date}${place ? ' 在' + place : ''}，一起來品嚐嗎？${msg ? '\n' + msg : ''}\n我用 BottleSense 記錄每次開瓶：`
    : `🍾 Let's open "${bottleName(b)}" ${date}${place ? ' at ' + place : ''}.${msg ? '\n' + msg : ''}\nI log every bottle with BottleSense:`;
  closeModal();
  renderBottleDetail(id);
  try {
    if (navigator.share) { await navigator.share({ title: 'BottleSense', text, url: link }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text + ' ' + link); showToast(zh ? '✓ 邀請已複製，貼給朋友吧' : '✓ Invite copied'); }
  catch (e) { prompt(zh ? '複製邀請：' : 'Copy invite:', text + ' ' + link); }
}

async function finishPourParty(id) {
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;
  const p = b.party || {};
  if (b.status !== 'opened') b.status = 'opened';
  await saveBottleToDB(b);
  openAddSessionModal(id);
  setTimeout(() => {
    const loc = document.getElementById('sess-loc'); if (loc && p.place) loc.value = p.place;
    const dt = document.getElementById('sess-date'); if (dt && p.date) dt.value = p.date.replace(' ', 'T');
  }, 30);
}

/* ---------------- 品鑑紀念卡 ---------------- */
function loadImageForCanvas(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

function wrapCanvasText(ctx, text, maxW, maxLines) {
  const lines = []; let line = '';
  for (const ch of String(text)) {
    if (ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; if (lines.length >= maxLines) break; }
    else line += ch;
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

async function drawMemoryCard(b, s, withPhoto) {
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b1410'); g.addColorStop(1, '#0b0907');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 6; ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(54, 54, W - 108, H - 108);
  let y = 150;
  const zh = currentLang === 'zh';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#D4AF37'; ctx.font = '600 34px sans-serif';
  ctx.fillText(zh ? '— 值得紀念的一刻 —' : '— A moment to remember —', W / 2, y);
  y += 40;
  let drawn = false;
  if (withPhoto) {
    const im = await loadImageForCanvas(bottleImage(b));
    if (im) {
      const box = 520, r = Math.min(box / im.width, box / im.height);
      const w = im.width * r, h = im.height * r;
      ctx.save(); ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect((W - w) / 2, y, w, h, 28); else ctx.rect((W - w) / 2, y, w, h);
      ctx.clip(); ctx.drawImage(im, (W - w) / 2, y, w, h); ctx.restore();
      y += h + 40; drawn = true;
    }
  }
  if (!drawn) {
    ctx.save(); ctx.translate(W / 2 - 130, y + 10); ctx.scale(10.8, 10.8);
    ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 0.35; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke(new Path2D('M10 3h4v4.2c0 .8.5 1.3 1.2 2A5 5 0 0 1 16.5 12.5V19a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-6.5a5 5 0 0 1 1.3-3.3c.7-.7 1.2-1.2 1.2-2zM8.5 14h7M8.5 17.5h7'));
    ctx.restore(); y += 300;
  }
  ctx.fillStyle = '#f5e8c8'; ctx.font = '700 54px serif';
  for (const ln of wrapCanvasText(ctx, bottleName(b), W - 220, 2)) { ctx.fillText(ln, W / 2, y + 50); y += 66; }
  y += 20;
  ctx.fillStyle = '#D4AF37'; ctx.font = '48px serif';
  ctx.fillText('★'.repeat(s.rating || 5), W / 2, y + 40); y += 90;
  ctx.fillStyle = '#e9dcc0'; ctx.font = '36px sans-serif';
  const meta = [s.dateStr ? s.dateStr.slice(0, 10) : '', s.location ? (zh ? '地點：' : 'At ') + s.location : '', s.companions ? (zh ? '同席：' : 'With ') + s.companions : ''].filter(Boolean);
  for (const m of meta) { ctx.fillText(m, W / 2, y + 30); y += 52; }
  if (s.notes) {
    y += 20; ctx.fillStyle = '#cdbf9f'; ctx.font = 'italic 36px serif';
    for (const ln of wrapCanvasText(ctx, '「' + s.notes + '」', W - 240, 3)) { ctx.fillText(ln, W / 2, y + 30); y += 50; }
  }
  ctx.fillStyle = 'rgba(212,175,55,0.8)'; ctx.font = '600 30px sans-serif';
  ctx.fillText('BottleSense · Know what to do with it', W / 2, H - 90);
  return cv;
}

async function openMemoryCard(bottleId, sessionId) {
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;
  const s = (b.tastings || []).find(x => String(x.id) === String(sessionId)) || b.tastings?.[0];
  if (!s) return;
  const zh = currentLang === 'zh';
  let cv;
  try {
    cv = await drawMemoryCard(b, s, true);
    cv.toDataURL('image/png'); // 圖片跨域時會丟錯
  } catch (e) { cv = await drawMemoryCard(b, s, false); }
  window._memoryCanvas = cv;
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:380px; text-align:center;" onclick="event.stopPropagation()">
        <div style="font-family:var(--serif); font-size:18px; font-weight:700; color:var(--gold); margin-bottom:8px;">🖼️ ${zh ? '這次的品鑑紀念卡' : 'Memory card'}</div>
        <img src="${cv.toDataURL('image/png')}" alt="" style="width:100%; border-radius:12px;">
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="btn btn-ghost btn-block" onclick="closeModal()">${zh ? '關閉' : 'Close'}</button>
          <button class="btn btn-primary btn-block" onclick="shareMemoryCard()">${zh ? '分享 / 儲存' : 'Share / Save'}</button>
        </div>
      </div>
    </div>`;
}

async function shareMemoryCard() {
  const cv = window._memoryCanvas; if (!cv) return;
  const zh = currentLang === 'zh';
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'bottlesense-memory.png', { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'BottleSense' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'bottlesense-memory.png';
  document.body.appendChild(a); a.click(); a.remove();
  showToast(zh ? '✓ 已儲存圖片' : '✓ Saved');
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
    { key:'kept', label: t('space_kept') },
    { key:'gifted', label: t('space_gift') },
    { key:'wishlist', label: t('space_wish') }
  ];

  main.innerHTML = `
    <div class="view" style="padding-bottom: 60px;">
      <div class="back-row">
        <button class="btn btn-ghost" style="padding:8px 14px; font-size:14px;" onclick="${currentView === 'cellar' ? 'renderCellar()' : 'goHome()'}">
          ${t('back')}
        </button>
        ${isVisitorMode ? '' : `<div style="display:flex; gap:8px; align-items:center;">
          <button class="fav-btn ${b.isFavorite ? 'on' : ''}" aria-label="${currentLang==='zh'?'加入最愛':'Favorite'}" onclick="toggleFavorite('${esc(b.id)}', true)">${b.isFavorite ? '★' : '☆'}</button>
          <button class="share-plane-btn" onclick="openShareActionSheet('${esc(b.id)}')">
            ${TELEGRAM_PLANE_SVG}
            <span>${t('share_bottle')}</span>
          </button>
        </div>`}
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
          ${isVisitorMode ? '' : `<button class="edit-badge-btn" onclick="openEditBottleModal('${esc(b.id)}')">
            ${EDIT_PENCIL_SVG} ${t('edit_info')}
          </button>`}
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

      <!-- 2. 八維價值地圖 (數據先行) -->
      ${(() => { const r = renderRadar(vm); return r ? `${r}` : ''; })()}

      <!-- 3. 建議 -->
      ${renderVerdictCard(b)}

      <!-- 4. 轉移藏酒空間 (單行極致收窄膠囊列) -->
      ${isVisitorMode ? '' : `<div class="info-block">
        <h3 style="font-size:14px; margin-bottom:6px;">${t('transfer_title')}</h3>
        <div class="destination-strip ${currentLang==='zh'?'dest-zh':'dest-en'}">
          ${statuses.map(s => `
            <div class="dest-pill ${b.status===s.key?'active':''}" onclick="moveStatus('${esc(b.id)}','${s.key}')">
              ${s.label}
            </div>
          `).join('')}
        </div>
      </div>`}

      <!-- 5. 品鑑紀錄：所有互動集中於此 -->
      ${timelineHTML(b)}

      ${isVisitorMode ? '' : `<div id="offers-slot"></div>`}

      ${isVisitorMode ? `<div style="margin-top:24px; text-align:center;"><button class="btn btn-primary btn-block" onclick="exitVisitorMode()">${currentLang==='zh'?'返回我的酒窖':'Back to my cellar'}</button></div>` : `<div style="margin-top:24px;">
        <button class="btn btn-quiet btn-block" onclick="deleteBottle('${esc(b.id)}')">${t('btn_remove')}</button>
      </div>`}
    </div>
  `;
  loadOffersInto(b.id);
}

function timelineHTML(b) {
  const zh = currentLang === 'zh';
  const list = b.tastings || [];
  const isExpanded = window['timeline_expanded_' + b.id];
  const shown = isExpanded ? list : list.slice(0, 4);
  const vis = isVisitorMode;
  const canInvite = !vis && ['unopened','opened','kept'].includes(b.status);
  const hasParty = !!(b.party && !vis);
  const party = hasParty ? `
    <div class="tl-item tl-left">
      <span class="tl-dot tl-dot-party"></span>
      <div class="tl-card tl-card-party">
        <div class="tl-party-tag">${zh ? '共飲邀約' : 'Pour invitation'}</div>
        <div class="tl-party-info">${esc(b.party.date || '')}<br>${esc(b.party.place || '')}</div>
        <button class="btn btn-primary btn-sm" onclick="finishPourParty('${esc(b.id)}')">${zh ? '記錄這次' : 'Log it'}</button>
      </div>
    </div>` : '';
  const items = shown.map((x, i0) => {
    const idx = i0 + (hasParty ? 1 : 0);
    const side = idx % 2 === 0 ? 'tl-left' : 'tl-right';
    const op = Math.max(0.42, 1 - idx * 0.13).toFixed(2);
    return `
    <div class="tl-item ${side}" style="opacity:${op}">
      <span class="tl-dot"></span>
      <div class="tl-card ${vis ? '' : 'tl-click'}" ${vis ? '' : `onclick="openMemoryCard('${esc(b.id)}', '${esc(x.id)}')"`}>
        <div class="tl-date">${esc(x.dateStr || x.date || '')}</div>
        <div class="tl-stars">${'&#9733;'.repeat(x.rating || 5)}</div>
        ${x.location ? `<div class="tl-meta">📍 ${esc(x.location)}</div>` : ''}
        ${x.companions ? `<div class="tl-meta">👥 ${esc(x.companions)}</div>` : ''}
        ${x.notes ? `<div class="tl-notes">&ldquo;${esc(x.notes)}&rdquo;</div>` : ''}
        ${vis ? '' : `<div class="tl-actions">
          <button onclick="event.stopPropagation(); togglePublishSession('${esc(b.id)}', '${esc(x.id)}')">${x.isPublic ? (zh ? '撤回' : 'Retract') : (zh ? '發布' : 'Publish')}</button>
          <button onclick="event.stopPropagation(); openShareActionSheet('${esc(b.id)}', '${esc(x.id)}')">${zh ? '分享' : 'Share'}</button>
        </div>`}
      </div>
    </div>`;
  }).join('');
  const more = (list.length > 4 && !isExpanded)
    ? `<div class="tl-more"><button class="btn btn-ghost btn-sm" onclick="expandTimeline('${esc(b.id)}')">${zh ? '展開全部 ' + list.length + ' 筆' : 'Show all ' + list.length}</button></div>` : '';
  const empty = (!list.length && !party)
    ? `<div class="tl-empty">${t('no_logs')}</div>` : '';
  return `
      <div class="info-block tl-block" id="tasting-timeline-block">
        <div class="tl-titlebar">
          <h3>${t('timeline_title')}</h3>
          ${vis ? '' : `<div class="tl-tools">
            <button class="btn btn-primary btn-sm" onclick="openAddSessionModal('${esc(b.id)}')">+ ${zh ? '記錄' : 'Log'}</button>
            ${canInvite ? `<button class="btn btn-ghost btn-sm tl-invite" onclick="openPourParty('${esc(b.id)}')">${TELEGRAM_PLANE_SVG}<span>${zh ? '約飲' : 'Invite'}</span></button>` : ''}
          </div>`}
        </div>
        <div style="font-size:13px; color:var(--text-faint); margin-bottom:14px;">${t('timeline_hint')}</div>
        ${empty}
        <div class="tl">
          ${party}${items}
          ${more}
          <div class="tl-end"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 20 3 6h18z"/></svg><span>${zh ? '期待無盡時光' : 'Endless moments await'}</span></div>
        </div>
      </div>`;
}

function renderRadar(vm) {
  const dimKeys = ['mv','ql','dv','pv','sv','gv','cv','sto'];
  const dimZh = { mv:"市場價值", ql:"品質工藝", dv:"飲用愉悅", pv:"配餐價值", sv:"社交話題", gv:"饋贈體面", cv:"收藏價值", sto:"陳放潛力" };
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
  const zhL = currentLang === 'zh';
  const total = Math.round(vals.reduce((a, v) => a + v, 0) / vals.length);
  const grade = total >= 80 ? { k: 'a', t: zhL ? '優秀' : 'Excellent' } : total >= 60 ? { k: 'b', t: zhL ? '及格' : 'Pass' } : { k: 'c', t: zhL ? '未及格' : 'Below pass' };
  const dimDescZh = { mv:'市場行情與稀缺程度', ql:'產區、釀造工藝與風味完成度', dv:'入口表現與易飲程度', pv:'搭配不同餐飲的彈性', sv:'適合分享、帶動話題', gv:'作為禮物的分量與體面', cv:'保值、升值與紀念意義', sto:'可存放年期與陳年潛力' };
  const dimDescEn = { mv:'Market price and scarcity', ql:'Terroir, craft and flavour finish', dv:'Approachability and enjoyment', pv:'Flexibility with food', sv:'Good for sharing and conversation', gv:'Weight and prestige as a gift', cv:'Value retention and sentiment', sto:'Cellaring years and ageing potential' };
  const dd = zhL ? dimDescZh : dimDescEn;
  const infoHTML = `
    <div class="ri-rule">${zhL ? '每項滿分 100。60 分為及格線(圖中虛線),80 分以上為優秀。綜合分為八項平均。' : 'Each axis is scored out of 100. 60 is the pass mark (dashed ring), 80+ is excellent. Overall is the average of the eight.'}</div>
    ${dimKeys.map(k => `<div class="ri-row"><b>${labels[k]}</b><span>${dd[k]}</span></div>`).join('')}
    <div class="ri-foot">${zhL ? '分數由 AI 依酒標資訊評估,僅供參考。' : 'Scores are AI estimates from the label, for reference only.'}</div>`;
  
  // 同心圓刻度線 (50 與 100)
  const rings = [0.6, 1.0].map(f => {
    const ringPts = dimKeys.map((k,i)=>{
      const angle = (Math.PI*2*i/n) - Math.PI/2;
      return [cx + R*f*Math.cos(angle), cy + R*f*Math.sin(angle)].join(',');
    }).join(' ');
    return `<polygon points="${ringPts}" fill="none" stroke="#2a2e1d" stroke-dasharray="${f===0.6?'3,3':'none'}" stroke-width="1"/>`;
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
      <div class="radar-head">
        <h3>${currentLang === 'zh' ? '八維價值地圖' : 'Eight-Dimension Value Map'}</h3>
        <button class="radar-info-btn" aria-label="info" onclick="this.closest('.radar-wrap').querySelector('.radar-info').classList.toggle('open')">!</button>
      </div>
      <div class="radar-total"><span class="rt-score">${total}</span><span class="rt-grade rt-${grade.k}">${grade.t}</span><span class="rt-note">${currentLang === 'zh' ? '綜合分 ・ 及格線 60' : 'Overall ・ pass mark 60'}</span></div>
      <div class="radar-info">${infoHTML}</div>
      <svg width="100%" viewBox="-44 -6 368 292" style="max-width:380px; margin:0 auto; display:block;">
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
      <h3>${currentLang === 'zh' ? '處理建議' : 'Guidance'}</h3>
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
            <div class="action-title">${esc(actionLabel(a.a))}</div>
            <div class="action-reason">${esc(a.reason||'')}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function moveStatus(id, newStatus) {
  if (blockIfVisitor()) return;
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;
  const wasWish = b.status === 'wishlist';
  b.status = newStatus;
  await saveBottleToDB(b);
  if (newStatus === 'wishlist' && !wasWish) sendDemandSignal('wishlist', b);
  renderBottleDetail(id);
}

function openEditBottleModal(id) {
  if (blockIfVisitor()) return;
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:380px; text-align:left;" onclick="event.stopPropagation()">
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
  if (blockIfVisitor()) return;
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
  if (blockIfVisitor()) return;
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const defaultIso = now.toISOString().slice(0, 16);
  currentSessionRating = 5;
  selectedSessionCity = '';
  selectedSessionScene = '';

  const cities = currentLang === 'zh' ? ['中環', '尖沙咀', '銅鑼灣', '旺角', '台中', '高雄', '台北', '東京', '大阪', '澳門'] : ['Central', 'Tsim Sha Tsui', 'Causeway Bay', 'Mong Kok', 'Taichung', 'Kaohsiung', 'Taipei', 'Tokyo', 'Osaka', 'Macau'];
  const scenes = currentLang === 'zh' ? ['家中陽台', '酒吧', '居酒屋', '露營星空下', '海邊', '朋友聚會', '餐廳'] : ['Home Balcony', 'Bar', 'Izakaya', 'Camping', 'Beach', 'Gathering', 'Restaurant'];

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:390px; text-align:left; max-height:calc(var(--vvh, 100dvh) - 40px); overflow-y:auto; -webkit-overflow-scrolling:touch;" onclick="event.stopPropagation()">
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
  if (blockIfVisitor()) return;
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;
  if (typeof uploadPhotoIfNeeded === 'function' && await uploadPhotoIfNeeded(b)) await saveBottleToDB(b);

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
  delete b.party;
  await saveBottleToDB(b);
  closeModal();
  renderBottleDetail(bottleId);
  openMemoryCard(bottleId, newSession.id);
}

function openShareActionSheet(bottleId, sessionId = null) {
  if (blockIfVisitor()) return;
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-card" role="dialog" aria-modal="true" style="text-align:left;" onclick="event.stopPropagation()">
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

// 探索池記錄 id：一筆品飲記錄只對應一個 id，重複發布只會取代
function exploreItemId(bottleId, sessionId) {
  return sessionId ? `${bottleId}_${sessionId}` : String(bottleId);
}

let _myShareIdCache = null;
async function getMyShareId() {
  if (_myShareIdCache) return _myShareIdCache;
  try {
    const key = getOrCreateSyncKey();
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bottlesense-share:' + key));
    const hex = Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');
    _myShareIdCache = 'S' + hex.slice(0, 20);
  } catch(e) { _myShareIdCache = ''; }
  return _myShareIdCache;
}

async function unpublishFromCommunityPool(bottleId, sessionId) {
  const ids = [exploreItemId(bottleId, sessionId), String(bottleId)];
  try {
    await apiFetch('/api/explore/delete', {
      method: 'POST',
      body: JSON.stringify({ ids, syncKey: getOrCreateSyncKey() })
    });
  } catch(e) {}
}

async function publishToCommunityPool(bottleId, sessionId) {
  if (blockIfVisitor()) return;
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;
  if (!localStorage.getItem('bottlesense_account_bound')) {
    showToast(currentLang === 'zh' ? '🔒 請先登入帳號，先可以公開發布到探索' : '🔒 Please sign in to publish');
    setTimeout(() => openSettings('auth'), 500);
    return;
  }
  if (await uploadPhotoIfNeeded(b)) await saveBottleToDB(b);
  const s = sessionId ? (b.tastings || []).find(t => String(t.id) === String(sessionId)) : null;

  const payload = {
    id: exploreItemId(bottleId, sessionId),
    syncKey: getOrCreateSyncKey(),
    author: localStorage.getItem('bottlesense_profile_name') || localStorage.getItem('bottlesense_owner_name') || '品飲同好',
    identification: b.identification,
    image: b.image,
    personalRating: s ? s.rating : (b.personalRating || 5),
    diary: { notes: s ? s.notes : (b.tastings?.[0]?.notes || '品鑑佳釀') },
    location: s?.location || b.identification?.region || b.tags?.region || '世界名釀',
    tastingLocation: (s?.location || '').trim(),
    publishedAt: Date.now()
  };

  try {
    const pr = await apiFetch('/api/explore/publish', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!pr.ok) {
      let c = '', d = {}; try { d = await pr.json(); c = d.error; } catch (e) {}
      showToast(apiErrorMessage(c, d) || (currentLang === 'zh' ? '發布失敗' : 'Publish failed'));
      return;
    }
    let pj = {}; try { pj = await pr.json(); } catch (e) {}
    showToast(pj.status === 'pending' ? (currentLang === 'zh' ? '✓ 已提交，審核通過後會顯示在探索' : '✓ Submitted for review') : t('published_toast'));
  } catch(e) {
    showToast(t('published_toast'));
  }
}

function executePrivateShare(bottleId, sessionId) {
  if (sessionId) shareSingleSession(bottleId, sessionId);
  else shareSingleBottle(bottleId);
}

async function publishCellarForShare() {
  const key = getOrCreateSyncKey();
  const ownerName = localStorage.getItem('bottlesense_profile_name') || '品飲家';
  try {
    const res = await apiFetch('/api/cellar/publish', {
      method: 'POST',
      body: JSON.stringify({ syncKey: key, cellar: window.cellar, ownerName })
    });
    const data = await res.json();
    if (res.ok && data.shareId) return data.shareId;
  } catch(e) {}
  showToast(currentLang === 'zh' ? '分享連結建立失敗，請檢查網路後重試' : 'Could not create share link, please retry');
  return null;
}

async function shareEntireCellar() {
  if (blockIfVisitor()) return;
  if (!window.cellar || !window.cellar.length) return;
  const shareId = await publishCellarForShare();
  if (!shareId) return;
  const shareUrl = `${location.origin}${location.pathname}?cellar=${encodeURIComponent(shareId)}${refSuffix()}`;
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
  if (blockIfVisitor()) return;
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;
  const shareId = await publishCellarForShare();
  if (!shareId) return;
  const shareUrl = `${location.origin}${location.pathname}?cellar=${encodeURIComponent(shareId)}&bottle=${b.id}${refSuffix()}`;
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
  if (blockIfVisitor()) return;
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;
  const s = (b.tastings || []).find(t => String(t.id) === String(sessionId));
  if (!s) return;
  const shareId = await publishCellarForShare();
  if (!shareId) return;
  const shareUrl = `${location.origin}${location.pathname}?cellar=${encodeURIComponent(shareId)}&bottle=${b.id}${refSuffix()}`;
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

  // 韓國 / 澳洲 / 紐西蘭
  '韓國': { top: 31.6, left: 81.7 }, 'korea': { top: 31.6, left: 81.7 }, '燒酒': { top: 31.6, left: 81.7 }, 'soju': { top: 31.6, left: 81.7 }, '馬格利': { top: 31.6, left: 81.7 }, 'makgeolli': { top: 31.6, left: 81.7 },
  '澳洲': { top: 72.5, left: 83.0 }, 'australia': { top: 72.5, left: 83.0 }, '巴羅薩': { top: 74.0, left: 82.0 }, 'barossa': { top: 74.0, left: 82.0 },
  '紐西蘭': { top: 83.0, left: 92.0 }, '新西蘭': { top: 83.0, left: 92.0 }, 'new zealand': { top: 83.0, left: 92.0 }, '馬爾堡': { top: 83.0, left: 92.0 }, 'marlborough': { top: 83.0, left: 92.0 },

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

let isRegionalMapActive = false;
let currentRegionalMapKey = 'map_world';
let regionalZoom = 1;
let regionalPanX = 0, regionalPanY = 0;
let regionalFlyToken = 0;

// 地區地圖 (GitHub 上的 map_*.webp)：圖片比例與各產區 Pin 座標
// 座標 = 圖片本身的百分比位置 [名稱, left%, top%, 關鍵字(用 | 分隔；以 / 開頭為正則)]
const REGIONAL_MAPS = [
  { key: 'map_hk', name: '香港', nameEn: 'Hong Kong', ratio: 1.5, pins: [
    ['中環', 58, 64, '中環|上環|金鐘|蘭桂坊|灣仔|銅鑼灣|causeway bay|wan chai|/\\bcentral\\b'],
    ['尖沙咀', 57, 57, '尖沙咀|tsim sha tsui'],
    ['旺角・九龍', 59, 54, '旺角|mong kok|九龍|kowloon|觀塘|大角咀'],
    ['沙田', 62, 46, '沙田|火炭|少爺|young master|大圍|sha tin'],
    ['新界', 50, 36, '新界|元朗|屯門|天水圍|大埔|tuen mun|yuen long'],
    ['黃竹坑', 58, 69, '黃竹坑|白蘭樹下|perfume trees|wong chuk hang|香港仔|赤柱'],
    ['西貢', 76, 50, '西貢|sai kung'],
    ['大嶼山', 22, 70, '大嶼山|lantau|東涌|赤鱲角']
  ], fallback: [['香港', 58, 58, '香港|hong kong']] },
  { key: 'map_taiwan', name: '台灣', nameEn: 'Taiwan', ratio: 1.5, pins: [
    ['台北', 62, 12, '台北|taipei|新北|基隆|酉鬼|掌門'],
    ['桃園', 54, 17, '桃園|taoyuan'],
    ['新竹', 52, 23, '新竹|hsinchu'],
    ['宜蘭・噶瑪蘭', 64, 21, '宜蘭|yilan|噶瑪蘭|kavalan|員山|金車'],
    ['台中', 43, 40, '台中|taichung|彰化'],
    ['南投・Omar', 52, 44, '南投|nantou|omar|歐瑪|埔里'],
    ['花蓮', 61, 41, '花蓮|hualien'],
    ['嘉義', 41, 57, '嘉義|chiayi'],
    ['台南', 39, 66, '台南|tainan'],
    ['高雄', 42, 74, '高雄|kaohsiung'],
    ['屏東', 46, 80, '屏東|pingtung|墾丁|kenting'],
    ['台東', 56, 68, '台東|taitung'],
    ['澎湖', 25, 40, '澎湖|penghu'],
    ['金門', 21, 45, '金門|kinmen|馬祖|高粱']
  ], fallback: [['台灣', 52, 48, '台灣|臺灣|taiwan']] },
  { key: 'map_japan', name: '日本', nameEn: 'Japan', ratio: 1.5, pins: [
    ['沖繩', 20.6, 91, '沖繩|沖縄|okinawa|泡盛|awamori|琉球|那霸|naha|殘波|菊之露'],
    ['鹿兒島', 28, 80, '鹿兒島|鹿児島|kagoshima|薩摩|森伊藏|魔王|村尾'],
    ['九州', 29, 70, '九州|kyushu|熊本|宮崎|長崎|大分'],
    ['福岡', 30, 63, '福岡|fukuoka'],
    ['山口', 35, 57, '山口|獺祭|dassai|旭酒造'],
    ['廣島', 40, 57, '廣島|hiroshima|賀茂鶴'],
    ['山崎蒸餾所', 48, 59, '山崎|yamazaki|suntory|三得利|hibiki'],
    ['兵庫・灘五鄉', 47, 59, '兵庫|神戶|kobe|灘五鄉|黑松白扇|山田錦'],
    ['大阪', 49, 60, '大阪|osaka'],
    ['京都', 49, 57, '京都|kyoto|伏見|月桂冠'],
    ['山梨・白州', 57, 57, '山梨|白州|hakushu|勝沼|甲州'],
    ['長野', 56, 52, '長野|nagano|信州|駒之岳|真澄'],
    ['東京', 59, 59, '東京|tokyo|關東|埼玉|秩父|chichibu|橫濱|yokohama'],
    ['新潟', 59, 44, '新潟|niigata|越後|久保田|八海山|越乃寒梅'],
    ['東北', 64, 38, '東北|宮城|仙台|sendai|十四代|新政|青森|山形|秋田'],
    ['北海道・余市', 66, 14, '北海道|hokkaido|余市|yoichi|nikka|札幌|sapporo']
  ], fallback: [['日本', 52, 58, '日本|japan|清酒|sake|燒酎']] },
  { key: 'map_china', name: '中國', nameEn: 'China', ratio: 1.5, pins: [
    ['貴州・茅台', 50, 70, '茅台|maotai|moutai|貴州|醬香'],
    ['四川', 46, 64, '四川|sichuan|五糧液|瀘州|劍南春|宜賓'],
    ['寧夏', 48, 43, '寧夏|ningxia|賀蘭山'],
    ['山西', 58, 45, '山西|汾酒'],
    ['山東', 72, 45, '山東|青島|tsingtao'],
    ['紹興', 70, 61, '紹興|浙江|古越龍山|黃酒|shaoxing'],
    ['北京', 65, 35, '北京|beijing|二鍋頭']
  ], fallback: [['中國', 55, 55, '中國|china']] },
  { key: 'map_russia', name: '俄羅斯', nameEn: 'Russia', ratio: 2.0, pins: [
    ['莫斯科', 16, 51, '莫斯科|moscow'],
    ['聖彼得堡', 14, 40, '聖彼得堡|petersburg'],
    ['西伯利亞', 50, 65, '西伯利亞|siberia|beluga|白鯨']
  ], fallback: [['俄羅斯', 45, 55, '俄羅斯|russia|伏特加|vodka']] },
  { key: 'map_scotland', name: '蘇格蘭', nameEn: 'Scotland', ratio: 0.6667, pins: [
    ["施特蘭群島", 87.9, 13, "shetland|設得蘭"],
    ["奧克尼", 70.8, 21.8, "orkney|highland park|高原騎士|scapa"],
    ["劉易斯島", 29.3, 29.6, "stornoway|isle of lewis|abhainn"],
    ["哈里斯島", 21, 37.4, "isle of harris|harris distill"],
    ["斯開島", 24.9, 46.5, "斯開|skye|talisker|泰斯卡"],
    ["因弗內斯", 59.8, 40.7, "inverness|因弗尼斯"],
    ["威廉堡", 45.4, 52.4, "fort william|ben nevis|尼維斯"],
    ["斯貝賽", 67.4, 45.6, "斯貝賽|speyside|macallan|麥卡倫|glenfiddich|格蘭菲迪|glenlivet|格蘭利威|balvenie|百富|aberlour|亞伯樂|cardhu|glenfarclas|cragganmore|benriach|glenrothes|mortlach|craigellachie|strathisla|tamdhu|glen grant|knockando"],
    ["阿伯丁", 81.8, 52.4, "aberdeen|阿伯丁|glen garioch|royal lochnagar"],
    ["達爾莫", 56.2, 39.1, "dalmore|大摩|glenmorangie|格蘭傑|balblair|dalwhinnie|達爾維尼"],
    ["威克", 68.4, 30.6, "/\\bwick\\b|pulteney|old pulteney|富特尼|clynelish|克萊根"],
    ["奧本", 36.3, 65.8, "/\\boban\\b|奧本|oban distill|ardnamurchan"],
    ["艾雷島", 22, 73.9, "艾雷|islay|ardbeg|雅柏|laphroaig|拉佛格|lagavulin|樂加維林|bowmore|波摩|bruichladdich|布萊迪|bunnahabhain|布納哈本|caol ila|kilchoman|octomore"],
    ["朱拉島", 26.2, 70.6, "isle of jura|jura distill|jura whisky|吉拉"],
    ["坎貝爾城", 32.2, 81.7, "campbeltown|坎貝爾|springbank|雲頂|glen scotia|glengyle|kilkerran"],
    ["阿蘭島", 38.3, 79.1, "isle of arran|/\\barran\\b|arran distill"],
    ["格拉斯哥", 49.3, 70.3, "glasgow|格拉斯哥|auchentoshan|歐肯|glengoyne|格蘭哥尼|loch lomond"],
    ["珀斯郡", 58.6, 60.5, "perthshire|珀斯郡|aberfeldy|blair athol|edradour|glenturret|tullibardine|deanston"],
    ["聖安德魯斯", 77.1, 66.1, "st andrews|聖安德魯|/\\bfife\\b|kingsbarns|eden mill"],
    ["愛丁堡", 70.3, 69.7, "edinburgh|愛丁堡|glenkinchie|格蘭金奇|lothian|holyrood"],
    ["邊境", 68.4, 81.4, "scottish borders|邊境區|lindores"],
    ["加洛韋", 46.9, 86.6, "galloway|加洛韋|bladnoch"],
    ["艾爾郡", 42, 79.8, "ayrshire|艾爾郡|girvan|kilbirnie|ailsa"]
  ], fallback: [["蘇格蘭", 54.7, 53.4, "蘇格蘭|scotland|scotch|高地|highland|低地|lowland|蘇格蘭威士忌"]] },
  { key: 'map_britain_and_ireland', name: '英國・愛爾蘭', nameEn: 'Britain & Ireland', ratio: 0.6667, pins: [
    ["倫敦", 79.6, 74.2, "倫敦|london|琴酒|beefeater|tanqueray"],
    ["肯特", 88.4, 80.4, "/\\bkent\\b|肯特|chapel down|英格蘭南部"],
    ["薩塞克斯", 76.2, 82.7, "sussex|薩塞克斯|ridgeview|nyetimber|hampshire|漢普郡"],
    ["康沃爾", 41, 86.9, "cornwall|康沃爾|camel valley|sharp's"],
    ["德文", 50.8, 83.7, "devon|德文|plymouth gin|普利茅斯"],
    ["威爾士", 48.8, 71.6, "/(?<!new south )wales|威爾士|penderyn|彭德林"],
    ["科茨沃爾德", 68.4, 71, "cotswold|科茨沃爾德|oxford|牛津|/\\bbath\\b|bristol|布里斯托"],
    ["中部地區", 67.4, 67.1, "midlands|中部|birmingham|伯明翰|leicester|萊斯特|nottingham"],
    ["曼徹斯特", 64.5, 57.3, "manchester|曼徹斯特|liverpool|利物浦|cheshire"],
    ["湖區", 60.5, 50.5, "lake district|湖區|lakes distill|cumbria"],
    ["約克郡", 74.2, 52.1, "yorkshire|約克郡|leeds|利茲|sheffield"],
    ["諾福克", 90.8, 67.7, "norfolk|諾福克|suffolk|薩福克|cambridge|劍橋|essex"],
    ["貝爾法斯特", 41.5, 49.2, "belfast|貝爾法斯特|northern ireland|北愛爾蘭|bushmills|布什米爾"],
    ["安特里姆", 33.2, 45.6, "antrim|安特里姆|giant's causeway"],
    ["都柏林", 38.3, 57.3, "dublin|都柏林|jameson|尊美醇|guinness|健力士|teeling|redbreast|紅雀|green spot|midleton|米德爾頓"],
    ["科克", 20, 71.9, "/\\bcork\\b|科克|west cork|ballykeefe"],
    ["凱里", 9.3, 70.6, "kerry|凱里|dingle|丁格爾"],
    ["戈爾韋", 11.7, 57.3, "galway|戈爾韋|connemara|康納馬拉"],
    ["利默里克", 19, 65.8, "limerick|利默里克|tipperary"],
    ["韋斯特米斯", 29.3, 57.3, "westmeath|韋斯特米斯|tullamore|圖拉莫爾|kilbeggan|offaly"],
    ["愛丁堡", 64, 39.7, "edinburgh.*england"]
  ], fallback: [["愛爾蘭", 24.4, 60.5, "愛爾蘭|ireland|irish whiskey|愛爾蘭威士忌"], ["英國", 68.4, 68.4, "英國|england|英格蘭|united kingdom|/\\buk\\b|british|britain|大不列顛"]] },
  { key: 'map_france', name: '法國', nameEn: 'France', ratio: 1.0942, pins: [
    ["波爾多", 31.3, 66.1, "波爾多|bordeaux|左岸|右岸|margaux|瑪歌|pauillac|波雅克|latour|拉圖|lafite|拉菲|mouton|木桐|haut-brion|st-emilion|saint-emilion|聖愛美濃|pomerol|波美侯|sauternes|索甸|graves|pessac|petrus|柏圖斯|cheval blanc"],
    ["梅多克", 27.4, 61.7, "medoc|梅多克|st-julien|聖朱利安|st-estephe|聖埃斯泰夫|moulis|haut-medoc"],
    ["干邑", 33.1, 57, "cognac|干邑|hennessy|軒尼詩|remy martin|人頭馬|martell|馬爹利|courvoisier|拿破崙"],
    ["香檳", 63.6, 21.9, "香檳|champagne|reims|epernay|dom perignon|唐培里儂|krug|bollinger|taittinger|roederer|酩悅|veuve|clicquot|寶祿爵|ruinart"],
    ["伯恩", 69.4, 44.3, "beaune|伯恩|勃艮第|bourgogne|burgundy|nuits|vosne|romanee|羅曼尼|conti|gevrey|chambertin|chambolle|meursault|montrachet|puligny|pommard|volnay|corton|cote d'or|金丘|macon"],
    ["夏布利", 62, 36.4, "chablis|夏布利"],
    ["第戎", 70.7, 41.3, "dijon|第戎"],
    ["薄酒萊", 67.7, 53, "beaujolais|薄酒萊|moulin-a-vent|morgon|fleurie|brouilly"],
    ["北隆河", 69, 59, "北隆河|northern rhone|cote-rotie|côte-rôtie|hermitage|艾米塔基|condrieu|saint-joseph|cornas|羅納河|隆河|rhone|rhône"],
    ["教皇新堡", 69.3, 73.4, "chateauneuf|châteauneuf|教皇新堡|gigondas|vacqueyras|ventoux|tavel"],
    ["桑塞爾", 55.3, 41.3, "sancerre|桑塞爾|pouilly|普依|menetou"],
    ["武弗雷", 40.2, 40.6, "vouvray|武弗雷|chinon|希濃|saumur|索繆爾|anjou|安茹|bourgueil|touraine|圖蘭|盧瓦爾|loire"],
    ["慕斯卡德", 24.5, 41.7, "muscadet|慕斯卡德|nantes|南特"],
    ["阿爾薩斯", 85.2, 32.9, "alsace|阿爾薩斯|riesling.*alsace|gewurztraminer|strasbourg"],
    ["普羅旺斯", 73.6, 78.7, "provence|普羅旺斯|bandol|邦多爾|cote de provence|尼斯"],
    ["朗格多克", 62.5, 77.9, "languedoc|朗格多克|roussillon|魯西雍|minervois|corbieres|pic saint-loup|faugeres|banyuls|pays d'oc|carcassonne"],
    ["薩瓦", 77, 58.8, "savoie|薩瓦|savoy|chignin|bugey"],
    ["汝拉", 75.8, 45.5, "jura|汝拉|arbois|vin jaune|黃酒|chateau-chalon|poligny"],
    ["科西嘉", 92.6, 86.7, "corsica|科西嘉|corse|patrimonio|ajaccio"],
    ["雅馬邑", 36, 75.8, "armagnac|雅馬邑|gascogne|加斯科涅|madiran|馬第朗|jurancon|cahors|卡奧爾|gaillac|bergerac|貝傑哈克|monbazillac"],
    ["巴黎", 51.8, 25.9, "paris|巴黎|ile-de-france"],
    ["諾曼第", 35.8, 22.9, "normandy|諾曼第|calvados|卡爾瓦多斯|pays d'auge"],
    ["布列塔尼", 15.2, 26.7, "brittany|布列塔尼|bretagne"]
  ], fallback: [["法國", 47.3, 46.7, "法國|france|french|法式|法蘭西"]] },
  { key: 'map_italy', name: '意大利', nameEn: 'Italy', ratio: 0.6667, pins: [
    ["巴羅洛", 14.6, 26.7, "barolo|巴羅洛|barbaresco|巴巴列斯科|piedmont|piemonte|皮埃蒙特|langhe|朗格|/\\basti\\b|阿斯蒂|moscato d|nebbiolo|barbera|dolcetto|gavi|蓋維|roero"],
    ["都靈", 10.7, 23.4, "turin|torino|都靈|vermouth|味美思|cinzano"],
    ["威羅納", 35.2, 21.5, "verona|威羅納|veneto|威尼托|valpolicella|瓦波利切拉|amarone|阿瑪羅尼|soave|索阿維|bardolino|venice|威尼斯|lugana"],
    ["普羅塞克", 43.9, 18.6, "prosecco|普羅塞克|conegliano|valdobbiadene|treviso|特雷維索|grappa|格拉巴"],
    ["上阿迪傑", 40, 9.8, "alto adige|上阿迪傑|sudtirol|south tyrol|南蒂羅爾|bolzano|博爾扎諾"],
    ["弗留利", 56.6, 16.3, "friuli|弗留利|collio|科利奧|trieste|的里雅斯特|colli orientali"],
    ["弗朗恰科爾塔", 29.3, 18.9, "franciacorta|弗朗恰科爾塔|lombardy|倫巴第|lombardia|milan|米蘭|valtellina|oltrepo|garda|加爾達"],
    ["艾米利亞", 39.1, 26.7, "emilia|艾米利亞|romagna|羅馬涅|lambrusco|蘭布魯斯科|bologna|博洛尼亞|parma|帕爾馬|sangiovese di romagna|albana"],
    ["經典奇揚第", 39.1, 35.2, "chianti|奇揚第|tuscany|toscana|托斯卡納|托斯卡尼|sassicaia|西施佳雅|tignanello|天娜|florence|佛羅倫斯|montepulciano|vino nobile|san gimignano|vernaccia"],
    ["蒙塔爾奇諾", 40, 39.1, "montalcino|蒙塔爾奇諾|brunello|布魯奈羅|rosso di montalcino|biondi-santi"],
    ["博格利", 33.7, 38.4, "bolgheri|博格利|ornellaia|奧納亞|masseto|馬賽多|maremma|馬雷瑪|super tuscan|超級托斯卡納"],
    ["翁布里亞", 48.8, 40.4, "umbria|翁布里亞|orvieto|奧維多|montefalco|蒙特法爾科|sagrantino|perugia"],
    ["馬凱", 54.7, 33.9, "marche|馬凱|verdicchio|維蒂奇奧|conero|rosso piceno|ancona"],
    ["阿布魯佐", 61.5, 41.7, "abruzzo|阿布魯佐|montepulciano d'abruzzo|trebbiano d'abruzzo|pecorino"],
    ["羅馬", 50.8, 49.5, "/\\brome\\b|/\\broma\\b|羅馬|lazio|拉齊奧|frascati|弗拉斯卡蒂|est! est|castelli romani"],
    ["那不勒斯", 67.4, 56.6, "naples|napoli|那不勒斯|campania|坎帕尼亞|taurasi|陶拉西|aglianico|fiano|greco di tufo|falanghina|amalfi|阿馬爾菲|limoncello|檸檬酒|vesuvio"],
    ["普利亞", 87.9, 59.9, "puglia|apulia|普利亞|primitivo|普里米蒂沃|salice salentino|negroamaro|manduria|salento|薩倫托|bari|巴里"],
    ["巴斯利卡塔", 76.2, 58.6, "basilicata|巴斯利卡塔|aglianico del vulture|vulture"],
    ["卡拉布里亞", 80.1, 69, "calabria|卡拉布里亞|gaglioppo"],
    ["埃特納", 64, 82.7, "etna|埃特納|sicily|sicilia|西西里|nero d'avola|黑珍珠|catania|卡塔尼亞|cerasuolo|vittoria|palermo|巴勒莫"],
    ["馬爾薩拉", 45.9, 82, "marsala|馬爾薩拉|pantelleria|潘泰萊里亞|passito"],
    ["卡諾娜", 19.5, 57.3, "cannonau|卡諾娜|sardinia|sardegna|薩丁尼亞|vermentino di sardegna|carignano|cagliari"],
    ["加盧拉", 21, 54, "gallura|加盧拉|vermentino di gallura|olbia"],
    ["特倫蒂諾", 37.1, 13, "trentino|特倫蒂諾|trento|特倫托|teroldego|lagrein|rotaliano"],
    ["利古里亞", 21.5, 30.6, "liguria|利古里亞|genoa|genova|熱那亞|cinque terre|五漁村|vermentino|pigato|rossese"]
  ], fallback: [["意大利", 46.9, 52.1, "意大利|義大利|義式|italy|italian|italia"]] },
  { key: 'map_korea', name: '韓國', nameEn: 'Korea', ratio: 0.6667, pins: [
    ["首爾", 31.4, 23.8, "seoul|首爾|서울|漢城|gyeonggi|京畿|suwon|水原"],
    ["釜山", 81.5, 65.8, "busan|釜山|부산|haeundae|海雲臺"],
    ["蔚山", 84.2, 60.9, "ulsan|蔚山"],
    ["大邱", 70.8, 55.3, "daegu|大邱|taegu|慶尚|gyeongsang|gyeongbuk"],
    ["大田", 43.7, 45.9, "daejeon|大田|세종|世宗|chungcheong|忠清"],
    ["光州", 31.2, 66.1, "gwangju|光州|jeolla|全羅|mokpo|木浦|boseong|寶城|suncheon|順天|yeosu|麗水"],
    ["濟州島", 21, 90.8, "jeju|濟州|제주|hallasan|漢拏"],
    ["江陵", 81.5, 24.7, "gangneung|江陵|gangwon|江原|chuncheon|春川"],
    ["全州", 36.1, 56, "jeonju|全州|전주|jeonju makgeolli"],
    ["安東", 67.4, 41.7, "andong|安東|안동|andong soju"],
    ["慶州", 82.2, 57.6, "gyeongju|慶州|경주|beopju|法酒"],
    ["束草", 71.8, 13, "sokcho|束草|속초|seoraksan|雪嶽"],
    ["仁川", 26.4, 21.5, "incheon|仁川|인천|ganghwa|江華"]
  ], fallback: [["韓國", 48.8, 45.6, "韓國|韩国|korea|korean|燒酒|烧酒|soju|jinro|真露|chamisul|참이슬|馬格利|makgeolli|makkoli|막걸리|bokbunja|覆盆子酒|韓式"]] },
  { key: 'map__new_zealand', name: '紐西蘭', nameEn: 'New Zealand', ratio: 1.5, pins: [
    ["馬爾堡", 53.1, 54.7, "marlborough|馬爾堡|cloudy bay|雲灣|blenheim|布倫海姆|wairau|awatere|kim crawford|villa maria|oyster bay|brancott"],
    ["尼爾森", 49.2, 50.8, "nelson|尼爾森|neudorf|moutere"],
    ["懷帕拉", 48.5, 65.9, "waipara|懷帕拉|north canterbury|北坎特伯雷"],
    ["基督城", 48.5, 69.8, "christchurch|基督城|canterbury|坎特伯雷"],
    ["中奧塔哥", 36.1, 77.6, "central otago|中奧塔哥|otago|奧塔哥|felton road|gibbston|吉布斯頓|bannockburn|cromwell|"],
    ["皇后鎮", 33.9, 79.1, "queenstown|皇后鎮|wanaka|瓦納卡"],
    ["但尼丁", 41.7, 83, "dunedin|但尼丁"],
    ["霍克斯灣", 67.1, 38.1, "hawke's bay|hawkes bay|霍克斯灣|napier|納皮爾|gimblett|te mata|craggy range|esk valley"],
    ["懷拉拉帕", 62.8, 48.8, "wairarapa|懷拉拉帕|martinborough|馬丁堡"],
    ["惠靈頓", 59.9, 53.2, "wellington|惠靈頓"],
    ["吉斯伯恩", 71, 30.3, "gisborne|吉斯伯恩"],
    ["奧克蘭", 56, 22.9, "auckland|奧克蘭|matakana|kumeu|west auckland"],
    ["懷赫科島", 57.6, 22, "waiheke|懷赫科|怀赫科"],
    ["北地", 52.1, 11.7, "northland|北地|bay of islands|島嶼灣"],
    ["陶朗加", 62.5, 26.4, "tauranga|陶朗加|bay of plenty|豐盛灣"],
    ["羅托魯阿", 61.8, 30.3, "rotorua|羅托魯阿"],
    ["陶波", 59.2, 34.2, "taupo|陶波"],
    ["斯圖爾特島", 30.3, 92.3, "stewart island|斯圖爾特島|southland"]
  ], fallback: [["紐西蘭", 52.1, 50.8, "紐西蘭|新西蘭|新西兰|new zealand|nz wine"]] },
  { key: 'map_australia', name: '澳洲', nameEn: 'Australia', ratio: 1.5, pins: [
    ["瑪格麗特河", 16, 63.5, "margaret river|瑪格麗特河|leeuwin|cullen|vasse felix|cape mentelle|moss wood|pierro|xanadu"],
    ["珀斯", 15.1, 57.1, "/\\bperth\\b|珀斯|swan valley|天鵝谷|western australia|西澳"],
    ["大南部", 21.5, 66.6, "great southern|大南部|frankland|mount barker|porongurup"],
    ["巴羅薩", 50, 68.8, "barossa|巴羅薩|penfolds|奔富|grange|葛蘭許|torbreck|henschke|亨舒克|yalumba|jacob's creek|杰卡斯|peter lehmann|rockford|two hands|eden valley|伊甸谷|hill of grace|seppeltsfield|st hallett|charles melton|wolf blass"],
    ["阿德萊德", 49.2, 70.5, "adelaide|阿德萊德|adelaide hills|阿德萊德山|south australia|南澳|riverland|河地|langhorne creek|朗赫恩溪|petaluma|shaw \\+ smith|shaw and smith"],
    ["麥克拉倫谷", 49.2, 72.5, "mclaren vale|麥克拉倫|d'arenberg|darenberg|wirra wirra|hardys|hugh hamilton|kay brothers|fox creek"],
    ["克萊爾谷", 49.3, 66.4, "clare valley|克萊爾谷|grosset|kilikanoon|jim barry|pikes|wendouree|skillogalee"],
    ["庫那瓦拉", 51.8, 74.4, "coonawarra|庫那瓦拉|wynns|黃尾|katnook|majella|zema|limestone coast|石灰岩海岸|padthaway|wrattonbully"],
    ["墨爾本", 57.8, 76.2, "melbourne|墨爾本|維多利亞省|geelong|吉朗|mornington|莫寧頓|macedon|bass phillip|giaconda|beechworth|pyrenees|grampians|heathcote|希斯科特"],
    ["雅拉谷", 59.8, 74.7, "yarra valley|雅拉谷|yering|yarra yering|coldstream|domaine chandon|tarra warra|giant steps"],
    ["路斯格蘭", 61.5, 70.8, "rutherglen|路斯格蘭|muscat|king valley|國王谷|glenrowan|chambers rosewood"],
    ["塔斯曼尼亞", 58.9, 84, "tasmania|塔斯曼尼亞|塔斯馬尼亞|tamar|塔馬爾|pipers brook|coal river|huon|house of arras|jansz|tasmanian"],
    ["荷伯特", 59.6, 88.4, "hobart|荷伯特|霍巴特|sullivans cove|/\\blark\\b"],
    ["獵人谷", 67.1, 60.1, "hunter valley|獵人谷|獵人河|tyrrell|tyrrells|brokenwood|mcwilliam|lindeman|lindemans|tulloch|de bortoli.*hunter|pokolbin|mudgee|馬奇|hilltops"],
    ["悉尼", 65.6, 67.4, "sydney|悉尼|雪梨|new south wales|新南威爾士|/\\bnsw\\b|southern highlands|shoalhaven|hawkesbury|blue mountains|藍山"],
    ["坎培拉", 63.5, 70.1, "canberra|坎培拉|act wine|clonakilla|riverina|利物浪|griffith|lerida|murrumbateman|gundagai"],
    ["花崗岩帶", 67.1, 53.2, "granite belt|花崗岩帶|queensland wine|昆士蘭葡萄酒|stanthorpe"],
    ["布里斯班", 68.9, 50.8, "brisbane|布里斯班|queensland|昆士蘭|gold coast|黃金海岸|sunshine coast|陽光海岸"],
    ["凱恩斯", 58.3, 29.3, "cairns|凱恩斯|far north queensland|daintree|丹特里"],
    ["達爾文", 39.4, 22.9, "darwin|達爾文|northern territory|北領地|kakadu|卡卡杜"],
    ["愛麗斯泉", 42.3, 45.9, "alice springs|愛麗斯泉|uluru|烏魯魯|ayers rock|艾爾斯岩"],
    ["袋鼠島", 46.5, 69.8, "kangaroo island|袋鼠島|kangaroo"]
  ], fallback: [["澳洲", 42.3, 50.8, "澳洲|澳大利亞|澳大利亚|australia|aussie|australian"]] },
  { key: 'map_europe', name: '歐洲', nameEn: 'Europe', ratio: 1.5, pins: [
    ['波爾多', 27, 66, '波爾多|bordeaux|左岸|右岸|medoc|margaux|pauillac|latour|lafite'],
    ['盧瓦爾河', 29, 62, '盧瓦爾|loire'],
    ['香檳', 34, 59, '香檳|champagne|reims|dom perignon'],
    ['勃艮第', 35, 63, '勃艮第|bourgogne|burgundy|chablis'],
    ['羅納河', 35, 69, '羅納河|隆河|rhone'],
    ['杜羅河・波特', 13, 77, 'douro|波特|porto'],
    ['里奧哈', 23, 75, '里奧哈|rioja'],
    ['杜埃羅河岸', 20, 77, '杜埃羅河岸|ribera del duero|vega sicilia'],
    ['赫雷斯', 17, 88, '赫雷斯|jerez|雪莉|sherry'],
    ['皮埃蒙特', 36, 69, '皮埃蒙特|piedmont|barolo|巴羅洛'],
    ['托斯卡納', 39, 73, '托斯卡納|tuscany|chianti|sassicaia'],
    ['西西里', 44, 90, '西西里|sicily'],
    ['摩澤爾', 35, 57, '摩澤爾|mosel|rheingau|萊茵']
  ], fallback: [
    ['法國', 31, 63, '法國|france'], ['西班牙', 22, 80, '西班牙|spain|españa'], ['葡萄牙', 12.5, 81, '葡萄牙|portugal'],
    ['義大利', 41, 76, '義大利|意大利|italy'], ['德國', 40, 55, '德國|germany'], ['英國', 29, 51, '英國|england|london|倫敦|united kingdom'],
    ['歐洲', 45, 58, '歐洲|europe']
  ] },
  { key: 'map_america', name: '美洲', nameEn: 'Americas', ratio: 0.6667, pins: [
    ['納帕', 28, 31, '納帕|napa|opus one|作品一號|screaming eagle'],
    ['加州', 28, 34.3, '加州|california|sonoma|索諾瑪'],
    ['肯塔基', 55, 33, '肯塔基|kentucky|波本|bourbon|jim beam'],
    ['田納西', 53.5, 35.5, '田納西|tennessee|jack daniel'],
    ['智利', 59.5, 73, '智利|chile|almaviva|活靈魂'],
    ['門多薩', 62, 72, '門多薩|mendoza|馬爾貝克|malbec']
  ], fallback: [
    ['阿根廷', 64, 76, '阿根廷|argentina'], ['美國', 45, 32, '美國|usa|united states'], ['墨西哥', 36, 42, '墨西哥|mexico|龍舌蘭|tequila'],
    ['加拿大', 50, 20, '加拿大|canada'], ['美洲', 50, 50, '美洲|america']
  ] },
  { key: 'map_africa', name: '非洲', nameEn: 'Africa', ratio: 0.9139, pins: [
    ['開普敦・Stellenbosch', 47, 88, '開普敦|cape town|stellenbosch|皮諾塔吉|pinotage']
  ], fallback: [['南非', 55, 85, '南非|south africa'], ['非洲', 50, 55, '非洲|africa']] }
];

function regionalKwMatch(text, kwString) {
  for (const k of String(kwString).split('|')) {
    if (!k) continue;
    if (k[0] === '/') { try { if (new RegExp(k.slice(1), 'i').test(text)) return true; } catch(e) {} }
    else if (text.includes(k.toLowerCase())) return true;
  }
  return false;
}

function matchRegionalPin(text, useFallback) {
  for (const m of REGIONAL_MAPS) {
    const list = useFallback ? (m.fallback || []) : (m.pins || []);
    for (const p of list) {
      if (regionalKwMatch(text, p[3])) return { map: m, pin: { name: p[0], left: p[1], top: p[2] } };
    }
  }
  return null;
}

// 酒款對應的地區地圖與 Pin：先看「品飲地點」，再看酒款產區；找不到 → null (只留在世界地圖)
// 開飲地點：新分享有 tastingLocation；舊分享的 location 若與產區不同也視為開飲地點
function tastingPlaceOf(b) {
  if (!b) return '';
  if (typeof b.tastingLocation === 'string') return b.tastingLocation.trim();
  const loc = String(b.location || b.diary?.location || '').trim();
  const reg = String(bottleRegion(b) || '').trim();
  return (loc && loc !== reg && loc !== '世界名釀') ? loc : '';
}

function resolveRegionalTarget(b) {
  if (!b) return null;
  const loc = String(b.location || b.diary?.location || '').toLowerCase();
  const origin = `${bottleRegion(b) || ''} ${bottleCountry(b) || ''} ${bottleName(b) || ''} ${b.identification?.producer || ''}`.toLowerCase();
  for (const text of [loc, origin]) {
    if (!text.trim()) continue;
    const hit = matchRegionalPin(text, false) || matchRegionalPin(text, true);
    if (hit) return hit;
  }
  return null;
}

function loadMapImageWithFallback(imgEl, mapKey) {
  if (!imgEl) return;
  const candidates = [`${mapKey}.webp`, `${mapKey}`, `${mapKey}.png`, `maps/${mapKey}.webp`, `maps/${mapKey}`, `maps/${mapKey}.png`];
  let idx = 0;
  imgEl.onerror = () => {
    idx++;
    if (idx < candidates.length) imgEl.src = candidates[idx];
    else imgEl.onerror = null;
  };
  imgEl.src = candidates[0];
}

// 2. 解析酒款在世界地圖上的經緯坐標（優先精確匹配特定產區與品牌）
function resolveRealImagePinPos(country, region, b = null) {
  const bName = b ? bottleName(b) : '';
  const bCat = b ? (b.category || b.identification?.category || '') : '';
  const bProd = b ? (b.identification?.producer || '') : '';
  const bLoc = b ? (b.location || b.diary?.location || '') : '';

  // 1. 優先以「品飲地點」定位 (例如在沖繩飲 → 釘在沖繩)
  const locText = String(bLoc || '').toLowerCase();
  if (locText.trim()) {
    for (const k in REAL_IMAGE_GEO_POINTS) {
      if (k.length > 1 && locText.includes(k.toLowerCase())) return REAL_IMAGE_GEO_POINTS[k];
    }
  }

  // 2. 其次以酒款產區/品名定位
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

// 判斷探索池項目是否為自己的分享 (擁有者 ID、署名，或對應到自己酒窖內的酒款/品飲記錄)
function isMyExploreItem(b, myShareId, myProfileName, myBoundEmail) {
  if (!b) return false;
  if (b.isMine) return true;
  if (myShareId && b.ownerShareId && b.ownerShareId === myShareId) return true;
  if (myProfileName && b.author === myProfileName) return true;
  if (myBoundEmail && b.author === myBoundEmail) return true;
  const id = String(b.id);
  return (window.cellar || []).some(x => String(x.id) === id || (x.tastings || []).some(t => exploreItemId(x.id, t.id) === id));
}

// 3. 探索頁面渲染（純粹單一世界地圖容器，零圖層切換）
async function renderExplore() {
  currentView = 'explore';
  setActiveNav('nav-explore');
  isRegionalMapActive = false;
  currentRegionalMapKey = 'map_world';
  regionalFlyToken++;

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

        <!-- 地區特寫地圖層：世界地圖飛向地區後切入，Pin 住品飲位置 -->
        <div class="regional-map-wrap" id="regionalMapView" style="display:none; opacity:0; pointer-events:none;">
          <div class="regional-canvas-wrap" id="regionalCanvasWrap">
            <div class="regional-stage" id="regionalStage">
              <img id="regionalMapImg" src="" class="regional-map-img" alt="Regional Map" draggable="false">
              <div id="regionalPinContainer" style="position:absolute; inset:0; pointer-events:none;"></div>
            </div>
          </div>
          <button class="btn-back-world" onclick="exitRegionalMap()">
            <span>&larr;</span>
            <span>${currentLang==='zh'?'世界地圖':'World'}</span>
          </button>
          <div class="region-header-badge" id="regionalBadge"></div>
          <div class="region-bottle-pill" id="regionalBottlePill"></div>
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
        <div id="feed-modes" class="feed-modes"></div>
      </div>
      <div id="feed-tags" class="feed-tags"></div>
      <div id="explore-feed" class="explore-feed" style="text-align:center; padding:6px 2px; color:var(--text-muted); font-size:14px;">
        載入中...
      </div>
    </div>
  `;

  initRealMapInteractions();
  renderRealWorldPinsAndFeed();
}

// 4. 地圖互動手勢：世界地圖與地區地圖各自縮放/平移；地區地圖雙指縮小到底自動返回世界
let _mapWindowListenersBound = false;
let _mapDragging = false, _mapStartX = 0, _mapStartY = 0;

function initRealMapInteractions() {
  const container = document.getElementById('worldRadarBox');
  if (!container) return;

  container.onwheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    if (isRegionalMapActive) {
      regionalZoom = Math.max(0.7, Math.min(4.5, regionalZoom * factor));
      updateRegionalMapTransform();
      if (regionalZoom < 0.8) exitRegionalMap();
    } else {
      mapZoom = Math.min(Math.max(mapZoom * factor, 0.7), 4.5);
      updateRealMapTransform();
    }
  };

  const noDrag = (e) => e.target.closest && (e.target.closest('.map-hud-btn') || e.target.closest('.btn-back-world'));

  container.onmousedown = (e) => {
    if (noDrag(e)) return;
    _mapDragging = true;
    _mapStartX = e.clientX - (isRegionalMapActive ? regionalPanX : mapPanX);
    _mapStartY = e.clientY - (isRegionalMapActive ? regionalPanY : mapPanY);
  };

  if (!_mapWindowListenersBound) {
    _mapWindowListenersBound = true;
    window.addEventListener('mousemove', (e) => {
      if (!_mapDragging) return;
      if (isRegionalMapActive) { regionalPanX = e.clientX - _mapStartX; regionalPanY = e.clientY - _mapStartY; updateRegionalMapTransform(); }
      else { mapPanX = e.clientX - _mapStartX; mapPanY = e.clientY - _mapStartY; updateRealMapTransform(); }
    });
    window.addEventListener('mouseup', () => { _mapDragging = false; });
  }

  let pinchDist = null, pinchZoom = 1;

  container.ontouchstart = (e) => {
    if (noDrag(e)) return;
    const wrap = document.getElementById(isRegionalMapActive ? 'regionalCanvasWrap' : 'worldMapCanvasWrap');
    if (wrap) wrap.style.transition = 'none';
    if (e.touches.length === 1) {
      _mapDragging = true;
      _mapStartX = e.touches[0].clientX - (isRegionalMapActive ? regionalPanX : mapPanX);
      _mapStartY = e.touches[0].clientY - (isRegionalMapActive ? regionalPanY : mapPanY);
    } else if (e.touches.length === 2) {
      _mapDragging = false;
      pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchZoom = isRegionalMapActive ? regionalZoom : mapZoom;
    }
  };

  container.ontouchmove = (e) => {
    if (e.touches.length === 1 && _mapDragging) {
      e.preventDefault();
      if (isRegionalMapActive) { regionalPanX = e.touches[0].clientX - _mapStartX; regionalPanY = e.touches[0].clientY - _mapStartY; updateRegionalMapTransform(); }
      else { mapPanX = e.touches[0].clientX - _mapStartX; mapPanY = e.touches[0].clientY - _mapStartY; updateRealMapTransform(); }
    } else if (e.touches.length === 2 && pinchDist) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (isRegionalMapActive) {
        regionalZoom = Math.min(Math.max(pinchZoom * d / pinchDist, 0.6), 4.5);
        updateRegionalMapTransform();
        if (regionalZoom < 0.8) { exitRegionalMap(); pinchDist = null; }
      } else {
        mapZoom = Math.min(Math.max(pinchZoom * d / pinchDist, 0.7), 4.5);
        updateRealMapTransform();
      }
    }
  };

  container.ontouchend = (e) => {
    if (e.touches.length < 2) pinchDist = null;
    if (e.touches.length === 0) _mapDragging = false;
  };
}

function handleMapZoomIn() {
  if (isRegionalMapActive) { regionalZoom = Math.min(regionalZoom * 1.25, 4.5); updateRegionalMapTransform(); }
  else { mapZoom = Math.min(mapZoom * 1.25, 4.5); updateRealMapTransform(); }
}

function handleMapZoomOut() {
  if (isRegionalMapActive) {
    regionalZoom = regionalZoom * 0.8;
    updateRegionalMapTransform();
    if (regionalZoom < 0.8) exitRegionalMap();
  } else { mapZoom = Math.max(mapZoom * 0.8, 0.7); updateRealMapTransform(); }
}

function handleMapReset() {
  if (isRegionalMapActive) {
    regionalZoom = 1; regionalPanX = 0; regionalPanY = 0;
    const wrap = document.getElementById('regionalCanvasWrap');
    if (wrap) wrap.style.transition = 'transform 0.35s ease';
    updateRegionalMapTransform();
  } else {
    resetWorldMap();
  }
}

function resetWorldMap() {
  mapZoom = 1; mapPanX = 0; mapPanY = 0;
  const wrap = document.getElementById('worldMapCanvasWrap');
  if (wrap) {
    wrap.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
    wrap.style.transform = 'translate(0px, 0px) scale(1)';
  }
}

function updateRealMapTransform() {
  const wrap = document.getElementById('worldMapCanvasWrap');
  if (wrap) wrap.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`;
}

function updateRegionalMapTransform() {
  const wrap = document.getElementById('regionalCanvasWrap');
  if (wrap) wrap.style.transform = `translate(${regionalPanX}px, ${regionalPanY}px) scale(${regionalZoom})`;
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
          tastingLocation: '香港 中環',
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
          tastingLocation: '香港 尖沙咀',
          isMine: false,
          personalRating: 4.8,
          image: '',
          identification: { name: 'Opus One Napa Valley Red Wine', country: '美國', region: '納帕', vintage: '2019' },
          diary: { notes: '黑醋栗與黑莓果醬濃郁，烤橡木與摩卡咖啡香氣層次極深。' }
        },
        {
          id: 'demo-taiwan',
          author: 'Evelyn (台灣威士忌俱樂部)',
          tastingLocation: '台北 信義',
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
    const myShareId = await getMyShareId();

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
    exploreCtx = { myShareId, myProfileName, myBoundEmail };
    renderFeedView();
  } catch(e) {
    const feedEl = document.getElementById('explore-feed');
    if (feedEl) feedEl.innerHTML = `<div class="empty-shelf">${currentLang==='zh'?'暫時無法載入酒友動態。':'Unable to load public feed.'}</div>`;
  }
}

/* ---- explore feed view: location tags, status tabs, swipe ---- */
let exploreCtx = {};
let exploreFilter = { city: null, sub: null, mode: 'all' };
const CITY_LIST = ['香港','澳門','台北','新北','台中','台南','高雄','東京','大阪','京都','首爾','新加坡','上海','北京','深圳','廣州','曼谷','倫敦','巴黎','紐約','悉尼'];
const DISTRICT_CITY = { '中環':'香港','上環':'香港','灣仔':'香港','銅鑼灣':'香港','尖沙咀':'香港','旺角':'香港','佐敦':'香港','金鐘':'香港','荃灣':'香港','沙田':'香港','信義':'台北','大安':'台北','中山':'台北','松山':'台北','銀座':'東京','新宿':'東京','澀谷':'東京','六本木':'東京' };
function placeParts(place) {
  const raw = String(place || '').trim();
  if (!raw) return null;
  for (const c of CITY_LIST) {
    if (raw.startsWith(c)) return { city: c, sub: raw.slice(c.length).replace(/^[\s,，、·\-\/]+/, '').trim() };
  }
  for (const d in DISTRICT_CITY) {
    if (raw.includes(d)) return { city: DISTRICT_CITY[d], sub: d };
  }
  const toks = raw.split(/[\s,，、·\-\/]+/).filter(Boolean);
  return { city: toks[0], sub: toks.slice(1).join(' ') };
}
function getStarred() { try { return JSON.parse(localStorage.getItem('bottlesense_feed_starred') || '{}'); } catch (e) { return {}; } }
function setStarred(o) { try { localStorage.setItem('bottlesense_feed_starred', JSON.stringify(o)); } catch (e) {} }
function unhideFeedItem(id) {
  const h = getHiddenFeed().filter(x => x !== String(id));
  try { localStorage.setItem('bottlesense_feed_hidden', JSON.stringify(h)); } catch (e) {}
  renderFeedView();
}
async function unstarFeedItem(id) {
  const st = getStarred(); const wid = st[String(id)];
  delete st[String(id)]; setStarred(st);
  if (wid) {
    const idx = (window.cellar || []).findIndex(x => String(x.id) === String(wid) && x.status === 'wishlist');
    if (idx >= 0) { window.cellar.splice(idx, 1); await deleteBottleFromDB(wid); }
  }
  showToast(currentLang==='zh'?'已取消加星':'Star removed');
  renderFeedView();
}
function setExploreMode(m) { exploreFilter.mode = m; renderFeedView(); }
function setExploreCity(c) {
  if (exploreFilter.city === c) { exploreFilter = { ...exploreFilter, city: null, sub: null }; renderFeedView(); return; }
  exploreFilter.city = c; exploreFilter.sub = null;
  const hit = (currentExploreFeed || []).find(x => { const pp = placeParts(tastingPlaceOf(x)); return pp && pp.city === c; });
  if (hit) flyToBottleRegion(hit.id);
  renderFeedView();
}
function setExploreSub(sv) { exploreFilter.sub = (exploreFilter.sub === sv) ? null : sv; renderFeedView(); }

function renderFeedView() {
  const feedEl = document.getElementById('explore-feed');
  const tagsEl = document.getElementById('feed-tags');
  if (!feedEl) return;
  const zh = currentLang === 'zh';
  const { myShareId, myProfileName, myBoundEmail } = exploreCtx;
  const hidden = getHiddenFeed();
  const starred = getStarred();
  const all = currentExploreFeed || [];
  const isHid = x => hidden.includes(String(x.id));
  const isStar = x => starred[String(x.id)] !== undefined;
  const cities = {};
  const base = all.filter(x => exploreFilter.mode === 'hidden' ? isHid(x) : exploreFilter.mode === 'starred' ? isStar(x) : !isHid(x));
  base.forEach(x => {
    const pp = placeParts(tastingPlaceOf(x));
    if (!pp || !pp.city) return;
    (cities[pp.city] = cities[pp.city] || { n: 0, subs: {} }).n++;
    if (pp.sub) cities[pp.city].subs[pp.sub] = (cities[pp.city].subs[pp.sub] || 0) + 1;
  });
  const cityNames = Object.keys(cities);
  if (exploreFilter.city && !cities[exploreFilter.city]) exploreFilter.city = exploreFilter.sub = null;
  const nHid = all.filter(isHid).length, nStar = all.filter(isStar).length;
  const mode = exploreFilter.mode;

  let list = all.filter(x => mode === 'hidden' ? isHid(x) : mode === 'starred' ? isStar(x) : !isHid(x));
  if (exploreFilter.city) list = list.filter(x => { const pp = placeParts(tastingPlaceOf(x)); return pp && pp.city === exploreFilter.city && (!exploreFilter.sub || pp.sub === exploreFilter.sub); });

  const modesEl = document.getElementById('feed-modes');
  if (modesEl) {
    const nAll = all.filter(x => !isHid(x)).length;
    modesEl.innerHTML = `<span class="fm ${mode==='all'?'on':''}" onclick="setExploreMode('all')">${zh?'全部':'All'}</span><span class="fm ${mode==='starred'?'on':''}" onclick="setExploreMode('starred')">${zh?'已加星':'Starred'}${nStar ? ' ' + nStar : ''}</span><span class="fm ${mode==='hidden'?'on':''}" onclick="setExploreMode('hidden')">${zh?'已隱藏':'Hidden'}${nHid ? ' ' + nHid : ''}</span>`;
  }
  if (tagsEl) {
    const subs = exploreFilter.city ? Object.keys(cities[exploreFilter.city].subs) : [];
    tagsEl.innerHTML = `
      <div class="ftag-row">
        ${cityNames.length ? cityNames.map(c => `<span class="ftag ftag-loc ${exploreFilter.city===c?'on':''}" onclick="setExploreCity('${esc(c)}')">${esc(c)} ${cities[c].n}</span>`).join('') : `<span class="ftag-none">${zh?'暫無品飲地點':'No tasting places yet'}</span>`}
      </div>
      <div class="ftag-sub ${subs.length ? 'open' : ''}">
        ${subs.map(sv => `<span class="ftag ftag-s ${exploreFilter.sub===sv?'on':''}" onclick="setExploreSub('${esc(sv)}')">${esc(sv)} ${cities[exploreFilter.city].subs[sv]}</span>`).join('')}
      </div>`;
  }

  if (!list.length) {
    feedEl.innerHTML = `<div class="empty-shelf">${mode==='hidden' ? (zh?'沒有隱藏的動態':'Nothing hidden') : mode==='starred' ? (zh?'尚未加星任何動態':'Nothing starred yet') : (zh?'暫無符合的動態':'No tastings match')}</div>`;
    return;
  }
  feedEl.innerHTML = list.map((b, idx) => {
    const c = bottleCountry(b), r = bottleRegion(b);
    const isMine = isMyExploreItem(b, myShareId, myProfileName, myBoundEmail);
    const place = tastingPlaceOf(b);
    const swipeable = mode === 'all';
    const undo = mode === 'hidden'
      ? `<button class="feed-undo" onclick="event.stopPropagation(); unhideFeedItem('${esc(b.id)}')">${zh?'還原':'Restore'}</button>`
      : mode === 'starred' ? `<button class="feed-undo" onclick="event.stopPropagation(); unstarFeedItem('${esc(b.id)}')">${zh?'取消加星':'Unstar'}</button>` : '';
    return `
        <div class="feed-swipe${swipeable && idx === 0 ? ' nudge' : ''}${swipeable ? '' : ' no-swipe'}" data-id="${esc(b.id)}" data-mine="${isMine ? 1 : 0}">
          <div class="feed-swipe-bg">
            <span class="fs-star">&#9733; ${zh ? '加星' : 'Star'}</span>
            <span class="fs-del">${isMine ? (zh ? '收回' : 'Remove') : (zh ? '隱藏' : 'Hide')} &#10005;</span>
          </div>
          <div class="bottle-card feed-clickable feed-glow" id="feed-card-${esc(b.id)}" onclick="flyToBottleRegion('${esc(b.id)}')" style="margin-bottom:0; cursor:pointer;">
            <div class="bottle-photo-box">${b.image ? `<img src="${esc(b.image)}">` : '🍷'}</div>
            <div class="bottle-info" style="flex:1; min-width:0;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px;">
                <div class="bottle-name">${esc(bottleName(b))}</div>
                ${isMine ? `<span style="font-size:10px; font-family:var(--mono); color:#D4AF37; background:rgba(212,175,55,0.15); border:1px solid rgba(212,175,55,0.3); padding:1px 6px; border-radius:4px; white-space:nowrap;">${zh?'我的分享':'Mine'}</span>` : (isStar(b) ? `<span class="feed-starred">&#9733;</span>` : '')}
              </div>
              <div style="font-size:12.5px; color:var(--gold); margin-top:2px;">&#9733; ${b.personalRating||5}/5 ・ ${esc(b.author||'品飲同好')}</div>
              ${place ? `<div class="feed-place">📍 ${esc(place)}</div>` : ''}
              <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">"${esc(b.diary?.notes || (zh ? '無額外筆記' : 'No notes'))}"</div>
              <div style="font-size:11.5px; color:var(--text-faint); margin-top:8px; display:flex; align-items:center; justify-content:space-between; gap:6px;">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">🍷 ${esc((c + ' ' + (r || '')).trim())}</span>
                ${undo}
                <button class="feed-detail-link" onclick="event.stopPropagation(); openSharedTastingModal('${esc(b.id)}')" title="${zh?'查看分享內容':'View'}">
                  <span>${zh?'詳細':'Detail'}</span><span style="font-family:monospace; font-size:12px; margin-left:1px;">&gt;</span>
                </button>
              </div>
            </div>
          </div>
        </div>`;
  }).join('');
  attachFeedSwipe(feedEl);
}

// ---- 探索動態：左右滑動 (右滑加星 / 左滑刪除或隱藏) ----
function getHiddenFeed() {
  try { return JSON.parse(localStorage.getItem('bottlesense_feed_hidden') || '[]'); } catch (e) { return []; }
}
function hideFeedItem(id) {
  const h = getHiddenFeed(); h.push(String(id));
  try { localStorage.setItem('bottlesense_feed_hidden', JSON.stringify(h.slice(-300))); } catch (e) {}
}
function attachFeedSwipe(root) {
  root.querySelectorAll('.feed-swipe:not(.no-swipe)').forEach(wrap => {
    const card = wrap.querySelector('.bottle-card');
    let sx = 0, sy = 0, dx = 0, drag = false, lock = null;
    wrap.addEventListener('touchstart', e => {
      const t0 = e.touches[0]; sx = t0.clientX; sy = t0.clientY; dx = 0; drag = true; lock = null;
      card.style.transition = 'none';
    }, { passive: true });
    wrap.addEventListener('touchmove', e => {
      if (!drag) return;
      const t0 = e.touches[0]; const mx = t0.clientX - sx, my = t0.clientY - sy;
      if (lock === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (lock !== 'x') return;
      dx = Math.max(-120, Math.min(120, mx));
      card.style.transform = 'translateX(' + dx + 'px)';
      wrap.classList.toggle('sw-right', dx > 12);
      wrap.classList.toggle('sw-left', dx < -12);
    }, { passive: true });
    const end = async () => {
      if (!drag) return; drag = false;
      card.style.transition = 'transform .25s ease';
      card.style.transform = '';
      wrap.classList.remove('sw-right', 'sw-left');
      const id = wrap.dataset.id, mine = wrap.dataset.mine === '1';
      if (lock === 'x' && dx > 70) {
        if (mine) showToast(currentLang==='zh'?'這是您自己的分享':'This is your own share');
        else if (getStarred()[String(id)] !== undefined) showToast(currentLang==='zh'?'已加星':'Already starred');
        else addExploreItemToWishlist(id);
      } else if (lock === 'x' && dx < -70) {
        if (mine) deleteMyExploreShare(id);
        else { hideFeedItem(id); showToast(currentLang==='zh'?'已隱藏，可在「已隱藏」標籤還原':'Hidden - restore from the Hidden tag'); renderFeedView(); }
      }
      if (lock === 'x' && Math.abs(dx) > 8) { wrap.dataset.swiped = '1'; setTimeout(() => { delete wrap.dataset.swiped; }, 350); }
    };
    wrap.addEventListener('touchend', end);
    wrap.addEventListener('touchcancel', end);
    wrap.addEventListener('click', e => { if (wrap.dataset.swiped) { e.stopPropagation(); e.preventDefault(); } }, true);
  });
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

// 7. 點擊品飲卡片 / Pin：世界地圖先飛向該地區，再切入該地區專屬地圖並 Pin 住位置
function flyToBottleRegion(bottleId) {
  const b = currentExploreFeed.find(x => String(x.id) === String(bottleId)) ||
            (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;

  highlightFeedItem(b.id);
  const box = document.getElementById('worldRadarBox');
  if (box) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const target = resolveRegionalTarget(b);
  const token = ++regionalFlyToken;

  // 已在地區地圖：同一張圖 → 直接移動焦點；不同圖 → 直接換圖
  if (isRegionalMapActive) {
    if (target) showRegionalMap(target, b, false);
    else exitRegionalMap();
    return;
  }

  const wrap = document.getElementById('worldMapCanvasWrap');
  if (!wrap || !box) return;

  const pos = resolveRealImagePinPos(bottleCountry(b), bottleRegion(b), b);
  const targetZoom = target ? 3.4 : 2.6;
  const w = box.clientWidth || 580;
  const h = box.clientHeight || 290;

  wrap.style.transition = 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)';
  mapZoom = targetZoom;
  mapPanX = ((50 - pos.left) / 100) * w * targetZoom;
  mapPanY = ((50 - pos.top) / 100) * h * targetZoom;
  updateRealMapTransform();

  if (target) {
    setTimeout(() => {
      if (token !== regionalFlyToken || currentView !== 'explore') return;
      showRegionalMap(target, b, true);
    }, 720);
  }
}

// 切入地區地圖，Pin 住品飲位置
function showRegionalMap(target, targetBottle, fromWorld) {
  const m = target.map;
  const worldWrap = document.getElementById('worldMapCanvasWrap');
  const regView = document.getElementById('regionalMapView');
  const regCanvas = document.getElementById('regionalCanvasWrap');
  const regImg = document.getElementById('regionalMapImg');
  const stage = document.getElementById('regionalStage');
  const pinLayer = document.getElementById('regionalPinContainer');
  const badgeEl = document.getElementById('regionalBadge');
  const pillEl = document.getElementById('regionalBottlePill');
  if (!worldWrap || !regView || !regCanvas || !regImg || !stage || !pinLayer) return;

  const sameMap = isRegionalMapActive && currentRegionalMapKey === m.key;
  isRegionalMapActive = true;
  currentRegionalMapKey = m.key;

  if (!sameMap) {
    stage.style.aspectRatio = String(m.ratio);
    loadMapImageWithFallback(regImg, m.key);
    regionalZoom = 1; regionalPanX = 0; regionalPanY = 0;
    regCanvas.style.transition = 'none';
    regCanvas.style.transform = 'translate(0px, 0px) scale(1.25)';
  }
  if (badgeEl) badgeEl.textContent = currentLang === 'zh' ? m.name : m.nameEn;

  // 同一張地圖上所有公開品飲的 Pin；目前焦點以脈動圓圈 + 名稱標示
  const sameMapItems = currentExploreFeed.map(x => ({ x, t: resolveRegionalTarget(x) })).filter(o => o.t && o.t.map.key === m.key);
  if (!sameMapItems.some(o => String(o.x.id) === String(targetBottle.id))) sameMapItems.push({ x: targetBottle, t: target });

  const seen = {};
  pinLayer.innerHTML = sameMapItems.map(o => {
    const p = o.t.pin;
    const k = p.left + ',' + p.top;
    const n = (seen[k] = (seen[k] || 0) + 1) - 1;
    const left = p.left + (n % 3) * 1.6 - (n ? 1.6 : 0);
    const top = p.top + Math.floor(n / 3) * 1.6;
    const isCurrent = String(o.x.id) === String(targetBottle.id);
    if (isCurrent) {
      return `
        <div class="regional-focus-pin" style="top:${top}%; left:${left}%; z-index:30; pointer-events:auto;" onclick="focusRegionalBottle('${esc(o.x.id)}')">
          <div class="pin-radar-ring"></div>
          <div class="pin-core">📍</div>
          <div class="pin-callout-bubble">${esc(p.name)}</div>
        </div>`;
    }
    return `
      <div class="geo-pin-node" style="top:${top}%; left:${left}%; pointer-events:auto;" onclick="focusRegionalBottle('${esc(o.x.id)}')" title="${esc(bottleName(o.x))}">🍷</div>`;
  }).join('');

  if (pillEl) {
    pillEl.style.display = 'block';
    pillEl.innerHTML = `🍷 ${esc(bottleName(targetBottle))} ・ ${esc(target.pin.name)}`;
  }

  if (!sameMap) {
    // 世界地圖淡出並略為放大穿透，地區地圖由 1.25 倍縮回 1 倍淡入
    worldWrap.style.transition = 'opacity 0.4s ease';
    worldWrap.style.opacity = '0';
    worldWrap.style.pointerEvents = 'none';
    regView.style.display = 'flex';
    regView.style.pointerEvents = 'auto';
    void regView.offsetWidth;
    regView.style.opacity = '1';
    requestAnimationFrame(() => {
      regCanvas.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
      regCanvas.style.transform = 'translate(0px, 0px) scale(1)';
    });
  }
}

// 點地區地圖上的 Pin：聚焦該酒款
function focusRegionalBottle(bottleId) {
  const b = currentExploreFeed.find(x => String(x.id) === String(bottleId));
  if (!b) return;
  highlightFeedItem(b.id);
  const target = resolveRegionalTarget(b);
  if (target) showRegionalMap(target, b, false);
}

// 返回世界地圖
function exitRegionalMap() {
  if (!isRegionalMapActive) return;
  isRegionalMapActive = false;
  currentRegionalMapKey = 'map_world';
  regionalFlyToken++;

  const worldWrap = document.getElementById('worldMapCanvasWrap');
  const regView = document.getElementById('regionalMapView');
  if (!worldWrap || !regView) return;

  regView.style.transition = 'opacity 0.35s ease';
  regView.style.opacity = '0';
  regView.style.pointerEvents = 'none';

  setTimeout(() => {
    if (isRegionalMapActive) return;
    regView.style.display = 'none';
    worldWrap.style.transition = 'opacity 0.35s ease';
    worldWrap.style.opacity = '1';
    worldWrap.style.pointerEvents = 'auto';
    resetWorldMap();
  }, 250);
}

// 8. 社群分享管理按鈕操作
async function deleteMyExploreShare(itemId) {
  if (!confirm(currentLang==='zh'?'確定要從酒友探索池收回並刪除此筆分享嗎？':'Remove this tasting share from explore feed?')) return;
  await apiFetch('/api/explore/delete', {
    method: 'POST',
    body: JSON.stringify({ ids: [String(itemId)], syncKey: getOrCreateSyncKey() })
  }).catch(() => {});
  // 同步取消本機該筆品飲記錄的「已發布」狀態
  for (const b of (window.cellar || [])) {
    for (const t of (b.tastings || [])) {
      if (exploreItemId(b.id, t.id) === String(itemId) && t.isPublic) { t.isPublic = false; await saveBottleToDB(b); }
    }
  }
  currentExploreFeed = currentExploreFeed.filter(x => String(x.id) !== String(itemId));
  renderRealWorldPinsAndFeed();
  showToast(currentLang==='zh'?'✓ 已成功收回分享':'✓ Tasting share removed');
}

async function addExploreItemToWishlist(bottleId) {
  if (blockIfVisitor()) return;
  const b = currentExploreFeed.find(x => String(x.id) === String(bottleId));
  if (!b) return;
  if (isMyExploreItem(b, await getMyShareId(), localStorage.getItem('bottlesense_profile_name') || '', localStorage.getItem('bottlesense_account_bound') || '')) {
    showToast(currentLang==='zh'?'這是您自己的分享':'This is your own share');
    return;
  }

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
  sendDemandSignal('share_wishlist', newBottle);
  const st = getStarred(); st[String(bottleId)] = newBottle.id; setStarred(st);
  showToast(currentLang==='zh'?'已加星並放入「願望」，可在「已加星」標籤取消':'Starred and added to Wishlist');
  if (currentView === 'explore') renderFeedView();
}

function openSharedTastingModal(bottleId) {
  const b = currentExploreFeed.find(x => String(x.id) === String(bottleId)) ||
            (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!b) return;

  const c = bottleCountry(b);
  const r = bottleRegion(b);

  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:380px; padding:22px 20px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
          <div style="flex:1; padding-right:10px;">
            <div style="font-size:11px; color:var(--gold); font-family:var(--mono); text-transform:uppercase; letter-spacing:0.5px;">
              ${esc(bottleCategory(b))} ${bottleVintage(b)!=='無年份'?'・ '+esc(bottleVintage(b)):''}
            </div>
            <h3 style="font-family:var(--serif); font-size:18px; margin-top:2px; color:var(--text); line-height:1.35;">
              ${esc(bottleName(b))}
            </h3>
          </div>
          <button class="icon-btn" aria-label="Close" onclick="closeModal()" style="margin-top:-4px; margin-right:-4px;">✕</button>
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

        <div style="font-size:12.5px; color:var(--text-muted); padding:0 2px; margin-bottom:16px; display:flex; flex-direction:column; gap:6px;">
          <div>🍷 ${currentLang==='zh'?'產區':'Origin'}: <strong style="color:var(--text);">${esc((c + ' ' + (r || '')).trim() || '—')}</strong></div>
          ${tastingPlaceOf(b) ? `<div>📍 ${currentLang==='zh'?'開飲地點':'Tasted at'}: <strong style="color:var(--gold);">${esc(tastingPlaceOf(b))}</strong>
            <span style="color:var(--text-faint); font-size:11px;"> · ${currentLang==='zh'?'地圖 Pin 位置以此為準':'map pin uses this'}</span></div>` : ''}
          ${b.diary?.date ? `<div>📅 ${currentLang==='zh'?'品飲日期':'Date'}: ${esc(b.diary.date)}</div>` : ''}
        </div>

        ${(typeof isMyExploreItem === 'function' && b.ownerShareId && !isMyExploreItem(b, _myShareIdCache, localStorage.getItem('bottlesense_profile_name'), localStorage.getItem('bottlesense_account_bound'))) ? `<div style="text-align:right; margin:-6px 0 10px;"><button class="btn btn-ghost btn-sm" style="font-size:11px; padding:3px 8px; color:var(--text-faint);" onclick="reportExploreItem('${esc(b.id)}')">⚑ ${currentLang==='zh'?'檢舉':'Report'}</button></div>` : ''}
        <div class="modal-btn-row">
          <button class="btn btn-ghost modal-btn-close" onclick="closeModal()">${t('btn_close')}</button>
          <button class="btn btn-primary modal-btn-focus" onclick="closeModal(); flyToBottleRegion('${esc(b.id)}');">
            <span class="modal-btn-icon">🗺️</span><span>${currentLang==='zh'?'在地圖上定位':'Show on Map'}</span>
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
    sendDemandSignal('scan', bottle);
    // 關閉擾人的首次掃描註冊彈窗，直接進入酒款詳情
    renderBottleDetail(bottle.id);

  } catch(err) {
    showError(err?.message || (currentLang === 'zh' ? '辨識失敗，請確保酒標清晰後重試。' : 'Recognition failed. Please try again.'));
  }
}

async function identifyBottle(image, mediaType) {
  const res = await apiFetch('/api/scan', {
    method: 'POST',
    body: JSON.stringify({ image, mediaType })
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(apiErrorMessage(data.error, data) || `AI API Error (${res.status})`);
  if (data._quota) {
    try { localStorage.setItem('bottlesense_quota', JSON.stringify({ tier: data._quota.tier, used: data._quota.used, limit: data._quota.limit, bonus: data._quota.bonus || 0 })); } catch (e) {}
    const left = (data._quota.limit - data._quota.used) + (data._quota.bonus || 0);
    if (left <= 2) showToast(currentLang === 'zh' ? `本月餘下 ${left} 次 AI 辨識${data._quota.tier === 'guest' ? '（登入後可獲更多）' : ''}` : `${left} AI scans left this month`);
  }
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
  if (blockIfVisitor()) return;
  const b = (window.cellar || []).find(x => String(x.id) === String(id));
  if (!b) return;
  b.isFavorite = !b.isFavorite;
  await saveBottleToDB(b);
  if (rerender) renderBottleDetail(id);
  else if (currentView === 'cellar') renderCellar();
  else renderHome();
}

async function deleteBottle(id) {
  if (blockIfVisitor()) return;
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
let settingsActiveTab = 'collection'; // 'collection' | 'profile' | 'account'

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
function openSettings(page) {
  settingsActiveTab = page || 'menu';
  renderSettings();
}

function openLoginModal() {
  openSettings('auth');
}

// 2. 設定頁面：未登入呈現「電郵登入/註冊」；已登入呈現「個人資料」與「帳號管理」
function renderSettings() {
  const boundAccount = localStorage.getItem('bottlesense_account_bound');
  const profileName = localStorage.getItem('bottlesense_profile_name') || (boundAccount ? boundAccount.split('@')[0] : '');
  const birthday = localStorage.getItem('bottlesense_profile_birthday') || '';
  const gender = localStorage.getItem('bottlesense_profile_gender') || 'unspecified';
  const cellarCount = (window.cellar || []).length;

  let contentHTML = '';

  const zhS = currentLang === 'zh';
  let page = settingsActiveTab;
  if (boundAccount) {
    if (!['menu', 'collection', 'profile', 'credits', 'account', 'prefs'].includes(page)) page = 'menu';
  } else if (authFlowState.step !== 'email') {
    page = 'auth';
  } else if (!['menu', 'auth', 'prefs'].includes(page)) {
    page = 'menu';
  }
  const PAGE_TITLE = zhS
    ? { collection: '珍藏圖鑑', profile: '個人資料', credits: '額度與邀請', account: '雲端與帳號', prefs: '偏好與資料', auth: '登入 / 註冊' }
    : { collection: 'Collection', profile: 'Profile', credits: 'Credits & Invites', account: 'Cloud & Account', prefs: 'Preferences', auth: 'Sign in' };
  const subHeader = (p) => `<div class="sub-head"><button class="sub-back" onclick="openSettings()">‹ ${zhS ? '設定' : 'Settings'}</button><div class="sub-title">${PAGE_TITLE[p] || ''}</div></div>`;
  const menuRow = (icon, title, sub, onclick) => `<button class="menu-row" onclick="${onclick}"><span class="menu-ico">${icon}</span><span class="menu-text"><b>${title}</b><small>${sub}</small></span><span class="menu-chev">›</span></button>`;
  const menuHTML = boundAccount
    ? `<div class="menu-list">
        ${menuRow('👤', zhS ? '個人資料' : 'Profile', zhS ? '姓名、性別、生日' : 'Name, gender, birthday', "openSettings('profile')")}
        ${menuRow('🎴', zhS ? '珍藏圖鑑' : 'Collection', zhS ? '收藏進度與最愛酒款' : 'Progress and favorites', "openSettings('collection')")}
        ${menuRow('🏷', zhS ? '額度與邀請' : 'Credits & Invites', zhS ? '鑑識額度、兌換碼、邀請好友' : 'Scans, codes, invitations', "openSettings('credits')")}
        ${menuRow('☁', zhS ? '雲端與帳號' : 'Cloud & Account', zhS ? '備份狀態、登出、註銷' : 'Backup, sign out, delete', "openSettings('account')")}
        ${menuRow('⚙', zhS ? '偏好與資料' : 'Preferences', zhS ? '購買建議、匯出、私隱政策' : 'Suggestions, export, privacy', "openSettings('prefs')")}
        ${menuRow('📲', zhS ? '安裝教學' : 'Install guide', zhS ? '加入手機主畫面' : 'Add to home screen', 'showPwaInstallModal()')}
      </div>`
    : `<div class="menu-list">
        ${menuRow('👤', zhS ? '登入 / 註冊' : 'Sign in', zhS ? '雲端備份與跨裝置同步' : 'Backup and sync', "openSettings('auth')")}
        ${menuRow('⚙', zhS ? '偏好與資料' : 'Preferences', zhS ? '購買建議、匯出、私隱政策' : 'Suggestions, export, privacy', "openSettings('prefs')")}
        ${menuRow('📲', zhS ? '安裝教學' : 'Install guide', zhS ? '加入手機主畫面' : 'Add to home screen', 'showPwaInstallModal()')}
      </div>`;
  const tabHeaderHTML = subHeader(page);
  const zhT = zhS;

  if (boundAccount) {
    if (page === 'menu') {
      contentHTML = menuHTML;
    } else if (page === 'credits') {
      contentHTML = `${tabHeaderHTML}${creditsCardHTML() || `<div class="collect-hint">${zhS ? '額度資料載入中，請稍後再開啟。' : 'Loading, please reopen shortly.'}</div>`}`;
    } else if (page === 'prefs') {
      contentHTML = `${tabHeaderHTML}${prefsCardHTML()}`;
    } else if (page === 'collection') {
      contentHTML = `
        ${tabHeaderHTML}
        ${collectionCardHTML() || `<div class="collect-card"><div class="collect-title">🎴 ${zhT ? '我的珍藏圖鑑' : 'My collection'}</div><div class="collect-hint" style="margin-top:6px;">${zhT ? '酒架上有酒之後，這裡會顯示您的收藏進度。' : 'Your progress appears once bottles are on your shelf.'}</div></div>`}
        ${favoritesSectionHTML()}
        <button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="closeModal(); renderCellar();">${zhT ? '前往我的電子酒架' : 'Go to my shelf'}</button>
      `;
    } else if (page === 'profile') {
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
          <input type="date" id="edit-profile-birthday" max="${adultMaxDate()}" class="text-input" style="margin-top:0; padding:9px 12px; font-size:13px; text-align:left;" value="${esc(birthday)}" ${birthday ? 'disabled' : ''}>
          <div style="font-size:11px; color:var(--text-faint); margin-top:4px; line-height:1.5;">
            ${birthday
              ? (currentLang === 'zh' ? '🔒 生日設定後不可更改。如需更正，請聯絡我們。' : '🔒 Birthday is locked once set. Contact us to correct it.')
              : (currentLang === 'zh' ? '填寫生日（需年滿 18 歲）可解鎖公開發布及壽星禮遇。只可設定一次。' : 'Set your birthday (18+) to publish and get birthday perks. One-time only.')}
          </div>

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
            ${currentLang === 'zh' ? '登出帳號' : 'Logout'}
          </button>
          <button class="btn btn-ghost btn-block" style="padding:9px; font-size:12px; margin-top:8px;" onclick="logoutAllDevices()">
            🔐 ${currentLang === 'zh' ? '登出所有裝置並更換同步碼' : 'Sign out everywhere & rotate key'}
          </button>
        </div>

        <details class="danger-fold"><summary>⚠️ ${currentLang === 'zh' ? '危險操作' : 'Danger zone'}</summary>
        <div style="background:rgba(239,68,68,0.04); border:1px solid rgba(239,68,68,0.2); border-radius:12px; padding:14px; margin-top:8px;">
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
        </details>
      `;
    }
  } else {
    // 【未登入狀態】：依據步驟流程顯示
    if (page === 'menu') {
      contentHTML = menuHTML;
    } else if (page === 'prefs') {
      contentHTML = `${tabHeaderHTML}${prefsCardHTML()}`;
    } else if (authFlowState.step === 'email') {
      contentHTML = `
        ${tabHeaderHTML}
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:14px; padding:18px 16px; margin-bottom:12px;">
          <div style="font-size:14px; font-weight:700; color:var(--gold); margin-bottom:6px;">
            👤 ${currentLang === 'zh' ? '酒窖登入 / 註冊' : 'Cellar Login / Register'}
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:14px; line-height:1.5;">
            ${currentLang === 'zh' ? '輸入您的電郵地址即可快速登入或註冊酒窖：' : 'Enter your email address to sign in or register:'}
          </div>



          <div style="font-size:11.5px; font-family:var(--mono); color:var(--text-faint); margin-bottom:4px;">
            ${currentLang === 'zh' ? '電郵地址 (Email)' : 'Email Address'}
          </div>
          <input type="email" id="auth-email" class="text-input" style="margin-top:0; padding:11px 12px; font-size:14.5px;" value="${esc(authFlowState.email)}" placeholder="${currentLang === 'zh' ? '輸入您的電郵 (例如 user@gmail.com)' : 'Enter email (e.g. user@gmail.com)'}">
          
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
          <input type="date" id="reg-birthday" max="${adultMaxDate()}" class="text-input" style="margin-top:0; padding:9px 12px; font-size:13px; text-align:left;" value="${esc(authFlowState.birthday)}">
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
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:390px; text-align:left;" onclick="event.stopPropagation()">
        ${page === 'menu' ? `<h2 style="font-family:var(--serif); margin-bottom:14px; font-size:22px; color:var(--gold); text-align:center;">${t('settings_title')}</h2>` : ''}
        ${contentHTML}
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
    // 訪客期間在本機加入的酒款/品飲記錄一併帶入帳號 (與雲端資料合併，不覆蓋)
    const localCellar = (typeof readAllLocal === 'function') ? await readAllLocal() : [];
    const localDeleted = (typeof getDeletedMap === 'function') ? getDeletedMap() : {};
    const res = await apiFetch('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp, syncKey: clientSyncKey, localCellar, localDeleted, ref: localStorage.getItem('bottlesense_ref') || '' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(apiErrorMessage(data.error, data) || '驗證失敗');
    setSessionToken(data.token);
    localStorage.setItem('bottlesense_plan', data.plan || 'free');
    try { localStorage.removeItem('bottlesense_ref'); } catch (e) {}
    if (Array.isArray(data.granted)) data.granted.forEach(announceGrant);
    _authExpiredShown = false;

    if (data.cellar) {
      await restoreCellarToLocal(data.cellar, data.syncKey, data.name || data.email, data.deleted);
    }
    localStorage.setItem('bottlesense_account_bound', data.email);
    localStorage.setItem('bottlesense_profile_name', data.name || email.split('@')[0]);
    if (data.birthday) localStorage.setItem('bottlesense_profile_birthday', data.birthday);
    if (data.gender) localStorage.setItem('bottlesense_profile_gender', data.gender);
    localStorage.setItem('bottlesense_registered', 'true');

    updateHeaderGreeting();
    closeModal();
    refreshMe();
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
    const res = await apiFetch('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(apiErrorMessage(data.error, data) || (currentLang === 'zh' ? '發送失敗' : 'Failed to send'));
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
      showToast(currentLang === 'zh' ? '✓ 驗證碼已發送至您的電郵信箱！' : '✓ Code sent to your inbox!');
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
    const checkRes = await apiFetch('/api/auth/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const checkData = await checkRes.json();
    if (checkData.exists) {
      showToast(currentLang === 'zh' ? '⚠️ 此電郵已經註冊過！已自動為您切換至「登入模式」' : '⚠️ Email already registered! Switched to login mode.');
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
  if (!birthday) { showToast(apiErrorMessage('BIRTHDAY_REQUIRED')); return; }
  if (calcAge(birthday) < 18) { showToast(apiErrorMessage('UNDER_AGE', { minAge: 18 })); return; }

  authFlowState.name = name;
  authFlowState.gender = gender;
  authFlowState.birthday = birthday;

  showToast(currentLang === 'zh' ? '正在發送註冊驗證碼…' : 'Sending verification code...');
  try {
    const res = await apiFetch('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email: authFlowState.email, name, gender, birthday, type: 'register' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(apiErrorMessage(data.error, data) || (currentLang === 'zh' ? '發送失敗' : 'Failed to send'));

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
      showToast(currentLang === 'zh' ? '✓ 驗證碼已發送至您的信箱，請輸入完成註冊！' : '✓ Verification code sent to email!');
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
  updateHeaderGreeting();

  try {
    const clientSyncKey = localStorage.getItem('bottlesense_sync_key');
    const lockedBd = localStorage.getItem('bottlesense_profile_birthday') || '';
    if (!lockedBd && birthday && calcAge(birthday) < 18) { showToast(apiErrorMessage('UNDER_AGE', { minAge: 18 })); return; }
    const pr = await apiFetch('/api/profile/update', {
      method: 'POST',
      body: JSON.stringify({ email, name, gender, birthday: lockedBd ? '' : birthday, syncKey: clientSyncKey })
    });
    const pd = await pr.json().catch(() => ({}));
    if (!pr.ok) { showToast(apiErrorMessage(pd.error, pd) || '儲存失敗'); return; }
    if (pd.birthday) localStorage.setItem('bottlesense_profile_birthday', pd.birthday);
    refreshMe();
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

  try { if (typeof syncToCloudKV === 'function') await syncToCloudKV(); } catch(e) {}
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch(e) {}
  setSessionToken('');
  localStorage.removeItem('bottlesense_plan');
  localStorage.removeItem('bottlesense_me');
  if (typeof clearLocalCellar === 'function') await clearLocalCellar();
  window.cellar = [];
  localStorage.removeItem('bottlesense_sync_key');
  localStorage.removeItem('bottlesense_deleted');
  getOrCreateSyncKey();
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
    await apiFetch('/api/account/delete', {
      method: 'POST',
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

async function restoreCellarToLocal(cellarData, syncKey, name, deleted) {
  if (syncKey) localStorage.setItem('bottlesense_sync_key', syncKey);
  if (name) localStorage.setItem('bottlesense_profile_name', name);
  if (deleted && typeof deleted === 'object') setDeletedMap({ ...getDeletedMap(), ...deleted });
  // 以雲端合併結果為準寫入本機 (不逐筆觸發同步，避免用舊資料覆蓋雲端)
  if (Array.isArray(cellarData)) {
    const keep = new Set(cellarData.map(b => String(b.id)));
    const existing = await readAllLocal();
    const toDel = existing.filter(b => !keep.has(String(b.id)) && deleted && deleted[b.id]).map(b => b.id);
    if (toDel.length) await deleteBottlesLocalRaw(toDel);
    await putBottlesLocalRaw(cellarData);
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
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:360px; padding:24px 20px; text-align:left;">
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
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:350px; text-align:center; padding:22px 18px;">
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
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:380px; text-align:left; max-height:80vh; overflow-y:auto; padding:20px;">
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
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:380px; text-align:left; max-height:80vh; overflow-y:auto; padding:20px;">
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
    captureRefParam();
    updateHeaderGreeting();
    document.getElementById('langSwitchBtn').textContent = currentLang === 'zh' ? 'EN' : '繁';
    await refreshCellar();
    const params = new URLSearchParams(location.search);
    const publicKey = params.get('cellar') || params.get('key');
    const sharedShelf = params.get('shelf');
    const sharedBottleId = params.get('bottle');

    if (publicKey) {
      setTimeout(maybeShowOnboarding, 700);
      await loadPublicCellar(publicKey, sharedShelf, sharedBottleId);
      return;
    }
    renderHome();
    schedulePhotoMigration();
    setTimeout(maybeShowOnboarding, 900);
    if (getSessionToken()) setTimeout(refreshMe, 1500);
    if (localStorage.getItem('bottlesense_account_bound')) {
      if (!getSessionToken()) handleAuthExpired(); else syncToCloudKV();
    } else setSyncStatus('ok');
    window.addEventListener('online', () => scheduleSync());
    window.addEventListener('offline', () => setSyncStatus('offline'));
  } catch(e) {
    window.cellar = [];
    renderHome();
  }
}

// 雲端有較新資料寫入本機後，重新整理畫面
function onCloudCellarChanged() {
  if (isVisitorMode) return;
  window.cellar = Array.isArray(window.cellar) ? window.cellar.map(normalizeBottle) : [];
  if (document.querySelector('.modal-overlay')) return;
  if (currentView === 'cellar') renderCellar();
  else if (currentView === 'home') renderHome();
}

// 切回 App(PWA 回到前景)時拉取其他裝置的更新
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !isVisitorMode && localStorage.getItem('bottlesense_account_bound')) {
    syncToCloudKV();
  }
});

document.addEventListener('DOMContentLoaded', initApp);


function expandTimeline(bottleId) {
  window['timeline_expanded_' + bottleId] = true;
  renderBottleDetail(bottleId);
}

async function togglePublishSession(bottleId, sessionId) {
  if (blockIfVisitor()) return;
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
    await unpublishFromCommunityPool(bottleId, sessionId);
    showToast(currentLang==='zh'?'✓ 已收回該筆公開品飲手記':'✓ Withdrawn from Community Feed');
  }
  renderBottleDetail(bottleId);
}


/* ---- 手機鍵盤彈出時，彈窗跟隨可視範圍並自動捲到輸入框 ---- */
(function setupKeyboardSafeModals() {
  const vv = window.visualViewport;
  const apply = () => {
    if (!vv) return;
    document.documentElement.style.setProperty('--vvh', vv.height + 'px');
    document.documentElement.style.setProperty('--vvt', vv.offsetTop + 'px');
  };
  if (vv) { vv.addEventListener('resize', apply); vv.addEventListener('scroll', apply); apply(); }
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!el || !el.closest || !el.closest('.modal-card')) return;
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    setTimeout(() => { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch(e) {} }, 320);
  });
})();


/* ---------------- PWA service worker ---------------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}


/* ---------------- 贊助購買建議 (只以酒款屬性配對，不帶任何用戶身份) ---------------- */
function offersEnabled() { try { return localStorage.getItem('bottlesense_offers') !== '0' && localStorage.getItem('bottlesense_age_ok') === '1'; } catch (e) { return false; } }
function toggleOffers(on) {
  try { localStorage.setItem('bottlesense_offers', on ? '1' : '0'); } catch (e) {}
  showToast(currentLang === 'zh' ? (on ? '✓ 已開啟購買建議' : '✓ 已關閉購買建議與匿名需求統計') : (on ? 'Suggestions on' : 'Suggestions off'));
}
function bottleQueryAttrs(b) {
  return {
    name: String(bottleName(b) || '').slice(0, 120),
    producer: String((b.identification && b.identification.producer) || '').slice(0, 80),
    category: String(bottleCategory(b) || '').slice(0, 30),
    country: String(bottleCountry(b) || '').slice(0, 40),
    region: String(bottleRegion(b) || '').slice(0, 60)
  };
}
// 匿名需求訊號：只送「酒款屬性」，不含帳號 / 同步碼 / 位置
function sendDemandSignal(type, b) {
  if (!offersEnabled() || isVisitorMode || !b) return;
  const q = bottleQueryAttrs(b);
  if (!q.name) return;
  try {
    fetch(`${WORKER_API_URL}/api/signal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ...q }), keepalive: true }).catch(() => {});
  } catch (e) {}
}
async function loadOffersInto(bottleId) {
  if (!offersEnabled() || isVisitorMode) return;
  const slot = document.getElementById('offers-slot');
  const b = (window.cellar || []).find(x => String(x.id) === String(bottleId));
  if (!slot || !b) return;
  try {
    const res = await fetch(`${WORKER_API_URL}/api/offers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bottleQueryAttrs(b)) });
    if (!res.ok) return;
    const o = await res.json();
    const zh = currentLang === 'zh';
    const showBuy = b.status === 'wishlist' || b.status === 'unopened';
    const buy = showBuy ? (o.buy || []) : [];
    const sim = o.similar || [];
    if (!buy.length && !sim.length) return;
    const row = (x) => `<a class="offer-row" href="${esc(x.go)}" target="_blank" rel="noopener sponsored nofollow">
        <span class="offer-main"><span class="offer-title">${esc(x.title)}</span><span class="offer-shop">${esc(x.merchant)}</span></span>
        <span class="offer-price">${esc(x.price || (zh ? '查看' : 'View'))} &rsaquo;</span></a>`;
    if (!document.getElementById('offers-slot')) return;
    document.getElementById('offers-slot').innerHTML = `
      <div class="offers-card">
        ${buy.length ? `<div class="offers-head"><span>🛒 ${zh ? '哪裡有得買' : 'Where to buy'}</span><span class="ad-tag">${zh ? '贊助' : 'Sponsored'}</span></div>${buy.map(row).join('')}` : ''}
        ${sim.length ? `<div class="offers-head" style="${buy.length ? 'margin-top:12px;' : ''}"><span>✨ ${zh ? '您可能也喜歡' : 'You may also like'}</span><span class="ad-tag">${zh ? '贊助' : 'Sponsored'}</span></div>${sim.map(row).join('')}` : ''}
        <div class="offers-foot">${zh ? '根據酒款資料配對，不涉及您的個人資料。' : 'Matched on bottle info only, not on personal data.'}
          <a href="javascript:void(0)" onclick="toggleOffers(false); document.getElementById('offers-slot').innerHTML='';">${zh ? '關閉建議' : 'Turn off'}</a></div>
      </div>`;
  } catch (e) {}
}

/* ---------------- 匯出 CSV ---------------- */
function exportCellarCSV() {
  const rows = [['名稱', '酒莊/品牌', '類別', '國家', '產區', '年份', '狀態', '收藏', '加入日期', '品飲次數', '最近評分', '最近品飲備註']];
  const stName = { unopened: '未開封', opened: '品鑑中', finished: '已品畢', kept: '典藏', gifted: '已贈送', sold: '已售出', wishlist: '心儀' };
  (window.cellar || []).forEach(b => {
    const last = (b.tastings || [])[0] || {};
    rows.push([bottleName(b), (b.identification && b.identification.producer) || '', bottleCategory(b), bottleCountry(b), bottleRegion(b), bottleVintage(b),
      stName[b.status] || b.status, b.isFavorite ? '是' : '', b.addedAt ? new Date(b.addedAt).toISOString().slice(0, 10) : '', (b.tastings || []).length, last.rating || '', last.notes || '']);
  });
  const esc2 = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';
  const csv = '\ufeff' + rows.map(r => r.map(esc2).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bottlesense-cellar-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------------- 首次使用導覽 ---------------- */
function maybeShowOnboarding() {
  if (document.querySelector('.modal-overlay')) return;
  let ageOk = '', blocked = '', onboarded = '';
  try { ageOk = localStorage.getItem('bottlesense_age_ok') || ''; blocked = localStorage.getItem('bottlesense_age_blocked') || ''; onboarded = localStorage.getItem('bottlesense_onboarded') || ''; } catch (e) { return; }
  const zh = currentLang === 'zh';
  if (blocked) { showAgeBlocked(); return; }
  if (!ageOk) {
    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card" role="dialog" aria-modal="true" style="max-width:360px; text-align:center;">
          <div style="font-size:42px; margin-bottom:6px;">🍷</div>
          <h2 style="font-family:var(--serif); color:var(--gold); font-size:20px; margin-bottom:10px;">${zh ? '年齡確認' : 'Age confirmation'}</h2>
          <p style="font-size:13.5px; color:var(--text-muted); line-height:1.6; margin-bottom:16px;">${zh ? 'BottleSense 與酒類相關，只供年滿 18 歲（及符合所在地法定飲酒年齡）人士使用。您是否已年滿 18 歲？' : 'BottleSense is about alcoholic drinks and is for adults aged 18+ (and of legal drinking age where you live). Are you 18 or older?'}</p>
          <button class="btn btn-primary btn-block" onclick="confirmAge(true)">${zh ? '我已年滿 18 歲' : 'I am 18 or older'}</button>
          <button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="confirmAge(false)">${zh ? '我未滿 18 歲' : 'I am under 18'}</button>
          <p style="font-size:11px; color:var(--text-faint); margin-top:12px;">${zh ? '請適量飲酒，飲酒不駕駛。' : 'Please drink responsibly.'}</p>
        </div>
      </div>`;
    return;
  }
  if (onboarded || isVisitorMode) return;
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:360px; text-align:left;">
        <h2 style="font-family:var(--serif); color:var(--gold); font-size:20px; text-align:center; margin-bottom:14px;">${zh ? '歡迎使用 BottleSense' : 'Welcome to BottleSense'}</h2>
        <div class="onb-step"><span>📷</span><div><strong>${zh ? '拍攝酒標，AI 即時鑑識' : 'Snap a label'}</strong><br>${zh ? '自動填寫酒款、產區與價值評分。' : 'AI fills in the bottle details and value profile.'}</div></div>
        <div class="onb-step"><span>🗂️</span><div><strong>${zh ? '以電子酒窖典藏您的酒' : 'Four spaces'}</strong><br>${zh ? '未開、已飲、飲盡、珍藏、饋贈與願望六處空間。可在酒款頁隨時移動。' : 'Unopened, Opened, Finished, Wishlist.'}</div></div>
        <div class="onb-step"><span>🌍</span><div><strong>${zh ? '探索酒友分享' : 'Explore'}</strong><br>${zh ? '在世界地圖上看看其他人在哪裡品嚐什麼酒。' : 'See what others are drinking around the world.'}</div></div>
        <div class="onb-step"><span>🎁</span><div><strong>${zh ? '登入有額外禮遇' : 'Perks when you sign in'}</strong><br>${zh ? '跨裝置同步、壽星送辨識額度、邀請朋友雙方有獎。' : 'Sync devices, birthday bonus, invite friends for rewards.'}</div></div>
        <button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="try{localStorage.setItem('bottlesense_onboarded','1')}catch(e){}; closeModal();">${zh ? '開始使用' : 'Get started'}</button>
      </div>
    </div>`;
}
function confirmAge(isAdult) {
  try { localStorage.setItem(isAdult ? 'bottlesense_age_ok' : 'bottlesense_age_blocked', '1'); } catch (e) {}
  closeModal();
  if (isAdult) setTimeout(maybeShowOnboarding, 200); else showAgeBlocked();
}
function showAgeBlocked() {
  const zh = currentLang === 'zh';
  document.body.innerHTML = `<div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:#11120D; color:#e8e6dc; text-align:center; font-family:-apple-system,sans-serif;"><div><div style="font-size:42px;">🚫</div><h2 style="color:#D4AF37; margin:10px 0;">${zh ? '未能使用本服務' : 'Not available'}</h2><p style="color:#9a9a8c; line-height:1.6;">${zh ? 'BottleSense 只供年滿 18 歲人士使用。' : 'BottleSense is for adults aged 18+.'}</p></div></div>`;
}


// 私隱政策在 App 內以彈窗顯示 (PWA 全螢幕模式冇返回掣，開新頁會被困住)
async function showPrivacyModal() {
  const zh = currentLang === 'zh';
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" role="dialog" aria-modal="true" style="max-width:420px; text-align:left; display:flex; flex-direction:column;" onclick="event.stopPropagation()">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h2 style="font-family:var(--serif); color:var(--gold); font-size:18px; margin:0;">${zh ? '私隱政策與使用條款' : 'Privacy & Terms'}</h2>
          <button class="icon-btn" aria-label="Close" onclick="renderSettings()">✕</button>
        </div>
        <div id="privacy-body" class="privacy-body">${zh ? '載入中…' : 'Loading…'}</div>
        <button class="btn btn-ghost btn-block" style="margin-top:12px;" onclick="renderSettings()">${zh ? '← 返回設定' : '← Back to settings'}</button>
      </div>
    </div>`;
  try {
    const res = await fetch('privacy.html');
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('main > p:first-child, script, style').forEach(n => n.remove());
    const el = document.getElementById('privacy-body');
    if (el) el.innerHTML = doc.querySelector('main').innerHTML;
  } catch (e) {
    const el = document.getElementById('privacy-body');
    if (el) el.textContent = zh ? '暫時無法載入，請連線後再試。' : 'Unable to load. Please try again online.';
  }
}


/* ---------------- 年齡 / 額度 / 兌換碼 / 邀請 ---------------- */
function calcAge(bd) {
  const d = new Date(bd + 'T00:00:00'), n = new Date();
  let age = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) age--;
  return age;
}
function adultMaxDate() {
  const d = new Date(); d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}
function getMe() { try { return JSON.parse(localStorage.getItem('bottlesense_me') || 'null'); } catch (e) { return null; } }
function refSuffix() { const me = getMe(); return me && me.refCode ? '&ref=' + encodeURIComponent(me.refCode) : ''; }
function captureRefParam() {
  try {
    const p = new URLSearchParams(location.search);
    const r = (p.get('ref') || '').toUpperCase();
    if (/^[0-9A-F]{8}$/.test(r) && !localStorage.getItem('bottlesense_account_bound')) localStorage.setItem('bottlesense_ref', r);
  } catch (e) {}
}
function announceGrant(g) {
  const zh = currentLang === 'zh';
  if (!g) return;
  if (g.src === 'birthday') showToast(zh ? `🎂 生日快樂！送您 ${g.n} 次 AI 辨識額度` : `🎂 Happy birthday! +${g.n} scans`);
  else if (g.src === 'campaign') showToast(zh ? `🎁 ${g.name || '活動'}：送您 ${g.n} 次 AI 辨識額度` : `🎁 ${g.name || 'Promo'}: +${g.n} scans`);
  else if (g.src === 'referral') showToast(zh ? `🤝 邀請獎勵：+${g.n} 次 AI 辨識額度` : `🤝 Referral reward: +${g.n} scans`);
}
async function refreshMe() {
  if (!getSessionToken()) return null;
  try {
    const res = await apiFetch('/api/me');
    if (!res.ok) return null;
    const me = await res.json();
    localStorage.setItem('bottlesense_me', JSON.stringify(me));
    if (me.birthday) localStorage.setItem('bottlesense_profile_birthday', me.birthday);
    localStorage.setItem('bottlesense_plan', me.plan || 'free');
    (me.granted || []).forEach(announceGrant);
    return me;
  } catch (e) { return null; }
}
async function redeemCode() {
  const el = document.getElementById('redeem-code');
  const code = (el && el.value || '').trim();
  if (!code) return;
  try {
    const res = await apiFetch('/api/redeem', { method: 'POST', body: JSON.stringify({ code }) });
    const d = await res.json();
    if (!res.ok) { showToast(apiErrorMessage(d.error, d) || '兌換失敗'); return; }
    const zh = currentLang === 'zh';
    const parts = [];
    if (d.scans) parts.push(zh ? `+${d.scans} 次辨識` : `+${d.scans} scans`);
    if (d.proDays) parts.push(zh ? `Pro ${d.proDays} 日` : `Pro ${d.proDays} days`);
    showToast('🎁 ' + (zh ? '兌換成功：' : 'Redeemed: ') + parts.join(' / '));
    if (d.voucher) setTimeout(() => alert((d.voucher.title || '') + '\n' + (d.voucher.text || '') + (d.voucher.url ? '\n' + d.voucher.url : '')), 400);
    await refreshMe();
    renderSettings();
  } catch (e) { showToast(currentLang === 'zh' ? '兌換失敗，請稍後再試' : 'Failed'); }
}
function inviteLink() {
  const me = getMe();
  return me && me.refCode ? `${location.origin}${location.pathname}?ref=${me.refCode}` : '';
}
async function shareInvite() {
  const link = inviteLink();
  if (!link) return;
  const zh = currentLang === 'zh';
  const text = zh ? '我正在用 BottleSense 管理酒窖，使用我的邀請連結註冊，我們都能獲得額外 AI 辨識額度：' : 'I use BottleSense for my cellar. Sign up with my link and we both get bonus scans:';
  try {
    if (navigator.share) { await navigator.share({ title: 'BottleSense', text, url: link }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text + ' ' + link); showToast(zh ? '✓ 邀請連結已複製' : '✓ Invite link copied'); }
  catch (e) { prompt(zh ? '複製邀請連結：' : 'Copy link:', link); }
}
function prefsCardHTML() {
  return `
        <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-top:12px; margin-bottom:12px;">
          <label style="display:flex; align-items:flex-start; gap:8px; font-size:12.5px; color:var(--text); line-height:1.45; cursor:pointer;">
            <input type="checkbox" ${offersEnabled() ? 'checked' : ''} onchange="toggleOffers(this.checked)" style="margin-top:2px; accent-color:#D4AF37;">
            <span>🛒 ${currentLang === 'zh' ? '顯示購買建議（贊助）並提供匿名需求統計' : 'Show purchase suggestions (sponsored) & anonymous demand stats'}<br><span style="color:var(--text-faint); font-size:11px;">${currentLang === 'zh' ? '只用酒款資料配對，不含您的身份。' : 'Matched on bottle info only; no identity is sent.'}</span></span>
          </label>
          <div style="display:flex; gap:8px; margin-top:10px;">
            <button class="btn btn-ghost btn-sm" style="flex:1; font-size:12px;" onclick="exportCellarCSV()">⬇️ ${currentLang === 'zh' ? '匯出 CSV' : 'Export CSV'}</button>
            <button class="btn btn-ghost btn-sm" style="flex:1; font-size:12px;" onclick="showPrivacyModal()">🔒 ${currentLang === 'zh' ? '私隱政策' : 'Privacy'}</button>
          </div>
        </div>
  `;
}

function favoritesSectionHTML() {
  const zh = currentLang === 'zh';
  const favs = (window.cellar || []).filter(b => b.isFavorite);
  return `
    <div class="collect-card">
      <div class="collect-title">⭐ ${zh ? '我的最愛' : 'Favorites'} (${favs.length})</div>
      ${favs.length ? `<div class="fav-list">${favs.map(b => `
        <div class="fav-row" onclick="closeModal(); renderBottleDetail('${esc(b.id)}')">
          <span>${rarityBadge(b)}</span><span class="fav-name">${esc(bottleName(b))}</span><span class="fav-go">›</span>
        </div>`).join('')}</div>` : `<div class="collect-hint" style="margin-top:6px;">${zh ? '在酒款頁點選右上角的星號，即可加入最愛。' : 'Tap the star on a bottle page to add it here.'}</div>`}
    </div>`;
}

function creditsCardHTML() {
  const me = getMe();
  if (!me) return '';
  const zh = currentLang === 'zh';
  const pro = me.plan === 'pro';
  const left = Math.max(0, (me.quota?.limit || 0) - (me.quota?.used || 0));
  const proTxt = pro ? (me.proUntil ? (zh ? `Pro 至 ${new Date(me.proUntil).toISOString().slice(0, 10)}` : `Pro until ${new Date(me.proUntil).toISOString().slice(0, 10)}`) : 'Pro') : (zh ? '免費版' : 'Free');
  return `
    <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:12px; padding:14px; margin-bottom:14px;">
      <div style="font-size:12.5px; font-weight:700; color:var(--gold); margin-bottom:8px;">🎟️ ${zh ? '我的額度' : 'My credits'} · ${proTxt}</div>
      <div style="font-size:12.5px; color:var(--text); line-height:1.7;">
        ${zh ? `本月 AI 辨識：餘 <strong style="color:var(--gold);">${left}</strong> / ${me.quota?.limit || 0} 次` : `Monthly scans left: <strong style="color:var(--gold);">${left}</strong> / ${me.quota?.limit || 0}`}<br>
        ${zh ? `額外額度：<strong style="color:var(--gold);">${me.bonus || 0}</strong> 次（90 日內有效）` : `Bonus scans: <strong style="color:var(--gold);">${me.bonus || 0}</strong>`}
      </div>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <input type="text" id="redeem-code" class="text-input" style="margin-top:0; padding:8px 10px; font-size:13px; flex:1; text-transform:uppercase;" placeholder="${zh ? '輸入兌換碼' : 'Gift code'}" autocomplete="off">
        <button class="btn btn-primary btn-sm" style="font-size:12px;" onclick="redeemCode()">${zh ? '兌換' : 'Redeem'}</button>
      </div>
      <div style="border-top:1px solid var(--line); margin-top:12px; padding-top:10px;">
        <div style="font-size:12.5px; font-weight:700; color:var(--gold); margin-bottom:4px;">🤝 ${zh ? '邀請朋友，雙方有獎' : 'Invite friends'}</div>
        <div style="font-size:11.5px; color:var(--text-faint); line-height:1.5; margin-bottom:8px;">
          ${zh ? `朋友使用您的連結註冊、完成首次辨識並滿 3 日，雙方各得 10 次額度（每月上限 10 位）。已成功邀請 ${me.refCount || 0} 位。` : `Friends who join via your link, scan once and stay 3 days: you both get 10 scans. Invited: ${me.refCount || 0}.`}
        </div>
        <button class="btn btn-ghost btn-sm btn-block" style="font-size:12px;" onclick="shareInvite()">📨 ${zh ? '分享邀請連結' : 'Share invite link'}</button>
      </div>
    </div>`;
}
