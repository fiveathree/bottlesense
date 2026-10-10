/* Replaces emoji with refined line icons, everywhere in the UI (text nodes only). */
(function () {
  const P = {
    wine: '<path d="M7 3h10l-.6 6.2A4.4 4.4 0 0 1 12 13a4.4 4.4 0 0 1-4.4-3.8z"/><path d="M12 13v7M8.5 21h7"/>',
    flute: '<path d="M9 3h6l-.7 8a2.3 2.3 0 0 1-4.6 0z"/><path d="M12 13v7M8.5 21h7M10 6.5h4"/>',
    tumbler: '<path d="M5.5 5h13l-1.4 14.2a1.5 1.5 0 0 1-1.5 1.3H8.4a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M6.2 11h11.6"/>',
    bottle: '<path d="M10 3h4v4.2c0 .8.5 1.3 1.2 2A5 5 0 0 1 16.5 12.5V19a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-6.5a5 5 0 0 1 1.3-3.3c.7-.7 1.2-1.2 1.2-2z"/><path d="M8.5 14h7M8.5 17.5h7"/>',
    sake: '<path d="M10.2 3h3.6v3a3 3 0 0 0 1.2 2.4A5.5 5.5 0 0 1 17.2 13v5a3 3 0 0 1-3 3H9.8a3 3 0 0 1-3-3v-5A5.5 5.5 0 0 1 9 8.4 3 3 0 0 0 10.2 6z"/>',
    beer: '<path d="M6 6h9v13a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 6 19z"/><path d="M15 9h2.2a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1-1.8 1.8H15M9 10v6M12 10v6"/><path d="M6 6c0-1.5 1.2-2.5 2.6-2.5 1 0 1.5.4 2.4.4s1.4-.4 2.4-.4C14.9 3.5 15 4.8 15 6"/>',
    martini: '<path d="M4 4h16l-8 9z"/><path d="M12 13v7M8 21h8"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4"/><path d="M5 12v8h14v-8M12 8v12M12 8C10 4 7 5 8 7c.7 1.4 4 1 4 1zm0 0c2-4 5-3 4-1-.7 1.4-4 1-4 1z"/>',
    diamond: '<path d="M6.5 4h11l3.5 5-9 11L3 9z"/><path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8.5 20h7M10 17h4"/>',
    pin: '<path d="M12 21s7-6.2 7-11.2A7 7 0 0 0 5 9.8C5 14.8 12 21 12 21z"/><circle cx="12" cy="10" r="2.4"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
    camera: '<path d="M21 18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V8.5A1.5 1.5 0 0 1 4.5 7H8l1.5-2.5h5L16 7h3.5A1.5 1.5 0 0 1 21 8.5z"/><circle cx="12" cy="13" r="3.6"/>',
    cards: '<rect x="7" y="4" width="12" height="16" rx="1.5"/><path d="M4 7v12a1.5 1.5 0 0 0 1.5 1.5"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3 3 0 0 1 0 5.6M18 14.4c2 .7 3.5 2.6 3.5 5.6"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    wood: '<path d="M3.5 20.5h17"/><path d="M6 20.5v-7.2a1.4 1.4 0 0 1 .9-1.3V6.5h2.2v5.5a1.4 1.4 0 0 1 .9 1.3v7.2"/><path d="M13.5 20.5v-7.2a1.4 1.4 0 0 1 .9-1.3V6.5h2.2v5.5a1.4 1.4 0 0 1 .9 1.3v7.2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="9" cy="10" r="1.5"/><path d="m4 17 5-4.5 4 3 3-2.5 4 3.5"/>',
    pencil: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.5 9.5h4a1.7 1.7 0 0 1 0 3.5h-3a1.7 1.7 0 0 0 0 3.5h4"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    folder: '<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/>',
    download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 20h14"/>',
    alert: '<path d="M12 4 21 19H3z"/><path d="M12 10v4M12 16.8v.1"/>',
    flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
    dish: '<path d="M3 4v6a2 2 0 0 0 2 2v8M7 4v6M21 4c-2 1-3 4-3 7h3v9"/>',
    thermo: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>'
  };
  const MAP = {
    '🍷': 'wine', '🥂': 'flute', '🥃': 'tumbler', '🍾': 'bottle', '🍶': 'sake', '🍺': 'beer', '🍸': 'martini', '🍹': 'martini',
    '🎁': 'gift', '💎': 'diamond', '🏷': 'tag', '🏁': 'trophy', '📍': 'pin', '🔒': 'lock', '🔐': 'lock', '⭐': 'star',
    '📷': 'camera', '🎴': 'cards', '👥': 'users', '🤝': 'link', '👤': 'user', '⚡': 'bolt', '🪵': 'wood', '🧊': 'bolt',
    '🌍': 'globe', '🌐': 'globe', '🗺': 'globe', '📲': 'phone', '📨': 'mail', '✉': 'mail', '✨': 'sparkle', '🎉': 'sparkle', '🎂': 'sparkle',
    '🖼': 'image', '✏': 'pencil', '📝': 'pencil', '🗑': 'trash', '⚙': 'gear', '🛒': 'bag', '🕒': 'clock', '📅': 'clock', '☁': 'cloud',
    '💰': 'coin', '🎟': 'tag', '🔑': 'key', '🚫': 'ban', '🗂': 'folder', '⬇': 'download', '⚠': 'alert', '⚑': 'flag', '🍽': 'dish', '🌡': 'thermo'
  };
  const RANK = { '🥇': '1', '🥈': '2', '🥉': '3' };
  const REMOVE = ['🎲', '🎯', '👀', '💡', '🍎', '🤖', '💻'];
  const keys = Object.keys(MAP).concat(Object.keys(RANK), REMOVE);
  const RE = new RegExp('(' + keys.join('|') + ')️?|️', 'g');
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SVG: 1, svg: 1, OPTION: 2 };

  function iconSvg(name) {
    return '<span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24">' + (P[name] || '') + '</svg></span>';
  }
  window.BSIcon = iconSvg;

  function procText(tn) {
    const txt = tn.nodeValue;
    if (!txt || !RE.test(txt)) { RE.lastIndex = 0; return; }
    RE.lastIndex = 0;
    const parent = tn.parentNode;
    if (!parent) return;
    const inOption = parent.nodeName === 'OPTION';
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = RE.exec(txt))) {
      if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      const ch = m[1];
      if (ch && !inOption) {
        if (MAP[ch]) { const w = document.createElement('span'); w.innerHTML = iconSvg(MAP[ch]); frag.appendChild(w.firstChild); }
        else if (RANK[ch]) { const r = document.createElement('span'); r.className = 'ico-rank'; r.textContent = RANK[ch]; frag.appendChild(r); }
      }
      last = RE.lastIndex;
    }
    if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
    parent.replaceChild(frag, tn);
  }

  function proc(node) {
    if (!node) return;
    if (node.nodeType === 3) { if (!SKIP[node.parentNode && node.parentNode.nodeName]) procText(node); return; }
    if (node.nodeType !== 1 || SKIP[node.nodeName]) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    const list = [];
    while (walker.nextNode()) {
      const p = walker.currentNode.parentNode;
      if (p && !SKIP[p.nodeName] && !(p.closest && p.closest('svg'))) list.push(walker.currentNode);
    }
    list.forEach(procText);
  }

  function start() {
    proc(document.body);
    new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'characterData') proc(m.target);
        else m.addedNodes.forEach(proc);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
