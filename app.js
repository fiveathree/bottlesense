/* BottleSense app.js
 * UI layer only — db.js handles IndexedDB + Cloudflare sync.
 */

const main = document.getElementById('main');
const modalContainer = document.getElementById('modal-container');
const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');

let currentView = 'home';
let currentBottleId = null;
let currentImageData = null;

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
  return x.name || x.brand || x.productName || b.name || '未辨識酒款';
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
  return b?.image ||
         b?.imageData ||
         b?.photo ||
         b?.imageUrl ||
         '';
}

function setActiveNav(id) {
  document.querySelectorAll('.navbtn').forEach(x => {
    x.classList.remove('active');
  });

  const el = document.getElementById(id);

  if (el) {
    el.classList.add('active');
  }
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

  x.tastings = Array.isArray(x.tastings)
    ? x.tastings
    : [];

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
    red: c.filter(b => bottleCategory(b) === '紅酒').length,
    whisky: c.filter(b => bottleCategory(b) === '威士忌').length,
    white: c.filter(b => bottleCategory(b) === '白酒').length,
    fav: c.filter(b => b.isFavorite).length
  };
}

function goHome() {
  renderHome();
}

function renderHome() {
  currentView = 'home';
  setActiveNav('nav-home');

  const s = statCounts();

  main.innerHTML = `
    <div class="view">

      <section class="scan-hero">

        <h1>認識你的每一瓶酒</h1>

        <p>
          拍下酒標，讓 AI 幫你辨識酒款、產區、年份，
          並給出品飲與收藏建議。
        </p>

        <div class="scan-center-box">

          <button
            class="scan-btn"
            onclick="openCamera()"
            aria-label="拍照辨識"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            >
              <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/>
              <circle cx="12" cy="13" r="3.5"/>
            </svg>
          </button>

          <span
            class="upload-subtext"
            onclick="openGallery()"
          >
            從相簿選照片
          </span>

        </div>

      </section>

      <div class="stat-grid-5">

        <div
          class="stat-card"
          onclick="renderCellar()"
        >
          <div class="stat-num">${s.total}</div>
          <div class="stat-label">TOTAL</div>
        </div>

        <div
          class="stat-card"
          onclick="filterCellar('紅酒')"
        >
          <div class="stat-num">${s.red}</div>
          <div class="stat-label">RED</div>
        </div>

        <div
          class="stat-card"
          onclick="filterCellar('威士忌')"
        >
          <div class="stat-num">${s.whisky}</div>
          <div class="stat-label">WHISKY</div>
        </div>

        <div
          class="stat-card"
          onclick="filterCellar('白酒')"
        >
          <div class="stat-num">${s.white}</div>
          <div class="stat-label">WHITE</div>
        </div>

        <div
          class="stat-card"
          onclick="filterCellar('收藏')"
        >
          <div class="stat-num">${s.fav}</div>
          <div class="stat-label">FAV</div>
        </div>

      </div>

      <div class="section-head">
        <h2>最近收藏</h2>
        <a onclick="renderCellar()">查看全部 →</a>
      </div>

      ${recentBottleHTML()}

    </div>
  `;
}

function recentBottleHTML() {
  const list = (window.cellar || []).slice(0, 3);

  if (!list.length) {
    return `
      <div class="empty-shelf">
        酒櫃目前是空的
        <br>
        先拍一瓶酒標開始吧。
      </div>
    `;
  }

  return list.map(bottleCardHTML).join('');
}

function bottleCardHTML(b) {
  const img = bottleImage(b);

  const meta = [
    bottleVintage(b),
    bottleCountry(b),
    bottleRegion(b)
  ]
    .filter(Boolean)
    .join(' · ');

  return `
    <div class="swipe-item-wrapper">

      <div
        class="swipe-action-left"
        onclick="toggleFavorite('${esc(b.id)}')"
      >
        <span class="swipe-action-icon">★</span>
        <span>收藏</span>
      </div>

      <div
        class="swipe-action-right"
        onclick="deleteBottle('${esc(b.id)}')"
      >
        <span class="swipe-action-icon">×</span>
        <span>刪除</span>
      </div>

      <article
        class="bottle-card"
        onclick="renderBottleDetail('${esc(b.id)}')"
      >

        <div class="bottle-photo-box">

          ${
            img
              ? `<img src="${esc(img)}" alt="">`
              : `<div class="emoji-fallback">
                   ${categoryEmoji(bottleCategory(b))}
                 </div>`
          }

        </div>

        <div class="bottle-info">

          <div class="bottle-name">
            ${esc(bottleName(b))}
          </div>

          <div class="bottle-sub">
            ${esc(meta || bottleCategory(b))}
          </div>

          <div class="tag-cluster">

            <span class="tag-badge">
              ${esc(bottleCategory(b))}
            </span>

            ${
              b.isFavorite
                ? '<span class="tag-badge secondary">★ 收藏</span>'
                : ''
            }

          </div>

        </div>

        ${
          b.isFavorite
            ? '<div class="fav-star-badge">★</div>'
            : ''
        }

      </article>

    </div>
  `;
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

function renderCellar() {
  currentView = 'cellar';

  setActiveNav('nav-cellar');

  renderCellarContent();
}

function renderCellarContent(category = '全部') {

  const list = (window.cellar || []).filter(b => {

    if (category === '全部') {
      return true;
    }

    if (category === '收藏') {
      return !!b.isFavorite;
    }

    if (category === '其他') {
      return ![
        '紅酒',
        '白酒',
        '威士忌',
        '清酒',
        '氣泡酒',
        '啤酒'
      ].includes(bottleCategory(b));
    }

    return bottleCategory(b) === category;
  });

  const cats = [
    '全部',
    '紅酒',
    '白酒',
    '威士忌',
    '清酒',
    '氣泡酒',
    '啤酒',
    '其他',
    '收藏'
  ];

  main.innerHTML = `
    <div class="view">

      <div class="section-head">

        <h2>我的酒櫃</h2>

        <a onclick="openGallery()">＋ 新增</a>

      </div>

      <div class="filter-row">

        ${
          cats.map(c => `
            <button
              class="filter-chip ${c === category ? 'active' : ''}"
              onclick="filterCellar('${esc(c)}')"
            >
              ${c}
            </button>
          `).join('')
        }

      </div>

      <div class="shelf-container shelf-bar">

        <div class="shelf-beam"></div>

        ${
          list.length
            ? list.map(bottleCardHTML).join('')
            : '<div class="empty-shelf">這個分類暫時沒有酒。</div>'
        }

      </div>

    </div>
  `;
}

function filterCellar(category) {
  currentView = 'cellar';

  setActiveNav('nav-cellar');

  renderCellarContent(category);
}

function renderExplore() {
  currentView = 'explore';

  setActiveNav('nav-explore');

  const s = statCounts();

  main.innerHTML = `
    <div class="view">

      <div class="section-head">
        <h2>探索</h2>
      </div>

      <div class="info-block">

        <h3>你的酒櫃</h3>

        <div class="storage-row">
          <span class="storage-tag">TOTAL</span>
          <span class="storage-desc">
            ${s.total} 瓶酒
          </span>
        </div>

        <div class="storage-row">
          <span class="storage-tag">FAV</span>
          <span class="storage-desc">
            ${s.fav} 瓶收藏
          </span>
        </div>

      </div>

      <div class="section-head">
        <h2>酒類分類</h2>
      </div>

      <div class="destination-grid">

        ${[
          '紅酒',
          '白酒',
          '威士忌',
          '清酒',
          '氣泡酒',
          '啤酒'
        ].map(c => `
          <div
            class="dest-card"
            onclick="filterCellar('${c}')"
          >
            <span class="icon">
              ${categoryEmoji(c)}
            </span>

            <span class="title">
              ${c}
            </span>
          </div>
        `).join('')}

      </div>

      <div class="section-head">
        <h2>開始探索</h2>
      </div>

      <div class="info-block">

        <h3>拍一瓶新酒</h3>

        <p class="storage-desc">
          辨識後會自動加入你的酒櫃。
        </p>

        <button
          class="btn btn-primary btn-block"
          style="margin-top:12px"
          onclick="openCamera()"
        >
          拍照辨識
        </button>

      </div>

    </div>
  `;
}

function renderBottleDetail(id) {

  const b = (window.cellar || []).find(
    x => String(x.id) === String(id)
  );

  if (!b) {
    renderCellar();
    return;
  }

  currentBottleId = b.id;

  const x = safeIdentification(b);

  const img = bottleImage(b);

  const confidence = Number(
    x.conf ??
    x.confidence ??
    0
  );

  const vm = x.vm || {};

  main.innerHTML = `
    <div class="view">

      <div class="back-row">

        <button
          class="btn btn-ghost"
          style="padding:7px 12px"
          onclick="${
            currentView === 'cellar'
              ? 'renderCellar()'
              : 'goHome()'
          }"
        >
          ← 返回
        </button>

        <button
          class="share-plane-btn"
          onclick="shareBottle('${esc(b.id)}')"
        >
          分享
        </button>

      </div>

      ${
        img
          ? `
            <div class="detail-photo-hero">
              <img src="${esc(img)}" alt="">
            </div>
          `
          : ''
      }

      <div class="label-card">

        ${
          confidence
            ? `
              <div
                class="confidence-seal ${
                  confidence >= 80
                    ? 'seal-high'
                    : confidence >= 55
                      ? 'seal-medium'
                      : 'seal-low'
                }"
              >

                <div class="seal-pct">
                  ${Math.round(confidence)}%
                </div>

                <div class="seal-label">
                  CONF
                </div>

              </div>
            `
            : ''
        }

        <div class="label-eyebrow">
          ${esc(bottleCategory(b))}
        </div>

        <div class="label-name">
          ${esc(bottleName(b))}
        </div>

        <div class="label-sub">
          ${esc(
            [
              bottleCountry(b),
              bottleRegion(b)
            ]
              .filter(Boolean)
              .join(' · ')
          )}
        </div>

        <div class="label-facts">

          <div>
            <div class="fact-label">VINTAGE</div>
            <div class="fact-value">
              ${esc(bottleVintage(b))}
            </div>
          </div>

          <div>
            <div class="fact-label">CATEGORY</div>
            <div class="fact-value">
              ${esc(bottleCategory(b))}
            </div>
          </div>

          <div>
            <div class="fact-label">COUNTRY</div>
            <div class="fact-value">
              ${esc(bottleCountry(b) || '未知')}
            </div>
          </div>

          <div>
            <div class="fact-label">REGION</div>
            <div class="fact-value">
              ${esc(bottleRegion(b) || '未知')}
            </div>
          </div>

        </div>

      </div>

      ${renderRadar(vm)}

      ${renderRecommendation(x, b)}

      ${renderTastings(b)}

      <div class="info-block">

        <h3>收藏</h3>

        <button
          class="btn ${
            b.isFavorite
              ? 'btn-primary'
              : 'btn-ghost'
          } btn-block"
          onclick="toggleFavorite('${esc(b.id)}', true)"
        >
          ${
            b.isFavorite
              ? '★ 已收藏'
              : '☆ 加入收藏'
          }
        </button>

      </div>

    </div>
  `;
}

function renderRadar(vm) {

  const dims = [
    '外觀',
    '香氣',
    '口感',
    '平衡',
    '複雜度',
    '餘韻',
    '適飲性',
    '收藏'
  ];

  const vals = dims.map((_, i) =>
    Number(
      vm?.[i] ??
      vm?.[String(i + 1)] ??
      vm?.[dims[i]] ??
      0
    )
  );

  if (!vals.some(v => v)) {
    return '';
  }

  return `
    <div class="radar-wrap">

      <h3>AI 品飲評估</h3>

      <div class="radar-legend">

        ${
          dims.map((d, i) => `
            <div class="legend-row">

              <span class="dim">
                ${d}
              </span>

              <span class="val">
                ${Math.max(
                  0,
                  Math.min(100, vals[i])
                )}
              </span>

            </div>
          `).join('')
        }

      </div>

    </div>
  `;
}

function renderRecommendation(x, b) {

  const text =
    x.recommendation ||
    x.recommend ||
    x.decision ||
    x.advice ||
    '';

  const reason =
    x.reason ||
    x.summary ||
    '';

  if (!text && !reason) {
    return '';
  }

  return `
    <div class="rec-card">

      <h3>品飲建議</h3>

      ${
        reason
          ? `
            <div class="rec-reason">
              ${esc(reason)}
            </div>
          `
          : ''
      }

      ${
        text
          ? `
            <div class="action-item">

              <div class="action-rank">
                1
              </div>

              <div class="action-icon">
                🍷
              </div>

              <div class="action-body">

                <div class="action-title">
                  ${esc(text)}
                </div>

              </div>

            </div>
          `
          : ''
      }

    </div>
  `;
}

function renderTastings(b) {

  const ts = Array.isArray(b.tastings)
    ? b.tastings
    : [];

  if (!ts.length) {
    return '';
  }

  return `
    <div class="info-block">

      <h3>品飲紀錄</h3>

      <div class="timeline-list">

        ${
          ts
            .slice()
            .reverse()
            .map(t => `
              <div class="timeline-card">

                <div class="timeline-header">

                  <span class="timeline-time">
                    ${esc(
                      t.date ||
                      t.createdAt ||
                      ''
                    )}
                  </span>

                </div>

                <div class="timeline-meta">
                  ${esc(
                    t.rating
                      ? `評分 ${t.rating}`
                      : ''
                  )}
                </div>

                ${
                  t.notes
                    ? `
                      <div class="timeline-notes">
                        ${esc(t.notes)}
                      </div>
                    `
                    : ''
                }

              </div>
            `)
            .join('')
        }

      </div>

    </div>
  `;
}

async function toggleFavorite(id, rerender = false) {

  const b = (window.cellar || []).find(
    x => String(x.id) === String(id)
  );

  if (!b) {
    return;
  }

  b.isFavorite = !b.isFavorite;

  await saveBottleToDB(b);

  if (rerender) {
    renderBottleDetail(id);
  } else if (currentView === 'cellar') {
    renderCellar();
  } else {
    renderHome();
  }
}

async function deleteBottle(id) {

  if (!confirm('確定要刪除這瓶酒？')) {
    return;
  }

  const idx = (window.cellar || []).findIndex(
    x => String(x.id) === String(id)
  );

  if (idx < 0) {
    return;
  }

  window.cellar.splice(idx, 1);

  await deleteBottleFromDB(id);

  if (currentView === 'cellar') {
    renderCellar();
  } else {
    renderHome();
  }
}

function openCamera() {

  if (cameraInput) {
    cameraInput.click();
  }
}

function openGallery() {

  if (galleryInput) {
    galleryInput.click();
  }
}

if (cameraInput) {
  cameraInput.addEventListener(
    'change',
    e => handleImageFile(e.target.files?.[0])
  );
}

if (galleryInput) {
  galleryInput.addEventListener(
    'change',
    e => handleImageFile(e.target.files?.[0])
  );
}

async function handleImageFile(file) {

  if (!file) {
    return;
  }

  try {

    currentImageData =
      await resizeImage(
        file,
        1600,
        0.85
      );

    showScanLoading();

    const result =
      await identifyBottle(
        currentImageData.data,
        currentImageData.mediaType
      );

    const bottle =
      normalizeBottle({

        id: uid(),

        image:
          currentImageData.dataUrl,

        imageData:
          currentImageData.dataUrl,

        identification:
          result,

        tags: {
          category:
            result.category || '酒類',

          vintage:
            result.vintage || '',

          country:
            result.country || '',

          region:
            result.region || ''
        },

        tastings: [],

        isFavorite: false,

        status: 'unopened',

        addedAt: Date.now()

      });

    window.cellar.unshift(bottle);

    await saveBottleToDB(bottle);

    renderBottleDetail(bottle.id);

  } catch (err) {

    console.error(err);

    showError(
      err?.message ||
      '辨識失敗，請再試一次。'
    );

  } finally {

    if (cameraInput) {
      cameraInput.value = '';
    }

    if (galleryInput) {
      galleryInput.value = '';
    }

  }
}

function resizeImage(
  file,
  maxSize = 1600,
  quality = 0.85
) {

  return new Promise((resolve, reject) => {

    const reader =
      new FileReader();

    reader.onerror = () =>
      reject(
        new Error('無法讀取圖片')
      );

    reader.onload = () => {

      const img = new Image();

      img.onerror = () =>
        reject(
          new Error('圖片格式不支援')
        );

      img.onload = () => {

        let w = img.naturalWidth;
        let h = img.naturalHeight;

        const scale =
          Math.min(
            1,
            maxSize /
              Math.max(w, h)
          );

        w = Math.round(w * scale);
        h = Math.round(h * scale);

        const canvas =
          document.createElement('canvas');

        canvas.width = w;
        canvas.height = h;

        const ctx =
          canvas.getContext('2d');

        ctx.drawImage(
          img,
          0,
          0,
          w,
          h
        );

        const dataUrl =
          canvas.toDataURL(
            'image/jpeg',
            quality
          );

        resolve({

          dataUrl,

          data:
            dataUrl.split(',')[1],

          mediaType:
            'image/jpeg'

        });

      };

      img.src = reader.result;

    };

    reader.readAsDataURL(file);

  });
}

async function identifyBottle(
  image,
  mediaType
) {

  const res =
    await fetch(
      `${WORKER_API_URL}/api/scan`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          image,
          mediaType
        })
      }
    );

  let data = {};

  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {

    throw new Error(
      data.error ||
      `AI API 錯誤 (${res.status})`
    );

  }

  return data || {};
}

function showScanLoading() {

  main.innerHTML = `
    <div class="loading-view">

      <div class="loading-ring"></div>

      <h2
        style="
          font-family:var(--serif);
          font-size:20px
        "
      >
        正在辨識酒標
      </h2>

      <p
        style="
          color:var(--text-muted);
          font-size:12px;
          margin-top:8px
        "
      >
        AI 正在分析酒款、年份及產區…
      </p>

    </div>
  `;
}

function showError(message) {

  main.innerHTML = `
    <div class="loading-view">

      <div
        style="
          font-size:42px;
          margin-bottom:16px
        "
      >
        ⚠️
      </div>

      <h2
        style="
          font-family:var(--serif);
          font-size:20px
        "
      >
        出現問題
      </h2>

      <p
        style="
          color:var(--text-muted);
          font-size:12px;
          margin:10px 20px 20px;
          line-height:1.6
        "
      >
        ${esc(message)}
      </p>

      <button
        class="btn btn-primary"
        onclick="goHome()"
      >
        返回首頁
      </button>

    </div>
  `;
}

async function shareBottle(id) {

  const b =
    (window.cellar || []).find(
      x => String(x.id) === String(id)
    );

  if (!b) {
    return;
  }

  const payload = {

    syncKey:
      localStorage.getItem(
        'bottlesense_sync_key'
      ),

    cellar: [b],

    ownerName: '品飲家'

  };

  try {

    const res =
      await fetch(
        `${WORKER_API_URL}/api/cellar/publish`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify(payload)
        }
      );

    const data =
      await res.json();

    if (!res.ok) {
      throw new Error(
        data.error ||
        '分享失敗'
      );
    }

    const shareUrl =
      `${location.origin}${location.pathname}?cellar=${encodeURIComponent(data.syncKey)}`;

    if (navigator.share) {

      await navigator.share({
        title: 'BottleSense 酒窖',
        text:
          `${bottleName(b)} — 我的酒櫃`,
        url: shareUrl
      });

    } else {

      await navigator.clipboard.writeText(
        shareUrl
      );

      alert('分享連結已複製');

    }

  } catch (e) {

    alert(
      e.message ||
      '分享失敗'
    );

  }
}

async function loadPublicCellar(key) {

  try {

    const res =
      await fetch(
        `${WORKER_API_URL}/api/cellar/get?key=${encodeURIComponent(key)}`
      );

    const data =
      await res.json();

    if (!res.ok) {

      throw new Error(
        data.error ||
        '找不到酒櫃'
      );

    }

    window.cellar =
      Array.isArray(data.cellar)
        ? data.cellar.map(
            normalizeBottle
          )
        : [];

    currentView = 'public';

    setActiveNav('');

    main.innerHTML = `
      <div class="view">

        <div class="section-head">

          <h2>
            ${esc(
              data.ownerName ||
              '公開酒櫃'
            )}
          </h2>

        </div>

        <div class="info-block">

          <div class="storage-row">

            <span class="storage-tag">
              LIKES
            </span>

            <span class="storage-desc">
              ♥ ${Number(data.likes || 0)}
            </span>

          </div>

        </div>

        <div class="shelf-container shelf-bar">

          <div class="shelf-beam"></div>

          ${
            window.cellar.length
              ? window.cellar
                  .map(bottleCardHTML)
                  .join('')
              : `
                <div class="empty-shelf">
                  這個酒櫃目前沒有酒。
                </div>
              `
          }

        </div>

      </div>
    `;

  } catch (e) {

    showError(
      e.message ||
      '無法載入公開酒櫃'
    );

  }
}

function renderSettings() {

  const key =
    localStorage.getItem(
      'bottlesense_sync_key'
    ) || '';

  modalContainer.innerHTML = `

    <div
      class="modal-overlay"
      onclick="
        if(event.target===this)
          closeModal()
      "
    >

      <div class="modal-card">

        <h2
          style="
            font-family:var(--serif);
            margin-bottom:10px
          "
        >
          設定
        </h2>

        <p
          style="
            font-size:11px;
            color:var(--text-muted);
            line-height:1.6
          "
        >
          你的同步代碼
        </p>

        <div
          class="text-input"
          style="text-align:center"
        >
          ${esc(key)}
        </div>

        <button
          class="btn btn-primary btn-block"
          style="margin-top:14px"
          onclick="copySyncKey()"
        >
          複製同步代碼
        </button>

        <button
          class="btn btn-ghost btn-block"
          style="margin-top:8px"
          onclick="closeModal()"
        >
          關閉
        </button>

      </div>

    </div>
  `;
}

function copySyncKey() {

  const key =
    localStorage.getItem(
      'bottlesense_sync_key'
    ) || '';

  if (navigator.clipboard) {
    navigator.clipboard.writeText(key);
  }

  alert('同步代碼已複製');
}

function closeModal() {
  modalContainer.innerHTML = '';
}

async function initApp() {

  try {

    await refreshCellar();

    const params =
      new URLSearchParams(
        location.search
      );

    const publicKey =
      params.get('cellar') ||
      params.get('key');

    if (publicKey) {

      await loadPublicCellar(
        publicKey
      );

      return;
    }

    renderHome();

  } catch (e) {

    console.error(
      'BottleSense init error',
      e
    );

    window.cellar = [];

    renderHome();

  }
}

document.addEventListener(
  'DOMContentLoaded',
  initApp
);
